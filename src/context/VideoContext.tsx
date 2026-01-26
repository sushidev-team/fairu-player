import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useVideo } from '@/hooks/useVideo';
import { usePlaylist } from '@/hooks/usePlaylist';
import { LabelsProvider } from './LabelsContext';
import type { VideoConfig, VideoContextValue, VideoTrack, WatchProgress } from '@/types/video';
import type { Track } from '@/types/player';
import type { AdEventBus } from '@/utils/AdEventBus';
import type { PlayerEventBus } from '@/utils/PlayerEventBus';

export const VideoContext = createContext<VideoContextValue | null>(null);

const DEFAULT_CONFIG: VideoConfig = {
  features: {
    chapters: true,
    volumeControl: true,
    playbackSpeed: true,
    skipButtons: true,
    progressBar: true,
    timeDisplay: true,
    playlistView: true,
    fullscreen: true,
    qualitySelector: true,
    subtitles: true,
    pictureInPicture: false,
    autoHideControls: true,
  },
  autoPlayNext: true,
  shuffle: false,
  repeat: 'none',
  skipForwardSeconds: 10,
  skipBackwardSeconds: 10,
  playbackSpeeds: [0.5, 0.75, 1, 1.25, 1.5, 2],
  volume: 1,
  muted: false,
  autoPlay: false,
  controlsHideDelay: 3000,
};

export interface VideoProviderProps {
  children: React.ReactNode;
  config?: VideoConfig;
  /** Ad event bus for triggering return-ads */
  adEventBus?: AdEventBus;
  /** Player event bus for emitting tab/PiP events */
  playerEventBus?: PlayerEventBus;
  /** Called when playback starts (first play) */
  onStart?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  /** Called when video has been fully watched (all segments covered) */
  onFinished?: () => void;
  onTimeUpdate?: (time: number) => void;
  /** Called when watch progress updates */
  onWatchProgressUpdate?: (progress: WatchProgress) => void;
  onTrackChange?: (track: VideoTrack, index: number) => void;
  onError?: (error: Error) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onPictureInPictureChange?: (isPiP: boolean) => void;
  onTabVisibilityChange?: (isVisible: boolean) => void;
}

export function VideoProvider({
  children,
  config: userConfig = {},
  adEventBus,
  playerEventBus,
  onStart,
  onPlay,
  onPause,
  onEnded,
  onFinished,
  onTimeUpdate,
  onWatchProgressUpdate,
  onTrackChange,
  onError,
  onFullscreenChange,
  onPictureInPictureChange,
  onTabVisibilityChange,
}: VideoProviderProps) {
  const config = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...userConfig,
    features: {
      ...DEFAULT_CONFIG.features,
      ...userConfig.features,
    },
  }), [userConfig]);

  // Determine tracks from config
  const tracks = useMemo(() => {
    if (config.playlist && config.playlist.length > 0) {
      return config.playlist;
    }
    if (config.track) {
      return [config.track];
    }
    return [];
  }, [config.playlist, config.track]);

  // Handle track change from playlist
  const handleTrackChange = useCallback((track: Track, index: number) => {
    onTrackChange?.(track as VideoTrack, index);
  }, [onTrackChange]);

  // Initialize playlist
  const playlistReturn = usePlaylist({
    tracks,
    shuffle: config.shuffle,
    repeat: config.repeat,
    autoPlayNext: config.autoPlayNext,
    onTrackChange: handleTrackChange,
  });

  // Handle ended - move to next track if autoPlayNext
  const handleEnded = useCallback(() => {
    onEnded?.();
    if (config.autoPlayNext) {
      playlistReturn.controls.next();
    }
  }, [config.autoPlayNext, onEnded, playlistReturn.controls]);

  // Get current track
  const currentTrack = playlistReturn.state.currentTrack as VideoTrack | null;
  const currentSrc = currentTrack?.src;

  // Initialize video with current track
  const videoReturn = useVideo({
    src: currentSrc,
    volume: config.volume,
    muted: config.muted,
    autoPlay: config.autoPlay,
    skipForwardSeconds: config.skipForwardSeconds,
    skipBackwardSeconds: config.skipBackwardSeconds,
    poster: currentTrack?.poster || config.poster,
    qualities: currentTrack?.qualities,
    controlsHideDelay: config.controlsHideDelay,
    hls: config.hls,
    tabVisibility: config.tabVisibility,
    adEventBus,
    playerEventBus,
    onStart,
    onPlay,
    onPause,
    onEnded: handleEnded,
    onFinished,
    onTimeUpdate,
    onWatchProgressUpdate,
    onError,
    onFullscreenChange,
    onPictureInPictureChange,
    onTabVisibilityChange,
  });

  const contextValue = useMemo<VideoContextValue>(() => ({
    state: videoReturn.state,
    playlistState: playlistReturn.state,
    controls: videoReturn.controls,
    playlistControls: playlistReturn.controls,
    config,
    videoRef: videoReturn.videoRef,
    containerRef: videoReturn.containerRef,
    currentTrack,
  }), [
    videoReturn.state,
    videoReturn.controls,
    videoReturn.videoRef,
    videoReturn.containerRef,
    playlistReturn.state,
    playlistReturn.controls,
    config,
    currentTrack,
  ]);

  return (
    <LabelsProvider labels={config.labels}>
      <VideoContext.Provider value={contextValue}>
        {children}
      </VideoContext.Provider>
    </LabelsProvider>
  );
}

/**
 * Hook to access the video context
 */
export function useVideoPlayer(): VideoContextValue {
  const context = useContext(VideoContext);

  if (!context) {
    throw new Error('useVideoPlayer must be used within a VideoProvider');
  }

  return context;
}

export { VideoContext as default };
