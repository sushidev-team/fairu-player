import { useCallback, useRef, useState, useEffect } from 'react';
import { useMedia } from './useMedia';
import { useFullscreen } from './useFullscreen';
import { usePictureInPicture } from './usePictureInPicture';
import { useCast } from './useCast';
import { useTabVisibility } from './useTabVisibility';
import { useHLS, isHLSSource } from './useHLS';
import type { VideoState, VideoControls, VideoQuality, WatchProgress, WatchedSegment, HLSConfig, TabVisibilityConfig } from '@/types/video';
import { initialWatchProgress } from '@/types/video';
import type { UseMediaOptions } from '@/types/media';
import type { AdEventBus } from '@/utils/AdEventBus';
import type { PlayerEventBus } from '@/utils/PlayerEventBus';

export interface UseVideoOptions extends UseMediaOptions {
  poster?: string;
  qualities?: VideoQuality[];
  controlsHideDelay?: number;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onPictureInPictureChange?: (isPiP: boolean) => void;
  onCastChange?: (isCasting: boolean) => void;
  onTabVisibilityChange?: (isVisible: boolean) => void;
  onStart?: () => void;
  onFinished?: () => void;
  onWatchProgressUpdate?: (progress: WatchProgress) => void;
  /** HLS streaming configuration */
  hls?: HLSConfig;
  /** Tab visibility behavior configuration */
  tabVisibility?: TabVisibilityConfig;
  /** Ad event bus for triggering return-ads */
  adEventBus?: AdEventBus;
  /** Player event bus for emitting tab/PiP events */
  playerEventBus?: PlayerEventBus;
}

/**
 * Merge overlapping segments and sort them
 */
function mergeSegments(segments: WatchedSegment[]): WatchedSegment[] {
  if (segments.length === 0) return [];

  // Sort by start time
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: WatchedSegment[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    // If current segment overlaps or is adjacent to the last one, merge them
    if (current.start <= last.end + 0.5) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Calculate total watched duration from segments
 */
function calculateWatchedDuration(segments: WatchedSegment[]): number {
  return segments.reduce((total, segment) => total + (segment.end - segment.start), 0);
}

export interface UseVideoReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  state: VideoState;
  controls: VideoControls;
}

const defaultVideoState: Omit<VideoState, keyof import('@/types/media').MediaState> = {
  isFullscreen: false,
  isPictureInPicture: false,
  isCasting: false,
  isTabVisible: true,
  currentQuality: 'auto',
  availableQualities: [],
  aspectRatio: 16 / 9,
  posterLoaded: false,
  currentSubtitle: null,
  controlsVisible: true,
  watchProgress: initialWatchProgress,
  isHLS: false,
  isAutoQuality: true,
};

/**
 * Hook for managing video playback with video-specific features
 * Extends useMedia with fullscreen, quality selection, and controls visibility
 */
export function useVideo(options: UseVideoOptions = {}): UseVideoReturn {
  const {
    poster,
    qualities = [],
    controlsHideDelay = 3000,
    onFullscreenChange,
    onPictureInPictureChange,
    onCastChange,
    onTabVisibilityChange,
    onStart,
    onFinished,
    onWatchProgressUpdate,
    hls: hlsConfig,
    tabVisibility: tabVisibilityConfig,
    adEventBus,
    playerEventBus,
    ...mediaOptions
  } = options;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStartedRef = useRef(false);
  const hasFinishedRef = useRef(false);
  const currentSegmentStartRef = useRef<number | null>(null);
  const watchProgressRef = useRef<WatchProgress>(initialWatchProgress);
  const wasPlayingBeforeHiddenRef = useRef(false);
  const wasMutedBeforeHiddenRef = useRef(false);
  const tabHiddenTimestampRef = useRef<number>(0);

  // Use shared media hook - but don't set src for HLS sources (useHLS will handle it)
  const isHLSStream = isHLSSource(mediaOptions.src);
  const mediaSrc = isHLSStream ? undefined : mediaOptions.src;
  const { mediaRef: videoRef, state: mediaState, controls: mediaControls } = useMedia<HTMLVideoElement>({
    ...mediaOptions,
    src: mediaSrc,
  });

  // Store reactive values in refs so tab-visibility callbacks always read fresh state.
  // This avoids stale closures: the visibilitychange handler (registered once)
  // always reads the latest media state, controls, and callbacks from these refs.
  const mediaStateRef = useRef(mediaState);
  const mediaControlsRef = useRef(mediaControls);
  const onTabVisibilityChangeRef = useRef(onTabVisibilityChange);
  const tabVisibilityConfigRef = useRef(tabVisibilityConfig);
  const adEventBusRef = useRef(adEventBus);
  const playerEventBusRef = useRef(playerEventBus);
  mediaStateRef.current = mediaState;
  mediaControlsRef.current = mediaControls;
  onTabVisibilityChangeRef.current = onTabVisibilityChange;
  tabVisibilityConfigRef.current = tabVisibilityConfig;
  adEventBusRef.current = adEventBus;
  playerEventBusRef.current = playerEventBus;

  // Use fullscreen hook
  const { isFullscreen, enterFullscreen, exitFullscreen, toggleFullscreen } = useFullscreen(containerRef, {
    onChange: onFullscreenChange,
  });

  // Use picture-in-picture hook
  const {
    isPictureInPicture,
    enterPictureInPicture,
    exitPictureInPicture,
    togglePictureInPicture,
  } = usePictureInPicture(videoRef, {
    onChange: onPictureInPictureChange,
  });

  // Use cast hook
  const {
    isCasting,
    toggleCast,
  } = useCast(videoRef, {
    onChange: onCastChange,
  });

  // Tab visibility callbacks — all logic lives here (pause/resume, mute/unmute,
  // event bus emissions, return-ad triggering). Every reactive value is read
  // from refs so these callbacks are completely stable and never stale.
  const handleTabHidden = useCallback(() => {
    if (tabVisibilityConfigRef.current?.pauseOnHidden && mediaStateRef.current.isPlaying) {
      wasPlayingBeforeHiddenRef.current = true;
      mediaControlsRef.current.pause();
    }
    if (tabVisibilityConfigRef.current?.muteOnHidden && !mediaStateRef.current.isMuted) {
      wasMutedBeforeHiddenRef.current = true;
      mediaControlsRef.current.toggleMute();
    }
    tabHiddenTimestampRef.current = Date.now();
    onTabVisibilityChangeRef.current?.(false);
    playerEventBusRef.current?.emit('tabHidden', { timestamp: Date.now() });
  }, []);

  const handleTabVisible = useCallback(() => {
    if (tabVisibilityConfigRef.current?.resumeOnVisible && wasPlayingBeforeHiddenRef.current) {
      wasPlayingBeforeHiddenRef.current = false;
      mediaControlsRef.current.play();
    }
    if (tabVisibilityConfigRef.current?.muteOnHidden && wasMutedBeforeHiddenRef.current) {
      wasMutedBeforeHiddenRef.current = false;
      mediaControlsRef.current.toggleMute();
    }
    const hiddenDuration = tabHiddenTimestampRef.current
      ? (Date.now() - tabHiddenTimestampRef.current) / 1000
      : 0;
    onTabVisibilityChangeRef.current?.(true);
    playerEventBusRef.current?.emit('tabVisible', { timestamp: Date.now(), hiddenDuration });

    // Return-ad: trigger overlay ad on every tab return
    // (respects returnAdMinHiddenDuration if set, otherwise triggers immediately)
    const tabConfig = tabVisibilityConfigRef.current;
    const minDuration = tabConfig?.returnAdMinHiddenDuration ?? 0;
    if (
      tabConfig?.showReturnAd &&
      tabConfig.returnAd &&
      hiddenDuration >= minDuration &&
      adEventBusRef.current
    ) {
      playerEventBusRef.current?.emit('triggerReturnAd', { hiddenDuration });
      adEventBusRef.current.emit('showOverlayAd', tabConfig.returnAd);
    }
  }, []);

  // Use tab visibility hook
  const { isTabVisible } = useTabVisibility({
    onHidden: handleTabHidden,
    onVisible: handleTabVisible,
  });

  // HLS quality levels state (managed separately since it comes from HLS hook)
  const [hlsQualityLevels, setHlsQualityLevels] = useState<VideoQuality[]>([]);

  // Use HLS hook for streaming support
  const {
    isHLS,
    isUsingHlsJs,
    currentLevel: hlsCurrentLevel,
    setLevel: setHlsLevel,
    isAutoQuality: hlsIsAutoQuality,
    setAutoQuality: setHlsAutoQuality,
  } = useHLS({
    src: mediaOptions.src,
    videoRef,
    config: hlsConfig,
    onQualityLevelsLoaded: setHlsQualityLevels,
    onError: mediaOptions.onError,
  });

  // Determine available qualities (HLS levels take precedence when available)
  const availableQualities = isUsingHlsJs && hlsQualityLevels.length > 0
    ? hlsQualityLevels
    : qualities;

  // Video-specific state
  const [videoState, setVideoState] = useState<Omit<VideoState, keyof import('@/types/media').MediaState>>({
    ...defaultVideoState,
    availableQualities: qualities,
  });

  // Update video state helper
  const updateVideoState = useCallback((updates: Partial<typeof videoState>) => {
    setVideoState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Show controls
  const showControls = useCallback(() => {
    updateVideoState({ controlsVisible: true });

    // Clear existing timeout
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    // Set new timeout to hide controls
    controlsTimeoutRef.current = setTimeout(() => {
      if (mediaState.isPlaying) {
        updateVideoState({ controlsVisible: false });
      }
    }, controlsHideDelay);
  }, [controlsHideDelay, mediaState.isPlaying, updateVideoState]);

  // Hide controls
  const hideControls = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    updateVideoState({ controlsVisible: false });
  }, [updateVideoState]);

  // Set quality
  const setQuality = useCallback((quality: string) => {
    const video = videoRef.current;
    if (!video) return;

    // If using HLS.js, use level switching
    if (isUsingHlsJs) {
      const levelIndex = availableQualities.findIndex((q) => q.label === quality);
      if (levelIndex >= 0) {
        setHlsLevel(levelIndex);
        updateVideoState({ currentQuality: quality });
      }
      return;
    }

    // For progressive video, change the source
    const selectedQuality = qualities.find((q) => q.label === quality);
    if (selectedQuality && selectedQuality.src !== video.src) {
      const currentTime = video.currentTime;
      const wasPlaying = !video.paused;

      video.src = selectedQuality.src;
      video.load();
      video.currentTime = currentTime;

      if (wasPlaying) {
        video.play();
      }
    }

    updateVideoState({ currentQuality: quality });
  }, [qualities, availableQualities, isUsingHlsJs, setHlsLevel, updateVideoState, videoRef]);

  // Set subtitle using TextTrack API
  const setSubtitle = useCallback((subtitleId: string | null) => {
    const video = videoRef.current;
    if (!video) {
      updateVideoState({ currentSubtitle: subtitleId });
      return;
    }

    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (track.kind === 'subtitles' || track.kind === 'captions') {
        // Match by label (subtitle.id maps to track.label in our implementation)
        track.mode = (subtitleId && track.label === subtitleId) ? 'showing' : 'hidden';
      }
    }
    updateVideoState({ currentSubtitle: subtitleId });
  }, [updateVideoState, videoRef]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Auto-hide controls when playing
  useEffect(() => {
    if (mediaState.isPlaying) {
      showControls();
    } else {
      updateVideoState({ controlsVisible: true });
    }
  }, [mediaState.isPlaying, showControls, updateVideoState]);

  // Track poster load
  useEffect(() => {
    if (poster) {
      const img = new Image();
      img.onload = () => updateVideoState({ posterLoaded: true });
      img.src = poster;
    }
  }, [poster, updateVideoState]);

  // Track video dimensions for aspect ratio
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleResize = () => {
      if (video.videoWidth && video.videoHeight) {
        updateVideoState({ aspectRatio: video.videoWidth / video.videoHeight });
      }
    };

    video.addEventListener('loadedmetadata', handleResize);
    return () => video.removeEventListener('loadedmetadata', handleResize);
  }, [updateVideoState, videoRef]);

  // Update watch progress helper
  const updateWatchProgress = useCallback((newSegment?: WatchedSegment) => {
    const duration = mediaState.duration;
    if (duration <= 0) return;

    let segments = [...watchProgressRef.current.watchedSegments];

    if (newSegment && newSegment.end > newSegment.start) {
      segments.push(newSegment);
      segments = mergeSegments(segments);
    }

    const watchedDuration = calculateWatchedDuration(segments);
    const percentageWatched = Math.min(100, (watchedDuration / duration) * 100);
    const furthestPoint = Math.max(
      watchProgressRef.current.furthestPoint,
      mediaState.currentTime
    );

    // Consider video fully watched if 95% or more has been watched
    const isFullyWatched = percentageWatched >= 95;

    const newProgress: WatchProgress = {
      watchedSegments: segments,
      percentageWatched,
      isFullyWatched,
      furthestPoint,
    };

    watchProgressRef.current = newProgress;
    updateVideoState({ watchProgress: newProgress });
    onWatchProgressUpdate?.(newProgress);

    // Fire onFinished when fully watched (only once)
    if (isFullyWatched && !hasFinishedRef.current) {
      hasFinishedRef.current = true;
      onFinished?.();
    }
  }, [mediaState.duration, mediaState.currentTime, updateVideoState, onWatchProgressUpdate, onFinished]);

  // Track first play event (onStart)
  useEffect(() => {
    if (mediaState.isPlaying && !hasStartedRef.current) {
      hasStartedRef.current = true;
      onStart?.();
    }
  }, [mediaState.isPlaying, onStart]);

  // Track current watching segment
  useEffect(() => {
    if (mediaState.isPlaying) {
      // Start a new segment when playing begins
      if (currentSegmentStartRef.current === null) {
        currentSegmentStartRef.current = mediaState.currentTime;
      }
    } else {
      // Save segment when paused
      if (currentSegmentStartRef.current !== null) {
        const newSegment: WatchedSegment = {
          start: currentSegmentStartRef.current,
          end: mediaState.currentTime,
        };
        updateWatchProgress(newSegment);
        currentSegmentStartRef.current = null;
      }
    }
  }, [mediaState.isPlaying, mediaState.currentTime, updateWatchProgress]);

  // Update furthest point during playback
  useEffect(() => {
    if (mediaState.isPlaying && mediaState.currentTime > watchProgressRef.current.furthestPoint) {
      watchProgressRef.current.furthestPoint = mediaState.currentTime;
    }
  }, [mediaState.isPlaying, mediaState.currentTime]);

  // Reset tracking when source changes
  useEffect(() => {
    hasStartedRef.current = false;
    hasFinishedRef.current = false;
    currentSegmentStartRef.current = null;
    watchProgressRef.current = initialWatchProgress;
    updateVideoState({ watchProgress: initialWatchProgress });
  }, [mediaOptions.src, updateVideoState]);

  // Sync available qualities when HLS levels change
  useEffect(() => {
    if (isUsingHlsJs && hlsQualityLevels.length > 0) {
      updateVideoState({ availableQualities: hlsQualityLevels });
    } else if (!isHLS && qualities.length > 0) {
      updateVideoState({ availableQualities: qualities });
    }
  }, [isUsingHlsJs, isHLS, hlsQualityLevels, qualities, updateVideoState]);

  // Update current quality label when HLS level changes
  useEffect(() => {
    if (isUsingHlsJs && hlsCurrentLevel >= 0 && hlsQualityLevels[hlsCurrentLevel]) {
      updateVideoState({ currentQuality: hlsQualityLevels[hlsCurrentLevel].label });
    }
  }, [isUsingHlsJs, hlsCurrentLevel, hlsQualityLevels, updateVideoState]);

  // Combine media state with video-specific state
  const state: VideoState = {
    ...mediaState,
    ...videoState,
    isFullscreen,
    isPictureInPicture,
    isCasting,
    isTabVisible,
    isHLS,
    isAutoQuality: isUsingHlsJs ? hlsIsAutoQuality : false,
    availableQualities,
  };

  // Combine media controls with video-specific controls
  const controls: VideoControls = {
    ...mediaControls,
    enterFullscreen: () => enterFullscreen(),
    exitFullscreen,
    toggleFullscreen: () => toggleFullscreen(),
    enterPictureInPicture,
    exitPictureInPicture,
    togglePictureInPicture,
    toggleCast,
    setQuality,
    setSubtitle,
    showControls,
    hideControls,
    setAutoQuality: setHlsAutoQuality,
  };

  return {
    videoRef,
    containerRef,
    state,
    controls,
  };
}
