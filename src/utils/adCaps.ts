/**
 * Ad load rules shared by the audio player, the video player and the reels feed.
 *
 * Capping is what separates a monetised player from one people close. The rules
 * are deliberately evaluated at *play* time rather than at planning time: pacing
 * should follow what the listener actually did, not where a break happens to sit
 * in a list. A capped break is therefore skipped, never queued — deferring an ad
 * to "later" stacks two spots back to back, which is worse than dropping one.
 */

import type { AdCapReason, AdCapRules, AdSessionState } from '@/types/ads';

export type { AdCapReason, AdCapRules, AdSessionState };

/** A fresh session counter. */
export function createAdSession(): AdSessionState {
  return { adsShown: 0, lastAdStartedAt: 0 };
}

/**
 * Decide whether a break may play right now.
 *
 * @returns `null` when it may play, or the reason it may not
 */
export function checkAdCaps(
  rules: AdCapRules | undefined,
  session: AdSessionState,
  now: number
): AdCapReason | null {
  if (!rules) return null;

  const max = rules.maxAdsPerSession ?? Infinity;
  if (session.adsShown >= max) return 'session-cap';

  const minGap = rules.minSecondsBetweenAds ?? 0;
  if (minGap > 0 && session.lastAdStartedAt > 0) {
    const elapsed = (now - session.lastAdStartedAt) / 1000;
    if (elapsed < minGap) return 'pacing';
  }

  return null;
}

/**
 * Trim an ad pod to `maxSeconds` of combined duration.
 *
 * Ads are kept in order and the first one is always kept, even when it alone
 * exceeds the cap — a break that plays nothing is a break the ad server was
 * never told about, and the impression is owed either way.
 */
export function capPodDuration<T extends { duration: number }>(
  ads: T[],
  maxSeconds: number | undefined
): T[] {
  if (!maxSeconds || maxSeconds <= 0 || ads.length === 0) return ads;

  const kept: T[] = [];
  let total = 0;

  for (const ad of ads) {
    const next = total + (ad.duration || 0);
    if (kept.length > 0 && next > maxSeconds) break;
    kept.push(ad);
    total = next;
  }

  return kept;
}

/** Record that an ad started, for pacing and session counting. */
export function recordAdStarted(session: AdSessionState, now: number): AdSessionState {
  return { adsShown: session.adsShown + 1, lastAdStartedAt: now };
}
