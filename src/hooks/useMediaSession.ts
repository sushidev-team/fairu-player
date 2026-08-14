import { useEffect, useRef } from 'react';
import type {
  MediaSessionArtwork,
  MediaSessionConfig,
  MediaSessionMetadata,
} from '@/types/mediaSession';

/**
 * Publishes playback state to the OS via the Media Session API.
 *
 * This is what puts the episode title, artwork and transport controls on the
 * lock screen, in the notification shade, on the macOS Now Playing widget, on
 * Bluetooth headsets and in CarPlay/Android Auto. Without it the OS shows
 * "unknown media from <hostname>" and the hardware buttons do nothing useful.
 *
 * Everything here is feature-detected. The API is unavailable in non-secure
 * contexts and in some embedded webviews, and individual actions are rejected
 * by browsers that do not implement them — each handler is registered
 * separately so one unsupported action cannot take the rest down with it.
 */
export interface UseMediaSessionOptions extends MediaSessionConfig {
  /** What to show in the OS UI. */
  metadata?: MediaSessionMetadata | null;
  /** Whether media is currently playing, for the OS play/pause indicator. */
  isPlaying?: boolean;
  /** Current position in seconds, for the OS scrubber. */
  position?: number;
  /** Total duration in seconds. */
  duration?: number;
  /** Current playback rate. */
  playbackRate?: number;

  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onNextTrack?: () => void;
  onPreviousTrack?: () => void;
  /** Seek to an absolute time, from the OS scrubber. */
  onSeekTo?: (time: number) => void;
  onSeekForward?: (offset: number) => void;
  onSeekBackward?: (offset: number) => void;
}

type MediaSessionActionName =
  | 'play'
  | 'pause'
  | 'stop'
  | 'nexttrack'
  | 'previoustrack'
  | 'seekto'
  | 'seekforward'
  | 'seekbackward';

interface MediaSessionActionDetails {
  action: MediaSessionActionName;
  seekTime?: number;
  seekOffset?: number;
  fastSeek?: boolean;
}

/** The parts of `navigator.mediaSession` this hook touches. */
interface MediaSessionLike {
  metadata: unknown;
  playbackState: 'none' | 'playing' | 'paused';
  setActionHandler(
    action: MediaSessionActionName,
    handler: ((details: MediaSessionActionDetails) => void) | null
  ): void;
  setPositionState?(state: {
    duration: number;
    playbackRate: number;
    position: number;
  }): void;
}

function getMediaSession(): MediaSessionLike | null {
  if (typeof navigator === 'undefined') return null;
  const session = (navigator as Navigator & { mediaSession?: MediaSessionLike })
    .mediaSession;
  return session ?? null;
}

function getMetadataConstructor(): (new (init: {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: MediaSessionArtwork[];
}) => unknown) | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as Window & { MediaMetadata?: new (init: never) => unknown })
    .MediaMetadata;
  return (ctor as never) ?? null;
}

/** Whether the browser exposes the Media Session API at all. */
export function isMediaSessionSupported(): boolean {
  return getMediaSession() !== null;
}

export function useMediaSession(options: UseMediaSessionOptions = {}): void {
  const {
    enabled = true,
    metadata,
    isPlaying = false,
    position,
    duration,
    playbackRate = 1,
    seekOffset = 10,
    onPlay,
    onPause,
    onStop,
    onNextTrack,
    onPreviousTrack,
    onSeekTo,
    onSeekForward,
    onSeekBackward,
  } = options;

  // Handlers are held in a ref so that a caller passing inline arrow functions
  // — which is every caller — does not re-register the whole action set on
  // every render. Registration is a global side effect on `navigator`, and
  // churning it makes the OS controls flicker on some platforms.
  //
  // The ref is updated in an effect rather than during render: writing to a ref
  // while rendering is unsafe under concurrent rendering, where a render can be
  // thrown away. Effect timing is harmless here because these handlers are only
  // ever invoked asynchronously, by the OS, long after commit.
  const handlersRef = useRef({
    onPlay,
    onPause,
    onStop,
    onNextTrack,
    onPreviousTrack,
    onSeekTo,
    onSeekForward,
    onSeekBackward,
  });

  useEffect(() => {
    handlersRef.current = {
      onPlay,
      onPause,
      onStop,
      onNextTrack,
      onPreviousTrack,
      onSeekTo,
      onSeekForward,
      onSeekBackward,
    };
  }, [
    onPlay,
    onPause,
    onStop,
    onNextTrack,
    onPreviousTrack,
    onSeekTo,
    onSeekForward,
    onSeekBackward,
  ]);

  const seekOffsetRef = useRef(seekOffset);
  useEffect(() => {
    seekOffsetRef.current = seekOffset;
  }, [seekOffset]);

  // Metadata
  useEffect(() => {
    const session = getMediaSession();
    if (!session || !enabled) return;

    if (!metadata) {
      session.metadata = null;
      return;
    }

    const MetadataCtor = getMetadataConstructor();
    if (!MetadataCtor) return;

    try {
      session.metadata = new MetadataCtor({
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        artwork: metadata.artwork,
      });
    } catch {
      // A malformed artwork URL is the usual cause. Not worth failing playback.
    }
  }, [
    enabled,
    metadata,
  ]);

  // Playback state
  useEffect(() => {
    const session = getMediaSession();
    if (!session || !enabled) return;
    session.playbackState = isPlaying ? 'playing' : 'paused';
  }, [enabled, isPlaying]);

  // Action handlers
  useEffect(() => {
    const session = getMediaSession();
    if (!session || !enabled) return;

    const actions: Array<[MediaSessionActionName, (d: MediaSessionActionDetails) => void]> = [
      ['play', () => handlersRef.current.onPlay?.()],
      ['pause', () => handlersRef.current.onPause?.()],
      ['stop', () => handlersRef.current.onStop?.()],
      ['nexttrack', () => handlersRef.current.onNextTrack?.()],
      ['previoustrack', () => handlersRef.current.onPreviousTrack?.()],
      [
        'seekto',
        (details) => {
          if (typeof details.seekTime === 'number') {
            handlersRef.current.onSeekTo?.(details.seekTime);
          }
        },
      ],
      [
        'seekforward',
        (details) =>
          handlersRef.current.onSeekForward?.(details.seekOffset ?? seekOffsetRef.current),
      ],
      [
        'seekbackward',
        (details) =>
          handlersRef.current.onSeekBackward?.(details.seekOffset ?? seekOffsetRef.current),
      ],
    ];

    const registered: MediaSessionActionName[] = [];

    actions.forEach(([action, handler]) => {
      try {
        session.setActionHandler(action, handler);
        registered.push(action);
      } catch {
        // Chrome throws NotSupportedError for actions it does not implement.
        // Registering each one separately keeps that from aborting the rest.
      }
    });

    return () => {
      registered.forEach((action) => {
        try {
          session.setActionHandler(action, null);
        } catch {
          // Teardown is best-effort.
        }
      });
    };
  }, [enabled]);

  // Position state — drives the OS scrubber.
  useEffect(() => {
    const session = getMediaSession();
    if (!session?.setPositionState || !enabled) return;
    if (duration === undefined || position === undefined) return;

    // The spec rejects a non-finite or zero duration, a position past the
    // duration, and a rate of zero. All three occur normally: duration is NaN
    // before metadata loads, and position can overshoot slightly on the last
    // timeupdate before `ended`.
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (!Number.isFinite(position) || position < 0) return;

    try {
      session.setPositionState({
        duration,
        playbackRate: playbackRate > 0 ? playbackRate : 1,
        position: Math.min(position, duration),
      });
    } catch {
      // Ignore — the scrubber is cosmetic.
    }
  }, [enabled, position, duration, playbackRate]);

  // Clear metadata on unmount so a destroyed player stops claiming the OS UI.
  useEffect(() => {
    return () => {
      const session = getMediaSession();
      if (!session) return;
      try {
        session.metadata = null;
        session.playbackState = 'none';
      } catch {
        // Best-effort.
      }
    };
  }, []);
}
