import { useMedia } from './useMedia';
import type { PlayerState, PlayerControls } from '@/types/player';

export interface UseAudioOptions {
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
}

export interface UseAudioReturn {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  state: PlayerState;
  controls: PlayerControls;
}

/**
 * Hook for managing audio playback
 * Thin wrapper around useMedia for audio-specific use
 */
export function useAudio(options: UseAudioOptions = {}): UseAudioReturn {
  const { mediaRef, state, controls } = useMedia<HTMLAudioElement>(options);

  return {
    audioRef: mediaRef,
    state,
    controls,
  };
}
