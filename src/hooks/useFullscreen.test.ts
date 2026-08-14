/**
 * jsdom implements no Fullscreen API at all, so every entry point is defined
 * per test. That is the point: the hook exists because the API is inconsistent
 * across engines, and the prefixed fallbacks are the part most likely to rot
 * unnoticed — nobody develops in a browser that needs them.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFullscreen } from './useFullscreen';

type Mutable = Record<string, unknown>;

const DOC_KEYS = [
  'fullscreenEnabled',
  'webkitFullscreenEnabled',
  'mozFullScreenEnabled',
  'msFullscreenEnabled',
  'fullscreenElement',
  'webkitFullscreenElement',
  'mozFullScreenElement',
  'msFullscreenElement',
  'exitFullscreen',
  'webkitExitFullscreen',
  'mozCancelFullScreen',
  'msExitFullscreen',
];

function defineOnDocument(key: string, value: unknown) {
  Object.defineProperty(document, key, { configurable: true, value, writable: true });
}

function clearDocument() {
  for (const key of DOC_KEYS) {
    Object.defineProperty(document, key, {
      configurable: true,
      value: undefined,
      writable: true,
    });
  }
}

/** A container ref holding a real element. */
function makeRef(element: HTMLElement = document.createElement('div')) {
  const ref = { current: element } as React.RefObject<HTMLElement | null>;
  return { ref, element };
}

describe('useFullscreen', () => {
  beforeEach(() => {
    clearDocument();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearDocument();
  });

  describe('support detection', () => {
    it('reports unsupported when no engine exposes it', () => {
      const { ref } = makeRef();
      const { result } = renderHook(() => useFullscreen(ref));
      expect(result.current.isSupported).toBeFalsy();
    });

    it.each([
      'fullscreenEnabled',
      'webkitFullscreenEnabled',
      'mozFullScreenEnabled',
      'msFullscreenEnabled',
    ])('reports supported via %s', (key) => {
      defineOnDocument(key, true);
      const { ref } = makeRef();
      const { result } = renderHook(() => useFullscreen(ref));
      expect(result.current.isSupported).toBeTruthy();
    });
  });

  describe('enterFullscreen', () => {
    it('uses the standard API on the container', async () => {
      const { ref, element } = makeRef();
      const requestFullscreen = vi.fn(async () => {});
      (element as unknown as Mutable).requestFullscreen = requestFullscreen;

      const { result } = renderHook(() => useFullscreen(ref));
      await act(async () => result.current.enterFullscreen());

      expect(requestFullscreen).toHaveBeenCalledOnce();
    });

    it.each([
      ['webkitRequestFullscreen'],
      ['mozRequestFullScreen'],
      ['msRequestFullscreen'],
    ])('falls back to %s', async (method) => {
      const { ref, element } = makeRef();
      const fallback = vi.fn(async () => {});
      (element as unknown as Mutable)[method] = fallback;

      const { result } = renderHook(() => useFullscreen(ref));
      await act(async () => result.current.enterFullscreen());

      expect(fallback).toHaveBeenCalledOnce();
    });

    it('prefers the standard API when both exist', async () => {
      const { ref, element } = makeRef();
      const standard = vi.fn(async () => {});
      const prefixed = vi.fn(async () => {});
      (element as unknown as Mutable).requestFullscreen = standard;
      (element as unknown as Mutable).webkitRequestFullscreen = prefixed;

      const { result } = renderHook(() => useFullscreen(ref));
      await act(async () => result.current.enterFullscreen());

      expect(standard).toHaveBeenCalledOnce();
      expect(prefixed).not.toHaveBeenCalled();
    });

    it('targets an explicitly passed element over the container', async () => {
      const { ref } = makeRef();
      const other = document.createElement('section');
      const requestFullscreen = vi.fn(async () => {});
      (other as unknown as Mutable).requestFullscreen = requestFullscreen;

      const { result } = renderHook(() => useFullscreen(ref));
      await act(async () => result.current.enterFullscreen(other));

      expect(requestFullscreen).toHaveBeenCalledOnce();
    });

    it('does nothing when there is no element at all', async () => {
      const ref = { current: null } as React.RefObject<HTMLElement | null>;
      const { result } = renderHook(() => useFullscreen(ref));

      await expect(
        act(async () => result.current.enterFullscreen())
      ).resolves.not.toThrow();
    });

    it('swallows a rejection rather than surfacing it', async () => {
      // Browsers reject this whenever the call is not tied to a user gesture,
      // which is routine — it must not become an unhandled rejection.
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { ref, element } = makeRef();
      (element as unknown as Mutable).requestFullscreen = vi.fn(async () => {
        throw new TypeError('gesture required');
      });

      const { result } = renderHook(() => useFullscreen(ref));
      await act(async () => result.current.enterFullscreen());

      expect(consoleError).toHaveBeenCalled();
    });

    it('does nothing when the element implements no variant', async () => {
      const { ref } = makeRef();
      const { result } = renderHook(() => useFullscreen(ref));

      await expect(
        act(async () => result.current.enterFullscreen())
      ).resolves.not.toThrow();
    });
  });

  describe('exitFullscreen', () => {
    it('uses the standard API', async () => {
      const exit = vi.fn(async () => {});
      defineOnDocument('exitFullscreen', exit);

      const { ref } = makeRef();
      const { result } = renderHook(() => useFullscreen(ref));
      await act(async () => result.current.exitFullscreen());

      expect(exit).toHaveBeenCalledOnce();
    });

    it.each([
      'webkitExitFullscreen',
      'mozCancelFullScreen',
      'msExitFullscreen',
    ])('falls back to %s', async (method) => {
      const fallback = vi.fn(async () => {});
      defineOnDocument(method, fallback);

      const { ref } = makeRef();
      const { result } = renderHook(() => useFullscreen(ref));
      await act(async () => result.current.exitFullscreen());

      expect(fallback).toHaveBeenCalledOnce();
    });

    it('swallows a rejection', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      defineOnDocument('exitFullscreen', async () => {
        throw new Error('not in fullscreen');
      });

      const { ref } = makeRef();
      const { result } = renderHook(() => useFullscreen(ref));
      await act(async () => result.current.exitFullscreen());

      expect(consoleError).toHaveBeenCalled();
    });

    it('does nothing when no variant exists', async () => {
      const { ref } = makeRef();
      const { result } = renderHook(() => useFullscreen(ref));

      await expect(
        act(async () => result.current.exitFullscreen())
      ).resolves.not.toThrow();
    });
  });

  describe('toggleFullscreen', () => {
    it('enters while windowed', async () => {
      const { ref, element } = makeRef();
      const enter = vi.fn(async () => {});
      (element as unknown as Mutable).requestFullscreen = enter;

      const { result } = renderHook(() => useFullscreen(ref));
      await act(async () => result.current.toggleFullscreen());

      expect(enter).toHaveBeenCalledOnce();
    });

    it('exits while fullscreen', async () => {
      const { ref, element } = makeRef();
      const exit = vi.fn(async () => {});
      defineOnDocument('exitFullscreen', exit);
      defineOnDocument('fullscreenElement', element);

      const { result } = renderHook(() => useFullscreen(ref));

      // The state only flips through the change event, as it does in a browser.
      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'));
      });
      expect(result.current.isFullscreen).toBe(true);

      await act(async () => result.current.toggleFullscreen());

      expect(exit).toHaveBeenCalledOnce();
    });
  });

  describe('change events', () => {
    it('starts windowed', () => {
      const { ref } = makeRef();
      const { result } = renderHook(() => useFullscreen(ref));
      expect(result.current.isFullscreen).toBe(false);
    });

    it.each([
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange',
    ])('reacts to %s', (eventName) => {
      const { ref, element } = makeRef();
      defineOnDocument('fullscreenElement', element);

      const { result } = renderHook(() => useFullscreen(ref));
      act(() => {
        document.dispatchEvent(new Event(eventName));
      });

      expect(result.current.isFullscreen).toBe(true);
    });

    it.each([
      'webkitFullscreenElement',
      'mozFullScreenElement',
      'msFullscreenElement',
    ])('reads the current element from %s', (key) => {
      const { ref, element } = makeRef();
      defineOnDocument(key, element);

      const { result } = renderHook(() => useFullscreen(ref));
      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'));
      });

      expect(result.current.isFullscreen).toBe(true);
    });

    it('reports the change to onChange', () => {
      const onChange = vi.fn();
      const { ref, element } = makeRef();
      defineOnDocument('fullscreenElement', element);

      renderHook(() => useFullscreen(ref, { onChange }));
      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'));
      });

      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('goes windowed when the fullscreen element clears', () => {
      // Pressing Escape exits without ever calling exitFullscreen, so the event
      // is the only signal.
      const { ref, element } = makeRef();
      defineOnDocument('fullscreenElement', element);

      const { result } = renderHook(() => useFullscreen(ref));
      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'));
      });

      defineOnDocument('fullscreenElement', null);
      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'));
      });

      expect(result.current.isFullscreen).toBe(false);
    });

    it('detaches its listeners on unmount', () => {
      const onChange = vi.fn();
      const { ref } = makeRef();
      const { unmount } = renderHook(() => useFullscreen(ref, { onChange }));

      unmount();
      document.dispatchEvent(new Event('fullscreenchange'));

      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
