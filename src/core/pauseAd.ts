/**
 * Pause ads — the banner shown while playback is stopped.
 *
 * Ported from PR #16. The rule is small but easy to get wrong in ways a viewer
 * notices: showing on the pause that happens before playback ever starts, or
 * on the momentary pause a seek produces, both read as the player misbehaving.
 */

export interface PauseAdTracking {
  impression?: string;
  click?: string;
  close?: string;
}

export interface PauseAd {
  id: string;
  imageUrl: string;
  clickThroughUrl?: string;
  altText?: string;
  title?: string;
  description?: string;
  /**
   * Seconds of pause before the banner appears. Default `0`.
   *
   * A short delay is what separates "the viewer stopped to read something" from
   * "the viewer nudged the scrub bar".
   */
  minPauseDuration?: number;
  trackingUrls?: PauseAdTracking;
}

export interface PauseAdConditions {
  /** Playback is stopped. */
  isPaused: boolean;
  /** Playback has begun at least once in this session. */
  hasPlayed: boolean;
  /** How long it has been stopped, in seconds. */
  pausedFor: number;
  enabled: boolean;
}

/**
 * Whether the banner belongs on screen.
 *
 * `hasPlayed` is the guard that matters most: a player sits paused before
 * anyone presses anything, and an advert over a poster nobody has asked to
 * watch yet is the version everybody complains about.
 */
export function shouldShow(ad: PauseAd | undefined, conditions: PauseAdConditions): boolean {
  if (!ad || !conditions.enabled) return false;
  if (!conditions.isPaused || !conditions.hasPlayed) return false;

  return conditions.pausedFor >= (ad.minPauseDuration ?? 0);
}
