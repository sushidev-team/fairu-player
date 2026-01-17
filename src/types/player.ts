export interface Chapter {
  id: string;
  title: string;
  startTime: number;
  endTime?: number;
  image?: string;
}

export interface Track {
  id: string;
  src: string;
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
  duration?: number;
  chapters?: Chapter[];
}

export type RepeatMode = 'none' | 'one' | 'all';

export interface PlayerFeatures {
  chapters?: boolean;
  volumeControl?: boolean;
  playbackSpeed?: boolean;
  skipButtons?: boolean;
  progressBar?: boolean;
  timeDisplay?: boolean;
  playlistView?: boolean;
}

export interface PlayerConfig {
  track?: Track;
  playlist?: Track[];
  features?: PlayerFeatures;
  autoPlayNext?: boolean;
  shuffle?: boolean;
  repeat?: RepeatMode;
  skipForwardSeconds?: number;
  skipBackwardSeconds?: number;
  playbackSpeeds?: number[];
  volume?: number;
  muted?: boolean;
  autoPlay?: boolean;
  /** Custom labels for text localization */
  labels?: import('./labels').PartialLabels;
}

export interface PlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  isBuffering: boolean;
  isEnded: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  playbackRate: number;
  error: Error | null;
}

export interface PlaylistState {
  tracks: Track[];
  currentIndex: number;
  currentTrack: Track | null;
  shuffle: boolean;
  repeat: RepeatMode;
  queue: Track[];
  history: Track[];
}

export interface PlayerControls {
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => Promise<void>;
  stop: () => void;
  seek: (time: number) => void;
  seekTo: (percentage: number) => void;
  skipForward: (seconds?: number) => void;
  skipBackward: (seconds?: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
}

export interface PlaylistControls {
  next: () => void;
  previous: () => void;
  goToTrack: (index: number) => void;
  setRepeat: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
}

export interface PlayerContextValue {
  state: PlayerState;
  playlistState: PlaylistState;
  controls: PlayerControls;
  playlistControls: PlaylistControls;
  config: PlayerConfig;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

export type PlayerTheme = 'light' | 'dark' | 'high-contrast' | 'auto';

export interface PlayerProps {
  config?: PlayerConfig;
  track?: Track;
  playlist?: Track[];
  theme?: PlayerTheme;
  className?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
  onTrackChange?: (track: Track, index: number) => void;
  onError?: (error: Error) => void;
}
