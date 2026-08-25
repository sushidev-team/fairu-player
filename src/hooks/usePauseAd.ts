import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VastTracker } from '@/utils/vast';
import { sanitizeUrl } from '@/utils/security';
import { shouldShow, type PauseAd } from '@/core/pauseAd';

export interface UsePauseAdOptions {
  ad?: PauseAd;
  /** Playback is stopped. */
  isPaused: boolean;
  /** Playback is running. Used to notice that it ever started. */
  isPlaying: boolean;
  enabled?: boolean;
  onShow?: (ad: PauseAd) => void;
  onHide?: (ad: PauseAd) => void;
  onClick?: (ad: PauseAd) => void;
  onBeacon?: (event: string, url: string) => void;
}

export interface UsePauseAdReturn {
  isVisible: boolean;
  currentAd: PauseAd | null;
  /** Seconds playback has been stopped. */
  pausedFor: number;
  /** Dismiss it for this pause. */
  dismiss: () => void;
  /** Open the advertiser's page and report the click. */
  click: () => void;
}

/**
 * The banner shown while playback is stopped.
 *
 * The rule lives in `@/core/pauseAd`. What is here is the clock and the pixels
 * — the version this was ported from sent none of the tracking URLs its own
 * type declares, and measured the pause with a `setInterval` whose cleanup ran
 * before it was ever started.
 */
export function usePauseAd(options: UsePauseAdOptions): UsePauseAdReturn {
  const { ad, isPaused, isPlaying, enabled = true, onShow, onHide, onClick, onBeacon } = options;

  /** When the current pause began, in wall-clock ms. */
  const [pausedSince, setPausedSince] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  const live = useRef({ onShow, onHide, onClick });
  useEffect(() => {
    live.current = { onShow, onHide, onClick };
  });

  /*
    Two readings from outside React, kept in state because that is the only
    place a render can see them: whether playback has ever run, and the moment
    the current pause began.

    Neither can cascade — each effect depends on the one prop it reflects, and
    the values it writes are derived from that prop alone.
  */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isPlaying) setHasPlayed(true);
  }, [isPlaying]);

  useEffect(() => {
    if (isPaused) {
      const at = Date.now();
      setPausedSince(at);
      setNow(at);
      return;
    }

    setPausedSince(null);
    setDismissed(false);
  }, [isPaused]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /*
    A tick, and only while it is needed.

    The elapsed time comes from the clock rather than a counter, so a throttled
    tick costs nothing — and the interval stops as soon as the banner is up,
    because after that the number is not read again.
  */
  const waiting = pausedSince !== null && !dismissed;
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [waiting]);

  const pausedFor = pausedSince === null ? 0 : Math.max(0, (now - pausedSince) / 1000);

  const visible =
    !dismissed && shouldShow(ad, { isPaused, hasPlayed, pausedFor, enabled });

  /** One tracker per showing, so the impression is sent once per pause. */
  const trackerRef = useRef<VastTracker | null>(null);
  /**
   * Which creative the current tracker belongs to.
   *
   * A boolean would let a second creative appearing during the same pause reuse
   * the first one's tracker — and its URLs. The click would then be billed to
   * an advertiser who never showed anything.
   */
  const shownRef = useRef<string | null>(null);

  useEffect(() => {
    if (visible && ad && shownRef.current !== ad.id) {
      trackerRef.current?.dispose();
      shownRef.current = ad.id;
      trackerRef.current = new VastTracker(
        {
          id: ad.id,
          duration: 0,
          impressionUrls: ad.trackingUrls?.impression ? [ad.trackingUrls.impression] : undefined,
          clickTrackingUrls: ad.trackingUrls?.click ? [ad.trackingUrls.click] : undefined,
          trackingEvents: {
            close: ad.trackingUrls?.close ? [ad.trackingUrls.close] : undefined,
          },
        },
        { onBeacon }
      );
      trackerRef.current.impression();
      live.current.onShow?.(ad);
      return;
    }

    if (!visible && shownRef.current !== null) {
      shownRef.current = null;
      trackerRef.current?.dispose();
      trackerRef.current = null;
      if (ad) live.current.onHide?.(ad);
    }
  }, [visible, ad, onBeacon]);

  const dismiss = useCallback(() => {
    trackerRef.current?.event('close');
    setDismissed(true);
  }, []);

  const click = useCallback(() => {
    if (!ad) return;

    trackerRef.current?.click();
    live.current.onClick?.(ad);

    // The destination comes from an ad server, like the creative did.
    const target = sanitizeUrl(ad.clickThroughUrl, ['http:', 'https:']);
    if (target && typeof window !== 'undefined') {
      window.open(target, '_blank', 'noopener,noreferrer');
    }
  }, [ad]);

  useEffect(() => () => trackerRef.current?.dispose(), []);

  return useMemo(
    () => ({
      isVisible: visible,
      currentAd: visible ? (ad ?? null) : null,
      pausedFor,
      dismiss,
      click,
    }),
    [visible, ad, pausedFor, dismiss, click]
  );
}
