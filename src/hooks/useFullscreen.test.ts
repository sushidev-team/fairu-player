import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFullscreen } from './useFullscreen';
import type { RefObject } from 'react';

function createContainerRef(): RefObject<HTMLDivElement> {
  const div = document.createElement('div');
  return { current: div };
}

describe('useFullscreen', () => {
  let originalFullscreenEnabled: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fullscreen state
    (document as any).fullscreenElement = null;
    originalFullscreenEnabled = (document as any).fullscreenEnabled;
    Object.defineProperty(document, 'fullscreenEnabled', {
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(document, 'fullscreenEnabled', {
      writable: true,
      value: originalFullscreenEnabled,
    });
  });

  // ─── Initial State ──────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts not fullscreen', () => {
      const ref = createContainerRef();
      const { result } = renderHook(() => useFullscreen(ref));

      expect(result.current.isFullscreen).toBe(false);
    });

    it('reports fullscreen as supported when fullscreenEnabled is true', () => {
      const ref = createContainerRef();
      const { result } = renderHook(() => useFullscreen(ref));

      expect(result.current.isSupported).toBe(true);
    });

    it('reports fullscreen as supported via webkit prefix', () => {
      Object.defineProperty(document, 'fullscreenEnabled', {
        writable: true,
        value: false,
      });
      (document as any).webkitFullscreenEnabled = true;

      const ref = createContainerRef();
      const { result } = renderHook(() => useFullscreen(ref));

      expect(result.current.isSupported).toBe(true);

      delete (document as any).webkitFullscreenEnabled;
    });

    it('provides enterFullscreen, exitFullscreen, toggleFullscreen methods', () => {
      const ref = createContainerRef();
      const { result } = renderHook(() => useFullscreen(ref));

      expect(typeof result.current.enterFullscreen).toBe('function');
      expect(typeof result.current.exitFullscreen).toBe('function');
      expect(typeof result.current.toggleFullscreen).toBe('function');
    });
  });

  // ─── Enter Fullscreen ──────────────────────────────────────────────

  describe('enterFullscreen', () => {
    it('calls requestFullscreen on the container ref element', async () => {
      const ref = createContainerRef();
      const requestSpy = vi.fn().mockResolvedValue(undefined);
      ref.current!.requestFullscreen = requestSpy;

      const { result } = renderHook(() => useFullscreen(ref));

      await act(async () => {
        await result.current.enterFullscreen();
      });

      expect(requestSpy).toHaveBeenCalledTimes(1);
    });

    it('calls requestFullscreen on a custom element when provided', async () => {
      const ref = createContainerRef();
      const customEl = document.createElement('div');
      const requestSpy = vi.fn().mockResolvedValue(undefined);
      customEl.requestFullscreen = requestSpy;

      const { result } = renderHook(() => useFullscreen(ref));

      await act(async () => {
        await result.current.enterFullscreen(customEl);
      });

      expect(requestSpy).toHaveBeenCalledTimes(1);
    });

    it('does nothing when ref.current is null and no element passed', async () => {
      const ref = { current: null } as RefObject<HTMLDivElement>;
      const { result } = renderHook(() => useFullscreen(ref));

      // Should not throw
      await act(async () => {
        await result.current.enterFullscreen();
      });
    });

    it('falls back to webkitRequestFullscreen', async () => {
      const ref = createContainerRef();
      // Shadow the prototype method with undefined on the instance
      Object.defineProperty(ref.current!, 'requestFullscreen', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      const webkitSpy = vi.fn().mockResolvedValue(undefined);
      (ref.current as any).webkitRequestFullscreen = webkitSpy;

      const { result } = renderHook(() => useFullscreen(ref));

      await act(async () => {
        await result.current.enterFullscreen();
      });

      expect(webkitSpy).toHaveBeenCalledTimes(1);
    });

    it('falls back to mozRequestFullScreen', async () => {
      const ref = createContainerRef();
      Object.defineProperty(ref.current!, 'requestFullscreen', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      const mozSpy = vi.fn().mockResolvedValue(undefined);
      (ref.current as any).mozRequestFullScreen = mozSpy;

      const { result } = renderHook(() => useFullscreen(ref));

      await act(async () => {
        await result.current.enterFullscreen();
      });

      expect(mozSpy).toHaveBeenCalledTimes(1);
    });

    it('falls back to msRequestFullscreen', async () => {
      const ref = createContainerRef();
      Object.defineProperty(ref.current!, 'requestFullscreen', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      const msSpy = vi.fn().mockResolvedValue(undefined);
      (ref.current as any).msRequestFullscreen = msSpy;

      const { result } = renderHook(() => useFullscreen(ref));

      await act(async () => {
        await result.current.enterFullscreen();
      });

      expect(msSpy).toHaveBeenCalledTimes(1);
    });

    it('handles requestFullscreen rejection gracefully', async () => {
      const ref = createContainerRef();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      ref.current!.requestFullscreen = vi.fn().mockRejectedValue(new Error('Not allowed'));

      const { result } = renderHook(() => useFullscreen(ref));

      await act(async () => {
        await result.current.enterFullscreen();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to enter fullscreen:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  // ─── Exit Fullscreen ───────────────────────────────────────────────

  describe('exitFullscreen', () => {
    it('calls document.exitFullscreen', async () => {
      const ref = createContainerRef();
      const exitSpy = vi.fn().mockResolvedValue(undefined);
      (document as any).exitFullscreen = exitSpy;

      const { result } = renderHook(() => useFullscreen(ref));

      await act(async () => {
        await result.current.exitFullscreen();
      });

      expect(exitSpy).toHaveBeenCalledTimes(1);
    });

    it('falls back to webkitExitFullscreen', async () => {
      const ref = createContainerRef();
      delete (document as any).exitFullscreen;
      const webkitSpy = vi.fn().mockResolvedValue(undefined);
      (document as any).webkitExitFullscreen = webkitSpy;

      const { result } = renderHook(() => useFullscreen(ref));

      await act(async () => {
        await result.current.exitFullscreen();
      });

      expect(webkitSpy).toHaveBeenCalledTimes(1);

      // Restore
      delete (document as any).webkitExitFullscreen;
      (document as any).exitFullscreen = vi.fn().mockResolvedValue(undefined);
    });

    it('handles exitFullscreen rejection gracefully', async () => {
      const ref = createContainerRef();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (document as any).exitFullscreen = vi.fn().mockRejectedValue(new Error('Not allowed'));

      const { result } = renderHook(() => useFullscreen(ref));

      await act(async () => {
        await result.current.exitFullscreen();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to exit fullscreen:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();

      // Restore
      (document as any).exitFullscreen = vi.fn().mockResolvedValue(undefined);
    });
  });

  // ─── Toggle Fullscreen ─────────────────────────────────────────────

  describe('toggleFullscreen', () => {
    it('enters fullscreen when not in fullscreen', async () => {
      const ref = createContainerRef();
      const requestSpy = vi.fn().mockResolvedValue(undefined);
      ref.current!.requestFullscreen = requestSpy;

      const { result } = renderHook(() => useFullscreen(ref));

      await act(async () => {
        await result.current.toggleFullscreen();
      });

      expect(requestSpy).toHaveBeenCalledTimes(1);
    });

    it('exits fullscreen when in fullscreen', async () => {
      const ref = createContainerRef();
      const exitSpy = vi.fn().mockResolvedValue(undefined);
      (document as any).exitFullscreen = exitSpy;

      const { result } = renderHook(() => useFullscreen(ref));

      // Simulate entering fullscreen
      (document as any).fullscreenElement = ref.current;
      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'));
      });

      expect(result.current.isFullscreen).toBe(true);

      await act(async () => {
        await result.current.toggleFullscreen();
      });

      expect(exitSpy).toHaveBeenCalled();
    });
  });

  // ─── Fullscreen Change Events ──────────────────────────────────────

  describe('fullscreen change events', () => {
    it('updates isFullscreen to true when entering fullscreen', () => {
      const ref = createContainerRef();
      const { result } = renderHook(() => useFullscreen(ref));

      (document as any).fullscreenElement = ref.current;

      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'));
      });

      expect(result.current.isFullscreen).toBe(true);
    });

    it('updates isFullscreen to false when exiting fullscreen', () => {
      const ref = createContainerRef();
      const { result } = renderHook(() => useFullscreen(ref));

      // Enter fullscreen
      (document as any).fullscreenElement = ref.current;
      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'));
      });
      expect(result.current.isFullscreen).toBe(true);

      // Exit fullscreen
      (document as any).fullscreenElement = null;
      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'));
      });
      expect(result.current.isFullscreen).toBe(false);
    });

    it('calls onChange callback when entering fullscreen', () => {
      const onChange = vi.fn();
      const ref = createContainerRef();
      renderHook(() => useFullscreen(ref, { onChange }));

      (document as any).fullscreenElement = ref.current;

      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'));
      });

      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('calls onChange callback when exiting fullscreen', () => {
      const onChange = vi.fn();
      const ref = createContainerRef();
      renderHook(() => useFullscreen(ref, { onChange }));

      // Enter
      (document as any).fullscreenElement = ref.current;
      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'));
      });

      // Exit
      (document as any).fullscreenElement = null;
      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'));
      });

      expect(onChange).toHaveBeenCalledWith(false);
    });

    it('responds to webkitfullscreenchange event', () => {
      const ref = createContainerRef();
      const { result } = renderHook(() => useFullscreen(ref));

      (document as any).fullscreenElement = ref.current;

      act(() => {
        document.dispatchEvent(new Event('webkitfullscreenchange'));
      });

      expect(result.current.isFullscreen).toBe(true);
    });

    it('responds to mozfullscreenchange event', () => {
      const ref = createContainerRef();
      const { result } = renderHook(() => useFullscreen(ref));

      (document as any).fullscreenElement = ref.current;

      act(() => {
        document.dispatchEvent(new Event('mozfullscreenchange'));
      });

      expect(result.current.isFullscreen).toBe(true);
    });

    it('responds to MSFullscreenChange event', () => {
      const ref = createContainerRef();
      const { result } = renderHook(() => useFullscreen(ref));

      (document as any).fullscreenElement = ref.current;

      act(() => {
        document.dispatchEvent(new Event('MSFullscreenChange'));
      });

      expect(result.current.isFullscreen).toBe(true);
    });
  });

  // ─── Cleanup ───────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('removes event listeners on unmount', () => {
      const ref = createContainerRef();
      const removeSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() => useFullscreen(ref));

      unmount();

      const removedEvents = removeSpy.mock.calls.map(([event]) => event);
      expect(removedEvents).toContain('fullscreenchange');
      expect(removedEvents).toContain('webkitfullscreenchange');
      expect(removedEvents).toContain('mozfullscreenchange');
      expect(removedEvents).toContain('MSFullscreenChange');

      removeSpy.mockRestore();
    });
  });

  // ─── isSupported ───────────────────────────────────────────────────

  describe('isSupported', () => {
    it('returns false when fullscreen is not enabled', () => {
      Object.defineProperty(document, 'fullscreenEnabled', {
        writable: true,
        value: false,
      });

      const ref = createContainerRef();
      const { result } = renderHook(() => useFullscreen(ref));

      expect(result.current.isSupported).toBeFalsy();
    });
  });
});
