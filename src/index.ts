// Main exports for @fairu/player

// Components
export { Player, type PlayerInnerProps, type PlayerProps } from './components/Player';
export {
  PlayButton,
  ProgressBar,
  TimeDisplay,
  VolumeControl,
  PlaybackSpeed,
  SkipButton,
  SkipButtons,
  type PlayButtonProps,
  type ProgressBarProps,
  type TimeDisplayProps,
  type VolumeControlProps,
  type PlaybackSpeedProps,
  type SkipButtonProps,
  type SkipButtonsProps,
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

// Hooks
export {
  useAudio,
  usePlayer,
  usePlaylist,
  useChapters,
  useKeyboardControls,
  type UseAudioOptions,
  type UseAudioReturn,
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
} from './types';

// Utilities
export { formatTime, formatDuration, parseTime, calculatePercentage, cn } from './utils';

// Embed (for advanced usage)
export {
  FairuPlayer,
  EmbedPlayer,
  parseDataAttributes,
  parseUrlParams,
  type EmbedConfig,
  type EmbedPlayerProps,
} from './embed';
