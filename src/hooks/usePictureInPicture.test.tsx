/**
 * jsdom implements no Picture-in-Picture API, so the element methods and the
 * document flags are defined per test.
 *
 * The video is rendered through JSX rather than assigned to a ref afterwards:
 * the hook subscribes to the element inside a mount effect, and a ref populated
 * later is invisible to React, so the listeners would never attach.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { usePictureInPicture, type UsePictureInPictureReturn } from './usePictureInPicture';

type Mutable = Record<string, unknown>;

let captured: UsePictureInPictureReturn;
let video: HTMLVideoElement;

/**
 * The hook reads `videoRef.current` inside its effect, so the ref object has to
 * be stable across renders — a fresh one per render would break subscription.
 */
function makeHarness() {
  const ref = { current: null } as React.RefObject<HTMLVideoElement | null>;

  function Stable({ onChange }: { onChange?: (isPip: boolean) => void }) {
    const pip = usePictureInPicture(ref, { onChange });
    captured = pip;
    return <video ref={ref as React.RefObject<HTMLVideoElement>} />;
  }

  return Stable;
}

function setup(options: { onChange?: (isPip: boolean) => void } = {}) {
  const Component = makeHarness();
  const result = render(<Component onChange={options.onChange} />);
  video = result.container.querySelector('video')!;
  return result;
}

function defineOnDocument(key: string, value: unknown) {
  Object.defineProperty(document, key, { configurable: true, value, writable: true });
}

describe('usePictureInPicture', () => {
  beforeEach(() => {
    defineOnDocument('pictureInPictureEnabled', undefined);
    defineOnDocument('pictureInPictureElement', null);
    defineOnDocument('exitPictureInPicture', undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('support detection', () => {
    it('reports unsupported when the document flag is absent', () => {
      Reflect.deleteProperty(document, 'pictureInPictureEnabled');
      setup();
      expect(captured.isSupported).toBeFalsy();
    });

    it('reports unsupported when the flag is present but false', () => {
      // Chrome sets this to false when PiP is disabled by policy.
      defineOnDocument('pictureInPictureEnabled', false);
      setup();
      expect(captured.isSupported).toBe(false);
    });

    it('reports supported when the flag is true', () => {
      defineOnDocument('pictureInPictureEnabled', true);
      setup();
      expect(captured.isSupported).toBe(true);
    });
  });

  describe('enterPictureInPicture', () => {
    it('requests PiP on the video', async () => {
      defineOnDocument('pictureInPictureEnabled', true);
      setup();
      const request = vi.fn(async () => ({}) as PictureInPictureWindow);
      (video as unknown as Mutable).requestPictureInPicture = request;

      await act(async () => captured.enterPictureInPicture());

      expect(request).toHaveBeenCalledOnce();
    });

    it('does nothing when unsupported', () => {
      defineOnDocument('pictureInPictureEnabled', false);
      setup();
      const request = vi.fn(async () => ({}) as PictureInPictureWindow);
      (video as unknown as Mutable).requestPictureInPicture = request;

      act(() => {
        captured.enterPictureInPicture();
      });

      expect(request).not.toHaveBeenCalled();
    });

    it('swallows a rejection', async () => {
      // Rejected without a user gesture, and for audio-only or unloaded media.
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      defineOnDocument('pictureInPictureEnabled', true);
      setup();
      (video as unknown as Mutable).requestPictureInPicture = vi.fn(async () => {
        throw new DOMException('gesture required', 'NotAllowedError');
      });

      await act(async () => captured.enterPictureInPicture());

      expect(consoleError).toHaveBeenCalled();
    });
  });

  describe('exitPictureInPicture', () => {
    it('exits when a PiP window is open', async () => {
      const exit = vi.fn(async () => {});
      defineOnDocument('pictureInPictureElement', document.createElement('video'));
      defineOnDocument('exitPictureInPicture', exit);
      setup();

      await act(async () => captured.exitPictureInPicture());

      expect(exit).toHaveBeenCalledOnce();
    });

    it('does nothing when no PiP window is open', async () => {
      const exit = vi.fn(async () => {});
      defineOnDocument('pictureInPictureElement', null);
      defineOnDocument('exitPictureInPicture', exit);
      setup();

      await act(async () => captured.exitPictureInPicture());

      expect(exit).not.toHaveBeenCalled();
    });

    it('swallows a rejection', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      defineOnDocument('pictureInPictureElement', document.createElement('video'));
      defineOnDocument('exitPictureInPicture', async () => {
        throw new Error('not in pip');
      });
      setup();

      await act(async () => captured.exitPictureInPicture());

      expect(consoleError).toHaveBeenCalled();
    });
  });

  describe('togglePictureInPicture', () => {
    it('enters while inline', async () => {
      defineOnDocument('pictureInPictureEnabled', true);
      setup();
      const request = vi.fn(async () => ({}) as PictureInPictureWindow);
      (video as unknown as Mutable).requestPictureInPicture = request;

      await act(async () => captured.togglePictureInPicture());

      expect(request).toHaveBeenCalledOnce();
    });

    it('exits while in PiP', async () => {
      const exit = vi.fn(async () => {});
      defineOnDocument('pictureInPictureEnabled', true);
      defineOnDocument('exitPictureInPicture', exit);
      setup();

      // State flips through the element event, as it does in a browser.
      act(() => {
        video.dispatchEvent(new Event('enterpictureinpicture'));
      });
      expect(captured.isPictureInPicture).toBe(true);

      defineOnDocument('pictureInPictureElement', video);
      await act(async () => captured.togglePictureInPicture());

      expect(exit).toHaveBeenCalledOnce();
    });
  });

  describe('element events', () => {
    it('starts inline', () => {
      setup();
      expect(captured.isPictureInPicture).toBe(false);
    });

    it('goes to PiP on enterpictureinpicture', () => {
      const onChange = vi.fn();
      setup({ onChange });

      act(() => {
        video.dispatchEvent(new Event('enterpictureinpicture'));
      });

      expect(captured.isPictureInPicture).toBe(true);
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('returns inline on leavepictureinpicture', () => {
      // The PiP window has its own close button, so this fires without the
      // page ever calling exitPictureInPicture.
      const onChange = vi.fn();
      setup({ onChange });

      act(() => {
        video.dispatchEvent(new Event('enterpictureinpicture'));
      });
      act(() => {
        video.dispatchEvent(new Event('leavepictureinpicture'));
      });

      expect(captured.isPictureInPicture).toBe(false);
      expect(onChange).toHaveBeenLastCalledWith(false);
    });

    it('detaches its listeners on unmount', () => {
      const onChange = vi.fn();
      const { unmount } = setup({ onChange });
      const detached = video;

      unmount();
      detached.dispatchEvent(new Event('enterpictureinpicture'));

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('without a video element', () => {
    it('is inert', async () => {
      const ref = { current: null } as React.RefObject<HTMLVideoElement | null>;
      function Empty() {
        captured = usePictureInPicture(ref);
        return null;
      }
      render(<Empty />);

      await expect(
        act(async () => {
          await captured.enterPictureInPicture();
          await captured.exitPictureInPicture();
        })
      ).resolves.not.toThrow();
    });
  });
});
