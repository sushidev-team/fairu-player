import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePersistentPreferences } from './usePersistentPreferences';
import { resetStorageAvailability, readStored, writeStored } from '@/utils/storage';
import type { PersistedPreferences } from '@/types/persistence';

describe('usePersistentPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStorageAvailability();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to the defaults when nothing is stored', () => {
    const { result } = renderHook(() =>
      usePersistentPreferences({ defaults: { volume: 0.8, muted: false } })
    );

    expect(result.current.preferences.volume).toBe(0.8);
    expect(result.current.preferences.muted).toBe(false);
    expect(result.current.isHydrated).toBe(true);
  });

  it('lets a stored value win over the default', () => {
    writeStored<PersistedPreferences>('preferences', { volume: 0.2 });

    const { result } = renderHook(() =>
      usePersistentPreferences({ defaults: { volume: 0.8, muted: false } })
    );

    expect(result.current.preferences.volume).toBe(0.2);
    // Defaults still fill the gaps the stored value does not cover.
    expect(result.current.preferences.muted).toBe(false);
  });

  it('persists an update', () => {
    const { result } = renderHook(() => usePersistentPreferences());

    act(() => result.current.update({ volume: 0.35 }));

    expect(result.current.preferences.volume).toBe(0.35);
    expect(readStored<PersistedPreferences>('preferences')?.volume).toBe(0.35);
  });

  it('merges patches rather than replacing the whole record', () => {
    const { result } = renderHook(() => usePersistentPreferences());

    act(() => result.current.update({ volume: 0.5 }));
    act(() => result.current.update({ muted: true }));

    expect(result.current.preferences).toMatchObject({ volume: 0.5, muted: true });
  });

  it('round-trips a muted state of false without losing it to the default', () => {
    writeStored<PersistedPreferences>('preferences', { muted: false });

    const { result } = renderHook(() =>
      usePersistentPreferences({ defaults: { muted: true } })
    );

    expect(result.current.preferences.muted).toBe(false);
  });

  it('reset drops the stored record and returns to the defaults', () => {
    const { result } = renderHook(() =>
      usePersistentPreferences({ defaults: { volume: 0.8 } })
    );

    act(() => result.current.update({ volume: 0.1 }));
    expect(result.current.preferences.volume).toBe(0.1);

    act(() => result.current.reset());

    expect(result.current.preferences.volume).toBe(0.8);
    expect(readStored('preferences')).toBeNull();
  });

  it('writes nothing when disabled', () => {
    const { result } = renderHook(() =>
      usePersistentPreferences({ enabled: false, defaults: { volume: 0.8 } })
    );

    act(() => result.current.update({ volume: 0.1 }));

    // In-memory state still tracks the change so the UI stays responsive.
    expect(result.current.preferences.volume).toBe(0.1);
    expect(readStored('preferences')).toBeNull();
  });

  it('ignores a stored record when disabled', () => {
    writeStored<PersistedPreferences>('preferences', { volume: 0.2 });

    const { result } = renderHook(() =>
      usePersistentPreferences({ enabled: false, defaults: { volume: 0.8 } })
    );

    expect(result.current.preferences.volume).toBe(0.8);
  });

  it('keeps separate scopes from colliding', () => {
    const a = renderHook(() => usePersistentPreferences({ scope: 'hero' }));
    act(() => a.result.current.update({ volume: 0.1 }));

    const b = renderHook(() => usePersistentPreferences({ scope: 'sidebar' }));
    expect(b.result.current.preferences.volume).toBeUndefined();
  });

  it('discards a record older than maxAge', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    writeStored<PersistedPreferences>('preferences', { volume: 0.2 });

    vi.spyOn(Date, 'now').mockReturnValue(1_000 + 60_000);
    const { result } = renderHook(() =>
      usePersistentPreferences({ maxAge: 30_000, defaults: { volume: 0.8 } })
    );

    expect(result.current.preferences.volume).toBe(0.8);
  });

  it('does not re-read and clobber changes when defaults are a fresh literal', () => {
    // Callers pass an object literal, which is a new reference every render.
    // If that fed the read effect, every render would reset the user's change.
    const { result, rerender } = renderHook(() =>
      usePersistentPreferences({ defaults: { volume: 0.8 } })
    );

    act(() => result.current.update({ volume: 0.15 }));
    rerender();
    rerender();

    expect(result.current.preferences.volume).toBe(0.15);
  });

  it('degrades to in-memory state when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    const { result } = renderHook(() => usePersistentPreferences());

    expect(() => act(() => result.current.update({ volume: 0.4 }))).not.toThrow();
    expect(result.current.preferences.volume).toBe(0.4);
  });
});
