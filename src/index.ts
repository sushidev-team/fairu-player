// Main exports for @fairu/player

// Components
export { Player, type PlayerInnerProps, type PlayerProps } from './components/Player';
export {
  VideoPlayer,
  VideoOverlay,
  VideoControls,
  LogoOverlay,
  type VideoPlayerWithProviderProps,
  type VideoOverlayProps,
  type VideoControlsProps,
  type LogoOverlayProps,
} from './components/VideoPlayer';
export {
  PlayButton,
  ProgressBar,
  TimeDisplay,
  VolumeControl,
  PlaybackSpeed,
  SkipButton,
  SkipButtons,
  FullscreenButton,
  QualitySelector,
  SubtitleSelector,
  type PlayButtonProps,
  type ProgressBarProps,
  type TimeDisplayProps,
  type VolumeControlProps,
  type PlaybackSpeedProps,
  type SkipButtonProps,
  type SkipButtonsProps,
  type FullscreenButtonProps,
  type QualitySelectorProps,
  type SubtitleSelectorProps,
} from './components/controls';
export {
  ChapterMarker,
  ChapterList,
  type ChapterMarkerProps,
  type ChapterListProps,
} from './components/chapters';
export {
  PlaylistView,
  TrackItem,
  PlaylistControls,
  type PlaylistViewProps,
  type TrackItemProps,
  type PlaylistControlsProps,
} from './components/playlist';
export {
  AdOverlay,
  AdSkipButton,
  type AdOverlayProps,
  type AdSkipButtonProps,
} from './components/ads';
export {
  Rating,
  Stats,
  StatIcons,
  type RatingProps,
  type StatsProps,
} from './components/stats';
export {
  PodcastPage,
  PodcastPageContent,
  PodcastHeader,
  EpisodeList,
  EpisodeItem,
  StickyPlayer,
  formatEpisodeDate,
  formatEpisodeNumber,
  type Podcast,
  type Episode,
  type PodcastPageProps,
  type PodcastHeaderProps,
  type EpisodeListProps,
  type EpisodeItemProps,
  type StickyPlayerProps,
  type PodcastRatingConfig,
  type EpisodeSortOrder,
} from './components/podcast';

// Context providers
export {
  PlayerContext,
  PlayerProvider,
  type PlayerProviderProps,
} from './context/PlayerContext';
export {
  TrackingContext,
  TrackingProvider,
  useTracking,
  type TrackingProviderProps,
} from './context/TrackingContext';
export {
  AdContext,
  AdProvider,
  useAds,
  type AdProviderProps,
} from './context/AdContext';
export {
  VideoContext,
  VideoProvider,
  useVideoPlayer,
  type VideoProviderProps,
} from './context/VideoContext';
export {
  VideoAdContext,
  VideoAdProvider,
  useVideoAds,
  type VideoAdProviderProps,
  type VideoAdContextValue,
} from './context/VideoAdContext';
export {
  LabelsContext,
  LabelsProvider,
  useLabels,
  type LabelsProviderProps,
} from './context/LabelsContext';

// Hooks
export {
  useAudio,
  useMedia,
  useVideo,
  useFullscreen,
  usePlayer,
  usePlaylist,
  useChapters,
  useKeyboardControls,
  type UseAudioOptions,
  type UseAudioReturn,
  type UseVideoOptions,
  type UseVideoReturn,
  type UseFullscreenOptions,
  type UseFullscreenReturn,
  type UsePlaylistOptions,
  type UsePlaylistReturn,
  type UseKeyboardControlsOptions,
} from './hooks';

// Services
export { TrackingService, AdService } from './services';

// Types
export type {
  // Player types
  Chapter,
  Track,
  RepeatMode,
  PlayerFeatures,
  PlayerConfig,
  PlayerState,
  PlaylistState,
  PlayerControls,
  PlaylistControls as PlaylistControlsType,
  PlayerContextValue,
  PlayerTheme,
  // Tracking types
  TrackingEventType,
  TrackingEventData,
  TrackingEvent,
  TrackingEventsConfig,
  TrackingConfig,
  TrackingContextValue,
  // Ad types
  AdPosition,
  AdTrackingUrls,
  Ad,
  AdBreak,
  AdState,
  AdControls,
  AdConfig,
  AdContextValue,
  // Chapter types
  ChapterState,
  ChapterControls as ChapterControlsInterface,
  UseChaptersOptions,
  UseChaptersReturn,
  // Labels types
  PlayerLabels,
  PartialLabels,
  // Stats types
  RatingValue,
  RatingState,
  RatingCallbacks,
  RatingConfig,
  StatItem,
  StatsConfig,
  RatingAndStatsProps,
  initialRatingState,
  createStatItem,
  formatStatNumber,
  formatStatDate,
} from './types';

// Labels utilities
export { defaultLabels, interpolateLabel } from './types/labels';

// Video types
export type {
  VideoTrack,
  VideoQuality,
  VideoFeatures,
  VideoState,
  VideoControls as VideoControlsInterface,
  VideoConfig,
  VideoContextValue,
  VideoAd,
  VideoAdBreak,
  VideoAdConfig,
  VideoPlayerProps,
  WatchProgress,
  WatchedSegment,
  Subtitle,
  HLSConfig,
  CustomAdComponentProps,
} from './types/video';

// Logo types
export type {
  LogoPosition,
  LogoAnimationType,
  LogoAnimation,
  LogoConfig,
  LogoComponentProps,
} from './types/logo';

// Utilities
export { formatTime, formatDuration, parseTime, calculatePercentage, cn } from './utils';

// Fairu.app hosting utilities
export {
  // Constants
  FAIRU_FILES_BASE_URL,
  FAIRU_DEFAULT_COVER_WIDTH,
  FAIRU_DEFAULT_COVER_HEIGHT,
  // URL generators
  getFairuAudioUrl,
  getFairuVideoUrl,
  getFairuHlsUrl,
  getFairuCoverUrl,
  getFairuThumbnailUrl,
  // Track converters
  createTrackFromFairu,
  createVideoTrackFromFairu,
  createPlaylistFromFairu,
  createVideoPlaylistFromFairu,
  // Types
  type FairuUrlOptions,
  type FairuCoverOptions,
  type FairuVideoOptions,
  type FairuTrack,
  type FairuVideoTrack,
} from './utils/fairu';

// Embed (for advanced usage)
export {
  FairuPlayer,
  EmbedPlayer,
  parseDataAttributes,
  parseUrlParams,
  type EmbedConfig,
  type EmbedPlayerProps,
} from './embed';
