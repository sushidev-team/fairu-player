/**
 * A single reel slide.
 *
 * Two things here are load-bearing and were both untested. The source is
 * released when a slide leaves the mounted window — mobile Safari refuses to
 * decode more than a handful of media elements at once, so a feed that keeps
 * every source attached stops playing after a few swipes. And the tap handling
 * has to tell a tap, a double-tap and a hold apart from one another, on a
 * surface where all three start identically.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { ReelItem } from './ReelItem';
import type { Reel, ReelInteraction } from '@/types/reels';

// ReelItem ignores what useHLS returns; it only needs it not to fetch a
// manifest. HLS attachment has its own tests.
vi.mock('@/hooks/useHLS', () => ({
  useHLS: () => ({
    isHLS: false,
    isUsingHlsJs: false,
    hlsInstance: null,
    levels: [],
    currentLevel: -1,
  }),
}));

const REEL: Reel = {
  id: 'r-1',
  src: 'https://example.test/r-1.mp4',
  caption: 'Ein Reel',
};

const INTERACTION: ReelInteraction = {
  liked: false,
  saved: false,
  following: false,
  likeDelta: 0,
};

type Props = Partial<React.ComponentProps<typeof ReelItem>>;

function renderItem(props: Props = {}) {
  const view = render(
    <ReelItem
      reel={REEL}
      interaction={INTERACTION}
      active
      playing
      muted
      shouldLoad
      {...props}
    />
  );

  const video = view.container.querySelector('video') as HTMLVideoElement;
  const surface = view.container.firstElementChild as HTMLElement;

  return {
    ...view,
    video,
    surface,
    /** Re-render with a different slice of feed state. */
    update(next: Props) {
      view.rerender(
        <ReelItem
          reel={REEL}
          interaction={INTERACTION}
          active
          playing
          muted
          shouldLoad
          {...props}
          {...next}
        />
      );
    },
  };
}

/** Replace one element's media method, shadowing the global stub. */
function stub<K extends 'play' | 'pause' | 'load'>(
  video: HTMLMediaElement,
  method: K,
  implementation: () => unknown
) {
  const spy = vi.fn(implementation);
  Object.defineProperty(video, method, { value: spy, configurable: true });
  return spy;
}

/** jsdom's currentTime is read-only; make it observable. */
function trackCurrentTime(video: HTMLMediaElement, initial = 0) {
  let value = initial;
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => value,
    set: (next: number) => {
      value = next;
    },
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ReelItem', () => {
  describe('the source', () => {
    it('is attached once the slide should load', () => {
      const { video } = renderItem();

      expect(video.getAttribute('src')).toBe(REEL.src);
    });

    it('is never attached for a slide outside the window', () => {
      const { video } = renderItem({ shouldLoad: false });

      expect(video.getAttribute('src')).toBeNull();
    });

    it('is released when the slide leaves the window', () => {
      const { video, update } = renderItem();
      const load = stub(video, 'load', () => {});
      const pause = stub(video, 'pause', () => {});

      update({ shouldLoad: false, active: false });

      // Removing the attribute is not enough on its own — the decoder only
      // lets go after a load() with no source.
      expect(video.getAttribute('src')).toBeNull();
      expect(load).toHaveBeenCalled();
      expect(pause).toHaveBeenCalled();
    });

    it('leaves an HLS source to the HLS attachment', () => {
      const { video } = renderItem({
        reel: { ...REEL, src: 'https://example.test/r-1.m3u8' },
      });

      // Setting .src on the element would make the browser fetch the manifest
      // itself and race hls.js for the same stream.
      expect(video.getAttribute('src')).toBeNull();
    });
  });

  describe('playback', () => {
    it('plays when the slide is active and the feed is running', () => {
      const { video, update } = renderItem({ active: false });
      const play = stub(video, 'play', () => Promise.resolve());

      update({ active: true });

      expect(play).toHaveBeenCalled();
    });

    it('pauses when the feed pauses', () => {
      const { video, update } = renderItem();
      const play = stub(video, 'play', () => Promise.resolve());
      const pause = stub(video, 'pause', () => {});

      update({ playing: false });

      expect(pause).toHaveBeenCalled();
      expect(play).not.toHaveBeenCalled();
    });

    it('rewinds when the slide leaves the viewport', () => {
      const { video, update } = renderItem();
      trackCurrentTime(video, 12);

      update({ active: false });

      // Coming back to a reel restarts it, which is what every short-form feed
      // does — resuming half way through reads as a bug.
      expect(video.currentTime).toBe(0);
    });

    it('keeps the playhead when only the feed pauses', () => {
      const { video, update } = renderItem();
      trackCurrentTime(video, 12);

      update({ playing: false });

      expect(video.currentTime).toBe(12);
    });

    it('survives a browser that refuses to seek before metadata', () => {
      const { video, update } = renderItem();
      Object.defineProperty(video, 'currentTime', {
        configurable: true,
        get: () => 0,
        set: () => {
          throw new Error('InvalidStateError');
        },
      });

      expect(() => update({ active: false })).not.toThrow();
    });

    it('reports a refused play while muted', () => {
      const onError = vi.fn();
      const { video, update } = renderItem({ active: false, onError });
      stub(video, 'play', () => Promise.reject(new Error('NotAllowedError')));

      update({ active: true });

      return Promise.resolve().then(() => {
        // A muted video that will not start is a real failure — the autoplay
        // policy allows muted playback everywhere.
        expect(onError).toHaveBeenCalled();
      });
    });

    it('stays quiet when an unmuted play is refused', () => {
      const onError = vi.fn();
      const { video, update } = renderItem({ active: false, muted: false, onError });
      stub(video, 'play', () => Promise.reject(new Error('NotAllowedError')));

      update({ active: true, muted: false });

      return Promise.resolve().then(() => {
        // Expected: no browser autoplays sound without a gesture. Reporting it
        // would train hosts to ignore onError.
        expect(onError).not.toHaveBeenCalled();
      });
    });

    it('follows the feed mute state', () => {
      const { video, update } = renderItem({ muted: true });
      expect(video.muted).toBe(true);

      update({ muted: false });
      expect(video.muted).toBe(false);
    });
  });

  describe('tapping', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('toggles playback on a single tap', () => {
      const onTogglePlay = vi.fn();
      const { surface } = renderItem({ onTogglePlay });

      fireEvent.click(surface);
      expect(onTogglePlay).not.toHaveBeenCalled();

      // The toggle waits out the double-tap window; firing it immediately
      // would pause the reel every time someone likes it.
      act(() => {
        vi.advanceTimersByTime(280);
      });
      expect(onTogglePlay).toHaveBeenCalledTimes(1);
    });

    it('likes on a double tap instead of toggling', () => {
      const onLike = vi.fn();
      const onTogglePlay = vi.fn();
      const { surface } = renderItem({ onLike, onTogglePlay });

      fireEvent.click(surface);
      act(() => {
        vi.advanceTimersByTime(100);
      });
      fireEvent.click(surface);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onLike).toHaveBeenCalledTimes(1);
      expect(onTogglePlay).not.toHaveBeenCalled();
    });

    it('never un-likes on a double tap', () => {
      const onLike = vi.fn();
      const { surface } = renderItem({
        interaction: { ...INTERACTION, liked: true },
        onLike,
      });

      fireEvent.click(surface);
      act(() => {
        vi.advanceTimersByTime(100);
      });
      fireEvent.click(surface);

      // Matching Instagram: a double-tap only ever adds a like, because a
      // mistimed tap that removed one would be destructive.
      expect(onLike).not.toHaveBeenCalled();
    });

    it('toggles at once when double-tap liking is switched off', () => {
      const onTogglePlay = vi.fn();
      const { surface } = renderItem({
        features: { doubleTapLike: false },
        onTogglePlay,
      });

      fireEvent.click(surface);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // No double-tap to wait for, so no reason to make the viewer wait.
      expect(onTogglePlay).toHaveBeenCalledTimes(1);
    });

    it('drops a pending tap when the slide is swiped away', () => {
      const onTogglePlay = vi.fn();
      const { surface, unmount } = renderItem({ onTogglePlay });

      fireEvent.click(surface);
      unmount();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Left running, the timer would toggle whichever slide became active in
      // the meantime.
      expect(onTogglePlay).not.toHaveBeenCalled();
    });
  });

  describe('holding', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('pauses while held and resumes on release', () => {
      const { video, surface } = renderItem();
      const pause = stub(video, 'pause', () => {});

      fireEvent.pointerDown(surface, { pointerId: 1 });
      act(() => {
        vi.advanceTimersByTime(220);
      });
      expect(pause).toHaveBeenCalled();

      const play = stub(video, 'play', () => Promise.resolve());
      fireEvent.pointerUp(surface, { pointerId: 1 });
      expect(play).toHaveBeenCalled();
    });

    it('does not pause on a press shorter than the hold', () => {
      const { video, surface } = renderItem();
      const pause = stub(video, 'pause', () => {});

      fireEvent.pointerDown(surface, { pointerId: 1 });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      fireEvent.pointerUp(surface, { pointerId: 1 });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(pause).not.toHaveBeenCalled();
    });

    it('releases the hold when the pointer leaves the surface', () => {
      const { video, surface } = renderItem();
      stub(video, 'pause', () => {});

      fireEvent.pointerDown(surface, { pointerId: 1 });
      act(() => {
        vi.advanceTimersByTime(220);
      });

      const play = stub(video, 'play', () => Promise.resolve());
      fireEvent.pointerLeave(surface, { pointerId: 1 });

      // A finger that slides off the edge still ended the hold; without this
      // the reel stays paused with nothing touching it.
      expect(play).toHaveBeenCalled();
    });

    it('ignores holds when the feature is off', () => {
      const { video, surface } = renderItem({ features: { holdToPause: false } });
      const pause = stub(video, 'pause', () => {});

      fireEvent.pointerDown(surface, { pointerId: 1 });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(pause).not.toHaveBeenCalled();
    });
  });

  describe('media events', () => {
    it('reports the end of the reel', () => {
      const onEnded = vi.fn();
      const { video } = renderItem({ onEnded });

      fireEvent(video, new Event('ended'));

      expect(onEnded).toHaveBeenCalled();
    });

    it('reports progress', () => {
      const onProgress = vi.fn();
      const { video } = renderItem({ onProgress });
      trackCurrentTime(video, 4);

      fireEvent(video, new Event('timeupdate'));

      expect(onProgress).toHaveBeenCalledWith(4, expect.any(Number));
    });

    it('reports a media error', () => {
      const onError = vi.fn();
      const { video } = renderItem({ onError });

      fireEvent(video, new Event('error'));

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
