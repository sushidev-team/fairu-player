export type AdPosition = 'pre-roll' | 'mid-roll' | 'post-roll';

/**
 * Why an ad break was suppressed by the player's load rules.
 *
 * The reels feed adds `'no-inventory'` to this union for a slot that exists in
 * the feed but has no ad source behind it.
 */
export type AdCapReason = 'session-cap' | 'pacing';

/**
 * Ad load rules, shared by the audio player, the video player and the reels
 * feed. See {@link import('@/utils/adCaps').checkAdCaps} for the evaluation.
 *
 * Capping is what separates a monetised player from one people close. The rules
 * are evaluated at *play* time rather than at planning time, so pacing follows
 * what the listener actually did rather than where a break sits in a list.
 */
export interface AdCapRules {
  /** Hard cap on ads per session. Default `Infinity`. */
  maxAdsPerSession?: number;
  /** Minimum wall-clock seconds between two ad breaks. Default `0`. */
  minSecondsBetweenAds?: number;
  /**
   * Cap on the combined duration of one break, in seconds.
   *
   * A pod is trimmed to the last ad that still fits rather than dropped: the
   * first spot in a pod is the one that was actually sold, and the tail is
   * usually make-good inventory.
   */
  maxAdDurationPerBreak?: number;
}

/** Runtime accounting used to decide whether a break may play. */
export interface AdSessionState {
  /** Ads already played this session. */
  adsShown: number;
  /** `Date.now()` of the last ad start, or `0` when none has played. */
  lastAdStartedAt: number;
}

/**
 * One or more tracking URLs for a single event.
 *
 * A plain string is the common hand-authored case. The array form exists
 * because a real VAST response almost always has several pixels per event: a
 * wrapper chain appends the SSP's impression to the DSP's, and dropping either
 * one is a billing error rather than a cosmetic loss.
 */
export type AdTrackingUrl = string | string[];

export interface AdTrackingUrls {
  // Required VAST events
  impression?: AdTrackingUrl;
  start?: AdTrackingUrl;
  firstQuartile?: AdTrackingUrl;
  midpoint?: AdTrackingUrl;
  thirdQuartile?: AdTrackingUrl;
  complete?: AdTrackingUrl;
  // Optional VAST events
  skip?: AdTrackingUrl;
  click?: AdTrackingUrl;
  error?: AdTrackingUrl;
  pause?: AdTrackingUrl;
  resume?: AdTrackingUrl;
  mute?: AdTrackingUrl;
  unmute?: AdTrackingUrl;
  creativeView?: AdTrackingUrl;
  // Progress event with custom offset (in seconds)
  progress?: { offset: number; url: string }[];
}

/** Normalise a single-or-many tracking value into a list. */
export function toUrlList(value: AdTrackingUrl | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

export interface Ad {
  id: string;
  src: string;
  duration: number;
  skipAfterSeconds?: number | null;
  clickThroughUrl?: string;
  title?: string;
  description?: string;
  /**
   * `<Companion>` creative — a static image shown alongside the ad.
   *
   * For a podcast this is the most valuable part of the unit: it replaces the
   * episode artwork for the duration of the spot and stays visible on the lock
   * screen, where a linear audio ad has already finished.
   */
  companion?: {
    imageUrl: string;
    clickUrl: string;
    width: number;
    height: number;
    /** Fired in addition to navigating to `clickUrl`. */
    clickTrackingUrls?: string[];
    /** `creativeView` fires when the companion becomes visible. */
    trackingEvents?: import('./vast').VastTrackingEvents;
  };
  trackingUrls?: AdTrackingUrls;
  /**
   * `<Icons>` — the AdChoices / privacy badge.
   *
   * Not decoration: EU rules require advertising to be identifiable, and most
   * networks require the badge contractually. A creative that declares one and
   * does not get it rendered is a breach on the publisher's side.
   */
  icons?: import('./vast').VastIcon[];
}

export interface AdBreak {
  id: string;
  position: AdPosition;
  triggerTime?: number;
  ads: Ad[];
  played?: boolean;
}

export interface AdState {
  isPlayingAd: boolean;
  currentAd: Ad | null;
  currentAdBreak: AdBreak | null;
  adProgress: number;
  adDuration: number;
  canSkip: boolean;
  skipCountdown: number;
  adsRemaining: number;
}

export interface AdControls {
  skipAd: () => void;
  clickThrough: () => void;
  startAdBreak: (adBreak: AdBreak) => void;
  stopAds: () => void;
}

export interface AdProgressInfo {
  currentTime: number;
  duration: number;
  percentage: number;
  remainingTime: number;
}

export interface AdConfig extends AdCapRules {
  /* Load rules are inherited from AdCapRules. */
  enabled: boolean;
  adBreaks?: AdBreak[];
  skipAllowed?: boolean;
  defaultSkipAfter?: number;
  /**
   * Called instead of `onAdStart` when load rules suppressed a break.
   *
   * Worth logging: a session that is silently capped looks identical to one
   * where the ad server had no inventory, and the two need very different fixes.
   */
  onAdCapped?: (adBreak: AdBreak, reason: AdCapReason) => void;
  // Lifecycle callbacks
  onAdStart?: (ad: Ad, adBreak: AdBreak) => void;
  onAdComplete?: (ad: Ad, adBreak: AdBreak) => void;
  onAdSkip?: (ad: Ad, adBreak: AdBreak) => void;
  onAdClick?: (ad: Ad, adBreak: AdBreak) => void;
  onAdError?: (error: Error, ad: Ad, adBreak: AdBreak) => void;
  onAllAdsComplete?: (adBreak: AdBreak) => void;
  // Playback callbacks
  onAdPause?: (ad: Ad, adBreak: AdBreak) => void;
  onAdResume?: (ad: Ad, adBreak: AdBreak) => void;
  // Progress callback - fires on every time update
  onAdProgress?: (progress: AdProgressInfo, ad: Ad, adBreak: AdBreak) => void;
  // Quartile callbacks
  onFirstQuartile?: (ad: Ad, adBreak: AdBreak) => void;
  onMidpoint?: (ad: Ad, adBreak: AdBreak) => void;
  onThirdQuartile?: (ad: Ad, adBreak: AdBreak) => void;
}

export interface AdContextValue {
  state: AdState;
  controls: AdControls;
  config: AdConfig;
}
