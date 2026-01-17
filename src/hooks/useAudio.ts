import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerState, PlayerControls } from '@/types/player';

export interface UseAudioOptions {
  src?: string;
  autoPlay?: boolean;
  volume?: number;
  muted?: boolean;
  playbackRate?: number;
  skipForwardSeconds?: number;
  skipBackwardSeconds?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
  onError?: (error: Error) => void;
  onLoadedMetadata?: (duration: number) => void;
}

export interface UseAudioReturn {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  state: PlayerState;
  controls: PlayerControls;
}

const initialState: PlayerState = {
  isPlaying: false,
  isPaused: true,
  isLoading: true,
  isBuffering: false,
  isEnded: false,
  isMuted: false,
  currentTime: 0,
  duration: 0,
  buffered: 0,
  volume: 1,
  playbackRate: 1,
  error: null,
};

export function useAudio(options: UseAudioOptions = {}): UseAudioReturn {
  const {
    src,
    autoPlay = false,
    volume: initialVolume = 1,
    muted: initialMuted = false,
    playbackRate: initialPlaybackRate = 1,
    skipForwardSeconds = 30,
    skipBackwardSeconds = 10,
    onPlay,
    onPause,
    onEnded,
    onTimeUpdate,
    onError,
    onLoadedMetadata,
  } = options;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PlayerState>({
    ...initialState,
    volume: initialVolume,
    isMuted: initialMuted,
    playbackRate: initialPlaybackRate,
  });

  // Update state helper
  const updateState = useCallback((updates: Partial<PlayerState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Play
  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      await audio.play();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to play');
      updateState({ error: err });
      onError?.(err);
    }
  }, [onError, updateState]);

  // Pause
  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
  }, []);

  // Toggle play/pause
  const toggle = useCallback(async () => {
    if (state.isPlaying) {
      pause();
    } else {
      await play();
    }
  }, [state.isPlaying, play, pause]);

  // Stop
  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  // Seek to specific time
  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(time, audio.duration || 0));
  }, []);

  // Seek to percentage
  const seekTo = useCallback((percentage: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const time = (percentage / 100) * audio.duration;
    seek(time);
  }, [seek]);

  // Skip forward
  const skipForward = useCallback((seconds?: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const skipAmount = seconds ?? skipForwardSeconds;
    seek(audio.currentTime + skipAmount);
  }, [seek, skipForwardSeconds]);

  // Skip backward
  const skipBackward = useCallback((seconds?: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const skipAmount = seconds ?? skipBackwardSeconds;
    seek(audio.currentTime - skipAmount);
  }, [seek, skipBackwardSeconds]);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clampedVolume = Math.max(0, Math.min(1, volume));
    audio.volume = clampedVolume;
    updateState({ volume: clampedVolume });
  }, [updateState]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    updateState({ isMuted: audio.muted });
  }, [updateState]);

  // Set playback rate
  const setPlaybackRate = useCallback((rate: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = rate;
    updateState({ playbackRate: rate });
  }, [updateState]);

  // Set up audio element and event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadStart = () => {
      updateState({ isLoading: true, error: null });
    };

    const handleLoadedMetadata = () => {
      updateState({
        isLoading: false,
        duration: audio.duration,
      });
      onLoadedMetadata?.(audio.duration);
    };

    const handleCanPlay = () => {
      updateState({ isLoading: false, isBuffering: false });
    };

    const handleWaiting = () => {
      updateState({ isBuffering: true });
    };

    const handlePlaying = () => {
      updateState({
        isPlaying: true,
        isPaused: false,
        isBuffering: false,
        isEnded: false,
      });
    };

    const handlePlay = () => {
      updateState({ isPlaying: true, isPaused: false, isEnded: false });
      onPlay?.();
    };

    const handlePause = () => {
      updateState({ isPlaying: false, isPaused: true });
      onPause?.();
    };

    const handleEnded = () => {
      updateState({ isPlaying: false, isPaused: true, isEnded: true });
      onEnded?.();
    };

    const handleTimeUpdate = () => {
      updateState({ currentTime: audio.currentTime });
      onTimeUpdate?.(audio.currentTime);
    };

    const handleProgress = () => {
      if (audio.buffered.length > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
        updateState({ buffered: bufferedEnd });
      }
    };

    const handleVolumeChange = () => {
      updateState({
        volume: audio.volume,
        isMuted: audio.muted,
      });
    };

    const handleRateChange = () => {
      updateState({ playbackRate: audio.playbackRate });
    };

    const handleError = () => {
      const error = audio.error;
      const err = new Error(error?.message || 'Audio error');
      updateState({ error: err, isLoading: false });
      onError?.(err);
    };

    // Add event listeners
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('progress', handleProgress);
    audio.addEventListener('volumechange', handleVolumeChange);
    audio.addEventListener('ratechange', handleRateChange);
    audio.addEventListener('error', handleError);

    // Set initial values
    audio.volume = initialVolume;
    audio.muted = initialMuted;
    audio.playbackRate = initialPlaybackRate;

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('progress', handleProgress);
      audio.removeEventListener('volumechange', handleVolumeChange);
      audio.removeEventListener('ratechange', handleRateChange);
      audio.removeEventListener('error', handleError);
    };
  }, [
    initialVolume,
    initialMuted,
    initialPlaybackRate,
    onPlay,
    onPause,
    onEnded,
    onTimeUpdate,
    onError,
    onLoadedMetadata,
    updateState,
  ]);

  // Handle source changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    audio.src = src;
    audio.load();

    if (autoPlay) {
      play();
    }
  }, [src, autoPlay, play]);

  const controls: PlayerControls = {
    play,
    pause,
    toggle,
    stop,
    seek,
    seekTo,
    skipForward,
    skipBackward,
    setVolume,
    toggleMute,
    setPlaybackRate,
  };

  return {
    audioRef,
    state,
    controls,
  };
}
