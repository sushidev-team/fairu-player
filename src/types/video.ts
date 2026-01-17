/**
 * Video-specific types
 */

import type { Track, RepeatMode, PlaylistState, PlaylistControls, PlayerFeatures } from './player';
import type { MediaState, MediaControls } from './media';
import type { AdConfig, AdState } from './ads';

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
