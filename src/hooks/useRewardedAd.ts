import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VastTracker } from '@/utils/vast';
import {
  rewardProgress,
  remainingSeconds,
  type RewardedAd,
} from '@/core/rewardedAd';

export interface RewardedAdState {
  isShowing: boolean;
  isPlaying: boolean;
  /** Enough of the spot has been watched. */
  isRewarded: boolean;
  /** Seconds watched. */
  progress: number;
  duration: number;
  percentage: number;
  /** Seconds left before the reward is earned. */
  remaining: number;
  currentAd: RewardedAd | null;
}

export interface UseRewardedAdOptions {
  ad?: RewardedAd;
  /** The element playing the spot. Progress is read from it. */
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  /** Fired once, when enough has been watched. */
  onReward?: (ad: RewardedAd) => void;
  onStart?: (ad: RewardedAd) => void;
  /** `earned` says whether the viewer got what they came for. */
  onClose?: (ad: RewardedAd, earned: boolean) => void;
  /** Every pixel sent — wire this to a debug HUD. */
  onBeacon?: (event: string, url: string) => void;
}

export interface UseRewardedAdReturn {
  state: RewardedAdState;
  show: () => void;
  close: () => void;
  /** Open the advertiser's page and report the click. */
  click: () => void;
  isAvailable: boolean;
}

const idle: RewardedAdState = {
  isShowing: false,
  isPlaying: false,
  isRewarded: false,
  progress: 0,
  duration: 0,
  percentage: 0,
  remaining: 0,
  currentAd: null,
};

/**
 * A spot the viewer watches in exchange for something.
 *
 * The rule for "watched enough" lives in `@/core/rewardedAd`. What is here is
 * the part that makes it a rewarded ad rather than a data structure: reading
 * progress off the element, sending the pixels the creative declared, and
 * granting the reward exactly once.
 */
export function useRewardedAd(options: UseRewardedAdOptions): UseRewardedAdReturn {
  const { ad, mediaRef, onReward, onStart, onClose, onBeacon } = options;

  const [state, setState] = useState<RewardedAdState>(idle);

  const live = useRef({ onReward, onStart, onClose });
  useEffect(() => {
    live.current = { onReward, onStart, onClose };
  });

  /** One tracker per showing, so "fire once" is scoped to this watch. */
  const trackerRef = useRef<VastTracker | null>(null);
  const rewardedRef = useRef(false);

  const show = useCallback(() => {
    if (!ad) return;

    trackerRef.current?.dispose();
    trackerRef.current = new VastTracker(
      {
        id: ad.id,
        duration: ad.duration,
        impressionUrls: ad.trackingUrls?.impression ? [ad.trackingUrls.impression] : undefined,
        clickTrackingUrls: ad.trackingUrls?.click ? [ad.trackingUrls.click] : undefined,
        trackingEvents: {
          start: ad.trackingUrls?.start ? [ad.trackingUrls.start] : undefined,
          firstQuartile: ad.trackingUrls?.quartile25 ? [ad.trackingUrls.quartile25] : undefined,
          midpoint: ad.trackingUrls?.quartile50 ? [ad.trackingUrls.quartile50] : undefined,
          thirdQuartile: ad.trackingUrls?.quartile75 ? [ad.trackingUrls.quartile75] : undefined,
          complete: ad.trackingUrls?.complete ? [ad.trackingUrls.complete] : undefined,
        },
      },
      { onBeacon }
    );

    rewardedRef.current = false;
    setState({ ...idle, isShowing: true, duration: ad.duration, currentAd: ad });
    live.current.onStart?.(ad);
  }, [ad, onBeacon]);

  // Read by `close` and `click`, neither of which may be rebuilt on every
  // progress update — they end up on buttons.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const close = useCallback(() => {
    const { currentAd, isRewarded } = stateRef.current;
    trackerRef.current?.dispose();
    trackerRef.current = null;
    setState(idle);
    if (currentAd) live.current.onClose?.(currentAd, isRewarded);
  }, []);

  /* --------------------------- Driving from the element -------------------- */

  useEffect(() => {
    const element = mediaRef.current;
    if (!element || !state.isShowing) return;

    const tracker = trackerRef.current;

    const handleTimeUpdate = () => {
      const duration =
        Number.isFinite(element.duration) && element.duration > 0
          ? element.duration
          : state.currentAd?.duration ?? 0;
      const { percentage, earned } = rewardProgress(element.currentTime, duration);

      tracker?.progress(element.currentTime, duration);

      setState((current) => ({
        ...current,
        progress: element.currentTime,
        duration,
        percentage,
        remaining: remainingSeconds(element.currentTime, duration),
        isRewarded: current.isRewarded || earned,
      }));

      // Granted once. A viewer who watches past the threshold has not earned
      // it twice, and a host crediting an account would.
      if (earned && !rewardedRef.current && state.currentAd) {
        rewardedRef.current = true;
        live.current.onReward?.(state.currentAd);
      }
    };

    const handlePlay = () => {
      tracker?.impression();
      tracker?.event('start');
      setState((current) => ({ ...current, isPlaying: true }));
    };
    const handlePause = () => setState((current) => ({ ...current, isPlaying: false }));
    const handleEnded = () => {
      tracker?.complete(element.duration);
      setState((current) => ({ ...current, isPlaying: false }));
    };

    element.addEventListener('timeupdate', handleTimeUpdate);
    element.addEventListener('play', handlePlay);
    element.addEventListener('pause', handlePause);
    element.addEventListener('ended', handleEnded);

    return () => {
      element.removeEventListener('timeupdate', handleTimeUpdate);
      element.removeEventListener('play', handlePlay);
      element.removeEventListener('pause', handlePause);
      element.removeEventListener('ended', handleEnded);
    };
  }, [mediaRef, state.isShowing, state.currentAd]);

  const click = useCallback(() => {
    const ad = stateRef.current.currentAd;
    if (!ad) return;

    trackerRef.current?.click();
    if (ad.clickThroughUrl && typeof window !== 'undefined') {
      // `noopener,noreferrer`: the landing page must not reach the opener.
      window.open(ad.clickThroughUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  useEffect(() => () => trackerRef.current?.dispose(), []);

  return useMemo(
    () => ({ state, show, close, click, isAvailable: Boolean(ad) }),
    [state, show, close, click, ad]
  );
}
