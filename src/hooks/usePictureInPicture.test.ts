import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePictureInPicture } from './usePictureInPicture';
import { createMockVideoElement } from '@/test/helpers';
import type { RefObject } from 'react';

function createVideoRef(overrides: Partial<HTMLVideoElement> = {}): RefObject<HTMLVideoElement> {
  const video = createMockVideoElement(overrides);
  return { current: video };
}

describe('usePictureInPicture', () => {
  let originalPipEnabled: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    originalPipEnabled = (document as any).pictureInPictureEnabled;
    Object.defineProperty(document, 'pictureInPictureEnabled', {
      writable: true,
      value: true,
    });
    (document as any).pictureInPictureElement = null;
  });

  afterEach(() => {
    Object.defineProperty(document, 'pictureInPictureEnabled', {
      writable: true,
      value: originalPipEnabled,
    });
  });

  // ─── Initial State ──────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts not in PiP mode', () => {
      const ref = createVideoRef();
      const { result } = renderHook(() => usePictureInPicture(ref));

      expect(result.current.isPictureInPicture).toBe(false);
    });

    it('reports PiP as supported when pictureInPictureEnabled is true', () => {
      const ref = createVideoRef();
      const { result } = renderHook(() => usePictureInPicture(ref));

      expect(result.current.isSupported).toBe(true);
    });

    it('reports PiP as not supported when pictureInPictureEnabled is false', () => {
      Object.defineProperty(document, 'pictureInPictureEnabled', {
        writable: true,
        value: false,
      });

      const ref = createVideoRef();
      const { result } = renderHook(() => usePictureInPicture(ref));

      expect(result.current.isSupported).toBe(false);
    });

    it('provides all control methods', () => {
      const ref = createVideoRef();
      const { result } = renderHook(() => usePictureInPicture(ref));

      expect(typeof result.current.enterPictureInPicture).toBe('function');
      expect(typeof result.current.exitPictureInPicture).toBe('function');
      expect(typeof result.current.togglePictureInPicture).toBe('function');
    });
  });

  // ─── Enter PiP ────────────────────────────────────────────────────

  describe('enterPictureInPicture', () => {
    it('calls requestPictureInPicture on the video element', async () => {
      const ref = createVideoRef();
      const requestSpy = vi.fn().mockResolvedValue(document.createElement('div'));
      ref.current!.requestPictureInPicture = requestSpy;

      const { result } = renderHook(() => usePictureInPicture(ref));

      await act(async () => {
        await result.current.enterPictureInPicture();
      });

      expect(requestSpy).toHaveBeenCalledTimes(1);
    });

    it('does nothing when video ref is null', async () => {
      const ref = { current: null } as RefObject<HTMLVideoElement>;
      const { result } = renderHook(() => usePictureInPicture(ref));

      // Should not throw
      await act(async () => {
        await result.current.enterPictureInPicture();
      });
    });

    it('does nothing when PiP is not supported', async () => {
      Object.defineProperty(document, 'pictureInPictureEnabled', {
        writable: true,
        value: false,
      });

      const ref = createVideoRef();
      const requestSpy = vi.fn().mockResolvedValue(document.createElement('div'));
      ref.current!.requestPictureInPicture = requestSpy;

      const { result } = renderHook(() => usePictureInPicture(ref));

      await act(async () => {
        await result.current.enterPictureInPicture();
      });

      expect(requestSpy).not.toHaveBeenCalled();
    });

    it('handles requestPictureInPicture rejection gracefully', async () => {
      const ref = createVideoRef();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      ref.current!.requestPictureInPicture = vi.fn().mockRejectedValue(new Error('PiP blocked'));

      const { result } = renderHook(() => usePictureInPicture(ref));

      await act(async () => {
        await result.current.enterPictureInPicture();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to enter Picture-in-Picture:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  // ─── Exit PiP ─────────────────────────────────────────────────────

  describe('exitPictureInPicture', () => {
    it('calls document.exitPictureInPicture when a PiP element exists', async () => {
      const ref = createVideoRef();
      const exitSpy = vi.fn().mockResolvedValue(undefined);
      (document as any).exitPictureInPicture = exitSpy;
      (document as any).pictureInPictureElement = ref.current;

      const { result } = renderHook(() => usePictureInPicture(ref));

      await act(async () => {
        await result.current.exitPictureInPicture();
      });

      expect(exitSpy).toHaveBeenCalledTimes(1);
    });

    it('does nothing when no PiP element exists', async () => {
      const ref = createVideoRef();
      const exitSpy = vi.fn().mockResolvedValue(undefined);
      (document as any).exitPictureInPicture = exitSpy;
      (document as any).pictureInPictureElement = null;

      const { result } = renderHook(() => usePictureInPicture(ref));

      await act(async () => {
        await result.current.exitPictureInPicture();
      });

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('handles exitPictureInPicture rejection gracefully', async () => {
      const ref = createVideoRef();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (document as any).exitPictureInPicture = vi.fn().mockRejectedValue(new Error('Exit failed'));
      (document as any).pictureInPictureElement = ref.current;

      const { result } = renderHook(() => usePictureInPicture(ref));

      await act(async () => {
        await result.current.exitPictureInPicture();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to exit Picture-in-Picture:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();

      // Restore
      (document as any).exitPictureInPicture = vi.fn().mockResolvedValue(undefined);
    });
  });

  // ─── Toggle PiP ───────────────────────────────────────────────────

  describe('togglePictureInPicture', () => {
    it('enters PiP when not in PiP mode', async () => {
      const ref = createVideoRef();
      const requestSpy = vi.fn().mockResolvedValue(document.createElement('div'));
      ref.current!.requestPictureInPicture = requestSpy;

      const { result } = renderHook(() => usePictureInPicture(ref));

      await act(async () => {
        await result.current.togglePictureInPicture();
      });

      expect(requestSpy).toHaveBeenCalledTimes(1);
    });

    it('exits PiP when already in PiP mode', async () => {
      const ref = createVideoRef();
      const exitSpy = vi.fn().mockResolvedValue(undefined);
      (document as any).exitPictureInPicture = exitSpy;
      (document as any).pictureInPictureElement = ref.current;

      const { result } = renderHook(() => usePictureInPicture(ref));

      // Simulate enter PiP
      act(() => {
        ref.current!.dispatchEvent(new Event('enterpictureinpicture'));
      });

      expect(result.current.isPictureInPicture).toBe(true);

      await act(async () => {
        await result.current.togglePictureInPicture();
      });

      expect(exitSpy).toHaveBeenCalled();
    });
  });

  // ─── PiP Events ───────────────────────────────────────────────────

  describe('PiP events', () => {
    it('updates isPictureInPicture to true on enterpictureinpicture', () => {
      const ref = createVideoRef();
      const { result } = renderHook(() => usePictureInPicture(ref));

      act(() => {
        ref.current!.dispatchEvent(new Event('enterpictureinpicture'));
      });

      expect(result.current.isPictureInPicture).toBe(true);
    });

    it('updates isPictureInPicture to false on leavepictureinpicture', () => {
      const ref = createVideoRef();
      const { result } = renderHook(() => usePictureInPicture(ref));

      // Enter first
      act(() => {
        ref.current!.dispatchEvent(new Event('enterpictureinpicture'));
      });
      expect(result.current.isPictureInPicture).toBe(true);

      // Leave
      act(() => {
        ref.current!.dispatchEvent(new Event('leavepictureinpicture'));
      });
      expect(result.current.isPictureInPicture).toBe(false);
    });

    it('calls onChange(true) when entering PiP', () => {
      const onChange = vi.fn();
      const ref = createVideoRef();
      renderHook(() => usePictureInPicture(ref, { onChange }));

      act(() => {
        ref.current!.dispatchEvent(new Event('enterpictureinpicture'));
      });

      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('calls onChange(false) when leaving PiP', () => {
      const onChange = vi.fn();
      const ref = createVideoRef();
      renderHook(() => usePictureInPicture(ref, { onChange }));

      act(() => {
        ref.current!.dispatchEvent(new Event('enterpictureinpicture'));
      });
      act(() => {
        ref.current!.dispatchEvent(new Event('leavepictureinpicture'));
      });

      expect(onChange).toHaveBeenCalledWith(false);
    });
  });

  // ─── Cleanup ───────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('removes event listeners on unmount', () => {
      const ref = createVideoRef();
      const removeSpy = vi.spyOn(ref.current!, 'removeEventListener');

      const { unmount } = renderHook(() => usePictureInPicture(ref));

      unmount();

      const removedEvents = removeSpy.mock.calls.map(([event]) => event);
      expect(removedEvents).toContain('enterpictureinpicture');
      expect(removedEvents).toContain('leavepictureinpicture');

      removeSpy.mockRestore();
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles entering and leaving PiP multiple times', () => {
      const onChange = vi.fn();
      const ref = createVideoRef();
      const { result } = renderHook(() =>
        usePictureInPicture(ref, { onChange })
      );

      // Enter
      act(() => {
        ref.current!.dispatchEvent(new Event('enterpictureinpicture'));
      });
      expect(result.current.isPictureInPicture).toBe(true);

      // Leave
      act(() => {
        ref.current!.dispatchEvent(new Event('leavepictureinpicture'));
      });
      expect(result.current.isPictureInPicture).toBe(false);

      // Enter again
      act(() => {
        ref.current!.dispatchEvent(new Event('enterpictureinpicture'));
      });
      expect(result.current.isPictureInPicture).toBe(true);

      expect(onChange).toHaveBeenCalledTimes(3);
    });

    it('works without onChange callback', () => {
      const ref = createVideoRef();
      const { result } = renderHook(() => usePictureInPicture(ref));

      // Should not throw
      act(() => {
        ref.current!.dispatchEvent(new Event('enterpictureinpicture'));
      });

      expect(result.current.isPictureInPicture).toBe(true);
    });
  });
});
