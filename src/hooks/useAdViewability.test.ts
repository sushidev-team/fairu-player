import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdViewability } from './useAdViewability';

/**
 * A controllable IntersectionObserver: tests drive the ratio directly instead of
 * trying to make jsdom lay anything out.
 */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly callback: IntersectionObserverCallback;
  disconnected = false;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }

  observe() {}
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }

  /** Report an intersection ratio to the hook. */
  emit(ratio: number) {
    this.callback(
      [{ intersectionRatio: ratio } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }

  static latest() {
    return FakeIntersectionObserver.instances[FakeIntersectionObserver.instances.length - 1];
  }
}

/** A ref pointing at a real element, so the hook has something to observe. */
function elementRef() {
  return { current: document.createElement('video') };
}

describe('useAdViewability', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('resolves viewable after 2 continuous seconds at 50 %', () => {
    const onResolve = vi.fn();
    const { result } = renderHook(() =>
      useAdViewability(elementRef(), { playing: true, onResolve })
    );

    act(() => FakeIntersectionObserver.latest().emit(0.6));
    expect(onResolve).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(1999));
    expect(onResolve).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(1));
    expect(onResolve).toHaveBeenCalledExactlyOnceWith('viewable');
    expect(result.current.state).toBe('viewable');
  });

  it('does not count time below the threshold', () => {
    const onResolve = vi.fn();
    renderHook(() => useAdViewability(elementRef(), { playing: true, onResolve }));

    act(() => FakeIntersectionObserver.latest().emit(0.49));
    act(() => void vi.advanceTimersByTime(5000));

    expect(onResolve).not.toHaveBeenCalled();
  });

  it('stops the clock when the ad is paused', () => {
    const onResolve = vi.fn();
    const ref = elementRef();
    const { rerender } = renderHook(
      ({ playing }) => useAdViewability(ref, { playing, onResolve }),
      { initialProps: { playing: true } }
    );

    act(() => FakeIntersectionObserver.latest().emit(1));
    act(() => void vi.advanceTimersByTime(1500));

    // A paused frame is not viewing time.
    rerender({ playing: false });
    act(() => void vi.advanceTimersByTime(5000));
    expect(onResolve).not.toHaveBeenCalled();

    // Banked time is kept, so only the remaining 500 ms are owed.
    rerender({ playing: true });
    act(() => void vi.advanceTimersByTime(499));
    expect(onResolve).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(1));
    expect(onResolve).toHaveBeenCalledWith('viewable');
  });

  it('stops the clock when the element scrolls out of view', () => {
    const onResolve = vi.fn();
    renderHook(() => useAdViewability(elementRef(), { playing: true, onResolve }));

    act(() => FakeIntersectionObserver.latest().emit(1));
    act(() => void vi.advanceTimersByTime(1000));

    act(() => FakeIntersectionObserver.latest().emit(0));
    act(() => void vi.advanceTimersByTime(5000));
    expect(onResolve).not.toHaveBeenCalled();

    act(() => FakeIntersectionObserver.latest().emit(1));
    act(() => void vi.advanceTimersByTime(1000));
    expect(onResolve).toHaveBeenCalledWith('viewable');
  });

  it('stops the clock while the tab is hidden', () => {
    // An IntersectionObserver still reports the element as intersecting in a
    // backgrounded tab, so this is not covered by the observer alone.
    const onResolve = vi.fn();
    renderHook(() => useAdViewability(elementRef(), { playing: true, onResolve }));

    act(() => FakeIntersectionObserver.latest().emit(1));

    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => void vi.advanceTimersByTime(5000));
    expect(onResolve).not.toHaveBeenCalled();

    visibility.mockReturnValue('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => void vi.advanceTimersByTime(2000));
    expect(onResolve).toHaveBeenCalledWith('viewable');

    visibility.mockRestore();
  });

  it('reports notViewable when the ad ends without ever qualifying', () => {
    const onResolve = vi.fn();
    const { result } = renderHook(() =>
      useAdViewability(elementRef(), { playing: true, onResolve })
    );

    act(() => FakeIntersectionObserver.latest().emit(0.2));
    act(() => void vi.advanceTimersByTime(1000));
    act(() => result.current.finalize());

    // Owing nothing at all would be the bug: the ad server sent a NotViewable
    // pixel precisely for this case.
    expect(onResolve).toHaveBeenCalledExactlyOnceWith('notViewable');
  });

  it('resolves only once', () => {
    const onResolve = vi.fn();
    const { result } = renderHook(() =>
      useAdViewability(elementRef(), { playing: true, onResolve })
    );

    act(() => FakeIntersectionObserver.latest().emit(1));
    act(() => void vi.advanceTimersByTime(2000));
    act(() => result.current.finalize());
    act(() => result.current.finalize());

    expect(onResolve).toHaveBeenCalledExactlyOnceWith('viewable');
  });

  it('reports undetermined when the browser cannot measure', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const onResolve = vi.fn();

    renderHook(() => useAdViewability(elementRef(), { playing: true, onResolve }));

    expect(onResolve).toHaveBeenCalledExactlyOnceWith('undetermined');
  });

  it('reports undetermined when measurement is disabled', () => {
    const onResolve = vi.fn();
    renderHook(() =>
      useAdViewability(elementRef(), { playing: true, enabled: false, onResolve })
    );

    expect(onResolve).toHaveBeenCalledExactlyOnceWith('undetermined');
  });

  it('honours a custom threshold and duration', () => {
    const onResolve = vi.fn();
    renderHook(() =>
      useAdViewability(elementRef(), {
        playing: true,
        threshold: 1,
        durationMs: 500,
        onResolve,
      })
    );

    act(() => FakeIntersectionObserver.latest().emit(0.9));
    act(() => void vi.advanceTimersByTime(2000));
    expect(onResolve).not.toHaveBeenCalled();

    act(() => FakeIntersectionObserver.latest().emit(1));
    act(() => void vi.advanceTimersByTime(500));
    expect(onResolve).toHaveBeenCalledWith('viewable');
  });
});
