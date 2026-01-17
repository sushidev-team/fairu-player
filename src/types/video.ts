/**
 * Video-specific types
 */

import type { Track, RepeatMode, PlaylistState, PlaylistControls, PlayerFeatures } from './player';
import type { MediaState, MediaControls } from './media';
import type { AdConfig, AdState } from './ads';
import type { PartialLabels } from './labels';
import type { LogoConfig } from './logo';

/**
 * Video quality option
 */
export interface VideoQuality {
  label: string;
  src: string;
  bitrate?: number;
  width?: number;
  height?: number;
}

/**
 * Subtitle/caption track
 */
export interface Subtitle {
  id: string;
  label: string;
  language: string;
  src: string;
  default?: boolean;
}

/**
 * Video track extending base Track
 */
export interface VideoTrack extends Track {
  type?: 'video';
  poster?: string;
  qualities?: VideoQuality[];
  subtitles?: Subtitle[];
}

/**
 * Video-specific features
 */
export interface VideoFeatures extends PlayerFeatures {
  fullscreen?: boolean;
  qualitySelector?: boolean;
  subtitles?: boolean;
  pictureInPicture?: boolean;
  autoHideControls?: boolean;
  /** Disable seeking/scrubbing on the progress bar */
  seekingDisabled?: boolean;
  /** Enable logo overlay (default: true when logo config is provided) */
  logoOverlay?: boolean;
}

/**
 * Watched segment for tracking playback progress
 */
export interface WatchedSegment {
  start: number;
  end: number;
}

/**
 * Watch progress tracking state
 */
export interface WatchProgress {
  /** Segments that have been watched */
  watchedSegments: WatchedSegment[];
  /** Total percentage watched (0-100) */
  percentageWatched: number;
  /** Whether the video has been fully watched (all segments covered) */
  isFullyWatched: boolean;
  /** Furthest point reached in the video */
  furthestPoint: number;
}

/**
 * Video-specific state extending MediaState
 */
export interface VideoState extends MediaState {
  isFullscreen: boolean;
  currentQuality: string;
  availableQualities: VideoQuality[];
  aspectRatio: number;
  posterLoaded: boolean;
  currentSubtitle: string | null;
  controlsVisible: boolean;
  /** Watch progress tracking */
  watchProgress: WatchProgress;
  /** Whether the current source is an HLS stream */
  isHLS: boolean;
  /** Whether auto quality selection is enabled (HLS only) */
  isAutoQuality: boolean;
}

/**
 * Video-specific controls extending MediaControls
 */
export interface VideoControls extends MediaControls {
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  setQuality: (quality: string) => void;
  setSubtitle: (subtitleId: string | null) => void;
  showControls: () => void;
  hideControls: () => void;
  /** Enable/disable auto quality selection (HLS only) */
  setAutoQuality: (auto: boolean) => void;
}

/**
 * HLS configuration options
 */
export interface HLSConfig {
  /** Enable HLS support (default: true) */
  enabled?: boolean;
  /** Allow hls.js to auto-select quality based on bandwidth (default: true) */
  autoQuality?: boolean;
  /** Starting quality level (-1 for auto, 0 for lowest, etc.) */
  startLevel?: number;
  /** Maximum buffer length in seconds */
  maxBufferLength?: number;
  /** Enable low latency mode for live streams */
  lowLatencyMode?: boolean;
}

/**
 * Video player configuration
 */
export interface VideoConfig {
  track?: VideoTrack;
  playlist?: VideoTrack[];
  features?: VideoFeatures;
  autoPlayNext?: boolean;
  shuffle?: boolean;
  repeat?: RepeatMode;
  skipForwardSeconds?: number;
  skipBackwardSeconds?: number;
  playbackSpeeds?: number[];
  volume?: number;
  muted?: boolean;
  autoPlay?: boolean;
  poster?: string;
  controlsHideDelay?: number;
  /** HLS streaming configuration */
  hls?: HLSConfig;
  /** Custom labels for text localization */
  labels?: PartialLabels;
  /** Logo/watermark configuration */
  logo?: LogoConfig;
  /** Overlay ads (banner ads during playback) */
  overlayAds?: OverlayAd[];
  /** Info cards (sponsored cards during playback) */
  infoCards?: InfoCard[];
  /** End screen with recommended videos */
  endScreen?: EndScreenConfig;
}

/**
 * Video context value
 */
export interface VideoContextValue {
  state: VideoState;
  playlistState: PlaylistState;
  controls: VideoControls;
  playlistControls: PlaylistControls;
  config: VideoConfig;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  currentTrack: VideoTrack | null;
}

/**
 * Props passed to custom ad components
 */
export interface CustomAdComponentProps {
  /** Call when the ad is complete (auto-advances to next ad) */
  onComplete: () => void;
  /** Call to skip the ad (if allowed) */
  onSkip: () => void;
  /** Whether the ad can be skipped */
  canSkip: boolean;
  /** Seconds until skip is available (0 if already skippable) */
  skipCountdown: number;
  /** Ad duration in seconds */
  duration: number;
  /** Current progress in seconds */
  progress: number;
  /** The ad data */
  ad: VideoAd;
}

/**
 * Video ad type - standard or bumper (6s non-skippable)
 */
export type VideoAdType = 'standard' | 'bumper';

/**
 * Video ad extending base Ad
 */
export interface VideoAd {
  id: string;
  /** Video source URL (required unless using component) */
  src: string;
  duration: number;
  skipAfterSeconds?: number | null;
  clickThroughUrl?: string;
  title?: string;
  description?: string;
  poster?: string;
  trackingUrls?: import('./ads').AdTrackingUrls;
  /** Custom React component to render instead of video */
  component?: React.ComponentType<CustomAdComponentProps>;
  /** Ad type - 'bumper' for 6s non-skippable ads (default: 'standard') */
  type?: VideoAdType;
}

/**
 * Overlay ad (banner ad displayed during playback)
 */
export interface OverlayAd {
  id: string;
  /** Banner image URL */
  imageUrl: string;
  /** Click destination URL */
  clickThroughUrl?: string;
  /** When to display (seconds from start) */
  displayAt: number;
  /** How long to display in seconds (default: 10) */
  duration?: number;
  /** Banner position (default: 'bottom') */
  position?: 'bottom' | 'top';
  /** Allow user to close (default: true) */
  closeable?: boolean;
  /** Alt text for the banner image */
  altText?: string;
  /** Tracking URLs */
  trackingUrls?: {
    impression?: string;
    click?: string;
    close?: string;
  };
}

/**
 * Info card type
 */
export type InfoCardType = 'video' | 'product' | 'link' | 'custom';

/**
 * Info card (sponsored/clickable card that appears during video)
 */
export interface InfoCard {
  id: string;
  /** Card type */
  type: InfoCardType;
  /** Card title */
  title: string;
  /** Card description */
  description?: string;
  /** Thumbnail image URL */
  thumbnail?: string;
  /** Click-through URL */
  url?: string;
  /** When to display (seconds from start) */
  displayAt: number;
  /** How long to display in seconds (default: until dismissed or video ends) */
  duration?: number;
  /** Position on screen (default: 'top-right') */
  position?: 'top-right' | 'top-left';
  /** For product cards - price display */
  price?: string;
  /** For video cards - video ID for internal navigation */
  videoId?: string;
  /** Custom callback when card is selected */
  onSelect?: (card: InfoCard) => void;
  /** Tracking URLs */
  trackingUrls?: {
    impression?: string;
    click?: string;
    dismiss?: string;
  };
}

/**
 * Recommended video for end screen
 */
export interface RecommendedVideo {
  id: string;
  /** Video title */
  title: string;
  /** Thumbnail image URL */
  thumbnail: string;
  /** Video duration in seconds */
  duration?: number;
  /** Video source (if playable in same player) */
  src?: string;
  /** External link URL */
  url?: string;
  /** View count display (e.g., "1.2M views") */
  views?: string;
  /** Channel/author name */
  channel?: string;
  /** Channel avatar URL */
  channelAvatar?: string;
}

/**
 * End screen layout type
 */
export type EndScreenLayout = 'grid' | 'carousel';

/**
 * End screen configuration
 */
export interface EndScreenConfig {
  /** Whether end screen is enabled */
  enabled: boolean;
  /** Seconds before video end to show (default: 10, 0 = only after video ends) */
  showAt?: number;
  /** Recommended videos to display */
  recommendations: RecommendedVideo[];
  /** Layout style (default: 'grid') */
  layout?: EndScreenLayout;
  /** Number of columns in grid layout (default: 3) */
  columns?: 2 | 3 | 4;
  /** Callback when a video is selected */
  onVideoSelect?: (video: RecommendedVideo) => void;
  /** Enable auto-play of next video */
  autoPlayNext?: boolean;
  /** Seconds before auto-play starts (default: 5) */
  autoPlayDelay?: number;
  /** Title for the end screen (default: "Recommended Videos") */
  title?: string;
  /** Show replay button (default: true) */
  showReplay?: boolean;
}

/**
 * Video ad break
 */
export interface VideoAdBreak {
  id: string;
  position: import('./ads').AdPosition;
  triggerTime?: number;
  ads: VideoAd[];
  played?: boolean;
}

/**
 * Video ad state
 */
export interface VideoAdState extends AdState {
  isVideoAd: true;
}

/**
 * Video ad configuration
 */
export interface VideoAdConfig extends Omit<AdConfig, 'adBreaks'> {
  adBreaks?: VideoAdBreak[];
  /** Callback when a bumper ad starts */
  onBumperStart?: (ad: VideoAd) => void;
  /** Callback when a bumper ad completes */
  onBumperComplete?: (ad: VideoAd) => void;
}

/**
 * Video player props
 */
export interface VideoPlayerProps {
  config?: VideoConfig;
  track?: VideoTrack;
  playlist?: VideoTrack[];
  className?: string;
  showChapters?: boolean;
  showPlaylist?: boolean;
  /** Called when playback starts (first play) */
  onStart?: () => void;
  /** Called each time playback resumes */
  onPlay?: () => void;
  /** Called when playback pauses */
  onPause?: () => void;
  /** Called when video reaches the end */
  onEnded?: () => void;
  /** Called when video has been fully watched (all segments covered) */
  onFinished?: () => void;
  /** Called on time update with current time */
  onTimeUpdate?: (time: number) => void;
  /** Called when watch progress updates */
  onWatchProgressUpdate?: (progress: WatchProgress) => void;
  onTrackChange?: (track: VideoTrack, index: number) => void;
  onError?: (error: Error) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

/**
 * Initial watch progress
 */
export const initialWatchProgress: WatchProgress = {
  watchedSegments: [],
  percentageWatched: 0,
  isFullyWatched: false,
  furthestPoint: 0,
};

/**
 * Initial video state
 */
export const initialVideoState: VideoState = {
  isPlaying: false,
  isPaused: true,
  isLoading: true,
  isBuffering: false,
  isEnded: false,
  isMuted: false,
  currentTime: 0,
  duration: 0,
  buffered: 0,
  volume: 1,
  playbackRate: 1,
  error: null,
  isFullscreen: false,
  currentQuality: 'auto',
  availableQualities: [],
  aspectRatio: 16 / 9,
  posterLoaded: false,
  currentSubtitle: null,
  controlsVisible: true,
  watchProgress: initialWatchProgress,
  isHLS: false,
  isAutoQuality: true,
};
