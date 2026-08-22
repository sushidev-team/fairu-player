/**
 * `useCast` drives two unrelated protocols behind one control: AirPlay through
 * WebKit's `webkitShowPlaybackTargetPicker`, and Chromecast through the Remote
 * Playback API. jsdom has neither, so both are stubbed here — and that is the
 * whole value of these tests, because in practice each path only ever runs in
 * one browser and neither gets exercised during development.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useCast, type UseCastReturn } from './useCast';

type Mutable = Record<string, unknown>;

let captured: UseCastReturn;
let video: HTMLVideoElement;

/** A minimal stand-in for `HTMLMediaElement.remote`. */
function makeRemote() {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    prompt: vi.fn(async () => {}),
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners.get(type)?.delete(listener);
    }),
    /** Test-only: fire a remote-playback event. */
    fire(type: string) {
      act(() => {
        listeners.get(type)?.forEach((l) => l(new Event(type)));
      });
    },
    listenerCount(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

/**
 * Render the hook with a stable ref and let a callback decorate the element
 * before the hook's effects observe it.
 */
function setup(
  decorate: (video: HTMLVideoElement) => void = () => {},
  options: { onChange?: (casting: boolean) => void } = {}
) {
  const ref: { current: HTMLVideoElement | null } = { current: null };

  function Harness() {
    captured = useCast(ref as React.RefObject<HTMLVideoElement | null>, options);
    return (
      <video
        ref={(node) => {
          // Decorating inside the ref callback means the stubbed APIs are in
          // place before the mount effect reads the element — which is when a
          // real Safari would already have them.
          if (node && ref.current !== node) {
            decorate(node);
            ref.current = node;
          }
        }}
      />
    );
  }

  const result = render(<Harness />);
  video = result.container.querySelector('video')!;
  return result;
}

describe('useCast', () => {
  const originalRemoteDescriptor = Object.getOwnPropertyDescriptor(
    HTMLVideoElement.prototype,
    'remote'
  );

  beforeEach(() => {
    Reflect.deleteProperty(HTMLVideoElement.prototype, 'remote');
    Reflect.deleteProperty(window as unknown as Mutable, 'WebKitPlaybackTargetAvailabilityEvent');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLVideoElement.prototype, 'remote');
    if (originalRemoteDescriptor) {
      Object.defineProperty(HTMLVideoElement.prototype, 'remote', originalRemoteDescriptor);
    }
  });

  describe('support detection', () => {
    it('reports unsupported when neither protocol is present', () => {
      setup();
      expect(captured.isSupported).toBe(false);
    });

    it('detects the Remote Playback API on the prototype', () => {
      Object.defineProperty(HTMLVideoElement.prototype, 'remote', {
        configurable: true,
        value: makeRemote(),
      });

      setup();

      expect(captured.isSupported).toBe(true);
    });

    it('detects AirPlay exposed only on the instance', () => {
      // Safari puts `webkitShowPlaybackTargetPicker` on elements, not on the
      // prototype, which is why detection re-runs once the element exists.
      setup((node) => {
        (node as unknown as Mutable).webkitShowPlaybackTargetPicker = vi.fn();
      });

      expect(captured.isSupported).toBe(true);
    });

    it('detects AirPlay via the WebKit event constructor', () => {
      (window as unknown as Mutable).WebKitPlaybackTargetAvailabilityEvent = function () {};

      setup();

      expect(captured.isSupported).toBe(true);
    });
  });

  describe('toggleCast', () => {
    it('opens the AirPlay picker on Safari', async () => {
      const picker = vi.fn();
      setup((node) => {
        (node as unknown as Mutable).webkitShowPlaybackTargetPicker = picker;
      });

      await act(async () => captured.toggleCast());

      expect(picker).toHaveBeenCalledOnce();
    });

    it('prompts the Remote Playback API on Chrome', async () => {
      const remote = makeRemote();
      setup((node) => {
        (node as unknown as Mutable).remote = remote;
      });

      await act(async () => captured.toggleCast());

      expect(remote.prompt).toHaveBeenCalledOnce();
    });

    it('prefers AirPlay when Safari exposes both', async () => {
      // Safari ships a partial Remote Playback API whose prompt() does not open
      // the AirPlay picker, so the WebKit path has to win.
      const picker = vi.fn();
      const remote = makeRemote();
      setup((node) => {
        (node as unknown as Mutable).webkitShowPlaybackTargetPicker = picker;
        (node as unknown as Mutable).remote = remote;
      });

      await act(async () => captured.toggleCast());

      expect(picker).toHaveBeenCalledOnce();
      expect(remote.prompt).not.toHaveBeenCalled();
    });

    it('stays quiet when the user dismisses the picker', async () => {
      // Cancelling is not a failure and must not reach the console.
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const remote = makeRemote();
      remote.prompt = vi.fn(async () => {
        throw new DOMException('cancelled', 'NotAllowedError');
      });
      setup((node) => {
        (node as unknown as Mutable).remote = remote;
      });

      await act(async () => captured.toggleCast());

      expect(consoleError).not.toHaveBeenCalled();
    });

    it('logs a genuine failure', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const remote = makeRemote();
      remote.prompt = vi.fn(async () => {
        throw new DOMException('no devices', 'NotFoundError');
      });
      setup((node) => {
        (node as unknown as Mutable).remote = remote;
      });

      await act(async () => captured.toggleCast());

      expect(consoleError).toHaveBeenCalled();
    });

    it('does nothing when neither protocol is available', async () => {
      setup();

      await expect(act(async () => captured.toggleCast())).resolves.not.toThrow();
    });

    it('does nothing without a video element', async () => {
      const ref = { current: null } as React.RefObject<HTMLVideoElement | null>;
      function Empty() {
        captured = useCast(ref);
        return null;
      }
      render(<Empty />);

      await expect(act(async () => captured.toggleCast())).resolves.not.toThrow();
    });
  });

  describe('session state — AirPlay', () => {
    it('starts idle', () => {
      setup();
      expect(captured.isCasting).toBe(false);
    });

    it('follows the wireless-target flag', () => {
      const onChange = vi.fn();
      setup(
        (node) => {
          (node as unknown as Mutable).webkitCurrentPlaybackTargetIsWireless = false;
        },
        { onChange }
      );

      (video as unknown as Mutable).webkitCurrentPlaybackTargetIsWireless = true;
      act(() => {
        video.dispatchEvent(new Event('webkitcurrentplaybacktargetiswirelesschanged'));
      });

      expect(captured.isCasting).toBe(true);
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('reports the end of an AirPlay session', () => {
      const onChange = vi.fn();
      setup(
        (node) => {
          (node as unknown as Mutable).webkitCurrentPlaybackTargetIsWireless = false;
        },
        { onChange }
      );

      (video as unknown as Mutable).webkitCurrentPlaybackTargetIsWireless = true;
      act(() => {
        video.dispatchEvent(new Event('webkitcurrentplaybacktargetiswirelesschanged'));
      });

      (video as unknown as Mutable).webkitCurrentPlaybackTargetIsWireless = false;
      act(() => {
        video.dispatchEvent(new Event('webkitcurrentplaybacktargetiswirelesschanged'));
      });

      expect(captured.isCasting).toBe(false);
      expect(onChange).toHaveBeenLastCalledWith(false);
    });
  });

  describe('session state — Remote Playback', () => {
    it('connects and disconnects', () => {
      const onChange = vi.fn();
      const remote = makeRemote();
      setup(
        (node) => {
          (node as unknown as Mutable).remote = remote;
        },
        { onChange }
      );

      remote.fire('connect');
      expect(captured.isCasting).toBe(true);
      expect(onChange).toHaveBeenCalledWith(true);

      remote.fire('disconnect');
      expect(captured.isCasting).toBe(false);
      expect(onChange).toHaveBeenLastCalledWith(false);
    });

    it('unsubscribes on unmount', () => {
      const remote = makeRemote();
      const { unmount } = setup((node) => {
        (node as unknown as Mutable).remote = remote;
      });

      expect(remote.listenerCount('connect')).toBe(1);

      unmount();

      expect(remote.listenerCount('connect')).toBe(0);
      expect(remote.listenerCount('disconnect')).toBe(0);
    });
  });

  describe('AirPlay takes precedence for events too', () => {
    it('subscribes to the WebKit event rather than remote playback', () => {
      const remote = makeRemote();
      setup((node) => {
        (node as unknown as Mutable).webkitCurrentPlaybackTargetIsWireless = false;
        (node as unknown as Mutable).remote = remote;
      });

      expect(remote.addEventListener).not.toHaveBeenCalled();
    });
  });
});
