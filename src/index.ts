// Main exports for @fairu/player

// Components
export { Player, type PlayerInnerProps, type PlayerProps } from './components/Player';
export { AudioPlayer, type AudioPlayerProps } from './components/AudioPlayer';
export {
  VideoPlayer,
  VideoOverlay,
  VideoControls,
  LogoOverlay,
  EndScreen,
  RecommendedCard,
  AutoPlayCountdown,
  type VideoPlayerWithProviderProps,
  type VideoPlayerRef,
  type VideoOverlayProps,
  type VideoControlsProps,
  type LogoOverlayProps,
  type EndScreenProps,
  type RecommendedCardProps,
  type AutoPlayCountdownProps,
} from './components/VideoPlayer';
export {
  PlayButton,
  ProgressBar,
  TimelineTracks,
  TimeDisplay,
  VolumeControl,
  PlaybackSpeed,
  SkipButton,
  SkipButtons,
  FullscreenButton,
  QualitySelector,
  SubtitleSelector,
  PictureInPictureButton,
  CastButton,
  type PlayButtonProps,
  type ProgressBarProps,
  type TimelineTracksProps,
  type TimeDisplayProps,
  type VolumeControlProps,
  type PlaybackSpeedProps,
  type SkipButtonProps,
  type SkipButtonsProps,
  type FullscreenButtonProps,
  type QualitySelectorProps,
  type SubtitleSelectorProps,
  type PictureInPictureButtonProps,
  type CastButtonProps,
} from './components/controls';
export {
  ChapterMarker,
  ChapterList,
  type ChapterMarkerProps,
  type ChapterListProps,
} from './components/chapters';
export {
  MarkerList,
  type MarkerListProps,
} from './components/markers';
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
  OverlayAd,
  InfoCard,
  InfoCardIcon,
  CompanionAd,
  type AdOverlayProps,
  type AdSkipButtonProps,
  type OverlayAdProps,
  type InfoCardProps,
  type InfoCardIconProps,
  type CompanionAdProps,
} from './components/ads';
export {
  Rating,
  Stats,
  StatIcons,
  type RatingProps,
  type StatsProps,
} from './components/stats';
export {
  ReelsPlayer,
  ReelItem,
  ReelAdSlide,
  ReelInfo,
  ReelActionRail,
  ReelProgress,
  type ReelItemProps,
  type ReelAdSlideProps,
  type ReelInfoProps,
  type ReelActionRailProps,
  type ReelProgressProps,
} from './components/Reels';
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
  ThemeContext,
  ThemeProvider,
  useTheme,
  type ThemeProviderProps,
  type ThemeContextValue,
} from './context/ThemeContext';
export {
  LabelsContext,
  LabelsProvider,
  useLabels,
  type LabelsProviderProps,
} from './context/LabelsContext';
export {
  OverlayAdContext,
  OverlayAdProvider,
  useOverlayAds,
  useOverlayAdControls,
  type OverlayAdProviderProps,
  type OverlayAdContextValue,
  type OverlayAdState,
  type OverlayAdControls,
} from './context/OverlayAdContext';

// Hooks
export {
  useAudio,
  useMedia,
  useVideo,
  useFullscreen,
  usePictureInPicture,
  useCast,
  useTabVisibility,
  usePlayer,
  usePlaylist,
  useChapters,
  useMarkers,
  useKeyboardControls,
  type UseAudioOptions,
  type UseAudioReturn,
  type UseVideoOptions,
  type UseVideoReturn,
  type UseFullscreenOptions,
  type UseFullscreenReturn,
  type UsePictureInPictureOptions,
  type UsePictureInPictureReturn,
  type UseCastOptions,
  type UseCastReturn,
  type UseTabVisibilityOptions,
  type UseTabVisibilityReturn,
  type UsePlaylistOptions,
  type UsePlaylistReturn,
  type UseKeyboardControlsOptions,
} from './hooks';

// VAST ad breaks for the classic VideoPlayer
export {
  useVastAdBreaks,
  type UseVastAdBreaksOptions,
  type UseVastAdBreaksReturn,
  type MidRollTag,
} from './hooks/useVastAdBreaks';

// Reels feed hook
export { useReelsFeed, type UseReelsFeedOptions, type UseReelsFeedReturn } from './hooks/useReelsFeed';

// Reels types
export type {
  Reel,
  ReelAuthor,
  ReelStats,
  ReelAudioTrack,
  ReelAd,
  ReelAdSource,
  ReelAdSlot,
  ReelAdSlotState,
  ReelAdSlotStatus,
  ReelsAdConfig,
  ReelContentSlide,
  ReelAdSlideEntry,
  ReelSlide,
  ReelsFeatures,
  ReelsLayout,
  ReelsConfig,
  ReelInteraction,
  ReelsState,
  ReelsControls,
  ReelsCallbacks,
  ReelsPlayerProps,
} from './types/reels';
export { createReelInteraction } from './types/reels';

// Reels ad scheduling
export {
  buildSlides,
  interleaveSlides,
  planFrequencySlots,
  planVmapSlots,
  checkAdCaps,
  slotHasSource,
  adTagUrls,
  type AdCapReason,
  type AdSessionState,
} from './utils/reelsAdScheduler';

// VAST / VMAP
export {
  VastClient,
  VastTracker,
  requestWaterfall,
  parseVast,
  parseVmap,
  parseXml,
  parseDuration,
  parseOffset,
  parseTimeOffset,
  offsetToContentCount,
  isLinearBreak,
  applyWrapperToAds,
  getLinearCreative,
  mergeTrackingEvents,
  selectMediaFile,
  isPlayableMediaFile,
  verticalFeedMediaOptions,
  audioAdMediaOptions,
  vastAdToReelAd,
  vastAdsToReelAds,
  vastAdToVideoAd,
  vastAdsToVideoAds,
  videoAdToTrackable,
  toVideoAdBreak,
  landscapePlayerMediaOptions,
  adToTrackable,
  vastAdToAudioAd,
  vastAdsToAudioAds,
  toAudioAdBreak,
  getCompanions,
  selectCompanion,
  substituteMacros,
  substituteMacrosAll,
  defaultMacroContext,
  formatPlayhead,
  cacheBuster,
  sendBeacon,
  type VastRequestResult,
  type VastTrackerOptions,
  type VastMacroContext,
  type ToReelAdOptions,
  type ToVideoAdOptions,
  type ToAudioAdOptions,
} from './utils/vast';

export { VastError, VastErrorCode } from './types/vast';
export { toUrlList } from './types/ads';
export type {
  VastAd,
  VastAdVerification,
  VastCreative,
  VastLinearCreative,
  VastNonLinearCreative,
  VastMediaFile,
  VastIcon,
  VastVideoClicks,
  VastResponse,
  VastWrapper,
  VastTrackingEvent,
  VastTrackingEvents,
  VastProgressTracking,
  VastClientOptions,
  VastErrorCodeValue,
  MediaFileSelectionOptions,
  TrackableAd,
  VmapAdBreak,
  VmapAdSource,
  VmapResponse,
  VmapTimeOffset,
  VmapOffsetKind,
} from './types/vast';

// Security helpers for untrusted embed/ad input
export { sanitizeUrl, sanitizeEndpoint, safeJsonParse } from './utils/security';

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
  AdTrackingUrl,
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
  // Marker types
  TimelineMarker,
  TimelineAction,
  TimelineTrack,
  TimelineActionRenderContext,
  MarkerState,
  MarkerControls as MarkerControlsInterface,
  UseMarkersOptions,
  UseMarkersReturn,
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

// Theming — every option maps to a `--fp-*` custom property, so the stylesheet
// stays the default and a config only overrides what it names.
export { themeToCssVars, mergeThemes, isEmptyTheme } from './utils/theme';
export type {
  FairuTheme,
  ThemePreset,
  ThemeColors,
  ThemeProgress,
  ThemeBorder,
  ThemeGlass,
  ThemeShadows,
  ThemeSpacing,
  ThemeTypography,
  ThemeTransitions,
} from './types/theme';

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
  // Tab visibility
  TabVisibilityConfig,
  // New ad/feature types
  VideoAdType,
  OverlayAd as OverlayAdType,
  InfoCard as InfoCardType,
  InfoCardType as InfoCardTypeEnum,
  RecommendedVideo,
  EndScreenConfig,
  EndScreenLayout,
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

// Ad Event Bus (for external ad control)
export {
  createAdEventBus,
  getGlobalAdEventBus,
  resetGlobalAdEventBus,
  type AdEventBus,
  type AdEventType,
  type AdEventPayloads,
  type AdEventListener,
} from './utils/AdEventBus';

// Player Event Bus (for PiP and tab visibility events)
export {
  createPlayerEventBus,
  getGlobalPlayerEventBus,
  resetGlobalPlayerEventBus,
  type PlayerEventBus,
  type PlayerEventType,
  type PlayerEventPayloads,
  type PlayerEventListener,
} from './utils/PlayerEventBus';

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
  // Marker helpers
  secondsToFairuTimestamp,
  createFairuMarkers,
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
