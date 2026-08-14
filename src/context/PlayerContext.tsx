import React, { createContext, useRef, useMemo, useCallback, useEffect } from 'react';
import { useAudio } from '@/hooks/useAudio';
import { usePlaylist } from '@/hooks/usePlaylist';
import { useMediaSession } from '@/hooks/useMediaSession';
import { usePersistentPreferences } from '@/hooks/usePersistentPreferences';
import { useResumePosition } from '@/hooks/useResumePosition';
import { LabelsProvider } from './LabelsContext';
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

  // Initialize playlist
  const playlistReturn = usePlaylist({
    tracks,
    shuffle: config.shuffle,
    repeat: config.repeat,
    autoPlayNext: config.autoPlayNext,
    onTrackChange: handleTrackChange,
  });

  // Handle ended - move to next track if autoPlayNext
  //
  // This used to be declared *above* `playlistReturn` and closed over it through
  // the temporal dead zone, with `playlistReturn.controls` missing from the
  // dependency array. The callback therefore kept whichever `controls` object
  // existed when `autoPlayNext`/`onEnded` last changed, so auto-advance could
  // call a stale `next()` and jump to the wrong track. VideoContext already had
  // it in this order; this brings PlayerContext in line.
  const handleEnded = useCallback(() => {
    onEnded?.();
    if (config.autoPlayNext) {
      playlistReturn.controls.next();
    }
  }, [config.autoPlayNext, onEnded, playlistReturn.controls]);

  // Get current track source
  const currentTrack = playlistReturn.state.currentTrack;
  const currentSrc = currentTrack?.src;

  // Remembered volume / mute / rate. Stored values win over the config
  // defaults, because the config default is the site's opening offer and the
  // stored value is the listener having already answered it.
  const { preferences, update: updatePreferences, isHydrated: prefsHydrated } =
    usePersistentPreferences({
      ...config.persistence,
      defaults: {
        volume: config.volume,
        muted: config.muted,
        playbackRate: 1,
      },
    });

  const resume = useResumePosition({
    trackId: currentTrack?.id,
    ...config.persistence,
    ...config.resume,
  });

  // Initialize audio with current track
  const audioReturn = useAudio({
    src: currentSrc,
    volume: preferences.volume ?? config.volume,
    muted: preferences.muted ?? config.muted,
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

  const { volume, isMuted, playbackRate, currentTime, duration, isPlaying } = audioReturn.state;

  // Persist preference changes.
  //
  // Gated on hydration: before the stored values have been read, the state
  // still holds the config defaults, and writing those back would overwrite
  // the listener's remembered settings with the site's defaults on every mount.
  useEffect(() => {
    if (!prefsHydrated) return;
    if (
      preferences.volume === volume &&
      preferences.muted === isMuted &&
      preferences.playbackRate === playbackRate
    ) {
      return;
    }
    updatePreferences({ volume, muted: isMuted, playbackRate });
  }, [
    prefsHydrated,
    volume,
    isMuted,
    playbackRate,
    preferences.volume,
    preferences.muted,
    preferences.playbackRate,
    updatePreferences,
  ]);

  // Restore the stored position once per track, after duration is known.
  //
  // Opt-in (`resume.autoResume`), because moving the playhead is a visible
  // behaviour change an existing embed did not ask for. Recording the position
  // stays on regardless, so a host page can offer "Continue from 12:34?" from
  // `useResumePosition` without handing the decision to the player.
  //
  // Seeking before `loadedmetadata` is silently ignored by the media element,
  // which is why this waits on a usable duration rather than on the src change.
  const autoResume = config.resume?.autoResume ?? false;
  const restoredForRef = useRef<string | null>(null);
  useEffect(() => {
    const trackId = currentTrack?.id;
    if (!autoResume || !trackId || !resume.isHydrated) return;
    if (restoredForRef.current === trackId) return;
    if (!Number.isFinite(duration) || duration <= 0) return;

    restoredForRef.current = trackId;
    if (resume.resumeAt !== null && resume.resumeAt < duration) {
      audioReturn.controls.seek(resume.resumeAt);
    }
  }, [
    autoResume,
    currentTrack?.id,
    resume.isHydrated,
    resume.resumeAt,
    duration,
    audioReturn.controls,
  ]);

  // Record the position as it advances. `save` throttles internally.
  useEffect(() => {
    if (!isPlaying) return;
    resume.save(currentTime, duration);
  }, [isPlaying, currentTime, duration, resume]);

  // Publish to the OS lock screen / Now Playing UI.
  useMediaSession({
    ...config.mediaSession,
    metadata: currentTrack
      ? {
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album,
          artwork: currentTrack.artwork
            ? [{ src: currentTrack.artwork, sizes: '512x512' }]
            : undefined,
        }
      : null,
    isPlaying,
    position: currentTime,
    duration,
    playbackRate,
    seekOffset: config.skipForwardSeconds,
    onPlay: audioReturn.controls.play,
    onPause: audioReturn.controls.pause,
    onStop: audioReturn.controls.stop,
    onNextTrack: playlistReturn.controls.next,
    onPreviousTrack: playlistReturn.controls.previous,
    onSeekTo: audioReturn.controls.seek,
    onSeekForward: audioReturn.controls.skipForward,
    onSeekBackward: audioReturn.controls.skipBackward,
  });

  const contextValue = useMemo<PlayerContextValue>(() => ({
    state: audioReturn.state,
    playlistState: playlistReturn.state,
    controls: audioReturn.controls,
    playlistControls: playlistReturn.controls,
    config,
    audioRef: audioReturn.audioRef,
  }), [audioReturn.state, audioReturn.controls, audioReturn.audioRef, playlistReturn.state, playlistReturn.controls, config]);

  return (
    <LabelsProvider labels={config.labels}>
      <PlayerContext.Provider value={contextValue}>
        <audio ref={audioReturn.audioRef as React.RefObject<HTMLAudioElement>} preload="metadata" />
        {children}
      </PlayerContext.Provider>
    </LabelsProvider>
  );
}

// Re-export the context for direct access
export { PlayerContext as default };
