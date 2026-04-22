import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MediaState, MediaControls } from '@/types/media';
import type { VideoQuality } from '@/types/video';
import { initialWatchProgress } from '@/types/video';

// ─── Mock sub-hooks ──────────────────────────────────────────────────
// We mock every sub-hook so we can isolate the logic that lives in useVideo itself.

const mockMediaState: MediaState = {
  isPlaying: false,
  isPaused: true,
  isLoading: false,
  isBuffering: false,
  isEnded: false,
  isMuted: false,
  currentTime: 0,
  duration: 100,
  buffered: 0,
  volume: 1,
  playbackRate: 1,
  error: null,
  retryCount: 0,
  isRetrying: false,
};

const mockMediaControls: MediaControls = {
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  toggle: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  seek: vi.fn(),
  seekTo: vi.fn(),
  skipForward: vi.fn(),
  skipBackward: vi.fn(),
  setVolume: vi.fn(),
  toggleMute: vi.fn(),
  setPlaybackRate: vi.fn(),
  retry: vi.fn().mockResolvedValue(undefined),
};

let currentMediaState = { ...mockMediaState };
let currentMediaControls = { ...mockMediaControls };
const mockVideoRef = { current: document.createElement('video') };

vi.mock('./useMedia', () => ({
  useMedia: vi.fn(() => ({
    mediaRef: mockVideoRef,
    state: currentMediaState,
    controls: currentMediaControls,
  })),
}));

vi.mock('./useFullscreen', () => ({
  useFullscreen: vi.fn(() => ({
    isFullscreen: false,
    enterFullscreen: vi.fn().mockResolvedValue(undefined),
    exitFullscreen: vi.fn().mockResolvedValue(undefined),
    toggleFullscreen: vi.fn().mockResolvedValue(undefined),
    isSupported: true,
  })),
}));

vi.mock('./usePictureInPicture', () => ({
  usePictureInPicture: vi.fn(() => ({
    isPictureInPicture: false,
    enterPictureInPicture: vi.fn().mockResolvedValue(undefined),
    exitPictureInPicture: vi.fn().mockResolvedValue(undefined),
    togglePictureInPicture: vi.fn().mockResolvedValue(undefined),
    isSupported: true,
  })),
}));

vi.mock('./useCast', () => ({
  useCast: vi.fn(() => ({
    isCasting: false,
    toggleCast: vi.fn().mockResolvedValue(undefined),
    isSupported: false,
  })),
}));

vi.mock('./useTabVisibility', () => ({
  useTabVisibility: vi.fn(() => ({
    isTabVisible: true,
    hiddenSince: null,
  })),
}));

let mockHlsReturn = {
  isHLS: false,
  isUsingHlsJs: false,
  hlsInstance: null,
  levels: [] as VideoQuality[],
  currentLevel: -1,
  setLevel: vi.fn(),
  isAutoQuality: true,
  setAutoQuality: vi.fn(),
  attachHLS: vi.fn(),
  detachHLS: vi.fn(),
};

/** Captures the onQualityLevelsLoaded callback from useHLS calls */
let capturedHlsOnQualityLevelsLoaded: ((levels: VideoQuality[]) => void) | undefined;

vi.mock('./useHLS', () => ({
  useHLS: vi.fn((opts: any) => {
    capturedHlsOnQualityLevelsLoaded = opts?.onQualityLevelsLoaded;
    return mockHlsReturn;
  }),
  isHLSSource: vi.fn((src: string | undefined) => {
    if (!src) return false;
    return src.endsWith('.m3u8') || src.includes('.m3u8?') || src.includes('/manifest/');
  }),
}));

// Import after mocks
import { useVideo } from './useVideo';
import type { UseVideoOptions } from './useVideo';
import { useMedia } from './useMedia';
import { useTabVisibility } from './useTabVisibility';

// ─── Helpers ─────────────────────────────────────────────────────────

function resetMocks() {
  currentMediaState = { ...mockMediaState };
  currentMediaControls = {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    toggle: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    seek: vi.fn(),
    seekTo: vi.fn(),
    skipForward: vi.fn(),
    skipBackward: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    setPlaybackRate: vi.fn(),
    retry: vi.fn().mockResolvedValue(undefined),
  };
  mockHlsReturn = {
    isHLS: false,
    isUsingHlsJs: false,
    hlsInstance: null,
    levels: [],
    currentLevel: -1,
    setLevel: vi.fn(),
    isAutoQuality: true,
    setAutoQuality: vi.fn(),
    attachHLS: vi.fn(),
    detachHLS: vi.fn(),
  };
  capturedHlsOnQualityLevelsLoaded = undefined;
  mockVideoRef.current = document.createElement('video');
}

/**
 * Stable empty array used as default `qualities` to avoid infinite
 * render loops. Inside useVideo, `qualities = []` creates a new
 * array identity on every render, which destabilises the effect
 * dep list and triggers an infinite update cycle in tests.
 */
const EMPTY_QUALITIES: VideoQuality[] = [];

function renderVideoHook(options: UseVideoOptions = {}) {
  const stableOpts: UseVideoOptions = { qualities: EMPTY_QUALITIES, ...options };
  const hookReturn = renderHook(
    ({ opts }: { opts: UseVideoOptions }) =>
      useVideo({ qualities: EMPTY_QUALITIES, ...opts }),
    { initialProps: { opts: stableOpts } as { opts: UseVideoOptions } },
  );
  return hookReturn;
}

/**
 * Create a mock video element with a textTracks-like structure.
 * jsdom does not implement addTextTrack, so we mock the textTracks property.
 */
function createVideoWithTextTracks(
  tracks: Array<{ kind: string; label: string; mode: string }>,
) {
  const video = document.createElement('video');
  const trackObjects = tracks.map((t) => ({
    kind: t.kind,
    label: t.label,
    mode: t.mode,
  }));
  Object.defineProperty(video, 'textTracks', {
    value: {
      length: trackObjects.length,
      ...trackObjects.reduce(
        (acc, track, i) => {
          acc[i] = track;
          return acc;
        },
        {} as Record<number, (typeof trackObjects)[0]>,
      ),
    },
    writable: true,
  });
  return { video, tracks: trackObjects };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('useVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  // ─── Initial state ─────────────────────────────────────────────

  describe('initial state', () => {
    it('returns videoRef and containerRef', () => {
      const { result } = renderVideoHook();

      expect(result.current.videoRef).toBeDefined();
      expect(result.current.containerRef).toBeDefined();
    });

    it('returns composed state from media and video-specific state', () => {
      const { result } = renderVideoHook();
      const { state } = result.current;

      expect(state.isPlaying).toBe(false);
      expect(state.isPaused).toBe(true);
      expect(state.isFullscreen).toBe(false);
      expect(state.isPictureInPicture).toBe(false);
      expect(state.isCasting).toBe(false);
      expect(state.isTabVisible).toBe(true);
      expect(state.controlsVisible).toBe(true);
      expect(state.currentQuality).toBe('auto');
      expect(state.aspectRatio).toBe(16 / 9);
      expect(state.posterLoaded).toBe(false);
      expect(state.currentSubtitle).toBeNull();
      expect(state.isHLS).toBe(false);
      expect(state.isAutoQuality).toBe(false); // isUsingHlsJs is false
    });

    it('returns initial watch progress', () => {
      const { result } = renderVideoHook();

      expect(result.current.state.watchProgress).toEqual(initialWatchProgress);
    });

    it('returns video-specific controls', () => {
      const { result } = renderVideoHook();
      const { controls } = result.current;

      expect(typeof controls.enterFullscreen).toBe('function');
      expect(typeof controls.exitFullscreen).toBe('function');
      expect(typeof controls.toggleFullscreen).toBe('function');
      expect(typeof controls.enterPictureInPicture).toBe('function');
      expect(typeof controls.exitPictureInPicture).toBe('function');
      expect(typeof controls.togglePictureInPicture).toBe('function');
      expect(typeof controls.toggleCast).toBe('function');
      expect(typeof controls.setQuality).toBe('function');
      expect(typeof controls.setSubtitle).toBe('function');
      expect(typeof controls.showControls).toBe('function');
      expect(typeof controls.hideControls).toBe('function');
      expect(typeof controls.setAutoQuality).toBe('function');
    });

    it('includes media controls in return value', () => {
      const { result } = renderVideoHook();
      const { controls } = result.current;

      expect(typeof controls.play).toBe('function');
      expect(typeof controls.pause).toBe('function');
      expect(typeof controls.toggle).toBe('function');
      expect(typeof controls.seek).toBe('function');
    });
  });

  // ─── Controls visibility ───────────────────────────────────────

  describe('controls visibility', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows controls and sets hide timeout', () => {
      const { result } = renderVideoHook({ controlsHideDelay: 3000 });

      act(() => {
        result.current.controls.hideControls();
      });
      expect(result.current.state.controlsVisible).toBe(false);

      act(() => {
        result.current.controls.showControls();
      });
      expect(result.current.state.controlsVisible).toBe(true);
    });

    it('hides controls after timeout when playing', () => {
      currentMediaState = { ...mockMediaState, isPlaying: true };
      const { result } = renderVideoHook({ controlsHideDelay: 3000 });

      act(() => {
        result.current.controls.showControls();
      });
      expect(result.current.state.controlsVisible).toBe(true);

      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(result.current.state.controlsVisible).toBe(false);
    });

    it('does not hide controls after timeout when paused', () => {
      currentMediaState = { ...mockMediaState, isPlaying: false };
      const { result } = renderVideoHook({ controlsHideDelay: 3000 });

      act(() => {
        result.current.controls.showControls();
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.state.controlsVisible).toBe(true);
    });

    it('uses custom controlsHideDelay', () => {
      currentMediaState = { ...mockMediaState, isPlaying: true };
      const { result } = renderVideoHook({ controlsHideDelay: 1000 });

      act(() => {
        result.current.controls.showControls();
      });

      act(() => {
        vi.advanceTimersByTime(999);
      });
      expect(result.current.state.controlsVisible).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current.state.controlsVisible).toBe(false);
    });

    it('hideControls immediately hides and clears timeout', () => {
      const { result } = renderVideoHook();

      act(() => {
        result.current.controls.showControls();
      });
      expect(result.current.state.controlsVisible).toBe(true);

      act(() => {
        result.current.controls.hideControls();
      });
      expect(result.current.state.controlsVisible).toBe(false);
    });

    it('resets hide timeout when showControls is called again', () => {
      currentMediaState = { ...mockMediaState, isPlaying: true };
      const { result } = renderVideoHook({ controlsHideDelay: 3000 });

      act(() => {
        result.current.controls.showControls();
      });

      // Advance 2s
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(result.current.state.controlsVisible).toBe(true);

      // Show again, resetting the timer
      act(() => {
        result.current.controls.showControls();
      });

      // Advance another 2s (total 4s from first show, but only 2s from second)
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(result.current.state.controlsVisible).toBe(true);

      // Now 3s from second show
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current.state.controlsVisible).toBe(false);
    });

    it('shows controls and auto-hides when playback starts', () => {
      const { result, rerender } = renderVideoHook();

      // Initially paused, controls visible
      expect(result.current.state.controlsVisible).toBe(true);

      // Start playing
      currentMediaState = { ...mockMediaState, isPlaying: true };
      rerender({ opts: {} });

      // Controls should still be visible (auto-hide timer started)
      expect(result.current.state.controlsVisible).toBe(true);

      // After delay, controls should hide
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(result.current.state.controlsVisible).toBe(false);
    });

    it('shows controls when playback pauses', () => {
      currentMediaState = { ...mockMediaState, isPlaying: true };
      const { result, rerender } = renderVideoHook();

      // Hide controls
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(result.current.state.controlsVisible).toBe(false);

      // Pause
      currentMediaState = { ...mockMediaState, isPlaying: false };
      rerender({ opts: {} });

      expect(result.current.state.controlsVisible).toBe(true);
    });
  });

  // ─── Quality selection ─────────────────────────────────────────

  describe('quality selection', () => {
    it('sets quality for progressive video by finding matching quality', () => {
      const qualities: VideoQuality[] = [
        { label: '720p', src: 'https://example.com/720.mp4' },
        { label: '1080p', src: 'https://example.com/1080.mp4' },
      ];
      const { result } = renderVideoHook({ qualities });

      act(() => {
        result.current.controls.setQuality('1080p');
      });

      expect(result.current.state.currentQuality).toBe('1080p');
    });

    it('sets video src and calls load for progressive quality switch', () => {
      const video = document.createElement('video');
      Object.defineProperty(video, 'currentTime', { writable: true, value: 50 });
      Object.defineProperty(video, 'paused', { writable: true, value: true });
      const loadSpy = vi.spyOn(video, 'load');
      mockVideoRef.current = video;

      const qualities: VideoQuality[] = [
        { label: '720p', src: 'https://example.com/720.mp4' },
        { label: '1080p', src: 'https://example.com/1080.mp4' },
      ];
      const { result } = renderVideoHook({ qualities });

      act(() => {
        result.current.controls.setQuality('1080p');
      });

      expect(video.src).toContain('1080.mp4');
      expect(loadSpy).toHaveBeenCalled();
      // Should restore currentTime
      expect(video.currentTime).toBe(50);
    });

    it('resumes playback after quality switch if was playing', () => {
      const video = document.createElement('video');
      Object.defineProperty(video, 'currentTime', { writable: true, value: 50 });
      Object.defineProperty(video, 'paused', { writable: true, value: false });
      const playSpy = vi.spyOn(video, 'play');
      mockVideoRef.current = video;

      const qualities: VideoQuality[] = [
        { label: '720p', src: 'https://example.com/720.mp4' },
        { label: '1080p', src: 'https://example.com/1080.mp4' },
      ];
      const { result } = renderVideoHook({ qualities });

      act(() => {
        result.current.controls.setQuality('1080p');
      });

      expect(playSpy).toHaveBeenCalled();
    });

    it('does not change src if same quality src is already set', () => {
      const video = document.createElement('video');
      video.src = 'https://example.com/720.mp4';
      mockVideoRef.current = video;
      const loadSpy = vi.spyOn(video, 'load');

      const qualities: VideoQuality[] = [
        { label: '720p', src: 'https://example.com/720.mp4' },
      ];
      const { result } = renderVideoHook({ qualities });

      act(() => {
        result.current.controls.setQuality('720p');
      });

      // src is the same, so load should not be called
      expect(loadSpy).not.toHaveBeenCalled();
    });

    it('does nothing when video ref is null', () => {
      mockVideoRef.current = null as any;
      const { result } = renderVideoHook({
        qualities: [{ label: '720p', src: 'https://example.com/720.mp4' }],
      });

      // Should not throw
      act(() => {
        result.current.controls.setQuality('720p');
      });
    });

    it('uses HLS level switching when using hls.js', () => {
      const hlsLevels: VideoQuality[] = [
        { label: 'Auto', src: '', bitrate: 0 },
        { label: '720p', src: '', bitrate: 2500000 },
        { label: '1080p', src: '', bitrate: 5000000 },
      ];
      mockHlsReturn = {
        ...mockHlsReturn,
        isHLS: true,
        isUsingHlsJs: true,
        levels: hlsLevels,
      };

      const { result } = renderVideoHook();

      // Simulate HLS quality levels being loaded (triggers internal hlsQualityLevels state)
      act(() => {
        capturedHlsOnQualityLevelsLoaded?.(hlsLevels);
      });

      act(() => {
        result.current.controls.setQuality('1080p');
      });

      expect(mockHlsReturn.setLevel).toHaveBeenCalledWith(2);
      expect(result.current.state.currentQuality).toBe('1080p');
    });

    it('uses Auto label correctly with HLS', () => {
      const hlsLevels: VideoQuality[] = [
        { label: 'Auto', src: '', bitrate: 0 },
        { label: '720p', src: '', bitrate: 2500000 },
      ];
      mockHlsReturn = {
        ...mockHlsReturn,
        isHLS: true,
        isUsingHlsJs: true,
        levels: hlsLevels,
      };

      const { result } = renderVideoHook();

      act(() => {
        capturedHlsOnQualityLevelsLoaded?.(hlsLevels);
      });

      act(() => {
        result.current.controls.setQuality('Auto');
      });

      expect(mockHlsReturn.setLevel).toHaveBeenCalledWith(0);
      expect(result.current.state.currentQuality).toBe('Auto');
    });

    it('ignores invalid quality label with HLS', () => {
      const hlsLevels: VideoQuality[] = [
        { label: 'Auto', src: '', bitrate: 0 },
        { label: '720p', src: '', bitrate: 2500000 },
      ];
      mockHlsReturn = {
        ...mockHlsReturn,
        isHLS: true,
        isUsingHlsJs: true,
        levels: hlsLevels,
      };

      const { result } = renderVideoHook();

      act(() => {
        capturedHlsOnQualityLevelsLoaded?.(hlsLevels);
      });

      act(() => {
        result.current.controls.setQuality('4K');
      });

      expect(mockHlsReturn.setLevel).not.toHaveBeenCalled();
    });
  });

  // ─── Subtitle selection ────────────────────────────────────────

  describe('subtitle selection', () => {
    it('sets currentSubtitle in state', () => {
      const { result } = renderVideoHook();

      act(() => {
        result.current.controls.setSubtitle('English');
      });

      expect(result.current.state.currentSubtitle).toBe('English');
    });

    it('sets subtitle to null to disable', () => {
      const { result } = renderVideoHook();

      act(() => {
        result.current.controls.setSubtitle('English');
      });
      expect(result.current.state.currentSubtitle).toBe('English');

      act(() => {
        result.current.controls.setSubtitle(null);
      });
      expect(result.current.state.currentSubtitle).toBeNull();
    });

    it('activates matching text track on video element', () => {
      const { video, tracks } = createVideoWithTextTracks([
        { kind: 'subtitles', label: 'English', mode: 'hidden' },
        { kind: 'subtitles', label: 'German', mode: 'hidden' },
      ]);
      mockVideoRef.current = video;

      const { result } = renderVideoHook();

      act(() => {
        result.current.controls.setSubtitle('English');
      });

      expect(tracks[0].mode).toBe('showing');
      expect(tracks[1].mode).toBe('hidden');
    });

    it('hides all tracks when setting subtitle to null', () => {
      const { video, tracks } = createVideoWithTextTracks([
        { kind: 'subtitles', label: 'English', mode: 'showing' },
        { kind: 'subtitles', label: 'German', mode: 'showing' },
      ]);
      mockVideoRef.current = video;

      const { result } = renderVideoHook();

      act(() => {
        result.current.controls.setSubtitle(null);
      });

      expect(tracks[0].mode).toBe('hidden');
      expect(tracks[1].mode).toBe('hidden');
    });

    it('handles setSubtitle when video ref is null', () => {
      mockVideoRef.current = null as any;
      const { result } = renderVideoHook();

      act(() => {
        result.current.controls.setSubtitle('English');
      });

      expect(result.current.state.currentSubtitle).toBe('English');
    });

    it('ignores non-subtitle tracks (e.g. descriptions)', () => {
      const { video, tracks } = createVideoWithTextTracks([
        { kind: 'subtitles', label: 'English', mode: 'hidden' },
        { kind: 'descriptions', label: 'Audio Desc', mode: 'hidden' },
      ]);
      mockVideoRef.current = video;

      const { result } = renderVideoHook();

      act(() => {
        result.current.controls.setSubtitle('English');
      });

      expect(tracks[0].mode).toBe('showing');
      expect(tracks[1].mode).toBe('hidden'); // descriptions track unchanged
    });

    it('handles captions kind tracks', () => {
      const { video, tracks } = createVideoWithTextTracks([
        { kind: 'captions', label: 'English CC', mode: 'hidden' },
      ]);
      mockVideoRef.current = video;

      const { result } = renderVideoHook();

      act(() => {
        result.current.controls.setSubtitle('English CC');
      });

      expect(tracks[0].mode).toBe('showing');
    });
  });

  // ─── Watch progress tracking ───────────────────────────────────

  describe('watch progress tracking', () => {
    it('tracks a segment when pausing after playing', () => {
      const onWatchProgressUpdate = vi.fn();
      const { rerender } = renderVideoHook({ onWatchProgressUpdate });

      // Start playing at time 10
      currentMediaState = { ...mockMediaState, isPlaying: true, currentTime: 10 };
      rerender({ opts: { onWatchProgressUpdate } });

      // Pause at time 30
      currentMediaState = { ...mockMediaState, isPlaying: false, currentTime: 30 };
      rerender({ opts: { onWatchProgressUpdate } });

      expect(onWatchProgressUpdate).toHaveBeenCalled();
      const lastCall = onWatchProgressUpdate.mock.calls[onWatchProgressUpdate.mock.calls.length - 1][0];
      expect(lastCall.watchedSegments.length).toBeGreaterThan(0);
      expect(lastCall.percentageWatched).toBeGreaterThan(0);
    });

    it('calculates percentageWatched correctly', () => {
      const onWatchProgressUpdate = vi.fn();
      const { rerender } = renderVideoHook({ onWatchProgressUpdate });

      // Play from 0 to 50 (50% of 100s)
      currentMediaState = { ...mockMediaState, isPlaying: true, currentTime: 0, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });

      currentMediaState = { ...mockMediaState, isPlaying: false, currentTime: 50, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });

      const lastCall = onWatchProgressUpdate.mock.calls[onWatchProgressUpdate.mock.calls.length - 1][0];
      expect(lastCall.percentageWatched).toBe(50);
    });

    it('merges overlapping segments', () => {
      const onWatchProgressUpdate = vi.fn();
      const { rerender } = renderVideoHook({ onWatchProgressUpdate });

      // First segment: 0-30
      currentMediaState = { ...mockMediaState, isPlaying: true, currentTime: 0, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });
      currentMediaState = { ...mockMediaState, isPlaying: false, currentTime: 30, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });

      // Second segment: 20-50 (overlaps with first)
      currentMediaState = { ...mockMediaState, isPlaying: true, currentTime: 20, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });
      currentMediaState = { ...mockMediaState, isPlaying: false, currentTime: 50, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });

      const lastCall = onWatchProgressUpdate.mock.calls[onWatchProgressUpdate.mock.calls.length - 1][0];
      // Merged: 0-50 = 50%
      expect(lastCall.percentageWatched).toBe(50);
      expect(lastCall.watchedSegments).toHaveLength(1);
    });

    it('merges adjacent segments within 0.5s', () => {
      const onWatchProgressUpdate = vi.fn();
      const { rerender } = renderVideoHook({ onWatchProgressUpdate });

      // First segment: 0-30
      currentMediaState = { ...mockMediaState, isPlaying: true, currentTime: 0, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });
      currentMediaState = { ...mockMediaState, isPlaying: false, currentTime: 30, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });

      // Second segment: 30.4-50 (adjacent, within 0.5s tolerance)
      currentMediaState = { ...mockMediaState, isPlaying: true, currentTime: 30.4, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });
      currentMediaState = { ...mockMediaState, isPlaying: false, currentTime: 50, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });

      const lastCall = onWatchProgressUpdate.mock.calls[onWatchProgressUpdate.mock.calls.length - 1][0];
      expect(lastCall.watchedSegments).toHaveLength(1);
      expect(lastCall.watchedSegments[0].start).toBe(0);
      expect(lastCall.watchedSegments[0].end).toBe(50);
    });

    it('keeps separate non-overlapping segments', () => {
      const onWatchProgressUpdate = vi.fn();
      const { rerender } = renderVideoHook({ onWatchProgressUpdate });

      // First segment: 0-20
      currentMediaState = { ...mockMediaState, isPlaying: true, currentTime: 0, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });
      currentMediaState = { ...mockMediaState, isPlaying: false, currentTime: 20, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });

      // Second segment: 50-80 (non-overlapping)
      currentMediaState = { ...mockMediaState, isPlaying: true, currentTime: 50, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });
      currentMediaState = { ...mockMediaState, isPlaying: false, currentTime: 80, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });

      const lastCall = onWatchProgressUpdate.mock.calls[onWatchProgressUpdate.mock.calls.length - 1][0];
      expect(lastCall.watchedSegments).toHaveLength(2);
      expect(lastCall.percentageWatched).toBe(50); // 20 + 30 = 50 out of 100
    });

    it('tracks furthest point', () => {
      const onWatchProgressUpdate = vi.fn();
      const { rerender } = renderVideoHook({ onWatchProgressUpdate });

      // Play to 80
      currentMediaState = { ...mockMediaState, isPlaying: true, currentTime: 80, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });
      currentMediaState = { ...mockMediaState, isPlaying: false, currentTime: 80, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });

      const lastCall = onWatchProgressUpdate.mock.calls[onWatchProgressUpdate.mock.calls.length - 1][0];
      expect(lastCall.furthestPoint).toBeGreaterThanOrEqual(80);
    });

    it('marks as fully watched at 95% or more', () => {
      const onWatchProgressUpdate = vi.fn();
      const onFinished = vi.fn();
      const { rerender } = renderVideoHook({ onWatchProgressUpdate, onFinished });

      // Watch 0-96 of a 100s video
      currentMediaState = { ...mockMediaState, isPlaying: true, currentTime: 0, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate, onFinished } });
      currentMediaState = { ...mockMediaState, isPlaying: false, currentTime: 96, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate, onFinished } });

      const lastCall = onWatchProgressUpdate.mock.calls[onWatchProgressUpdate.mock.calls.length - 1][0];
      expect(lastCall.isFullyWatched).toBe(true);
      expect(lastCall.percentageWatched).toBe(96);
    });

    it('fires onFinished when fully watched', () => {
      const onFinished = vi.fn();
      const { rerender } = renderVideoHook({ onFinished });

      currentMediaState = { ...mockMediaState, isPlaying: true, currentTime: 0, duration: 100 };
      rerender({ opts: { onFinished } });
      currentMediaState = { ...mockMediaState, isPlaying: false, currentTime: 96, duration: 100 };
      rerender({ opts: { onFinished } });

      expect(onFinished).toHaveBeenCalledTimes(1);
    });

    it('fires onFinished only once', () => {
      const onFinished = vi.fn();
      const { rerender } = renderVideoHook({ onFinished });

      // First full watch
      currentMediaState = { ...mockMediaState, isPlaying: true, currentTime: 0, duration: 100 };
      rerender({ opts: { onFinished } });
      currentMediaState = { ...mockMediaState, isPlaying: false, currentTime: 96, duration: 100 };
      rerender({ opts: { onFinished } });

      // Watch more
      currentMediaState = { ...mockMediaState, isPlaying: true, currentTime: 96, duration: 100 };
      rerender({ opts: { onFinished } });
      currentMediaState = { ...mockMediaState, isPlaying: false, currentTime: 100, duration: 100 };
      rerender({ opts: { onFinished } });

      expect(onFinished).toHaveBeenCalledTimes(1);
    });

    it('does not update progress when duration is 0', () => {
      const onWatchProgressUpdate = vi.fn();
      const { rerender } = renderVideoHook({ onWatchProgressUpdate });

      currentMediaState = { ...mockMediaState, isPlaying: true, currentTime: 0, duration: 0 };
      rerender({ opts: { onWatchProgressUpdate } });
      currentMediaState = { ...mockMediaState, isPlaying: false, currentTime: 10, duration: 0 };
      rerender({ opts: { onWatchProgressUpdate } });

      expect(onWatchProgressUpdate).not.toHaveBeenCalled();
    });

    it('does not create a segment when segment end equals start', () => {
      const onWatchProgressUpdate = vi.fn();
      const { rerender } = renderVideoHook({ onWatchProgressUpdate });

      // Play and immediately pause at the same time
      currentMediaState = { ...mockMediaState, isPlaying: true, currentTime: 10, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });
      currentMediaState = { ...mockMediaState, isPlaying: false, currentTime: 10, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });

      if (onWatchProgressUpdate.mock.calls.length > 0) {
        const lastCall = onWatchProgressUpdate.mock.calls[onWatchProgressUpdate.mock.calls.length - 1][0];
        expect(lastCall.watchedSegments).toHaveLength(0);
      }
    });

    it('caps percentageWatched at 100', () => {
      const onWatchProgressUpdate = vi.fn();
      const { rerender } = renderVideoHook({ onWatchProgressUpdate });

      // Watch entire video
      currentMediaState = { ...mockMediaState, isPlaying: true, currentTime: 0, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });
      currentMediaState = { ...mockMediaState, isPlaying: false, currentTime: 100, duration: 100 };
      rerender({ opts: { onWatchProgressUpdate } });

      const lastCall = onWatchProgressUpdate.mock.calls[onWatchProgressUpdate.mock.calls.length - 1][0];
      expect(lastCall.percentageWatched).toBeLessThanOrEqual(100);
    });
  });

  // ─── onStart callback ──────────────────────────────────────────

  describe('onStart callback', () => {
    it('fires onStart on first play', () => {
      const onStart = vi.fn();
      const { rerender } = renderVideoHook({ onStart });

      currentMediaState = { ...mockMediaState, isPlaying: true };
      rerender({ opts: { onStart } });

      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('fires onStart only once', () => {
      const onStart = vi.fn();
      const { rerender } = renderVideoHook({ onStart });

      // First play
      currentMediaState = { ...mockMediaState, isPlaying: true };
      rerender({ opts: { onStart } });

      // Pause and play again
      currentMediaState = { ...mockMediaState, isPlaying: false };
      rerender({ opts: { onStart } });
      currentMediaState = { ...mockMediaState, isPlaying: true };
      rerender({ opts: { onStart } });

      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('does not fire onStart when not playing', () => {
      const onStart = vi.fn();
      renderVideoHook({ onStart });

      expect(onStart).not.toHaveBeenCalled();
    });
  });

  // ─── Source change resets ──────────────────────────────────────

  describe('source change resets', () => {
    it('resets watch progress when src changes', () => {
      const onWatchProgressUpdate = vi.fn();
      const { result, rerender } = renderVideoHook({
        src: 'https://example.com/v1.mp4',
        onWatchProgressUpdate,
      });

      // Watch something
      currentMediaState = { ...mockMediaState, isPlaying: true, currentTime: 0, duration: 100 };
      rerender({ opts: { src: 'https://example.com/v1.mp4', onWatchProgressUpdate } });
      currentMediaState = { ...mockMediaState, isPlaying: false, currentTime: 50, duration: 100 };
      rerender({ opts: { src: 'https://example.com/v1.mp4', onWatchProgressUpdate } });

      // Change source
      rerender({ opts: { src: 'https://example.com/v2.mp4', onWatchProgressUpdate } });

      expect(result.current.state.watchProgress).toEqual(initialWatchProgress);
    });
  });

  // ─── Available qualities ───────────────────────────────────────

  describe('available qualities', () => {
    it('uses HLS quality levels when available and using hls.js', () => {
      const hlsLevels: VideoQuality[] = [
        { label: 'Auto', src: '', bitrate: 0 },
        { label: '720p', src: '', bitrate: 2500000 },
      ];
      mockHlsReturn = {
        ...mockHlsReturn,
        isHLS: true,
        isUsingHlsJs: true,
        levels: hlsLevels,
      };

      const { result } = renderVideoHook({
        qualities: [{ label: '480p', src: 'https://example.com/480.mp4' }],
      });

      // Simulate HLS quality levels callback
      act(() => {
        capturedHlsOnQualityLevelsLoaded?.(hlsLevels);
      });

      expect(result.current.state.availableQualities).toEqual(hlsLevels);
    });

    it('falls back to provided qualities when not using hls.js', () => {
      const qualities: VideoQuality[] = [
        { label: '480p', src: 'https://example.com/480.mp4' },
        { label: '720p', src: 'https://example.com/720.mp4' },
      ];

      const { result } = renderVideoHook({ qualities });

      expect(result.current.state.availableQualities).toEqual(qualities);
    });

    it('returns empty array when no qualities provided', () => {
      const { result } = renderVideoHook();

      expect(result.current.state.availableQualities).toEqual([]);
    });
  });

  // ─── isAutoQuality composition ─────────────────────────────────

  describe('isAutoQuality', () => {
    it('is false when not using hls.js', () => {
      mockHlsReturn = { ...mockHlsReturn, isUsingHlsJs: false, isAutoQuality: true };
      const { result } = renderVideoHook();

      expect(result.current.state.isAutoQuality).toBe(false);
    });

    it('reflects HLS auto quality when using hls.js', () => {
      mockHlsReturn = { ...mockHlsReturn, isUsingHlsJs: true, isAutoQuality: true };
      const { result } = renderVideoHook();

      expect(result.current.state.isAutoQuality).toBe(true);
    });

    it('delegates setAutoQuality to HLS hook', () => {
      const { result } = renderVideoHook();

      act(() => {
        result.current.controls.setAutoQuality(true);
      });

      expect(mockHlsReturn.setAutoQuality).toHaveBeenCalledWith(true);
    });
  });

  // ─── isHLS composition ────────────────────────────────────────

  describe('isHLS state', () => {
    it('reflects HLS hook state', () => {
      mockHlsReturn = { ...mockHlsReturn, isHLS: true };
      const { result } = renderVideoHook();

      expect(result.current.state.isHLS).toBe(true);
    });

    it('is false for non-HLS sources', () => {
      mockHlsReturn = { ...mockHlsReturn, isHLS: false };
      const { result } = renderVideoHook();

      expect(result.current.state.isHLS).toBe(false);
    });
  });

  // ─── HLS source handling ──────────────────────────────────────

  describe('HLS source handling', () => {
    it('passes undefined src to useMedia for HLS sources', () => {
      renderVideoHook({ src: 'https://example.com/video.m3u8' });

      expect(useMedia).toHaveBeenCalledWith(
        expect.objectContaining({ src: undefined }),
      );
    });

    it('passes src to useMedia for non-HLS sources', () => {
      renderVideoHook({ src: 'https://example.com/video.mp4' });

      expect(useMedia).toHaveBeenCalledWith(
        expect.objectContaining({ src: 'https://example.com/video.mp4' }),
      );
    });
  });

  // ─── Tab visibility callbacks ──────────────────────────────────

  describe('tab visibility callbacks', () => {
    it('calls useTabVisibility with onHidden and onVisible handlers', () => {
      renderVideoHook();

      expect(useTabVisibility).toHaveBeenCalledWith(
        expect.objectContaining({
          onHidden: expect.any(Function),
          onVisible: expect.any(Function),
        }),
      );
    });
  });

  // ─── Default options ──────────────────────────────────────────

  describe('default options', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('uses default controlsHideDelay of 3000', () => {
      currentMediaState = { ...mockMediaState, isPlaying: true };
      const { result } = renderVideoHook();

      act(() => {
        result.current.controls.showControls();
      });

      act(() => {
        vi.advanceTimersByTime(2999);
      });
      expect(result.current.state.controlsVisible).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current.state.controlsVisible).toBe(false);
    });

    it('works with no options', () => {
      const { result } = renderVideoHook();

      expect(result.current.state).toBeDefined();
      expect(result.current.controls).toBeDefined();
    });
  });

  // ─── Cleanup ──────────────────────────────────────────────────

  describe('cleanup', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('clears controls timeout on unmount', () => {
      currentMediaState = { ...mockMediaState, isPlaying: true };
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      const { unmount } = renderVideoHook();

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  // ─── Poster loading ───────────────────────────────────────────

  describe('poster loading', () => {
    it('sets posterLoaded when poster image loads', () => {
      const originalImage = globalThis.Image;
      let imageOnload: (() => void) | null = null;

      (globalThis as any).Image = class MockImage {
        onload: (() => void) | null = null;
        set src(_url: string) {
          imageOnload = this.onload;
        }
      };

      const { result } = renderVideoHook({ poster: 'https://example.com/poster.jpg' });

      expect(result.current.state.posterLoaded).toBe(false);

      if (imageOnload) {
        act(() => {
          imageOnload!();
        });
        expect(result.current.state.posterLoaded).toBe(true);
      }

      globalThis.Image = originalImage;
    });
  });

  // ─── Aspect ratio tracking ────────────────────────────────────

  describe('aspect ratio tracking', () => {
    it('updates aspect ratio on loadedmetadata', () => {
      const video = document.createElement('video');
      Object.defineProperty(video, 'videoWidth', { writable: true, value: 1920 });
      Object.defineProperty(video, 'videoHeight', { writable: true, value: 1080 });
      mockVideoRef.current = video;

      const { result } = renderVideoHook();

      act(() => {
        video.dispatchEvent(new Event('loadedmetadata'));
      });

      expect(result.current.state.aspectRatio).toBeCloseTo(1920 / 1080);
    });

    it('does not update aspect ratio when dimensions are 0', () => {
      const video = document.createElement('video');
      Object.defineProperty(video, 'videoWidth', { writable: true, value: 0 });
      Object.defineProperty(video, 'videoHeight', { writable: true, value: 0 });
      mockVideoRef.current = video;

      const { result } = renderVideoHook();

      act(() => {
        video.dispatchEvent(new Event('loadedmetadata'));
      });

      // Should remain default 16/9
      expect(result.current.state.aspectRatio).toBe(16 / 9);
    });
  });

  // ─── HLS quality level sync ───────────────────────────────────

  describe('HLS quality level sync', () => {
    it('syncs availableQualities when HLS levels are loaded', () => {
      const hlsLevels: VideoQuality[] = [
        { label: 'Auto', src: '', bitrate: 0 },
        { label: '1080p', src: '', bitrate: 5000000 },
      ];
      mockHlsReturn = {
        ...mockHlsReturn,
        isHLS: true,
        isUsingHlsJs: true,
        levels: hlsLevels,
      };

      const { result } = renderVideoHook();

      act(() => {
        capturedHlsOnQualityLevelsLoaded?.(hlsLevels);
      });

      expect(result.current.state.availableQualities).toEqual(hlsLevels);
    });

    it('updates currentQuality label when HLS level changes', () => {
      const hlsLevels: VideoQuality[] = [
        { label: 'Auto', src: '', bitrate: 0 },
        { label: '720p', src: '', bitrate: 2500000 },
        { label: '1080p', src: '', bitrate: 5000000 },
      ];
      mockHlsReturn = {
        ...mockHlsReturn,
        isHLS: true,
        isUsingHlsJs: true,
        levels: hlsLevels,
        currentLevel: 2,
      };

      const { result } = renderVideoHook();

      act(() => {
        capturedHlsOnQualityLevelsLoaded?.(hlsLevels);
      });

      expect(result.current.state.currentQuality).toBe('1080p');
    });
  });
});
