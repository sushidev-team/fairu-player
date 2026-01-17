import { useCallback, useRef, useState, useEffect } from 'react';
import { useMedia } from './useMedia';
import { useFullscreen } from './useFullscreen';
import { useHLS, isHLSSource } from './useHLS';
import type { VideoState, VideoControls, VideoQuality, WatchProgress, WatchedSegment, HLSConfig } from '@/types/video';
import { initialWatchProgress } from '@/types/video';
import type { UseMediaOptions } from '@/types/media';

export interface UseVideoOptions extends UseMediaOptions {
  poster?: string;
  qualities?: VideoQuality[];
  controlsHideDelay?: number;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onStart?: () => void;
  onFinished?: () => void;
  onWatchProgressUpdate?: (progress: WatchProgress) => void;
  /** HLS streaming configuration */
  hls?: HLSConfig;
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
    onStart,
    onFinished,
    onWatchProgressUpdate,
    hls: hlsConfig,
    ...mediaOptions
  } = options;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStartedRef = useRef(false);
  const hasFinishedRef = useRef(false);
  const currentSegmentStartRef = useRef<number | null>(null);
  const watchProgressRef = useRef<WatchProgress>(initialWatchProgress);

  // Use shared media hook - but don't set src for HLS sources (useHLS will handle it)
  const isHLSStream = isHLSSource(mediaOptions.src);
  const mediaSrc = isHLSStream ? undefined : mediaOptions.src;
  const { mediaRef: videoRef, state: mediaState, controls: mediaControls } = useMedia<HTMLVideoElement>({
    ...mediaOptions,
    src: mediaSrc,
  });

  // Use fullscreen hook
  const { isFullscreen, enterFullscreen, exitFullscreen, toggleFullscreen } = useFullscreen(containerRef, {
    onChange: onFullscreenChange,
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

  // Set subtitle
  const setSubtitle = useCallback((subtitleId: string | null) => {
    updateVideoState({ currentSubtitle: subtitleId });
  }, [updateVideoState]);

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
