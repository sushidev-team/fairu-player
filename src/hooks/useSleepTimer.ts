import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  SleepTimerState,
  UseSleepTimerOptions,
  UseSleepTimerReturn,
} from '@/types/sleepTimer';

const initialState: SleepTimerState = {
  isActive: false,
  remainingTime: 0,
  selectedDuration: null,
  isFadingOut: false,
};

/**
 * Hook for managing a sleep timer that pauses media playback after a set duration.
 * Supports preset minute durations and "end of track" mode.
 * Optionally fades out volume in the last 30 seconds before pausing.
 */
export function useSleepTimer(options: UseSleepTimerOptions): UseSleepTimerReturn {
  const {
    mediaRef,
    onTimerEnd,
    fadeOut = false,
    fadeOutDuration = 30,
    currentTime = 0,
    duration = 0,
  } = options;

  const [state, setState] = useState<SleepTimerState>(initialState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const volumeBeforeFadeRef = useRef<number>(1);
  const isFadingRef = useRef(false);

  // Cleanup interval
  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Restore volume after fade out
  const restoreVolume = useCallback(() => {
    const media = mediaRef.current;
    if (media && isFadingRef.current) {
      media.volume = volumeBeforeFadeRef.current;
      isFadingRef.current = false;
    }
  }, [mediaRef]);

  // Stop the timer
  const stopTimer = useCallback(() => {
    clearTimer();
    restoreVolume();
    setState(initialState);
  }, [clearTimer, restoreVolume]);

  // Handle timer end: pause playback and call callback
  const handleTimerEnd = useCallback(() => {
    const media = mediaRef.current;
    if (media) {
      media.pause();
      // Restore volume after pausing so next play has normal volume
      if (isFadingRef.current) {
        media.volume = volumeBeforeFadeRef.current;
        isFadingRef.current = false;
      }
    }
    clearTimer();
    setState(initialState);
    onTimerEnd?.();
  }, [mediaRef, clearTimer, onTimerEnd]);

  // Start the timer
  const startTimer = useCallback(
    (durationValue: number | 'endOfTrack') => {
      // Clear any existing timer
      clearTimer();
      restoreVolume();

      let remainingSeconds: number;

      if (durationValue === 'endOfTrack') {
        // Calculate remaining time from current position to end of track
        remainingSeconds = Math.max(0, Math.ceil(duration - currentTime));
        if (remainingSeconds <= 0) {
          // Track is already at the end, trigger immediately
          handleTimerEnd();
          return;
        }
      } else {
        remainingSeconds = durationValue * 60;
      }

      // Save current volume for potential fade out
      const media = mediaRef.current;
      if (media) {
        volumeBeforeFadeRef.current = media.volume;
      }

      setState({
        isActive: true,
        remainingTime: remainingSeconds,
        selectedDuration: durationValue,
        isFadingOut: false,
      });

      intervalRef.current = setInterval(() => {
        setState((prev) => {
          if (!prev.isActive) return prev;

          const newRemaining = prev.remainingTime - 1;

          if (newRemaining <= 0) {
            // Timer reached zero, will be handled by the effect below
            return {
              ...prev,
              remainingTime: 0,
            };
          }

          // Handle fade out
          if (fadeOut && newRemaining <= fadeOutDuration && !isFadingRef.current) {
            const mediaEl = mediaRef.current;
            if (mediaEl) {
              volumeBeforeFadeRef.current = mediaEl.volume;
              isFadingRef.current = true;
            }
          }

          if (fadeOut && isFadingRef.current && newRemaining <= fadeOutDuration) {
            const mediaEl = mediaRef.current;
            if (mediaEl) {
              const fadeProgress = newRemaining / fadeOutDuration;
              mediaEl.volume = volumeBeforeFadeRef.current * fadeProgress;
            }
          }

          return {
            ...prev,
            remainingTime: newRemaining,
            isFadingOut: fadeOut && newRemaining <= fadeOutDuration,
          };
        });
      }, 1000);
    },
    [clearTimer, restoreVolume, duration, currentTime, mediaRef, fadeOut, fadeOutDuration, handleTimerEnd]
  );

  // Watch for remaining time reaching zero
  useEffect(() => {
    if (state.isActive && state.remainingTime <= 0) {
      handleTimerEnd();
    }
  }, [state.isActive, state.remainingTime, handleTimerEnd]);

  // For "end of track" mode, update remaining time based on current playback position
  useEffect(() => {
    if (state.isActive && state.selectedDuration === 'endOfTrack' && duration > 0) {
      const newRemaining = Math.max(0, Math.ceil(duration - currentTime));
      setState((prev) => ({
        ...prev,
        remainingTime: newRemaining,
      }));
    }
  }, [state.isActive, state.selectedDuration, currentTime, duration]);

  // Extend the timer by additional minutes
  const extendTimer = useCallback(
    (minutes: number) => {
      if (!state.isActive) return;

      setState((prev) => {
        if (!prev.isActive) return prev;

        const additionalSeconds = minutes * 60;
        const newRemaining = prev.remainingTime + additionalSeconds;

        // If we were fading out and now have more time, restore volume
        if (prev.isFadingOut && newRemaining > fadeOutDuration) {
          restoreVolume();
        }

        return {
          ...prev,
          remainingTime: newRemaining,
          isFadingOut: fadeOut && newRemaining <= fadeOutDuration,
          // Switch away from endOfTrack mode when extending
          selectedDuration:
            prev.selectedDuration === 'endOfTrack'
              ? minutes
              : prev.selectedDuration,
        };
      });
    },
    [state.isActive, fadeOut, fadeOutDuration, restoreVolume]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      // Restore volume if we were fading
      const media = mediaRef.current;
      if (media && isFadingRef.current) {
        media.volume = volumeBeforeFadeRef.current;
      }
    };
  }, [clearTimer, mediaRef]);

  return {
    state,
    controls: {
      startTimer,
      stopTimer,
      extendTimer,
    },
  };
}
