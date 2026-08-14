import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTabVisibility } from './useTabVisibility';

/** Set `document.hidden` and fire the event the browser would. */
function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('useTabVisibility', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts visible for a foreground tab', () => {
      const { result } = renderHook(() => useTabVisibility());
      expect(result.current.isTabVisible).toBe(true);
      expect(result.current.hiddenSince).toBeNull();
    });

    it('starts hidden when the page is already backgrounded', () => {
      // A player mounted in a background tab — prerendering, or a tab restored
      // on session resume.
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });

      const { result } = renderHook(() => useTabVisibility());
      expect(result.current.isTabVisible).toBe(false);
    });
  });

  describe('transitions', () => {
    it('goes hidden when the tab is backgrounded', () => {
      const { result } = renderHook(() => useTabVisibility());

      setHidden(true);

      expect(result.current.isTabVisible).toBe(false);
    });

    it('comes back visible', () => {
      const { result } = renderHook(() => useTabVisibility());

      setHidden(true);
      setHidden(false);

      expect(result.current.isTabVisible).toBe(true);
      expect(result.current.hiddenSince).toBeNull();
    });

    it('calls onHidden when backgrounded', () => {
      const onHidden = vi.fn();
      renderHook(() => useTabVisibility({ onHidden }));

      setHidden(true);

      expect(onHidden).toHaveBeenCalledOnce();
    });

    it('calls onVisible when restored', () => {
      const onVisible = vi.fn();
      renderHook(() => useTabVisibility({ onVisible }));

      setHidden(true);
      setHidden(false);

      expect(onVisible).toHaveBeenCalledOnce();
    });
  });

  describe('hidden duration', () => {
    it('reports how long the tab was away, in seconds', () => {
      // This number is what drives the return-ad decision, so it has to be
      // seconds rather than milliseconds.
      const onVisible = vi.fn();
      vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

      renderHook(() => useTabVisibility({ onVisible }));
      setHidden(true);

      vi.spyOn(Date, 'now').mockReturnValue(1_000_000 + 30_000);
      setHidden(false);

      expect(onVisible).toHaveBeenCalledWith(30);
    });

    it('reports 0 for a visibility event with no preceding hide', () => {
      const onVisible = vi.fn();
      renderHook(() => useTabVisibility({ onVisible }));

      setHidden(false);

      expect(onVisible).toHaveBeenCalledWith(0);
    });

    it('measures each hide separately rather than accumulating', () => {
      const onVisible = vi.fn();
      vi.spyOn(Date, 'now').mockReturnValue(0);
      renderHook(() => useTabVisibility({ onVisible }));

      setHidden(true);
      vi.spyOn(Date, 'now').mockReturnValue(10_000);
      setHidden(false);

      vi.spyOn(Date, 'now').mockReturnValue(50_000);
      setHidden(true);
      vi.spyOn(Date, 'now').mockReturnValue(55_000);
      setHidden(false);

      expect(onVisible).toHaveBeenNthCalledWith(1, 10);
      expect(onVisible).toHaveBeenNthCalledWith(2, 5);
    });

    it('reports fractional seconds', () => {
      const onVisible = vi.fn();
      vi.spyOn(Date, 'now').mockReturnValue(0);
      renderHook(() => useTabVisibility({ onVisible }));

      setHidden(true);
      vi.spyOn(Date, 'now').mockReturnValue(1500);
      setHidden(false);

      expect(onVisible).toHaveBeenCalledWith(1.5);
    });
  });

  describe('callback identity', () => {
    it('calls the latest callback after a rerender', () => {
      // The listener is registered once with an empty dependency array, so the
      // callbacks are held in refs. Without that, a parent re-render would
      // leave a stale closure attached.
      const first = vi.fn();
      const second = vi.fn();

      const { rerender } = renderHook(
        ({ onHidden }) => useTabVisibility({ onHidden }),
        { initialProps: { onHidden: first } }
      );

      rerender({ onHidden: second });
      setHidden(true);

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledOnce();
    });

    it('does not re-register the listener on every render', () => {
      const addEventListener = vi.spyOn(document, 'addEventListener');

      const { rerender } = renderHook(() => useTabVisibility({ onHidden: () => {} }));
      const afterMount = addEventListener.mock.calls.filter(
        ([type]) => type === 'visibilitychange'
      ).length;

      rerender();
      rerender();

      const afterRerenders = addEventListener.mock.calls.filter(
        ([type]) => type === 'visibilitychange'
      ).length;

      expect(afterRerenders).toBe(afterMount);
    });
  });

  describe('teardown', () => {
    it('detaches its listener on unmount', () => {
      const onHidden = vi.fn();
      const { unmount } = renderHook(() => useTabVisibility({ onHidden }));

      unmount();
      setHidden(true);

      expect(onHidden).not.toHaveBeenCalled();
    });
  });

  describe('options are optional', () => {
    it('works with no callbacks at all', () => {
      expect(() => {
        renderHook(() => useTabVisibility());
        setHidden(true);
        setHidden(false);
      }).not.toThrow();
    });
  });
});
