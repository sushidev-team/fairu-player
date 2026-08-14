import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useResumePosition } from './useResumePosition';
import { resetStorageAvailability, readStored } from '@/utils/storage';

describe('useResumePosition', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStorageAvailability();
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offers nothing to resume for a track that was never played', () => {
    const { result } = renderHook(() => useResumePosition({ trackId: 'ep-1' }));
    expect(result.current.resumeAt).toBeNull();
    expect(result.current.entry).toBeNull();
  });

  it('remembers a position and offers it back', () => {
    const { result, rerender } = renderHook(() =>
      useResumePosition({ trackId: 'ep-1' })
    );

    act(() => result.current.save(120, 600));
    rerender();

    expect(result.current.resumeAt).toBe(120);
    expect(result.current.entry?.completed).toBe(false);
  });

  it('ignores a position below minPosition', () => {
    const { result, rerender } = renderHook(() =>
      useResumePosition({ trackId: 'ep-1', minPosition: 30 })
    );

    act(() => result.current.save(12, 600));
    rerender();

    // Stored, but not offered — a stray tap at the start is not a resume point.
    expect(result.current.entry?.position).toBe(12);
    expect(result.current.resumeAt).toBeNull();
  });

  it('stops offering a resume point once the track is effectively finished', () => {
    const { result, rerender } = renderHook(() =>
      useResumePosition({ trackId: 'ep-1', completedThreshold: 0.95 })
    );

    act(() => result.current.save(580, 600)); // 96.7 %
    rerender();

    expect(result.current.entry?.completed).toBe(true);
    expect(result.current.resumeAt).toBeNull();
  });

  it('keeps positions for different tracks apart', () => {
    const { result, rerender } = renderHook(
      ({ id }) => useResumePosition({ trackId: id }),
      { initialProps: { id: 'ep-1' } }
    );

    act(() => result.current.save(120, 600));
    rerender({ id: 'ep-2' });

    expect(result.current.resumeAt).toBeNull();

    act(() => result.current.save(300, 600));
    rerender({ id: 'ep-1' });

    expect(result.current.resumeAt).toBe(120);
  });

  it('throttles writes while playing', () => {
    const { result, rerender } = renderHook(() =>
      useResumePosition({ trackId: 'ep-1', saveInterval: 5000 })
    );

    act(() => result.current.save(100, 600));
    rerender();
    expect(result.current.entry?.position).toBe(100);

    // Same simulated instant — inside the throttle window, so dropped.
    act(() => result.current.save(101, 600));
    rerender();
    expect(result.current.entry?.position).toBe(100);

    vi.spyOn(Date, 'now').mockReturnValue(1_000_000 + 6000);
    act(() => result.current.save(130, 600));
    rerender();
    expect(result.current.entry?.position).toBe(130);
  });

  it('never throttles away the write that marks a track complete', () => {
    const { result, rerender } = renderHook(() =>
      useResumePosition({ trackId: 'ep-1', saveInterval: 5000 })
    );

    act(() => result.current.save(100, 600));
    rerender();

    // Still inside the throttle window, but this one flips `completed`, which
    // is a one-shot state change rather than a running position.
    act(() => result.current.save(599, 600));
    rerender();

    expect(result.current.entry?.completed).toBe(true);
  });

  it('markCompleted clears the resume point', () => {
    const { result, rerender } = renderHook(() =>
      useResumePosition({ trackId: 'ep-1' })
    );

    act(() => result.current.save(120, 600));
    rerender();
    expect(result.current.resumeAt).toBe(120);

    act(() => result.current.markCompleted());
    rerender();
    expect(result.current.resumeAt).toBeNull();
  });

  it('clear forgets one track, clearAll forgets everything', () => {
    const { result, rerender } = renderHook(
      ({ id }) => useResumePosition({ trackId: id }),
      { initialProps: { id: 'ep-1' } }
    );

    act(() => result.current.save(120, 600));
    rerender({ id: 'ep-2' });
    act(() => result.current.save(300, 600));

    act(() => result.current.clear());
    rerender({ id: 'ep-1' });
    expect(result.current.resumeAt).toBe(120);

    act(() => result.current.clearAll());
    rerender({ id: 'ep-1' });
    expect(result.current.resumeAt).toBeNull();
  });

  it('evicts the oldest entries past maxEntries', () => {
    const { result, rerender } = renderHook(
      ({ id }) => useResumePosition({ trackId: id, maxEntries: 2, saveInterval: 0 }),
      { initialProps: { id: 'a' } }
    );

    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    act(() => result.current.save(100, 600));
    rerender({ id: 'b' });

    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    act(() => result.current.save(100, 600));
    rerender({ id: 'c' });

    vi.spyOn(Date, 'now').mockReturnValue(3_000);
    act(() => result.current.save(100, 600));

    const stored = readStored<Record<string, unknown>>('resume');
    expect(Object.keys(stored ?? {}).sort()).toEqual(['b', 'c']);
  });

  it('writes nothing when disabled', () => {
    const { result } = renderHook(() =>
      useResumePosition({ trackId: 'ep-1', enabled: false })
    );

    act(() => result.current.save(120, 600));

    expect(readStored('resume')).toBeNull();
  });

  it('keeps separate scopes from colliding', () => {
    const a = renderHook(() => useResumePosition({ trackId: 'ep-1', scope: 'sidebar' }));
    act(() => a.result.current.save(120, 600));

    const b = renderHook(() => useResumePosition({ trackId: 'ep-1', scope: 'hero' }));
    expect(b.result.current.resumeAt).toBeNull();
  });

  it('is inert without a trackId', () => {
    const { result } = renderHook(() => useResumePosition({}));
    act(() => result.current.save(120, 600));
    expect(result.current.resumeAt).toBeNull();
    expect(readStored('resume')).toBeNull();
  });

  it('ignores a non-finite position', () => {
    const { result, rerender } = renderHook(() =>
      useResumePosition({ trackId: 'ep-1' })
    );

    act(() => result.current.save(NaN, 600));
    rerender();
    expect(result.current.entry).toBeNull();
  });
});
