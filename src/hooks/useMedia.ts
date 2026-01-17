import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaState, MediaControls, UseMediaOptions, UseMediaReturn } from '@/types/media';

const initialState: MediaState = {
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

/**
 * Shared hook for managing media (audio/video) playback
 * Works with both HTMLAudioElement and HTMLVideoElement
 */
export function useMedia<T extends HTMLMediaElement>(
  options: UseMediaOptions = {}
): UseMediaReturn<T> {
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
    onLoadedData,
    onCanPlayThrough,
  } = options;

  const mediaRef = useRef<T | null>(null);
  const [state, setState] = useState<MediaState>({
    ...initialState,
    volume: initialVolume,
    isMuted: initialMuted,
    playbackRate: initialPlaybackRate,
  });

  // Update state helper
  const updateState = useCallback((updates: Partial<MediaState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Play
  const play = useCallback(async () => {
    const media = mediaRef.current;
    if (!media) return;

    try {
      await media.play();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to play');
      updateState({ error: err });
      onError?.(err);
    }
  }, [onError, updateState]);

  // Pause
  const pause = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.pause();
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
    const media = mediaRef.current;
    if (!media) return;
    media.pause();
    media.currentTime = 0;
  }, []);

  // Seek to specific time
  const seek = useCallback((time: number) => {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = Math.max(0, Math.min(time, media.duration || 0));
  }, []);

  // Seek to percentage
  const seekTo = useCallback((percentage: number) => {
    const media = mediaRef.current;
    if (!media || !media.duration) return;
    const time = (percentage / 100) * media.duration;
    seek(time);
  }, [seek]);

  // Skip forward
  const skipForward = useCallback((seconds?: number) => {
    const media = mediaRef.current;
    if (!media) return;
    const skipAmount = seconds ?? skipForwardSeconds;
    seek(media.currentTime + skipAmount);
  }, [seek, skipForwardSeconds]);

  // Skip backward
  const skipBackward = useCallback((seconds?: number) => {
    const media = mediaRef.current;
    if (!media) return;
    const skipAmount = seconds ?? skipBackwardSeconds;
    seek(media.currentTime - skipAmount);
  }, [seek, skipBackwardSeconds]);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    // Update state first so UI reflects the change
    updateState({ volume: clampedVolume });
    // Then update the media element if available
    const media = mediaRef.current;
    if (media) {
      media.volume = clampedVolume;
    }
  }, [updateState]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const media = mediaRef.current;
    if (media) {
      media.muted = !media.muted;
      updateState({ isMuted: media.muted });
    } else {
      // Toggle mute state even without media element
      setState((prev) => ({ ...prev, isMuted: !prev.isMuted }));
    }
  }, [updateState]);

  // Set playback rate
  const setPlaybackRate = useCallback((rate: number) => {
    const media = mediaRef.current;
    if (!media) return;
    media.playbackRate = rate;
    updateState({ playbackRate: rate });
  }, [updateState]);

  // Set up media element and event listeners
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const handleLoadStart = () => {
      updateState({ isLoading: true, error: null });
    };

    const handleLoadedMetadata = () => {
      updateState({
        isLoading: false,
        duration: media.duration,
      });
      onLoadedMetadata?.(media.duration);
    };

    const handleLoadedData = () => {
      onLoadedData?.();
    };

    const handleCanPlay = () => {
      updateState({ isLoading: false, isBuffering: false });
    };

    const handleCanPlayThrough = () => {
      onCanPlayThrough?.();
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
      updateState({ currentTime: media.currentTime });
      onTimeUpdate?.(media.currentTime);
    };

    const handleProgress = () => {
      if (media.buffered.length > 0) {
        const bufferedEnd = media.buffered.end(media.buffered.length - 1);
        updateState({ buffered: bufferedEnd });
      }
    };

    const handleVolumeChange = () => {
      updateState({
        volume: media.volume,
        isMuted: media.muted,
      });
    };

    const handleRateChange = () => {
      updateState({ playbackRate: media.playbackRate });
    };

    const handleError = () => {
      const error = media.error;
      const err = new Error(error?.message || 'Media error');
      updateState({ error: err, isLoading: false });
      onError?.(err);
    };

    // Add event listeners
    media.addEventListener('loadstart', handleLoadStart);
    media.addEventListener('loadedmetadata', handleLoadedMetadata);
    media.addEventListener('loadeddata', handleLoadedData);
    media.addEventListener('canplay', handleCanPlay);
    media.addEventListener('canplaythrough', handleCanPlayThrough);
    media.addEventListener('waiting', handleWaiting);
    media.addEventListener('playing', handlePlaying);
    media.addEventListener('play', handlePlay);
    media.addEventListener('pause', handlePause);
    media.addEventListener('ended', handleEnded);
    media.addEventListener('timeupdate', handleTimeUpdate);
    media.addEventListener('progress', handleProgress);
    media.addEventListener('volumechange', handleVolumeChange);
    media.addEventListener('ratechange', handleRateChange);
    media.addEventListener('error', handleError);

    // Set initial values from current state (in case they were changed before media was ready)
    media.volume = state.volume;
    media.muted = state.isMuted;
    media.playbackRate = state.playbackRate;

    return () => {
      media.removeEventListener('loadstart', handleLoadStart);
      media.removeEventListener('loadedmetadata', handleLoadedMetadata);
      media.removeEventListener('loadeddata', handleLoadedData);
      media.removeEventListener('canplay', handleCanPlay);
      media.removeEventListener('canplaythrough', handleCanPlayThrough);
      media.removeEventListener('waiting', handleWaiting);
      media.removeEventListener('playing', handlePlaying);
      media.removeEventListener('play', handlePlay);
      media.removeEventListener('pause', handlePause);
      media.removeEventListener('ended', handleEnded);
      media.removeEventListener('timeupdate', handleTimeUpdate);
      media.removeEventListener('progress', handleProgress);
      media.removeEventListener('volumechange', handleVolumeChange);
      media.removeEventListener('ratechange', handleRateChange);
      media.removeEventListener('error', handleError);
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
    onLoadedData,
    onCanPlayThrough,
    updateState,
  ]);

  // Handle source changes
  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !src) return;

    media.src = src;
    media.load();

    if (autoPlay) {
      play();
    }
  }, [src, autoPlay, play]);

  const controls: MediaControls = {
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
    mediaRef,
    state,
    controls,
  };
}
