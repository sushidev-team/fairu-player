/**
 * Controls and event wiring for `useMedia`.
 *
 * `useMedia.test.tsx` covers the source-swap behaviour; this covers the control
 * surface and the media-element events that feed state.
 *
 * The element is rendered through JSX rather than assigned to the ref
 * afterwards. That is not a stylistic choice: `useMedia` attaches its listeners
 * in a mount effect that reads `mediaRef.current`, and a ref assigned after
 * mount is invisible to React — the listeners would never attach and every
 * assertion here would pass or fail for the wrong reason. Rendering it is also
 * exactly what the providers do.
 *
 * jsdom implements no playback, so time, duration and buffered ranges are
 * stubbed per instance. That is enough: the hook's job is translating between
 * React state and element properties, and both sides are observable.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useMedia } from './useMedia';
import type { UseMediaOptions, UseMediaReturn } from '@/types/media';

type Media = UseMediaReturn<HTMLAudioElement>;

let captured: Media;
let element: HTMLAudioElement;

function Harness({ options }: { options?: UseMediaOptions }) {
  const media = useMedia<HTMLAudioElement>(options);
  captured = media;
  return <audio ref={media.mediaRef as React.RefObject<HTMLAudioElement>} />;
}

/** Render the hook with a real element attached, and stub the media bits. */
function setup(options: UseMediaOptions = {}, stubs: { duration?: number } = {}) {
  const result = render(<Harness options={options} />);
  element = result.container.querySelector('audio')!;

  let currentTime = 0;
  Object.defineProperty(element, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: (value: number) => {
      currentTime = value;
    },
  });

  Object.defineProperty(element, 'duration', {
    configurable: true,
    get: () => stubs.duration ?? 100,
  });

  Object.defineProperty(element, 'buffered', {
    configurable: true,
    get: () => ({ length: 1, end: () => 42, start: () => 0 }) as unknown as TimeRanges,
  });

  element.play = vi.fn(async () => {});
  element.pause = vi.fn();

  return result;
}

/** Fire a media event and let React flush. */
function fire(type: string) {
  act(() => {
    element.dispatchEvent(new Event(type));
  });
}

describe('useMedia controls', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts paused, loading and unplayed', () => {
      setup();

      expect(captured.state.isPlaying).toBe(false);
      expect(captured.state.isPaused).toBe(true);
      expect(captured.state.isLoading).toBe(true);
      expect(captured.state.currentTime).toBe(0);
      expect(captured.state.error).toBeNull();
    });

    it('seeds volume, mute and rate from the options', () => {
      setup({ volume: 0.3, muted: true, playbackRate: 1.5 });

      expect(captured.state.volume).toBe(0.3);
      expect(captured.state.isMuted).toBe(true);
      expect(captured.state.playbackRate).toBe(1.5);
    });

    it('applies those values to the element', () => {
      setup({ volume: 0.3, muted: true, playbackRate: 1.5 });

      expect(element.volume).toBeCloseTo(0.3);
      expect(element.muted).toBe(true);
      expect(element.playbackRate).toBe(1.5);
    });
  });

  describe('play / pause / stop', () => {
    it('plays', async () => {
      setup();
      await act(async () => captured.controls.play());
      expect(element.play).toHaveBeenCalled();
    });

    it('records a rejected play as an error', async () => {
      // Autoplay policy rejections arrive this way and must not go unhandled.
      const onError = vi.fn();
      setup({ onError });
      element.play = vi.fn(async () => {
        throw new DOMException('blocked', 'NotAllowedError');
      });

      await act(async () => captured.controls.play());

      expect(captured.state.error).toBeInstanceOf(Error);
      expect(onError).toHaveBeenCalled();
    });

    it('survives a play rejection that is not an Error', async () => {
      setup();
      element.play = vi.fn(async () => {
        throw 'nope';
      });

      await act(async () => captured.controls.play());

      expect(captured.state.error?.message).toBe('Failed to play');
    });

    it('pauses', () => {
      setup();
      act(() => captured.controls.pause());
      expect(element.pause).toHaveBeenCalled();
    });

    it('stop pauses and rewinds', () => {
      setup();
      element.currentTime = 50;

      act(() => captured.controls.stop());

      expect(element.pause).toHaveBeenCalled();
      expect(element.currentTime).toBe(0);
    });

    it('toggle plays while paused', async () => {
      setup();
      await act(async () => captured.controls.toggle());
      expect(element.play).toHaveBeenCalled();
    });

    it('toggle pauses while playing', async () => {
      setup();
      fire('play');

      await act(async () => captured.controls.toggle());

      expect(element.pause).toHaveBeenCalled();
    });
  });

  describe('seeking', () => {
    it('seeks to a time', () => {
      setup();
      act(() => captured.controls.seek(42));
      expect(element.currentTime).toBe(42);
    });

    it('clamps a negative seek to the start', () => {
      setup();
      act(() => captured.controls.seek(-10));
      expect(element.currentTime).toBe(0);
    });

    it('clamps a seek past the end to the duration', () => {
      setup({}, { duration: 100 });
      act(() => captured.controls.seek(9999));
      expect(element.currentTime).toBe(100);
    });

    it('seeks by percentage', () => {
      setup({}, { duration: 200 });
      act(() => captured.controls.seekTo(25));
      expect(element.currentTime).toBe(50);
    });

    it('ignores a percentage seek when the duration is unknown', () => {
      setup({}, { duration: 0 });
      act(() => captured.controls.seekTo(50));
      expect(element.currentTime).toBe(0);
    });

    it('skips forward by the configured amount', () => {
      setup({ skipForwardSeconds: 30 });
      element.currentTime = 10;

      act(() => captured.controls.skipForward());

      expect(element.currentTime).toBe(40);
    });

    it('skips backward by the configured amount', () => {
      setup({ skipBackwardSeconds: 10 });
      element.currentTime = 50;

      act(() => captured.controls.skipBackward());

      expect(element.currentTime).toBe(40);
    });

    it('accepts an explicit skip override', () => {
      setup({ skipForwardSeconds: 30 });
      element.currentTime = 10;

      act(() => captured.controls.skipForward(5));

      expect(element.currentTime).toBe(15);
    });

    it('clamps a backward skip at the start', () => {
      setup({ skipBackwardSeconds: 30 });
      element.currentTime = 5;

      act(() => captured.controls.skipBackward());

      expect(element.currentTime).toBe(0);
    });
  });

  describe('volume', () => {
    it('sets the volume on the element', () => {
      setup();
      act(() => captured.controls.setVolume(0.4));

      expect(element.volume).toBeCloseTo(0.4);
      expect(captured.state.volume).toBeCloseTo(0.4);
    });

    it('clamps above 1 and below 0', () => {
      setup();

      act(() => captured.controls.setVolume(5));
      expect(captured.state.volume).toBe(1);

      act(() => captured.controls.setVolume(-5));
      expect(captured.state.volume).toBe(0);
    });

    it('toggles mute on the element', () => {
      setup();

      act(() => captured.controls.toggleMute());
      expect(element.muted).toBe(true);
      expect(captured.state.isMuted).toBe(true);

      act(() => captured.controls.toggleMute());
      expect(element.muted).toBe(false);
    });
  });

  describe('playback rate', () => {
    it('sets the rate on the element', () => {
      setup();
      act(() => captured.controls.setPlaybackRate(1.5));

      expect(element.playbackRate).toBe(1.5);
      expect(captured.state.playbackRate).toBe(1.5);
    });
  });

  describe('media events feed state', () => {
    it('play and pause flip the transport flags', () => {
      const onPlay = vi.fn();
      const onPause = vi.fn();
      setup({ onPlay, onPause });

      fire('play');
      expect(captured.state.isPlaying).toBe(true);
      expect(captured.state.isPaused).toBe(false);
      expect(onPlay).toHaveBeenCalled();

      fire('pause');
      expect(captured.state.isPlaying).toBe(false);
      expect(captured.state.isPaused).toBe(true);
      expect(onPause).toHaveBeenCalled();
    });

    it('loadedmetadata clears loading and reports the duration', () => {
      const onLoadedMetadata = vi.fn();
      setup({ onLoadedMetadata }, { duration: 321 });

      fire('loadedmetadata');

      expect(captured.state.isLoading).toBe(false);
      expect(captured.state.duration).toBe(321);
      expect(onLoadedMetadata).toHaveBeenCalledWith(321);
    });

    it('waiting marks buffering and canplay clears it', () => {
      setup();

      fire('waiting');
      expect(captured.state.isBuffering).toBe(true);

      fire('canplay');
      expect(captured.state.isBuffering).toBe(false);
    });

    it('playing clears buffering without waiting for canplay', () => {
      setup();

      fire('waiting');
      fire('playing');

      expect(captured.state.isBuffering).toBe(false);
      expect(captured.state.isPlaying).toBe(true);
    });

    it('ended sets the ended flag and reports it', () => {
      const onEnded = vi.fn();
      setup({ onEnded });

      fire('ended');

      expect(captured.state.isEnded).toBe(true);
      expect(captured.state.isPlaying).toBe(false);
      expect(onEnded).toHaveBeenCalled();
    });

    it('a fresh play clears the ended flag', () => {
      setup();

      fire('ended');
      fire('play');

      expect(captured.state.isEnded).toBe(false);
    });

    it('timeupdate advances the clock', () => {
      const onTimeUpdate = vi.fn();
      setup({ onTimeUpdate });
      element.currentTime = 12.5;

      fire('timeupdate');

      expect(captured.state.currentTime).toBe(12.5);
      expect(onTimeUpdate).toHaveBeenCalledWith(12.5);
    });

    it('progress records the buffered end', () => {
      setup();

      fire('progress');

      expect(captured.state.buffered).toBe(42);
    });

    it('volumechange mirrors element-side changes', () => {
      // Hardware and OS volume keys change the element directly, bypassing the
      // controls entirely.
      setup();

      element.volume = 0.2;
      element.muted = true;
      fire('volumechange');

      expect(captured.state.volume).toBeCloseTo(0.2);
      expect(captured.state.isMuted).toBe(true);
    });

    it('ratechange mirrors element-side changes', () => {
      setup();

      element.playbackRate = 2;
      fire('ratechange');

      expect(captured.state.playbackRate).toBe(2);
    });

    it('error surfaces and clears loading', () => {
      const onError = vi.fn();
      setup({ onError });

      fire('error');

      expect(captured.state.error).toBeInstanceOf(Error);
      expect(captured.state.isLoading).toBe(false);
      expect(onError).toHaveBeenCalled();
    });

    it('loadstart returns to loading and clears a previous error', () => {
      setup();

      fire('error');
      fire('loadstart');

      expect(captured.state.isLoading).toBe(true);
      expect(captured.state.error).toBeNull();
    });

    it('forwards loadeddata and canplaythrough', () => {
      const onLoadedData = vi.fn();
      const onCanPlayThrough = vi.fn();
      setup({ onLoadedData, onCanPlayThrough });

      fire('loadeddata');
      fire('canplaythrough');

      expect(onLoadedData).toHaveBeenCalled();
      expect(onCanPlayThrough).toHaveBeenCalled();
    });
  });

  describe('teardown', () => {
    it('stops updating state after unmount', () => {
      const onTimeUpdate = vi.fn();
      const { unmount } = setup({ onTimeUpdate });
      const detached = element;

      unmount();
      detached.dispatchEvent(new Event('timeupdate'));

      expect(onTimeUpdate).not.toHaveBeenCalled();
    });
  });
});
