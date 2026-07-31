export type AdPosition = 'pre-roll' | 'mid-roll' | 'post-roll';

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

export interface AdConfig {
  enabled: boolean;
  adBreaks?: AdBreak[];
  skipAllowed?: boolean;
  defaultSkipAfter?: number;
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
