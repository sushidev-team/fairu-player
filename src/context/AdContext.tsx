import React, { createContext, useContext, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { AdConfig, AdContextValue, AdState, Ad, AdBreak, AdProgressInfo } from '@/types/ads';
import { VastErrorCode } from '@/types/vast';
import { VastTracker } from '@/utils/vast/VastTracker';
import { adToTrackable } from '@/utils/vast/toVideoAd';
import { capPodDuration, checkAdCaps, createAdSession, recordAdStarted } from '@/utils/adCaps';

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
  /** Session accounting for `maxAdsPerSession` and `minSecondsBetweenAds`. */
  const sessionRef = useRef(createAdSession());

  // Update state helper
  const updateState = useCallback((updates: Partial<AdState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * Pixels go through the shared {@link VastTracker}, the same as the video
   * player. Doing it here by hand would repeat the three defects this context
   * used to have: only the first URL per event fired, `[CACHEBUSTING]` was sent
   * verbatim, and a plain `fetch` lost pixels during page teardown.
   */
  const trackerRef = useRef<VastTracker | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const startTracking = useCallback((ad: Ad, adBreak: AdBreak) => {
    trackerRef.current?.dispose();
    trackerRef.current = new VastTracker(adToTrackable(ad), {
      macros: { BREAKPOSITION: adBreak.position },
      onEvent: (event) => {
        const cfg = configRef.current;
        if (event === 'firstQuartile') cfg.onFirstQuartile?.(ad, adBreak);
        else if (event === 'midpoint') cfg.onMidpoint?.(ad, adBreak);
        else if (event === 'thirdQuartile') cfg.onThirdQuartile?.(ad, adBreak);
      },
    });
    return trackerRef.current;
  }, []);

  useEffect(() => () => trackerRef.current?.dispose(), []);

  // Play ad
  const playAd = useCallback((ad: Ad, adBreak: AdBreak, adsRemaining: number) => {
    if (!adAudioRef.current) return;

    // A fresh tracker per ad scopes "fire once" to this playback.
    const tracker = startTracking(ad, adBreak);

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

    tracker.impression();
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
  }, [config, startTracking, updateState]);

  // Skip ad
  const skipAd = useCallback(() => {
    if (!state.canSkip || !state.currentAd || !state.currentAdBreak) return;

    if (skipTimer.current) {
      clearInterval(skipTimer.current);
    }

    trackerRef.current?.skip();
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
  }, [state.canSkip, state.currentAd, state.currentAdBreak, config, playAd, updateState]);

  // Click through
  const clickThrough = useCallback(() => {
    if (!state.currentAd || !state.currentAdBreak) return;

    trackerRef.current?.click();
    config.onAdClick?.(state.currentAd, state.currentAdBreak);

    if (state.currentAd.clickThroughUrl) {
      window.open(state.currentAd.clickThroughUrl, '_blank');
    }
  }, [state.currentAd, state.currentAdBreak, config]);

  // Start ad break
  const startAdBreak = useCallback((adBreak: AdBreak) => {
    if (!adBreak.ads || adBreak.ads.length === 0) return;

    // Load rules are checked here rather than at the trigger sites, because
    // this is the one door every break goes through — pre-roll, mid-roll and
    // post-roll alike.
    const capped = checkAdCaps(config, sessionRef.current, Date.now());
    if (capped) {
      config.onAdCapped?.(adBreak, capped);
      return;
    }

    const ads = capPodDuration(adBreak.ads, config.maxAdDurationPerBreak);
    // The trimmed pod is what plays, so `adsRemaining` and the "ad 2 of 3"
    // labels have to count against it rather than the original.
    const cappedBreak = ads.length === adBreak.ads.length ? adBreak : { ...adBreak, ads };

    sessionRef.current = recordAdStarted(sessionRef.current, Date.now());
    currentAdIndex.current = 0;
    playAd(ads[0], cappedBreak, ads.length - 1);
  }, [config, playAd]);

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

        // Quartiles, `start` and offset-based progress pixels — once each, with
        // macros substituted. Lifecycle callbacks ride the tracker's `onEvent`.
        trackerRef.current?.progress(currentTime, duration);
      }
    };

    const handleEnded = () => {
      if (!state.currentAd || !state.currentAdBreak) return;

      if (skipTimer.current) {
        clearInterval(skipTimer.current);
      }

      trackerRef.current?.complete(audio.duration || state.currentAd.duration);
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
        trackerRef.current?.error(VastErrorCode.MEDIAFILE_DISPLAY);
        config.onAdError?.(new Error('Ad playback error'), state.currentAd, state.currentAdBreak);
      }
      updateState(initialState);
    };

    const handlePause = () => {
      if (state.currentAd && state.currentAdBreak) {
        trackerRef.current?.paused(true);
        config.onAdPause?.(state.currentAd, state.currentAdBreak);
      }
    };

    const handleResume = () => {
      if (state.currentAd && state.currentAdBreak) {
        trackerRef.current?.paused(false);
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
  }, [state.currentAd, state.currentAdBreak, config, playAd, updateState]);

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
