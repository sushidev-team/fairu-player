/**
 * Rewarded ads — watch the spot, unlock the thing.
 *
 * Ported from PR #16, where the hook held `progress`, `percentage` and
 * `isRewarded` in state and had nothing that ever moved them. The reward could
 * not be earned, and the tracking URLs the type declares were never sent. This
 * is the part that decides when it *is* earned.
 */

export interface RewardedAdTracking {
  impression?: string;
  start?: string;
  complete?: string;
  click?: string;
  quartile25?: string;
  quartile50?: string;
  quartile75?: string;
}

export interface RewardedAd {
  id: string;
  src: string;
  /** Declared length, used until the element reports its own. */
  duration: number;
  title?: string;
  /** What the viewer gets — shown before they commit to watching. */
  rewardDescription?: string;
  poster?: string;
  clickThroughUrl?: string;
  trackingUrls?: RewardedAdTracking;
}

/**
 * How much of a spot counts as watched.
 *
 * Not 100 %: a media element rarely reports the final fraction of a second, and
 * a reward withheld because playback stopped at 29.8 of 30 seconds is a support
 * ticket. The IAB uses the same allowance for a completed view.
 */
export const REWARD_THRESHOLD = 0.95;

export interface RewardProgress {
  /** 0–100. */
  percentage: number;
  /** Enough has been watched. */
  earned: boolean;
}

export function rewardProgress(currentTime: number, duration: number): RewardProgress {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(currentTime)) {
    return { percentage: 0, earned: false };
  }

  const ratio = Math.max(0, Math.min(1, currentTime / duration));
  return {
    percentage: ratio * 100,
    earned: ratio >= REWARD_THRESHOLD,
  };
}

/**
 * Seconds still to watch, rounded up.
 *
 * Rounded up so a countdown never shows `0` while the reward is still out of
 * reach — the one number a viewer will hold the player to.
 */
export function remainingSeconds(currentTime: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;

  // A playhead that is not a number would otherwise come back out as one, and
  // `NaNs to go` is what the viewer would read.
  const watched = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
  return Math.max(0, Math.ceil(duration * REWARD_THRESHOLD - watched));
}
