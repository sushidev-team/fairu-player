export type AdPosition = 'pre-roll' | 'mid-roll' | 'post-roll';

export interface AdTrackingUrls {
  // Required VAST events
  impression?: string;
  start?: string;
  firstQuartile?: string;
  midpoint?: string;
  thirdQuartile?: string;
  complete?: string;
  // Optional VAST events
  skip?: string;
  click?: string;
  error?: string;
  pause?: string;
  resume?: string;
  mute?: string;
  unmute?: string;
  // Progress event with custom offset (in seconds)
  progress?: { offset: number; url: string }[];
}

export interface Ad {
  id: string;
  src: string;
  duration: number;
  skipAfterSeconds?: number | null;
  clickThroughUrl?: string;
  title?: string;
  description?: string;
  companion?: {
    imageUrl: string;
    clickUrl: string;
    width: number;
    height: number;
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
