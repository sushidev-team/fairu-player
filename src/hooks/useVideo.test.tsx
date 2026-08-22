/**
 * Video-specific behaviour on top of `useMedia`: control auto-hide, quality and
 * subtitle switching, and watch progress.
 *
 * Watch progress is the part with consequences outside the player — it decides
 * whether an episode counts as finished, which is what a "continue watching"
 * row and any completion reporting are built on. It also has the only real
 * algorithm in here: overlapping segments have to merge, or re-watching the
 * first minute five times would read as five minutes watched.
 *
 * The element is rendered through JSX rather than assigned to the ref
 * afterwards, because the hook subscribes to it in a mount effect — see
 * useMedia.controls.test.tsx for the same reasoning.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render } from '@testing-library/react';

const { FakeHls } = vi.hoisted(() => {
  class FakeHls {
    static isSupported = vi.fn(() => false);
    static Events = {
      MANIFEST_PARSED: 'hlsManifestParsed',
      LEVEL_SWITCHED: 'hlsLevelSwitched',
      LEVEL_LOADED: 'hlsLevelLoaded',
      ERROR: 'hlsError',
    };
    static ErrorTypes = { NETWORK_ERROR: 'n', MEDIA_ERROR: 'm', OTHER_ERROR: 'o' };
    on = vi.fn();
    loadSource = vi.fn();
    attachMedia = vi.fn();
    destroy = vi.fn();
    startLoad = vi.fn();
    recoverMediaError = vi.fn();
    currentLevel = -1;
  }
  return { FakeHls };
});

vi.mock('hls.js', () => ({ default: FakeHls }));

import { useVideo, type UseVideoOptions, type UseVideoReturn } from './useVideo';

let captured: UseVideoReturn;
let video: HTMLVideoElement;

function Harness({ options }: { options?: UseVideoOptions }) {
  const result = useVideo(options);
  captured = result;
  return (
    <div ref={result.containerRef as React.RefObject<HTMLDivElement>}>
      <video ref={result.videoRef as React.RefObject<HTMLVideoElement>} />
    </div>
  );
}

function setup(options: UseVideoOptions = {}, stubs: { duration?: number } = {}) {
  const utils = render(<Harness options={options} />);
  video = utils.container.querySelector('video')!;

  let currentTime = 0;
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: (v: number) => {
      currentTime = v;
    },
  });
  Object.defineProperty(video, 'duration', {
    configurable: true,
    get: () => stubs.duration ?? 100,
  });
  video.play = vi.fn(async () => {});
  video.pause = vi.fn();
  video.load = vi.fn();

  return utils;
}

/** A writable stand-in for `video.textTracks`, keyed by label. */
function stubTextTracks(labels: string[]) {
  const tracks = labels.map((label) => ({
    kind: 'subtitles',
    label,
    mode: 'disabled' as TextTrackMode,
  }));
  const list = Object.assign(tracks.slice(), { length: tracks.length });
  tracks.forEach((track, i) => {
    (list as unknown as Record<number, unknown>)[i] = track;
  });
  Object.defineProperty(video, 'textTracks', { configurable: true, value: list });
  return tracks;
}

/** Fire a media event and let React flush. */
function fire(type: string) {
  act(() => {
    video.dispatchEvent(new Event(type));
  });
}

/**
 * Play from `from` to `to`, as the media element would report it.
 *
 * `loadedmetadata` comes first because watch progress is a percentage of the
 * duration, and the duration is 0 until that event — progress recorded before
 * it is discarded rather than divided by zero.
 */
function watch(from: number, to: number) {
  fire('loadedmetadata');

  // The starting point is published *before* play. A segment opens at whatever
  // `currentTime` the hook last saw, so seeking without a timeupdate first
  // would open it wherever the previous segment ended.
  video.currentTime = from;
  fire('timeupdate');

  fire('play');
  video.currentTime = to;
  fire('timeupdate');
  fire('pause');
}

describe('useVideo', () => {
  beforeEach(() => {
    FakeHls.isSupported.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('control visibility', () => {
    it('starts visible', () => {
      setup();
      expect(captured.state.controlsVisible).toBe(true);
    });

    it('hides after the delay once playing', () => {
      vi.useFakeTimers();
      setup({ controlsHideDelay: 3000 });

      fire('play');
      expect(captured.state.controlsVisible).toBe(true);

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(captured.state.controlsVisible).toBe(false);
    });

    it('stays visible while paused', () => {
      vi.useFakeTimers();
      setup({ controlsHideDelay: 3000 });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(captured.state.controlsVisible).toBe(true);
    });

    it('comes back on demand and restarts the timer', () => {
      vi.useFakeTimers();
      setup({ controlsHideDelay: 3000 });

      fire('play');
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(captured.state.controlsVisible).toBe(false);

      act(() => captured.controls.showControls());
      expect(captured.state.controlsVisible).toBe(true);

      act(() => {
        vi.advanceTimersByTime(2999);
      });
      expect(captured.state.controlsVisible).toBe(true);
    });

    it('hides immediately on request', () => {
      setup();
      act(() => captured.controls.hideControls());
      expect(captured.state.controlsVisible).toBe(false);
    });

    it('reappears when playback pauses', () => {
      vi.useFakeTimers();
      setup({ controlsHideDelay: 1000 });

      fire('play');
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(captured.state.controlsVisible).toBe(false);

      fire('pause');
      expect(captured.state.controlsVisible).toBe(true);
    });

    it('drops its timer on unmount', () => {
      vi.useFakeTimers();
      const clearTimeout = vi.spyOn(globalThis, 'clearTimeout');
      const { unmount } = setup();

      act(() => captured.controls.showControls());
      clearTimeout.mockClear();
      unmount();

      expect(clearTimeout).toHaveBeenCalled();
    });
  });

  describe('quality switching', () => {
    const QUALITIES = [
      { label: '1080p', src: 'https://example.test/1080.mp4' },
      { label: '720p', src: 'https://example.test/720.mp4' },
    ];

    it('publishes the available qualities for a progressive source', () => {
      setup({ src: 'https://example.test/1080.mp4', qualities: QUALITIES });
      expect(captured.state.availableQualities).toHaveLength(2);
    });

    it('swaps the source and keeps the position', () => {
      // Changing quality mid-watch must not send the viewer back to zero.
      setup({ src: 'https://example.test/1080.mp4', qualities: QUALITIES });
      video.currentTime = 42;

      act(() => captured.controls.setQuality('720p'));

      expect(video.src).toContain('720.mp4');
      expect(video.load).toHaveBeenCalled();
      expect(video.currentTime).toBe(42);
      expect(captured.state.currentQuality).toBe('720p');
    });

    it('resumes playback if it was playing', () => {
      setup({ src: 'https://example.test/1080.mp4', qualities: QUALITIES });
      Object.defineProperty(video, 'paused', { configurable: true, value: false });

      act(() => captured.controls.setQuality('720p'));

      expect(video.play).toHaveBeenCalled();
    });

    it('stays paused if it was paused', () => {
      setup({ src: 'https://example.test/1080.mp4', qualities: QUALITIES });
      Object.defineProperty(video, 'paused', { configurable: true, value: true });

      act(() => captured.controls.setQuality('720p'));

      expect(video.play).not.toHaveBeenCalled();
    });

    it('ignores an unknown label', () => {
      setup({ src: 'https://example.test/1080.mp4', qualities: QUALITIES });
      const before = video.src;

      act(() => captured.controls.setQuality('4K'));

      expect(video.src).toBe(before);
    });
  });

  describe('subtitles', () => {
    it('records the choice even before a track exists', () => {
      setup();
      act(() => captured.controls.setSubtitle('de'));
      expect(captured.state.currentSubtitle).toBe('de');
    });

    it('shows the matching track and hides the rest', () => {
      // jsdom's addTextTrack does not give back a track whose `mode` is
      // writable, so the list is stubbed. What is under test is which track the
      // hook decides to show, not the browser's TextTrack implementation.
      setup();
      const tracks = stubTextTracks(['de', 'en']);

      act(() => captured.controls.setSubtitle('de'));

      expect(tracks[0].mode).toBe('showing');
      expect(tracks[1].mode).toBe('hidden');
    });

    it('hides everything when switched off', () => {
      setup();
      const tracks = stubTextTracks(['de']);

      act(() => captured.controls.setSubtitle('de'));
      act(() => captured.controls.setSubtitle(null));

      expect(tracks[0].mode).toBe('hidden');
      expect(captured.state.currentSubtitle).toBeNull();
    });
  });

  describe('watch progress', () => {
    it('starts empty', () => {
      setup();
      expect(captured.state.watchProgress.percentageWatched).toBe(0);
      expect(captured.state.watchProgress.watchedSegments).toEqual([]);
    });

    it('records a watched segment', () => {
      setup({}, { duration: 100 });

      watch(0, 25);

      expect(captured.state.watchProgress.percentageWatched).toBeCloseTo(25, 0);
    });

    it('adds up separate segments', () => {
      setup({}, { duration: 100 });

      watch(0, 20);
      watch(60, 80);

      expect(captured.state.watchProgress.percentageWatched).toBeCloseTo(40, 0);
    });

    it('merges overlapping segments instead of double counting', () => {
      // Re-watching the same minute five times is still one minute watched.
      setup({}, { duration: 100 });

      watch(0, 30);
      watch(10, 40);

      expect(captured.state.watchProgress.percentageWatched).toBeCloseTo(40, 0);
      expect(captured.state.watchProgress.watchedSegments).toHaveLength(1);
    });

    it('tracks the furthest point reached', () => {
      setup({}, { duration: 100 });

      watch(0, 50);
      watch(10, 20);

      expect(captured.state.watchProgress.furthestPoint).toBe(50);
    });

    it('calls onWatchProgressUpdate as it goes', () => {
      const onWatchProgressUpdate = vi.fn();
      setup({ onWatchProgressUpdate }, { duration: 100 });

      watch(0, 25);

      expect(onWatchProgressUpdate).toHaveBeenCalled();
    });

    it('marks the video finished past 95 percent', () => {
      const onFinished = vi.fn();
      setup({ onFinished }, { duration: 100 });

      watch(0, 96);

      expect(captured.state.watchProgress.isFullyWatched).toBe(true);
      expect(onFinished).toHaveBeenCalledOnce();
    });

    it('reports finished only once', () => {
      const onFinished = vi.fn();
      setup({ onFinished }, { duration: 100 });

      watch(0, 96);
      watch(20, 40);

      expect(onFinished).toHaveBeenCalledOnce();
    });

    it('ignores progress before the duration is known', () => {
      // Duration is 0 until loadedmetadata; a percentage against it would be
      // Infinity and would mark everything watched.
      setup({}, { duration: 0 });

      watch(0, 25);

      expect(captured.state.watchProgress.percentageWatched).toBe(0);
    });

    it('ignores a zero-length segment', () => {
      setup({}, { duration: 100 });

      watch(30, 30);

      expect(captured.state.watchProgress.watchedSegments).toEqual([]);
    });
  });

  describe('first play', () => {
    it('reports onStart once', () => {
      const onStart = vi.fn();
      setup({ onStart });

      fire('play');
      fire('pause');
      fire('play');

      expect(onStart).toHaveBeenCalledOnce();
    });
  });

  describe('changing the source', () => {
    it('resets watch progress', () => {
      // Progress belongs to a video, not to the player instance.
      const { rerender } = setup({ src: 'https://example.test/a.mp4' }, { duration: 100 });

      watch(0, 50);
      expect(captured.state.watchProgress.percentageWatched).toBeGreaterThan(0);

      rerender(<Harness options={{ src: 'https://example.test/b.mp4' }} />);

      expect(captured.state.watchProgress.percentageWatched).toBe(0);
      expect(captured.state.watchProgress.watchedSegments).toEqual([]);
    });

    it('lets onStart fire again for the new video', () => {
      const onStart = vi.fn();
      const { rerender } = setup({ src: 'https://example.test/a.mp4', onStart });

      fire('play');
      // Back to paused first: onStart is keyed on the transition into playing,
      // so a source swap while already playing produces no new transition.
      fire('pause');
      rerender(<Harness options={{ src: 'https://example.test/b.mp4', onStart }} />);
      fire('play');

      expect(onStart).toHaveBeenCalledTimes(2);
    });
  });

  describe('aspect ratio', () => {
    it('follows the loaded video dimensions', () => {
      setup();
      Object.defineProperty(video, 'videoWidth', { configurable: true, value: 1280 });
      Object.defineProperty(video, 'videoHeight', { configurable: true, value: 720 });

      fire('loadedmetadata');

      expect(captured.state.aspectRatio).toBeCloseTo(16 / 9);
    });

    it('keeps the default while the dimensions are unknown', () => {
      setup();
      fire('loadedmetadata');
      expect(captured.state.aspectRatio).toBeCloseTo(16 / 9);
    });
  });
});
