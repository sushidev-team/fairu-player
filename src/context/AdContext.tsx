import React, { createContext, useContext, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { AdConfig, AdContextValue, AdState, Ad, AdBreak, AdProgressInfo } from '@/types/ads';

const DEFAULT_CONFIG: AdConfig = {
  enabled: false,
  adBreaks: [],
  skipAllowed: true,
  defaultSkipAfter: 5,
};

const initialState: AdState = {
  isPlayingAd: false,
  currentAd: null,
  currentAdBreak: null,
  adProgress: 0,
  adDuration: 0,
  canSkip: false,
  skipCountdown: 0,
  adsRemaining: 0,
};

export const AdContext = createContext<AdContextValue | null>(null);

export interface AdProviderProps {
  children: React.ReactNode;
  config?: Partial<AdConfig>;
}

export function AdProvider({ children, config: userConfig = {} }: AdProviderProps) {
  const config = useMemo<AdConfig>(() => ({
    ...DEFAULT_CONFIG,
    ...userConfig,
  }), [userConfig]);

  const [state, setState] = useState<AdState>(initialState);
  const adAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAdIndex = useRef(0);
  const skipTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track which quartiles have been fired (to avoid duplicate fires)
  const firedQuartiles = useRef<Set<string>>(new Set());
  // Track which progress offsets have been fired
  const firedProgressOffsets = useRef<Set<number>>(new Set());

  // Update state helper
  const updateState = useCallback((updates: Partial<AdState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Standard VAST event types (excludes 'progress' which has a different structure)
  type StandardTrackingEvent = Exclude<keyof NonNullable<Ad['trackingUrls']>, 'progress'>;

  // Track ad impression
  const trackAdEvent = useCallback(async (ad: Ad, eventType: StandardTrackingEvent) => {
    const url = ad.trackingUrls?.[eventType];
    if (url && typeof url === 'string') {
      try {
        await fetch(url, { method: 'GET', mode: 'no-cors' });
      } catch (error) {
        console.error(`Failed to track ad ${eventType}:`, error);
      }
    }
  }, []);

  // Play ad
  const playAd = useCallback((ad: Ad, adBreak: AdBreak, adsRemaining: number) => {
    if (!adAudioRef.current) return;

    // Reset quartile and progress tracking for new ad
    firedQuartiles.current.clear();
    firedProgressOffsets.current.clear();

    adAudioRef.current.src = ad.src;
    adAudioRef.current.play();

    const skipAfter = ad.skipAfterSeconds ?? config.defaultSkipAfter ?? null;

    updateState({
      isPlayingAd: true,
      currentAd: ad,
      currentAdBreak: adBreak,
      adDuration: ad.duration,
      adProgress: 0,
      canSkip: skipAfter === null ? false : skipAfter === 0,
      skipCountdown: skipAfter ?? 0,
      adsRemaining,
    });

    trackAdEvent(ad, 'impression');
    trackAdEvent(ad, 'start');
    config.onAdStart?.(ad, adBreak);

    // Start skip countdown if applicable
    if (skipAfter !== null && skipAfter > 0) {
      let countdown = skipAfter;
      skipTimer.current = setInterval(() => {
        countdown -= 1;
        updateState({ skipCountdown: countdown });
        if (countdown <= 0) {
          updateState({ canSkip: true });
          if (skipTimer.current) {
            clearInterval(skipTimer.current);
          }
        }
      }, 1000);
    }
  }, [config, trackAdEvent, updateState]);

  // Skip ad
  const skipAd = useCallback(() => {
    if (!state.canSkip || !state.currentAd || !state.currentAdBreak) return;

    if (skipTimer.current) {
      clearInterval(skipTimer.current);
    }

    trackAdEvent(state.currentAd, 'skip');
    config.onAdSkip?.(state.currentAd, state.currentAdBreak);

    // Move to next ad or end ad break
    const ads = state.currentAdBreak.ads;
    currentAdIndex.current += 1;

    if (currentAdIndex.current < ads.length) {
      const nextAd = ads[currentAdIndex.current];
      playAd(nextAd, state.currentAdBreak, ads.length - currentAdIndex.current - 1);
    } else {
      // End ad break
      config.onAllAdsComplete?.(state.currentAdBreak);
      updateState(initialState);
    }
  }, [state.canSkip, state.currentAd, state.currentAdBreak, trackAdEvent, config, playAd, updateState]);

  // Click through
  const clickThrough = useCallback(() => {
    if (!state.currentAd || !state.currentAdBreak) return;

    trackAdEvent(state.currentAd, 'click');
    config.onAdClick?.(state.currentAd, state.currentAdBreak);

    if (state.currentAd.clickThroughUrl) {
      window.open(state.currentAd.clickThroughUrl, '_blank');
    }
  }, [state.currentAd, state.currentAdBreak, trackAdEvent, config]);

  // Start ad break
  const startAdBreak = useCallback((adBreak: AdBreak) => {
    if (!adBreak.ads || adBreak.ads.length === 0) return;

    currentAdIndex.current = 0;
    const firstAd = adBreak.ads[0];
    playAd(firstAd, adBreak, adBreak.ads.length - 1);
  }, [playAd]);

  // Stop ads
  const stopAds = useCallback(() => {
    if (skipTimer.current) {
      clearInterval(skipTimer.current);
    }
    if (adAudioRef.current) {
      adAudioRef.current.pause();
      adAudioRef.current.src = '';
    }
    updateState(initialState);
  }, [updateState]);

  // Set up ad audio element events
  useEffect(() => {
    const audio = adAudioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const currentTime = audio.currentTime;
      const duration = audio.duration || 0;

      updateState({ adProgress: currentTime });

      if (state.currentAd && state.currentAdBreak && duration > 0) {
        const percentage = (currentTime / duration) * 100;
        const remainingTime = Math.max(0, duration - currentTime);

        // Fire progress callback
        const progressInfo: AdProgressInfo = {
          currentTime,
          duration,
          percentage,
          remainingTime,
        };
        config.onAdProgress?.(progressInfo, state.currentAd, state.currentAdBreak);

        // Track quartiles (only fire once each)
        if (percentage >= 25 && !firedQuartiles.current.has('firstQuartile')) {
          firedQuartiles.current.add('firstQuartile');
          trackAdEvent(state.currentAd, 'firstQuartile');
          config.onFirstQuartile?.(state.currentAd, state.currentAdBreak);
        }
        if (percentage >= 50 && !firedQuartiles.current.has('midpoint')) {
          firedQuartiles.current.add('midpoint');
          trackAdEvent(state.currentAd, 'midpoint');
          config.onMidpoint?.(state.currentAd, state.currentAdBreak);
        }
        if (percentage >= 75 && !firedQuartiles.current.has('thirdQuartile')) {
          firedQuartiles.current.add('thirdQuartile');
          trackAdEvent(state.currentAd, 'thirdQuartile');
          config.onThirdQuartile?.(state.currentAd, state.currentAdBreak);
        }

        // Track custom progress offsets
        const progressUrls = state.currentAd.trackingUrls?.progress;
        if (progressUrls) {
          for (const { offset, url } of progressUrls) {
            if (currentTime >= offset && !firedProgressOffsets.current.has(offset)) {
              firedProgressOffsets.current.add(offset);
              fetch(url, { method: 'GET', mode: 'no-cors' }).catch(() => {});
            }
          }
        }
      }
    };

    const handleEnded = () => {
      if (!state.currentAd || !state.currentAdBreak) return;

      if (skipTimer.current) {
        clearInterval(skipTimer.current);
      }

      trackAdEvent(state.currentAd, 'complete');
      config.onAdComplete?.(state.currentAd, state.currentAdBreak);

      // Move to next ad or end ad break
      const ads = state.currentAdBreak.ads;
      currentAdIndex.current += 1;

      if (currentAdIndex.current < ads.length) {
        const nextAd = ads[currentAdIndex.current];
        playAd(nextAd, state.currentAdBreak, ads.length - currentAdIndex.current - 1);
      } else {
        // End ad break
        config.onAllAdsComplete?.(state.currentAdBreak);
        updateState(initialState);
      }
    };

    const handleError = () => {
      if (state.currentAd && state.currentAdBreak) {
        trackAdEvent(state.currentAd, 'error');
        config.onAdError?.(new Error('Ad playback error'), state.currentAd, state.currentAdBreak);
      }
      updateState(initialState);
    };

    const handlePause = () => {
      if (state.currentAd && state.currentAdBreak) {
        trackAdEvent(state.currentAd, 'pause');
        config.onAdPause?.(state.currentAd, state.currentAdBreak);
      }
    };

    const handleResume = () => {
      if (state.currentAd && state.currentAdBreak) {
        trackAdEvent(state.currentAd, 'resume');
        config.onAdResume?.(state.currentAd, state.currentAdBreak);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handleResume);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handleResume);
    };
  }, [state.currentAd, state.currentAdBreak, config, trackAdEvent, playAd, updateState]);

  const contextValue = useMemo<AdContextValue>(() => ({
    state,
    controls: {
      skipAd,
      clickThrough,
      startAdBreak,
      stopAds,
    },
    config,
  }), [state, skipAd, clickThrough, startAdBreak, stopAds, config]);

  return (
    <AdContext.Provider value={contextValue}>
      <audio ref={adAudioRef} />
      {children}
    </AdContext.Provider>
  );
}

export function useAds(): AdContextValue {
  const context = useContext(AdContext);

  if (!context) {
    throw new Error('useAds must be used within an AdProvider');
  }

  return context;
}
