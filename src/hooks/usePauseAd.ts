import { useState, useCallback, useEffect, useRef } from 'react';
import type { PauseAdState, UsePauseAdOptions, UsePauseAdReturn } from '@/types/pauseAd';

export function usePauseAd(options: UsePauseAdOptions): UsePauseAdReturn {
  const {
    ad,
    isPaused,
    isPlaying,
    enabled = true,
    onShow,
    onHide,
    onClick: _onClick,
  } = options;

  const [state, setState] = useState<PauseAdState>({
    isVisible: false,
    currentAd: null,
    pauseDuration: 0,
  });

  const pauseStartRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasBeenPlayingRef = useRef(false);
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;

  // Track if playback has started (don't show ad on initial load)
  useEffect(() => {
    if (isPlaying) {
      hasBeenPlayingRef.current = true;
    }
  }, [isPlaying]);

  // Handle pause/play state changes
  useEffect(() => {
    if (!enabled || !ad || !hasBeenPlayingRef.current) {
      return;
    }

    if (isPaused && !isPlaying) {
      // Video was paused
      pauseStartRef.current = Date.now();
      const minDuration = (ad.minPauseDuration ?? 0) * 1000;

      if (minDuration <= 0) {
        // Show immediately
        setState({ isVisible: true, currentAd: ad, pauseDuration: 0 });
        onShowRef.current?.(ad);
      } else {
        // Wait for minimum pause duration
        const timeout = setTimeout(() => {
          setState({ isVisible: true, currentAd: ad, pauseDuration: ad.minPauseDuration ?? 0 });
          onShowRef.current?.(ad);
        }, minDuration);
        return () => clearTimeout(timeout);
      }

      // Start tracking pause duration
      timerRef.current = setInterval(() => {
        if (pauseStartRef.current) {
          const elapsed = (Date.now() - pauseStartRef.current) / 1000;
          setState((prev) => ({ ...prev, pauseDuration: elapsed }));
        }
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    } else if (isPlaying) {
      // Video resumed - hide ad
      if (state.isVisible && state.currentAd) {
        onHideRef.current?.(state.currentAd);
      }
      pauseStartRef.current = null;
      setState({ isVisible: false, currentAd: null, pauseDuration: 0 });
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isPaused, isPlaying, enabled, ad]);

  const dismiss = useCallback(() => {
    if (state.isVisible && state.currentAd) {
      onHideRef.current?.(state.currentAd);
    }
    setState({ isVisible: false, currentAd: null, pauseDuration: 0 });
  }, [state.isVisible, state.currentAd]);

  return { state, dismiss };
}
