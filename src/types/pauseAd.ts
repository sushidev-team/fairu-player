export interface PauseAd {
  /** Unique identifier */
  id: string;
  /** Image URL for the ad */
  imageUrl: string;
  /** Click-through URL (optional) */
  clickThroughUrl?: string;
  /** Alt text for accessibility */
  altText?: string;
  /** Title text overlaid on the image (optional) */
  title?: string;
  /** Description text (optional) */
  description?: string;
  /** Minimum pause duration in seconds before showing the ad. Default: 0 (immediate) */
  minPauseDuration?: number;
  /** Tracking URLs */
  trackingUrls?: {
    impression?: string;
    click?: string;
    close?: string;
  };
}

export interface PauseAdState {
  /** Whether a pause ad is currently visible */
  isVisible: boolean;
  /** The currently displayed pause ad */
  currentAd: PauseAd | null;
  /** How long the video has been paused (seconds) */
  pauseDuration: number;
}

export interface UsePauseAdOptions {
  /** The pause ad to display */
  ad?: PauseAd;
  /** Whether the video is currently paused */
  isPaused: boolean;
  /** Whether the video is playing (needed to distinguish initial state from paused) */
  isPlaying: boolean;
  /** Whether pause ads are enabled. Default: true */
  enabled?: boolean;
  /** Callback when the ad is shown */
  onShow?: (ad: PauseAd) => void;
  /** Callback when the ad is hidden (user resumed) */
  onHide?: (ad: PauseAd) => void;
  /** Callback when the ad is clicked */
  onClick?: (ad: PauseAd) => void;
}

export interface UsePauseAdReturn {
  state: PauseAdState;
  /** Dismiss the ad manually */
  dismiss: () => void;
}
