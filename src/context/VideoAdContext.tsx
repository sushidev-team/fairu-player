import React, { createContext, useContext, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import { isHLSSource, supportsNativeHLS } from '@/hooks/useHLS';
import type { AdState, AdControls, AdProgressInfo } from '@/types/ads';
import type { VideoAdConfig, VideoAd, VideoAdBreak, CustomAdComponentProps } from '@/types/video';

export interface VideoAdContextValue {
  state: AdState & {
    /** Whether the current ad is a custom component (not video) */
    isComponentAd: boolean;
  };
  controls: AdControls & {
    /** Signal that a component ad has completed */
    completeComponentAd: () => void;
  };
  config: VideoAdConfig;
  adVideoRef: React.RefObject<HTMLVideoElement | null>;
  /** Props for the current component ad (if isComponentAd is true) */
  componentAdProps: CustomAdComponentProps | null;
}

const DEFAULT_CONFIG: VideoAdConfig = {
  enabled: false,
  adBreaks: [],
  skipAllowed: true,
  defaultSkipAfter: 5,
};

const initialState: AdState & { isComponentAd: boolean } = {
  isPlayingAd: false,
  currentAd: null,
  currentAdBreak: null,
  adProgress: 0,
  adDuration: 0,
  canSkip: false,
  skipCountdown: 0,
  adsRemaining: 0,
  isComponentAd: false,
};

export interface VideoAdProviderProps {
  children: React.ReactNode;
  config?: Partial<VideoAdConfig>;
}

export function VideoAdProvider({ children, config: userConfig = {} }: VideoAdProviderProps) {
  const config = useMemo<VideoAdConfig>(() => ({
    ...DEFAULT_CONFIG,
    ...userConfig,
  }), [userConfig]);

  const [state, setState] = useState<AdState & { isComponentAd: boolean }>(initialState);
  const componentAdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adVideoRef = useRef<HTMLVideoElement | null>(null);
  const adHlsRef = useRef<Hls | null>(null);
  const currentAdIndex = useRef(0);
  const skipTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedQuartiles = useRef<Set<string>>(new Set());
  const firedProgressOffsets = useRef<Set<number>>(new Set());

  // Cleanup HLS instance
  const cleanupAdHls = useCallback(() => {
    if (adHlsRef.current) {
      adHlsRef.current.destroy();
      adHlsRef.current = null;
    }
  }, []);

  // Load ad source (handles both HLS and progressive)
  const loadAdSource = useCallback((src: string) => {
    const video = adVideoRef.current;
    if (!video) return;

    // Cleanup previous HLS instance
    cleanupAdHls();

    // Check if source is HLS
    if (isHLSSource(src)) {
      // Check if browser supports HLS natively (Safari)
      if (supportsNativeHLS()) {
        // Use native HLS
        video.src = src;
      } else if (Hls.isSupported()) {
        // Use hls.js
        const hls = new Hls({
          enableWorker: true,
        });
        adHlsRef.current = hls;

        hls.loadSource(src);
        hls.attachMedia(video);

        // Handle HLS errors
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            console.error('HLS ad error:', data.type, data.details);
            // Let the video error handler deal with it
          }
        });
      } else {
        // HLS not supported, try anyway (will likely fail)
        console.warn('HLS is not supported in this browser for ad playback');
        video.src = src;
      }
    } else {
      // Progressive video (MP4, etc.)
      video.src = src;
    }
  }, [cleanupAdHls]);

  // Update state helper
  const updateState = useCallback((updates: Partial<AdState & { isComponentAd: boolean }>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Standard VAST event types (excludes 'progress' which has a different structure)
  type StandardTrackingEvent = Exclude<keyof NonNullable<VideoAd['trackingUrls']>, 'progress'>;

  // Track ad event
  const trackAdEvent = useCallback(async (ad: VideoAd, eventType: StandardTrackingEvent) => {
    const url = ad.trackingUrls?.[eventType];
    if (url && typeof url === 'string') {
      try {
        await fetch(url, { method: 'GET', mode: 'no-cors' });
      } catch (error) {
        console.error(`Failed to track ad ${eventType}:`, error);
      }
    }
  }, []);

  // Cleanup component ad timer
  const cleanupComponentAdTimer = useCallback(() => {
    if (componentAdTimerRef.current) {
      clearInterval(componentAdTimerRef.current);
      componentAdTimerRef.current = null;
    }
  }, []);

  // Play ad
  const playAd = useCallback((ad: VideoAd, adBreak: VideoAdBreak, adsRemaining: number) => {
    // Reset quartile and progress tracking for new ad
    firedQuartiles.current.clear();
    firedProgressOffsets.current.clear();
    cleanupComponentAdTimer();

    // Check if this is a component ad
    const isComponentAd = !!ad.component;

    if (!isComponentAd) {
      // Video ad - need video element
      if (!adVideoRef.current) return;

      // Load ad source (handles HLS and progressive)
      loadAdSource(ad.src);
      adVideoRef.current.poster = ad.poster || '';
      adVideoRef.current.play();
    } else {
      // Component ad - start progress timer
      let progress = 0;
      componentAdTimerRef.current = setInterval(() => {
        progress += 0.1; // Update every 100ms
        updateState({ adProgress: progress });

        // Track quartiles for component ads too
        const percentage = (progress / ad.duration) * 100;
        if (percentage >= 25 && !firedQuartiles.current.has('firstQuartile')) {
          firedQuartiles.current.add('firstQuartile');
          trackAdEvent(ad, 'firstQuartile');
          config.onFirstQuartile?.(ad, adBreak);
        }
        if (percentage >= 50 && !firedQuartiles.current.has('midpoint')) {
          firedQuartiles.current.add('midpoint');
          trackAdEvent(ad, 'midpoint');
          config.onMidpoint?.(ad, adBreak);
        }
        if (percentage >= 75 && !firedQuartiles.current.has('thirdQuartile')) {
          firedQuartiles.current.add('thirdQuartile');
          trackAdEvent(ad, 'thirdQuartile');
          config.onThirdQuartile?.(ad, adBreak);
        }
      }, 100);
    }

    // Determine if skip is allowed:
    // - config.skipAllowed === false disables all skipping globally
    // - ad.skipAfterSeconds === null makes this specific ad non-skippable
    // - Otherwise use ad's skipAfterSeconds or config.defaultSkipAfter
    const globalSkipAllowed = config.skipAllowed !== false;
    const adSkipAfter = ad.skipAfterSeconds;

    let skipAfter: number | null = null;
    if (globalSkipAllowed && adSkipAfter !== null) {
      skipAfter = adSkipAfter ?? config.defaultSkipAfter ?? null;
    }

    updateState({
      isPlayingAd: true,
      currentAd: ad,
      currentAdBreak: adBreak,
      adDuration: ad.duration,
      adProgress: 0,
      canSkip: skipAfter !== null && skipAfter === 0,
      skipCountdown: skipAfter ?? 0,
      adsRemaining,
      isComponentAd,
    });

    trackAdEvent(ad, 'impression');
    trackAdEvent(ad, 'start');
    config.onAdStart?.(ad, adBreak);

    // Start skip countdown if applicable (only if skipping is allowed)
    if (globalSkipAllowed && skipAfter !== null && skipAfter > 0) {
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
  }, [config, cleanupComponentAdTimer, loadAdSource, trackAdEvent, updateState]);

  // Move to next ad or end ad break (shared logic)
  const advanceToNextAd = useCallback(() => {
    if (!state.currentAdBreak) return;

    const ads = state.currentAdBreak.ads as VideoAd[];
    currentAdIndex.current += 1;

    if (currentAdIndex.current < ads.length) {
      const nextAd = ads[currentAdIndex.current];
      playAd(nextAd, state.currentAdBreak as VideoAdBreak, ads.length - currentAdIndex.current - 1);
    } else {
      // End ad break
      cleanupComponentAdTimer();
      config.onAllAdsComplete?.(state.currentAdBreak);
      updateState(initialState);
    }
  }, [state.currentAdBreak, cleanupComponentAdTimer, config, playAd, updateState]);

  // Skip ad
  const skipAd = useCallback(() => {
    if (!state.canSkip || !state.currentAd || !state.currentAdBreak) return;

    if (skipTimer.current) {
      clearInterval(skipTimer.current);
    }
    cleanupComponentAdTimer();

    trackAdEvent(state.currentAd as VideoAd, 'skip');
    config.onAdSkip?.(state.currentAd, state.currentAdBreak);

    advanceToNextAd();
  }, [state.canSkip, state.currentAd, state.currentAdBreak, cleanupComponentAdTimer, trackAdEvent, config, advanceToNextAd]);

  // Complete component ad (called by custom ad components)
  const completeComponentAd = useCallback(() => {
    if (!state.currentAd || !state.currentAdBreak || !state.isComponentAd) return;

    if (skipTimer.current) {
      clearInterval(skipTimer.current);
    }
    cleanupComponentAdTimer();

    trackAdEvent(state.currentAd as VideoAd, 'complete');
    config.onAdComplete?.(state.currentAd, state.currentAdBreak);

    advanceToNextAd();
  }, [state.currentAd, state.currentAdBreak, state.isComponentAd, cleanupComponentAdTimer, trackAdEvent, config, advanceToNextAd]);

  // Click through
  const clickThrough = useCallback(() => {
    if (!state.currentAd || !state.currentAdBreak) return;

    trackAdEvent(state.currentAd as VideoAd, 'click');
    config.onAdClick?.(state.currentAd, state.currentAdBreak);

    if (state.currentAd.clickThroughUrl) {
      window.open(state.currentAd.clickThroughUrl, '_blank');
    }
  }, [state.currentAd, state.currentAdBreak, trackAdEvent, config]);

  // Start ad break
  const startAdBreak = useCallback((adBreak: VideoAdBreak) => {
    if (!adBreak.ads || adBreak.ads.length === 0) return;

    currentAdIndex.current = 0;
    const firstAd = adBreak.ads[0] as VideoAd;
    playAd(firstAd, adBreak, adBreak.ads.length - 1);
  }, [playAd]);

  // Stop ads
  const stopAds = useCallback(() => {
    if (skipTimer.current) {
      clearInterval(skipTimer.current);
    }
    // Cleanup HLS instance and component ad timer
    cleanupAdHls();
    cleanupComponentAdTimer();
    if (adVideoRef.current) {
      adVideoRef.current.pause();
      adVideoRef.current.src = '';
    }
    updateState(initialState);
  }, [cleanupAdHls, cleanupComponentAdTimer, updateState]);

  // Set up ad video element events
  useEffect(() => {
    const video = adVideoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const currentTime = video.currentTime;
      const duration = video.duration || 0;

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
          trackAdEvent(state.currentAd as VideoAd, 'firstQuartile');
          config.onFirstQuartile?.(state.currentAd, state.currentAdBreak);
        }
        if (percentage >= 50 && !firedQuartiles.current.has('midpoint')) {
          firedQuartiles.current.add('midpoint');
          trackAdEvent(state.currentAd as VideoAd, 'midpoint');
          config.onMidpoint?.(state.currentAd, state.currentAdBreak);
        }
        if (percentage >= 75 && !firedQuartiles.current.has('thirdQuartile')) {
          firedQuartiles.current.add('thirdQuartile');
          trackAdEvent(state.currentAd as VideoAd, 'thirdQuartile');
          config.onThirdQuartile?.(state.currentAd, state.currentAdBreak);
        }

        // Track custom progress offsets
        const progressUrls = (state.currentAd as VideoAd).trackingUrls?.progress;
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

      trackAdEvent(state.currentAd as VideoAd, 'complete');
      config.onAdComplete?.(state.currentAd, state.currentAdBreak);

      // Move to next ad or end ad break
      const ads = state.currentAdBreak.ads as VideoAd[];
      currentAdIndex.current += 1;

      if (currentAdIndex.current < ads.length) {
        const nextAd = ads[currentAdIndex.current];
        playAd(nextAd, state.currentAdBreak as VideoAdBreak, ads.length - currentAdIndex.current - 1);
      } else {
        // End ad break
        config.onAllAdsComplete?.(state.currentAdBreak);
        updateState(initialState);
      }
    };

    const handleError = () => {
      if (state.currentAd && state.currentAdBreak) {
        trackAdEvent(state.currentAd as VideoAd, 'error');
        config.onAdError?.(new Error('Video ad playback error'), state.currentAd, state.currentAdBreak);
      }
      updateState(initialState);
    };

    const handlePause = () => {
      if (state.currentAd && state.currentAdBreak) {
        trackAdEvent(state.currentAd as VideoAd, 'pause');
        config.onAdPause?.(state.currentAd, state.currentAdBreak);
      }
    };

    const handleResume = () => {
      if (state.currentAd && state.currentAdBreak) {
        trackAdEvent(state.currentAd as VideoAd, 'resume');
        config.onAdResume?.(state.currentAd, state.currentAdBreak);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('pause', handlePause);
    video.addEventListener('play', handleResume);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('play', handleResume);
    };
  }, [state.currentAd, state.currentAdBreak, config, trackAdEvent, playAd, updateState]);

  // Build component ad props if showing a component ad
  const componentAdProps: CustomAdComponentProps | null = useMemo(() => {
    if (!state.isComponentAd || !state.currentAd) return null;

    return {
      onComplete: completeComponentAd,
      onSkip: skipAd,
      canSkip: state.canSkip,
      skipCountdown: state.skipCountdown,
      duration: state.adDuration,
      progress: state.adProgress,
      ad: state.currentAd as VideoAd,
    };
  }, [state.isComponentAd, state.currentAd, state.canSkip, state.skipCountdown, state.adDuration, state.adProgress, completeComponentAd, skipAd]);

  const contextValue = useMemo<VideoAdContextValue>(() => ({
    state,
    controls: {
      skipAd,
      clickThrough,
      startAdBreak: startAdBreak as AdControls['startAdBreak'],
      stopAds,
      completeComponentAd,
    },
    config,
    adVideoRef,
    componentAdProps,
  }), [state, skipAd, clickThrough, startAdBreak, stopAds, completeComponentAd, config, componentAdProps]);

  return (
    <VideoAdContext.Provider value={contextValue}>
      {children}
    </VideoAdContext.Provider>
  );
}

export const VideoAdContext = createContext<VideoAdContextValue | null>(null);

/**
 * Hook to access the video ad context
 */
export function useVideoAds(): VideoAdContextValue {
  const context = useContext(VideoAdContext);

  if (!context) {
    throw new Error('useVideoAds must be used within a VideoAdProvider');
  }

  return context;
}

export { VideoAdContext as default };
