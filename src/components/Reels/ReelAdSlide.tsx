import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/utils/cn';
import { useHLS } from '@/hooks/useHLS';
import { useLabels } from '@/context/LabelsContext';
import { interpolateLabel } from '@/types/labels';
import { sanitizeUrl } from '@/utils/security';
import { VastTracker } from '@/utils/vast';
import { VastErrorCode } from '@/types/vast';
import type { HLSConfig } from '@/types/video';
import type { ReelAd, ReelAdSlot, ReelAdSlotState } from '@/types/reels';
import { ReelProgress } from './ReelProgress';

export interface ReelAdSlideProps {
  slot: ReelAdSlot;
  slotState: ReelAdSlotState | undefined;
  active: boolean;
  playing: boolean;
  muted: boolean;
  shouldLoad: boolean;
  hls?: HLSConfig;
  /** Whether the viewer is prevented from swiping past this ad. */
  gated?: boolean;
  onAdStart?: (ad: ReelAd, slot: ReelAdSlot) => void;
  onAdProgress?: (ad: ReelAd, currentTime: number, duration: number) => void;
  onAdComplete?: (ad: ReelAd, slot: ReelAdSlot) => void;
  onAdSkip?: (ad: ReelAd, slot: ReelAdSlot, atTime: number) => void;
  onAdClick?: (ad: ReelAd, slot: ReelAdSlot) => void;
  onAdError?: (error: Error, ad: ReelAd | null, slot: ReelAdSlot) => void;
  onToggleMute?: () => void;
  /** Emitted for every tracking pixel sent — wire this to a debug HUD. */
  onBeacon?: (event: string, url: string) => void;
  className?: string;
}

/**
 * An ad rendered as a feed slide.
 *
 * Standards behaviour that matters here:
 *
 * - **Impression on view, not on load.** The pixel fires when the ad becomes the
 *   active slide and starts playing, never when it is merely prefetched. Firing
 *   on prefetch is the single most common way a feed integration over-reports.
 * - **Quartiles and offset progress** are driven by {@link VastTracker}, which
 *   guarantees once-only delivery even if the element seeks or re-buffers.
 * - **`skipoffset`** unlocks the skip button; `null` means non-skippable and no
 *   button is rendered at all.
 * - **Click-through** fires `ClickTracking` *and* opens `ClickThrough` with
 *   `noopener`, so the ad page cannot reach back into the player.
 * - **`<Error>` pixels** are sent with `[ERRORCODE]` filled in on playback failure.
 */
export function ReelAdSlide({
  slot,
  slotState,
  active,
  playing,
  muted,
  shouldLoad,
  hls,
  gated = false,
  onAdStart,
  onAdProgress,
  onAdComplete,
  onAdSkip,
  onAdClick,
  onAdError,
  onToggleMute,
  onBeacon,
  className,
}: ReelAdSlideProps) {
  const labels = useLabels();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const status = slotState?.status ?? 'idle';
  const ad = slotState?.ads[slotState.podIndex] ?? null;
  const podSize = slotState?.ads.length ?? 0;
  const podIndex = slotState?.podIndex ?? 0;

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(ad?.duration ?? 0);
  const [buffering, setBuffering] = useState(false);

  const isHls = !!ad?.src.includes('.m3u8');

  useHLS({
    src: shouldLoad && ad && isHls ? ad.src : undefined,
    videoRef,
    config: hls,
  });

  /* ------------------------------- Tracking ------------------------------- */

  // One tracker per (ad, activation). Recreating it on ad change is what keeps
  // pod members from inheriting each other's "already fired" state.
  const tracker = useMemo(() => {
    if (!ad) return null;
    return new VastTracker(ad, { onBeacon });
  }, [ad, onBeacon]);

  useEffect(() => () => tracker?.dispose(), [tracker]);

  /* ---------------------------- Source handling --------------------------- */

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ad) return;

    if (!shouldLoad) {
      if (video.src) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      return;
    }

    if (isHls) return;

    // The ad URL comes from a third-party document, so validate the scheme
    // before it ever reaches the media element.
    const safe = sanitizeUrl(ad.src, ['http:', 'https:', 'blob:']);
    if (!safe) {
      tracker?.error(VastErrorCode.NO_SUPPORTED_MEDIAFILE);
      onAdError?.(new Error(`Ad media URL rejected: ${ad.src}`), ad, slot);
      return;
    }

    if (video.src !== safe) {
      video.src = safe;
      video.load();
    }
  }, [shouldLoad, ad, isHls, slot, tracker, onAdError]);

  /* ------------------------------ Play control ---------------------------- */

  const startedRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ad) return;

    if (active && playing) {
      const attempt = video.play();
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch(() => {
          // Muted autoplay is allowed everywhere; anything else is the policy
          // blocking us and the viewer's next tap will start it.
        });
      }
    } else {
      video.pause();
    }
  }, [active, playing, ad]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = muted;
  }, [muted]);

  // Report mute changes to the ad server — advertisers buy on audibility.
  const previousMuted = useRef(muted);
  useEffect(() => {
    if (!active || !tracker || previousMuted.current === muted) {
      previousMuted.current = muted;
      return;
    }
    previousMuted.current = muted;
    tracker.mute(muted);
  }, [muted, active, tracker]);

  // Reset per-activation state whenever this slide stops being the active one.
  useEffect(() => {
    if (active) return;
    startedRef.current = false;
    setCurrentTime(0);
    const video = videoRef.current;
    if (video) {
      try {
        video.currentTime = 0;
      } catch {
        // Pre-metadata seek; harmless.
      }
    }
  }, [active]);

  /* ------------------------------ Media events ---------------------------- */

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ad || !tracker) return;

    const handleTimeUpdate = () => {
      const total = Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : ad.duration;

      setCurrentTime(video.currentTime);

      if (!active) return;

      // The impression belongs to the first frame the viewer actually sees.
      if (!startedRef.current && video.currentTime > 0) {
        startedRef.current = true;
        tracker.impression();
        tracker.viewable('viewable');
        onAdStart?.(ad, slot);
      }

      tracker.progress(video.currentTime, total);
      onAdProgress?.(ad, video.currentTime, total);
    };

    const handleLoadedMetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) setDuration(video.duration);
    };
    const handleWaiting = () => setBuffering(true);
    const handlePlaying = () => setBuffering(false);

    const handleEnded = () => {
      if (!active) return;
      tracker.complete(video.duration || ad.duration);
      onAdComplete?.(ad, slot);
    };

    const handleError = () => {
      const message = video.error?.message || 'Ad playback failed';
      tracker.error(VastErrorCode.MEDIAFILE_DISPLAY);
      onAdError?.(new Error(message), ad, slot);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [ad, tracker, active, slot, onAdStart, onAdProgress, onAdComplete, onAdError]);

  /* -------------------------------- Skipping ------------------------------ */

  const skipOffset = ad?.skipOffset ?? null;
  const canSkip = skipOffset !== null && currentTime >= skipOffset;
  const skipCountdown =
    skipOffset === null ? 0 : Math.max(0, Math.ceil(skipOffset - currentTime));

  const handleSkip = useCallback(() => {
    if (!ad || !canSkip) return;
    tracker?.skip();
    onAdSkip?.(ad, slot, currentTime);
  }, [ad, canSkip, tracker, onAdSkip, slot, currentTime]);

  const handleCtaClick = useCallback(() => {
    if (!ad) return;

    tracker?.click();
    onAdClick?.(ad, slot);

    const target = sanitizeUrl(ad.clickThroughUrl, ['http:', 'https:']);
    if (target && typeof window !== 'undefined') {
      // `noopener,noreferrer` prevents the landing page from touching the opener.
      window.open(target, '_blank', 'noopener,noreferrer');
    }
  }, [ad, tracker, onAdClick, slot]);

  /* -------------------------------- Rendering ----------------------------- */

  if (status === 'loading' || status === 'idle') {
    return (
      <div className={cn('relative flex h-full w-full items-center justify-center bg-black', className)}>
        <span className="fp-animate-spin h-8 w-8 rounded-full border-2 border-white/25 border-t-white" />
      </div>
    );
  }

  // Unfilled and failed slots render a neutral surface for the frame or two
  // before useReelsFeed scrolls past them.
  if (!ad) {
    return (
      <div className={cn('relative flex h-full w-full items-center justify-center bg-black', className)}>
        <span className="text-xs text-white/40">{labels.ad}</span>
      </div>
    );
  }

  const remaining = Math.max(0, Math.ceil((duration || ad.duration) - currentTime));
  const adChoices = ad.icons?.find(
    (icon) => icon.program?.toLowerCase() === 'adchoices' || !!icon.staticResource
  );

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted={muted}
        preload="auto"
        poster={ad.poster}
        disablePictureInPicture
        // Ads must never be scrubbed or downloaded from the player chrome.
        controls={false}
        aria-label={`${labels.ad}: ${ad.title ?? ad.advertiser ?? ''}`}
      />

      {buffering && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="fp-animate-spin h-8 w-8 rounded-full border-2 border-white/25 border-t-white" />
        </div>
      )}

      {/* Top bar: ad badge, pod position, remaining time, AdChoices. */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-start justify-between p-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[var(--fp-color-accent)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
            {labels.ad}
          </span>
          {podSize > 1 && (
            <span className="rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
              {podIndex + 1}/{podSize}
            </span>
          )}
          <span className="rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white/90 backdrop-blur-sm">
            {interpolateLabel(labels.adCountdown, { seconds: remaining })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {adChoices?.staticResource && (
            <a
              href={sanitizeUrl(adChoices.clickThroughUrl, ['http:', 'https:']) ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="block h-4 w-4 overflow-hidden rounded-sm bg-white/80"
              aria-label={labels.learnMore}
            >
              <img src={adChoices.staticResource} alt="" className="h-full w-full object-contain" />
            </a>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleMute?.();
            }}
            aria-label={muted ? labels.unmute : labels.mute}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
          >
            {muted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Skip control — only when the creative allows it. */}
      {skipOffset !== null && (
        <div className="absolute bottom-28 right-3 z-20">
          {canSkip ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleSkip();
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-full bg-black/60 px-3.5 py-2',
                'text-xs font-semibold text-white backdrop-blur-sm',
                'transition-colors hover:bg-black/75'
              )}
            >
              {labels.skipAd}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="13 17 18 12 13 7" />
                <polyline points="6 17 11 12 6 7" />
              </svg>
            </button>
          ) : (
            <span className="rounded-full bg-black/45 px-3.5 py-2 text-xs font-medium tabular-nums text-white/80 backdrop-blur-sm">
              {interpolateLabel(labels.skipIn, { seconds: skipCountdown })}
            </span>
          )}
        </div>
      )}

      {/* Advertiser block + CTA. */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-5 pt-14">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
            {labels.sponsored}
          </span>
          {ad.advertiser && (
            <span className="text-[11px] text-white/60">· {ad.advertiser}</span>
          )}
        </div>

        {ad.title && (
          <p className="mb-1 text-sm font-semibold leading-snug text-white">{ad.title}</p>
        )}
        {ad.description && (
          <p className="mb-3 line-clamp-2 text-[12px] leading-snug text-white/75">
            {ad.description}
          </p>
        )}

        {ad.clickThroughUrl && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleCtaClick();
            }}
            className={cn(
              'flex w-full items-center justify-center gap-1.5 rounded-lg',
              'bg-white px-4 py-2.5 text-[13px] font-semibold text-black',
              'transition-transform active:scale-[0.98]'
            )}
          >
            {ad.ctaLabel ?? labels.learnMore}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        )}

        {gated && (
          <p className="mt-2 text-center text-[10px] text-white/50">
            {interpolateLabel(labels.skipIn, { seconds: remaining })}
          </p>
        )}
      </div>

      {/* Ads are never scrubbable — the bar is display-only. */}
      <ReelProgress
        currentTime={currentTime}
        duration={duration || ad.duration}
        scrubbable={false}
        variant="ad"
      />
    </div>
  );
}

export default ReelAdSlide;
