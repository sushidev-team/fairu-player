/**
 * Shared media types for audio and video players
 */

export type MediaType = 'audio' | 'video';

/**
 * Base media state - shared between audio and video
 */
export interface MediaState {
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

/**
 * Base media controls - shared between audio and video
 */
export interface MediaControls {
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

/**
 * Options for useMedia hook
 */
export interface UseMediaOptions {
  src?: string;
  autoPlay?: boolean;
  volume?: number;
  muted?: boolean;
  playbackRate?: number;
  skipForwardSeconds?: number;
  skipBackwardSeconds?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
  onError?: (error: Error) => void;
  onLoadedMetadata?: (duration: number) => void;
  onLoadedData?: () => void;
  onCanPlayThrough?: () => void;
}

/**
 * Return type for useMedia hook
 */
export interface UseMediaReturn<T extends HTMLMediaElement> {
  mediaRef: React.RefObject<T | null>;
  state: MediaState;
  controls: MediaControls;
}

/**
 * Initial media state
 */
export const initialMediaState: MediaState = {
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
};
