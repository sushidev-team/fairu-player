import { cn } from '@/utils/cn';
import { useLabels } from '@/context/LabelsContext';
import { interpolateLabel, resolveLabels, type PlayerLabels } from '@/types/labels';
import type { RewardedAd as RewardedAdType } from '@/core/rewardedAd';

export interface RewardedAdProps {
  ad: RewardedAdType;
  /** Seconds still to watch. `0` once the reward is earned. */
  remaining: number;
  percentage: number;
  earned: boolean;
  /** Autoplay was refused; offer a way to start it. */
  needsGesture?: boolean;
  /** The element playing the spot — supplied by {@link useRewardedAd}. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onClose: () => void;
  onClick: () => void;
  onPlay?: () => void;
  labels?: PlayerLabels;
  className?: string;
}

/**
 * The full-surface overlay a rewarded spot plays in.
 *
 * Closing is only offered once the reward is earned. That is the deal the
 * viewer accepted, and a close button that appears earlier turns the offer into
 * something else — but it is also why the countdown has to be visible and
 * honest the whole way.
 */
export function RewardedAd({
  ad,
  remaining,
  percentage,
  earned,
  needsGesture = false,
  videoRef,
  onClose,
  onClick,
  onPlay,
  labels: labelsProp,
  className,
}: RewardedAdProps) {
  const contextLabels = useLabels();
  const labels = resolveLabels(labelsProp ?? contextLabels);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ad.title ?? labels.rewardedAd}
      className={cn('absolute inset-0 z-50 flex flex-col bg-black', className)}
    >
      <div className="flex items-center justify-between px-3 py-2 text-xs text-white/80">
        <span>{ad.title ?? labels.rewardedAd}</span>

        {earned ? (
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'rounded-full bg-white/15 px-3 py-1 font-medium text-white',
              'transition-colors hover:bg-white/25'
            )}
          >
            {labels.rewardedAdClose}
          </button>
        ) : (
          // Announced politely: it changes every second, and an assertive live
          // region would interrupt a screen reader on each tick.
          <span aria-live="polite" className="tabular-nums">
            {interpolateLabel(labels.rewardedAdRemaining, { seconds: remaining })}
          </span>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          src={ad.src}
          poster={ad.poster}
          className="h-full w-full object-contain"
          playsInline
          autoPlay
        />

        {/*
          Every browser refuses audible autoplay without a gesture. Without this
          the spot never starts, the reward is never earned, and — because the
          close button only appears once it is — the viewer is stuck in an
          overlay that does nothing.
        */}
        {needsGesture && !earned && (
          <button
            type="button"
            onClick={onPlay}
            aria-label={labels.play}
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-black/40',
              'transition-colors hover:bg-black/50'
            )}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="black" aria-hidden="true">
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
            </span>
          </button>
        )}
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percentage)}
        aria-label={ad.title ?? labels.rewardedAd}
        className="h-1 w-full bg-white/20"
      >
        <div
          className="h-full bg-[var(--fp-color-accent)] transition-[width] duration-200"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 px-3 py-3">
        <div className="min-w-0">
          {ad.rewardDescription && (
            <p className="truncate text-sm text-white">
              {earned ? labels.rewardedAdEarned : ad.rewardDescription}
            </p>
          )}
        </div>

        {ad.clickThroughUrl && (
          <button
            type="button"
            onClick={onClick}
            className={cn(
              'shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black',
              'transition-transform active:scale-[0.98]'
            )}
          >
            {labels.rewardedAdLearnMore}
          </button>
        )}
      </div>
    </div>
  );
}
