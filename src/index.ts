// Main exports for @fairu/player

// Components
export { Player, type PlayerInnerProps, type PlayerProps } from './components/Player';
export {
  VideoPlayer,
  VideoOverlay,
  VideoControls,
  LogoOverlay,
  GestureOverlay,
  EndScreen,
  RecommendedCard,
  AutoPlayCountdown,
  SubtitleDisplay,
  type VideoPlayerWithProviderProps,
  type VideoPlayerRef,
  type VideoOverlayProps,
  type VideoControlsProps,
  type LogoOverlayProps,
  type GestureOverlayProps,
  type GestureFeedback,
  type GestureFeedbackType,
  type EndScreenProps,
  type RecommendedCardProps,
  type AutoPlayCountdownProps,
  type SubtitleDisplayProps,
  type SubtitleDisplayMode,
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
  PictureInPictureButton,
  CastButton,
  SleepTimer,
  ShareButton,
  SubtitleSettings,
  Equalizer,
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
  type PictureInPictureButtonProps,
  type CastButtonProps,
  type SleepTimerProps,
  type ShareButtonProps,
  type SubtitleSettingsProps,
  type EqualizerProps,
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
  PauseAd,
  RewardedAdOverlay,
  type AdOverlayProps,
  type AdSkipButtonProps,
  type OverlayAdProps,
  type InfoCardProps,
  type InfoCardIconProps,
  type PauseAdComponentProps,
  type RewardedAdOverlayProps,
} from './components/ads';
export {
  Rating,
  Stats,
  StatIcons,
  type RatingProps,
  type StatsProps,
} from './components/stats';
export {
  PlayerErrorBoundary,
  type PlayerErrorBoundaryProps,
} from './components/ErrorBoundary';
export {
  ScreenReaderAnnouncer,
  type ScreenReaderAnnouncerProps,
} from './components/a11y';
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
  FairuProvider,
  type FairuProviderProps,
} from './context/FairuProvider';
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
  useSleepTimer,
  useGestures,
  useResumePosition,
  usePlaylistPersistence,
  usePlaybackHistory,
  useSubtitleStyling,
  useSubtitleParser,
  parseVTTCues,
  useEqualizer,
  useFocusTrap,
  useAutoplayDetection,
  useABLoop,
  useShareableTimestamp,
  usePauseAd,
  useRewardedAd,
  useSyncPlayback,
  formatTimestamp,
  parseTimestamp,
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
  type UseGesturesOptions,
  type UseAutoplayDetectionOptions,
  type AutoplayPolicy,
  type ABLoopState,
  type ABLoopControls,
  type UseABLoopOptions,
  type UseABLoopReturn,
  type UseShareableTimestampOptions,
  type UseShareableTimestampReturn,
  type UseFocusTrapOptions,
  type UseFocusTrapReturn,
  type UseSyncPlaybackOptions,
  type UseSyncPlaybackReturn,
  type UseSubtitleParserOptions,
  type UseSubtitleParserReturn,
  type SubtitleCue,
} from './hooks';

// Equalizer
export {
  DEFAULT_BANDS,
  EQUALIZER_PRESETS,
} from './types/equalizer';
export type {
  EqualizerBand,
  EqualizerPreset,
  UseEqualizerOptions,
  UseEqualizerReturn,
} from './types/equalizer';

// Subtitle styling
export {
  DEFAULT_SUBTITLE_STYLE,
  SUBTITLE_PRESETS,
} from './types/subtitleStyling';
export type {
  SubtitleStyle,
  SubtitleStylePreset,
  UseSubtitleStylingOptions,
  UseSubtitleStylingReturn,
} from './types/subtitleStyling';

// Services
export { TrackingService, AdService, WebSocketSyncTransport } from './services';

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
  // Marker types
  TimelineMarker,
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
  // Sleep timer types
  SleepTimerPreset,
  SleepTimerConfig,
  SleepTimerState,
  SleepTimerControls,
  UseSleepTimerOptions,
  UseSleepTimerReturn,
  DEFAULT_SLEEP_TIMER_PRESETS,
  // Resume types
  ResumeConfig,
  ResumeData,
  UseResumePositionReturn,
  // Playlist persistence types
  PlaylistPersistenceConfig,
  PlaylistPersistenceData,
  UsePlaylistPersistenceReturn,
  // Media types
  MediaState,
  MediaControls as MediaControlsInterface,
  UseMediaOptions,
  UseMediaReturn,
  // A-B loop types
  ABLoopState,
  ABLoopControls,
  UseABLoopOptions,
  UseABLoopReturn,
  // Playback history types
  PlaybackHistoryEntry,
  PlaybackHistoryConfig,
  UsePlaybackHistoryReturn,
  // Sync types
  SyncEventType,
  SyncEvent,
  SyncEventData,
  SyncPeer,
  SyncConnectionState,
  SyncRoomInfo,
  SyncTransport,
  // Pause ad types
  PauseAd as PauseAdType,
  PauseAdState,
  UsePauseAdOptions,
  UsePauseAdReturn,
  // Rewarded ad types
  RewardedAd as RewardedAdType,
  RewardedAdState,
  UseRewardedAdOptions,
  UseRewardedAdReturn,
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
export { parseVTT, findCueAtTime, generateSpriteCues, type ThumbnailConfig, type ThumbnailCue } from './utils/thumbnails';
export { ThumbnailPreview, type ThumbnailPreviewProps } from './components/controls/ProgressBar/ThumbnailPreview';

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
