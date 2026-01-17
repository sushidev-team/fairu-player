import React, { createContext, useRef, useMemo, useCallback } from 'react';
import { useAudio } from '@/hooks/useAudio';
import { usePlaylist } from '@/hooks/usePlaylist';
import type {
  PlayerConfig,
  PlayerContextValue,
  Track,
} from '@/types/player';

export const PlayerContext = createContext<PlayerContextValue | null>(null);

const DEFAULT_CONFIG: PlayerConfig = {
  features: {
    chapters: true,
    volumeControl: true,
    playbackSpeed: true,
    skipButtons: true,
    progressBar: true,
    timeDisplay: true,
    playlistView: true,
  },
  autoPlayNext: true,
  shuffle: false,
  repeat: 'none',
  skipForwardSeconds: 30,
  skipBackwardSeconds: 10,
  playbackSpeeds: [0.5, 0.75, 1, 1.25, 1.5, 2],
  volume: 1,
  muted: false,
  autoPlay: false,
};

export interface PlayerProviderProps {
  children: React.ReactNode;
  config?: PlayerConfig;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
  onTrackChange?: (track: Track, index: number) => void;
  onError?: (error: Error) => void;
}

export function PlayerProvider({
  children,
  config: userConfig = {},
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
  onTrackChange,
  onError,
}: PlayerProviderProps) {
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
    onTrackChange?.(track, index);
  }, [onTrackChange]);

  // Handle ended - move to next track if autoPlayNext
  const handleEnded = useCallback(() => {
    onEnded?.();
    if (config.autoPlayNext) {
      playlistReturn.controls.next();
    }
  }, [config.autoPlayNext, onEnded]);

  // Initialize playlist
  const playlistReturn = usePlaylist({
    tracks,
    shuffle: config.shuffle,
    repeat: config.repeat,
    autoPlayNext: config.autoPlayNext,
    onTrackChange: handleTrackChange,
  });

  // Get current track source
  const currentSrc = playlistReturn.state.currentTrack?.src;

  // Initialize audio with current track
  const audioReturn = useAudio({
    src: currentSrc,
    volume: config.volume,
    muted: config.muted,
    autoPlay: config.autoPlay,
    skipForwardSeconds: config.skipForwardSeconds,
    skipBackwardSeconds: config.skipBackwardSeconds,
    onPlay,
    onPause,
    onEnded: handleEnded,
    onTimeUpdate,
    onError,
  });

  // Create stable ref for audio element
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync refs
  if (audioReturn.audioRef.current !== audioRef.current) {
    audioRef.current = audioReturn.audioRef.current;
  }

  const contextValue = useMemo<PlayerContextValue>(() => ({
    state: audioReturn.state,
    playlistState: playlistReturn.state,
    controls: audioReturn.controls,
    playlistControls: playlistReturn.controls,
    config,
    audioRef: audioReturn.audioRef,
  }), [audioReturn.state, audioReturn.controls, audioReturn.audioRef, playlistReturn.state, playlistReturn.controls, config]);

  return (
    <PlayerContext.Provider value={contextValue}>
      <audio ref={audioReturn.audioRef as React.RefObject<HTMLAudioElement>} preload="metadata" />
      {children}
    </PlayerContext.Provider>
  );
}

// Re-export the context for direct access
export { PlayerContext as default };
