export interface RewardedAd {
  /** Unique identifier */
  id: string;
  /** Video ad source URL */
  src: string;
  /** Ad duration in seconds */
  duration: number;
  /** Ad title (e.g., "Watch to unlock premium episode") */
  title?: string;
  /** Description of the reward */
  rewardDescription?: string;
  /** Poster image */
  poster?: string;
  /** Click-through URL */
  clickThroughUrl?: string;
  /** Tracking URLs */
  trackingUrls?: {
    impression?: string;
    start?: string;
    complete?: string;
    click?: string;
    quartile25?: string;
    quartile50?: string;
    quartile75?: string;
  };
}

export interface RewardedAdState {
  /** Whether the rewarded ad UI is showing */
  isShowing: boolean;
  /** Whether the ad video is currently playing */
  isPlaying: boolean;
  /** Whether the ad has been completed and reward earned */
  isRewarded: boolean;
  /** Current playback progress in seconds */
  progress: number;
  /** Ad duration */
  duration: number;
  /** Progress percentage 0-100 */
  percentage: number;
  /** The current ad being displayed */
  currentAd: RewardedAd | null;
}

export interface UseRewardedAdOptions {
  /** The rewarded ad configuration */
  ad?: RewardedAd;
  /** Called when the user earns the reward (ad completed) */
  onReward?: (ad: RewardedAd) => void;
  /** Called when the ad starts playing */
  onStart?: (ad: RewardedAd) => void;
  /** Called when the user closes without completing */
  onClose?: (ad: RewardedAd, completed: boolean) => void;
  /** Called on error */
  onError?: (error: Error, ad: RewardedAd) => void;
}

export interface UseRewardedAdReturn {
  state: RewardedAdState;
  /** Show the rewarded ad prompt */
  show: () => void;
  /** Close/dismiss the rewarded ad */
  close: () => void;
  /** Whether an ad is available */
  isAvailable: boolean;
}
