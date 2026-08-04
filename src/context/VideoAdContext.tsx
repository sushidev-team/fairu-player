import React, { createContext, useContext, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import { isHLSSource, supportsNativeHLS } from '@/hooks/useHLS';
import type { AdState, AdControls, AdProgressInfo } from '@/types/ads';
import { VastErrorCode } from '@/types/vast';
import { VastTracker } from '@/utils/vast/VastTracker';
import { videoAdToTrackable } from '@/utils/vast/toVideoAd';
import { capPodDuration, checkAdCaps, createAdSession, recordAdStarted } from '@/utils/adCaps';
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
  /** Session accounting for `maxAdsPerSession` and `minSecondsBetweenAds`. */
  const sessionRef = useRef(createAdSession());

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

  /**
   * Fire tracking pixels through the shared {@link VastTracker}.
   *
   * This replaced a hand-rolled `fetch` per event, which had three problems the
   * tracker solves once for both players:
   *
   * 1. **Only the first URL fired.** `trackingUrls.impression` accepted a single
   *    string, so a VAST wrapper chain's extra impression pixels were dropped —
   *    a billing error, since SSP and DSP both need counting.
   * 2. **No macro substitution.** `?cb=[CACHEBUSTING]` was sent verbatim, so ad
   *    servers saw the literal placeholder instead of a cache buster.
   * 3. **Plain `fetch`.** Pixels sent while the page was unloading were dropped;
   *    the tracker uses `navigator.sendBeacon` where available.
   *
   * A tracker instance belongs to one ad playback, so it is rebuilt whenever the
   * current ad changes — that is what keeps "fire once" scoped correctly.
   */
  const trackerRef = useRef<VastTracker | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const startTracking = useCallback((ad: VideoAd, adBreak: VideoAdBreak) => {
    trackerRef.current?.dispose();

    trackerRef.current = new VastTracker(videoAdToTrackable(ad), {
      macros: { BREAKPOSITION: adBreak.position },
      // Lifecycle callbacks ride on the tracker's once-only bookkeeping rather
      // than keeping a parallel set of "already fired" flags.
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

  // Cleanup component ad timer
  const cleanupComponentAdTimer = useCallback(() => {
    if (componentAdTimerRef.current) {
      clearInterval(componentAdTimerRef.current);
      componentAdTimerRef.current = null;
    }
  }, []);

  // Play ad
  const playAd = useCallback((ad: VideoAd, adBreak: VideoAdBreak, adsRemaining: number) => {
    // A fresh tracker per ad is what scopes "fire once" to this playback.
    const tracker = startTracking(ad, adBreak);
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
      // Component ad - drive the tracker from a timer, since there is no media
      // element to emit timeupdate. Quartiles and offset-based progress pixels
      // are handled by the tracker exactly as they are for video ads.
      let progress = 0;
      componentAdTimerRef.current = setInterval(() => {
        progress += 0.1; // Update every 100ms
        updateState({ adProgress: progress });
        tracker.progress(progress, ad.duration);
      }, 100);
    }

    // Check if this is a bumper ad (6s non-skippable)
    const isBumperAd = ad.type === 'bumper';

    // Bumper ads are always 6 seconds and non-skippable
    if (isBumperAd) {
      config.onBumperStart?.(ad);
    }

    // Determine if skip is allowed:
    // - Bumper ads are never skippable
    // - config.skipAllowed === false disables all skipping globally
    // - ad.skipAfterSeconds === null makes this specific ad non-skippable
    // - Otherwise use ad's skipAfterSeconds or config.defaultSkipAfter
    const globalSkipAllowed = config.skipAllowed !== false && !isBumperAd;
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

    tracker.impression();
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
  }, [config, cleanupComponentAdTimer, loadAdSource, startTracking, updateState]);

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

    trackerRef.current?.skip();
    config.onAdSkip?.(state.currentAd, state.currentAdBreak);

    advanceToNextAd();
  }, [state.canSkip, state.currentAd, state.currentAdBreak, cleanupComponentAdTimer, config, advanceToNextAd]);

  // Complete component ad (called by custom ad components)
  const completeComponentAd = useCallback(() => {
    if (!state.currentAd || !state.currentAdBreak || !state.isComponentAd) return;

    if (skipTimer.current) {
      clearInterval(skipTimer.current);
    }
    cleanupComponentAdTimer();

    trackerRef.current?.complete();
    config.onAdComplete?.(state.currentAd, state.currentAdBreak);

    advanceToNextAd();
  }, [state.currentAd, state.currentAdBreak, state.isComponentAd, cleanupComponentAdTimer, config, advanceToNextAd]);

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
  const startAdBreak = useCallback((adBreak: VideoAdBreak) => {
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
    playAd(ads[0] as VideoAd, cappedBreak, ads.length - 1);
  }, [config, playAd]);

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

        // Quartiles, `start` and offset-based progress pixels are all handled
        // here — once each, with macros substituted. The lifecycle callbacks
        // (`onFirstQuartile` …) ride along via the tracker's `onEvent`.
        trackerRef.current?.progress(currentTime, duration);
      }
    };

    const handleEnded = () => {
      if (!state.currentAd || !state.currentAdBreak) return;

      if (skipTimer.current) {
        clearInterval(skipTimer.current);
      }

      const ad = state.currentAd as VideoAd;
      // Prefer the element's real duration; fall back to the declared one when
      // metadata never arrived.
      trackerRef.current?.complete(
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : ad.duration
      );
      config.onAdComplete?.(state.currentAd, state.currentAdBreak);

      // Fire bumper complete callback if this was a bumper ad
      if (ad.type === 'bumper') {
        config.onBumperComplete?.(ad);
      }

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
        trackerRef.current?.error(VastErrorCode.MEDIAFILE_DISPLAY);
        config.onAdError?.(new Error('Video ad playback error'), state.currentAd, state.currentAdBreak);
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
  }, [state.currentAd, state.currentAdBreak, config, playAd, updateState]);

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
