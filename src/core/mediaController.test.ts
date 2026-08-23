/**
 * The media controller, driven directly.
 *
 * `useMedia.controls.test.tsx` exercises the same behaviour through React and
 * is the proof the binding is faithful. Here there is no renderer: a controller,
 * an element, and a subscriber. That makes the publish semantics assertable —
 * how often subscribers are woken, and for what — which is invisible from the
 * React side because React coalesces renders.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMediaController, type MediaController } from './mediaController';

let element: HTMLAudioElement;
let controller: MediaController;

/** An element with the playback bits jsdom does not implement. */
function makeElement(stubs: { duration?: number } = {}): HTMLAudioElement {
  const el = document.createElement('audio');

  let currentTime = 0;
  Object.defineProperty(el, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: (v: number) => {
      currentTime = v;
    },
  });
  Object.defineProperty(el, 'duration', {
    configurable: true,
    get: () => stubs.duration ?? 100,
  });
  Object.defineProperty(el, 'buffered', {
    configurable: true,
    get: () => ({ length: 1, end: () => 42, start: () => 0 }) as unknown as TimeRanges,
  });

  el.play = vi.fn(async () => {});
  el.pause = vi.fn();
  el.load = vi.fn();
  return el;
}

function fire(type: string) {
  element.dispatchEvent(new Event(type));
}

describe('mediaController', () => {
  beforeEach(() => {
    element = makeElement();
  });

  afterEach(() => {
    controller?.destroy();
    vi.restoreAllMocks();
  });

  describe('seeding', () => {
    it('starts from the options it was given', () => {
      controller = createMediaController(element, {
        volume: 0.3,
        muted: true,
        playbackRate: 1.5,
      });

      expect(controller.getState()).toMatchObject({
        volume: 0.3,
        isMuted: true,
        playbackRate: 1.5,
      });
    });

    it('writes those onto the element', () => {
      controller = createMediaController(element, { volume: 0.3, muted: true });

      expect(element.volume).toBeCloseTo(0.3);
      expect(element.muted).toBe(true);
    });

    it('keeps muted set even though assigning volume fires volumechange', () => {
      // Assigning `volume` fires the event synchronously, whose handler reads
      // `muted` back off the element. Seeding in the wrong order therefore
      // clobbered the muted flag and a player configured muted started audible.
      controller = createMediaController(element, { volume: 0.5, muted: true });

      expect(element.muted).toBe(true);
      expect(controller.getState().isMuted).toBe(true);
    });

    it('starts paused and loading', () => {
      controller = createMediaController(element);

      expect(controller.getState()).toMatchObject({
        isPlaying: false,
        isPaused: true,
        isLoading: true,
        error: null,
      });
    });
  });

  describe('publishing', () => {
    it('wakes subscribers when something changes', () => {
      controller = createMediaController(element);
      const listener = vi.fn();
      controller.subscribe(listener);

      fire('play');

      expect(listener).toHaveBeenCalled();
    });

    it('stays quiet when nothing actually differs', () => {
      // `timeupdate` fires faster than the clock moves, so the same second
      // arrives repeatedly. Publishing each one would wake every subscriber for
      // nothing — invisible through React, which coalesces, and expensive in a
      // framework that does not.
      controller = createMediaController(element);
      element.currentTime = 5;
      fire('timeupdate');

      const listener = vi.fn();
      controller.subscribe(listener);
      fire('timeupdate');

      expect(listener).not.toHaveBeenCalled();
    });

    it('hands out a stable snapshot until something changes', () => {
      controller = createMediaController(element);
      const first = controller.getState();

      fire('timeupdate');

      expect(controller.getState()).toBe(first);
    });

    it('replaces the snapshot when something does change', () => {
      controller = createMediaController(element);
      const first = controller.getState();

      fire('play');

      expect(controller.getState()).not.toBe(first);
    });

    it('stops notifying an unsubscribed listener', () => {
      controller = createMediaController(element);
      const listener = vi.fn();
      const off = controller.subscribe(listener);

      off();
      fire('play');

      expect(listener).not.toHaveBeenCalled();
    });

    it('notifies every subscriber', () => {
      controller = createMediaController(element);
      const a = vi.fn();
      const b = vi.fn();
      controller.subscribe(a);
      controller.subscribe(b);

      fire('play');

      expect(a).toHaveBeenCalled();
      expect(b).toHaveBeenCalled();
    });
  });

  describe('transport', () => {
    it('plays and pauses', async () => {
      controller = createMediaController(element);

      await controller.controls.play();
      expect(element.play).toHaveBeenCalled();

      controller.controls.pause();
      expect(element.pause).toHaveBeenCalled();
    });

    it('records a refused play rather than throwing', async () => {
      // Every autoplay policy refusal arrives as a rejected promise; letting it
      // escape would be an unhandled rejection in a console the host page owns.
      const onError = vi.fn();
      controller = createMediaController(element, { onError });
      element.play = vi.fn(async () => {
        throw new DOMException('blocked', 'NotAllowedError');
      });

      await expect(controller.controls.play()).resolves.toBeUndefined();

      expect(controller.getState().error).toBeInstanceOf(Error);
      expect(onError).toHaveBeenCalled();
    });

    it('describes a non-Error rejection', async () => {
      controller = createMediaController(element);
      element.play = vi.fn(async () => {
        throw 'nope';
      });

      await controller.controls.play();

      expect(controller.getState().error?.message).toBe('Failed to play');
    });

    it('toggles according to what is actually happening', async () => {
      controller = createMediaController(element);

      await controller.controls.toggle();
      expect(element.play).toHaveBeenCalled();

      fire('play');
      await controller.controls.toggle();
      expect(element.pause).toHaveBeenCalled();
    });

    it('stop rewinds as well as pausing', () => {
      controller = createMediaController(element);
      element.currentTime = 50;

      controller.controls.stop();

      expect(element.pause).toHaveBeenCalled();
      expect(element.currentTime).toBe(0);
    });
  });

  describe('seeking', () => {
    it('clamps to the media', () => {
      controller = createMediaController(element);

      controller.controls.seek(-10);
      expect(element.currentTime).toBe(0);

      controller.controls.seek(9999);
      expect(element.currentTime).toBe(100);
    });

    it('seeks by percentage', () => {
      controller = createMediaController(element);
      controller.controls.seekTo(25);
      expect(element.currentTime).toBe(25);
    });

    it('ignores a percentage seek with no duration', () => {
      element = makeElement({ duration: 0 });
      controller = createMediaController(element);

      controller.controls.seekTo(50);

      expect(element.currentTime).toBe(0);
    });

    it('skips by the configured amounts', () => {
      controller = createMediaController(element, {
        skipForwardSeconds: 30,
        skipBackwardSeconds: 10,
      });
      element.currentTime = 40;

      controller.controls.skipForward();
      expect(element.currentTime).toBe(70);

      controller.controls.skipBackward();
      expect(element.currentTime).toBe(60);
    });

    it('takes an explicit override', () => {
      controller = createMediaController(element, { skipForwardSeconds: 30 });
      element.currentTime = 10;

      controller.controls.skipForward(5);

      expect(element.currentTime).toBe(15);
    });

    it('reads the duration off the element rather than the snapshot', () => {
      // State lags the element by an event, and a seek has to be right now.
      controller = createMediaController(element);
      expect(controller.getState().duration).toBe(0);

      controller.controls.seek(9999);

      expect(element.currentTime).toBe(100);
    });
  });

  describe('volume and rate', () => {
    it('clamps volume', () => {
      controller = createMediaController(element);

      controller.controls.setVolume(5);
      expect(controller.getState().volume).toBe(1);

      controller.controls.setVolume(-5);
      expect(controller.getState().volume).toBe(0);
    });

    it('toggles mute against the element', () => {
      controller = createMediaController(element);

      controller.controls.toggleMute();
      expect(element.muted).toBe(true);
      expect(controller.getState().isMuted).toBe(true);

      controller.controls.toggleMute();
      expect(element.muted).toBe(false);
    });

    it('sets the rate', () => {
      controller = createMediaController(element);
      controller.controls.setPlaybackRate(1.5);

      expect(element.playbackRate).toBe(1.5);
      expect(controller.getState().playbackRate).toBe(1.5);
    });

    it('follows a change made on the element directly', () => {
      // Hardware keys and OS volume bypass the controls entirely.
      controller = createMediaController(element);

      element.volume = 0.2;
      fire('volumechange');

      expect(controller.getState().volume).toBeCloseTo(0.2);
    });
  });

  describe('element events', () => {
    it('separates asked-to-play from actually-playing', () => {
      // `waiting` then `playing` is the rebuffer path; only `playing` means
      // frames are moving again.
      controller = createMediaController(element);

      fire('waiting');
      expect(controller.getState().isBuffering).toBe(true);

      fire('playing');
      expect(controller.getState()).toMatchObject({ isBuffering: false, isPlaying: true });
    });

    it('reports the duration once metadata lands', () => {
      const onLoadedMetadata = vi.fn();
      controller = createMediaController(element, { onLoadedMetadata });

      fire('loadedmetadata');

      expect(controller.getState()).toMatchObject({ duration: 100, isLoading: false });
      expect(onLoadedMetadata).toHaveBeenCalledWith(100);
    });

    it('records the buffered end', () => {
      controller = createMediaController(element);
      fire('progress');
      expect(controller.getState().buffered).toBe(42);
    });

    it('marks the end and clears it on a fresh play', () => {
      controller = createMediaController(element);

      fire('ended');
      expect(controller.getState().isEnded).toBe(true);

      fire('play');
      expect(controller.getState().isEnded).toBe(false);
    });

    it('surfaces an element error', () => {
      const onError = vi.fn();
      controller = createMediaController(element, { onError });

      fire('error');

      expect(controller.getState().error).toBeInstanceOf(Error);
      expect(onError).toHaveBeenCalled();
    });

    it('clears a previous error when loading starts again', () => {
      controller = createMediaController(element);

      fire('error');
      fire('loadstart');

      expect(controller.getState()).toMatchObject({ error: null, isLoading: true });
    });
  });

  describe('source', () => {
    it('loads a source', () => {
      controller = createMediaController(element);
      controller.setSource('https://example.test/a.mp3');

      expect(element.src).toContain('a.mp3');
      expect(element.load).toHaveBeenCalledOnce();
    });

    it('ignores a repeat of what is already loaded', () => {
      // Called on every render by the React binding, so this guard is what
      // stops a reload per keystroke elsewhere on the page.
      controller = createMediaController(element);
      controller.setSource('https://example.test/a.mp3');
      controller.setSource('https://example.test/a.mp3');

      expect(element.load).toHaveBeenCalledOnce();
    });

    it('loads a genuinely different source', () => {
      controller = createMediaController(element);
      controller.setSource('https://example.test/a.mp3');
      controller.setSource('https://example.test/b.mp3');

      expect(element.load).toHaveBeenCalledTimes(2);
      expect(element.src).toContain('b.mp3');
    });

    it('ignores an empty source', () => {
      controller = createMediaController(element);
      controller.setSource(undefined);
      expect(element.load).not.toHaveBeenCalled();
    });

    it('starts playback when asked to', () => {
      controller = createMediaController(element);
      controller.setSource('https://example.test/a.mp3', true);
      expect(element.play).toHaveBeenCalled();
    });
  });

  describe('callbacks', () => {
    it('can be replaced without rebuilding', () => {
      const first = vi.fn();
      const second = vi.fn();
      controller = createMediaController(element, { onPlay: first });

      controller.setCallbacks({ onPlay: second });
      fire('play');

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('detaches from the element', () => {
      const onPlay = vi.fn();
      controller = createMediaController(element, { onPlay });

      controller.destroy();
      fire('play');

      expect(onPlay).not.toHaveBeenCalled();
    });

    it('drops its subscribers', () => {
      controller = createMediaController(element);
      const listener = vi.fn();
      controller.subscribe(listener);

      controller.destroy();
      fire('play');

      expect(listener).not.toHaveBeenCalled();
    });

    it('leaves the element itself alone', () => {
      // A framework rendered it, so a framework disposes it. Removing the src
      // here would blank a node React still believes it owns.
      controller = createMediaController(element);
      controller.setSource('https://example.test/a.mp3');

      controller.destroy();

      expect(element.src).toContain('a.mp3');
    });
  });
});

describe('handing the element to somebody else', () => {
  it('reloads a source it had loaded before the handover', () => {
    const element = makeElement();
    const controller = createMediaController(element);

    controller.setSource('https://example.test/a.mp4');
    expect(element.src).toBe('https://example.test/a.mp4');

    // `useVideo` passes no source for an HLS track, because hls.js attaches
    // its own — the controller has to let go rather than remember.
    controller.setSource(undefined);
    element.src = 'blob:hls-stream';

    controller.setSource('https://example.test/a.mp4');

    // Without forgetting, this looks like the source already applied and gets
    // skipped, leaving the element on a stream nobody asked for.
    expect(element.src).toBe('https://example.test/a.mp4');
  });

  it('still ignores a repeat of the source it is already on', () => {
    const element = makeElement();
    const controller = createMediaController(element);
    controller.setSource('https://example.test/a.mp4');

    // `makeElement` already stubs `load`, so reset its history rather than
    // spying on it again — vi.spyOn hands back the existing mock, calls and all.
    const load = vi.mocked(element.load);
    load.mockClear();
    controller.setSource('https://example.test/a.mp4');

    expect(load).not.toHaveBeenCalled();
  });
});
