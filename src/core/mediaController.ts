import type { MediaState, MediaControls } from '@/types/media';

/**
 * Playback, as an object that owns a media element.
 *
 * The third and load-bearing slice of the framework-neutral core (Phase 3 in
 * ROADMAP.md). Everything a player does to an `<audio>` or `<video>` lives
 * here: the transport, seeking, volume, and the fifteen media events that keep
 * state honest. No React.
 *
 * "Framework-neutral" is not the same as "DOM-free" — this deliberately holds
 * an HTMLMediaElement, because that is the thing being controlled. What it does
 * not hold is any opinion about how a UI observes it. State changes are
 * published to subscribers; a React binding is `useSyncExternalStore` over
 * that, and a Vue or Angular one is the equivalent three lines.
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

export interface MediaControllerOptions {
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

export interface MediaController {
  /** The current snapshot. Stable by reference until something changes. */
  getState: () => MediaState;
  /** Observe changes. Returns an unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  controls: MediaControls;
  /** Point at a source, loading it. Ignores a repeat of the current one. */
  setSource: (src: string | undefined, autoPlay?: boolean) => void;
  /** Replace the callbacks without rebuilding anything. */
  setCallbacks: (options: MediaControllerOptions) => void;
  /** Detach every listener. The element itself is the caller's to dispose. */
  destroy: () => void;
}

/**
 * Attach a controller to a media element.
 *
 * The element is not created here and not destroyed here: a framework renders
 * it, so a framework owns its lifetime. This only borrows it.
 */
export function createMediaController(
  element: HTMLMediaElement,
  options: MediaControllerOptions = {}
): MediaController {
  let opts = options;

  let state: MediaState = {
    ...initialMediaState,
    volume: opts.volume ?? initialMediaState.volume,
    isMuted: opts.muted ?? initialMediaState.isMuted,
    playbackRate: opts.playbackRate ?? initialMediaState.playbackRate,
  };

  const listeners = new Set<() => void>();

  /**
   * Publish a patch.
   *
   * Bails out when nothing actually differs, so a `timeupdate` that reports the
   * same second — which happens, the event fires faster than the clock moves —
   * does not wake every subscriber for nothing.
   */
  function update(patch: Partial<MediaState>): void {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof MediaState)[]) {
      if (!Object.is(state[key], patch[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;

    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }

  // ── Controls ───────────────────────────────────────────────────────────────

  async function play(): Promise<void> {
    try {
      await element.play();
    } catch (error) {
      // A rejected play is routine, not exceptional: every autoplay policy
      // refusal arrives this way, and an unhandled rejection here would be
      // noise in a console the host page does not own.
      const err = error instanceof Error ? error : new Error('Failed to play');
      update({ error: err });
      opts.onError?.(err);
    }
  }

  function pause(): void {
    element.pause();
  }

  async function toggle(): Promise<void> {
    if (state.isPlaying) {
      pause();
    } else {
      await play();
    }
  }

  function stop(): void {
    element.pause();
    element.currentTime = 0;
  }

  function seek(time: number): void {
    // Clamped against the element's own duration rather than the state copy —
    // seeking is one of the few things that has to be right *now*, and state
    // lags the element by one event.
    element.currentTime = Math.max(0, Math.min(time, element.duration || 0));
  }

  function seekTo(percentage: number): void {
    if (!element.duration) return;
    seek((percentage / 100) * element.duration);
  }

  function skipForward(seconds?: number): void {
    seek(element.currentTime + (seconds ?? opts.skipForwardSeconds ?? 30));
  }

  function skipBackward(seconds?: number): void {
    seek(element.currentTime - (seconds ?? opts.skipBackwardSeconds ?? 10));
  }

  function setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    // State first, so a slider drag reflects immediately even if the element
    // has not yet echoed a `volumechange` back.
    update({ volume: clamped });
    element.volume = clamped;
  }

  function toggleMute(): void {
    element.muted = !element.muted;
    update({ isMuted: element.muted });
  }

  function setPlaybackRate(rate: number): void {
    element.playbackRate = rate;
    update({ playbackRate: rate });
  }

  // ── Element events ─────────────────────────────────────────────────────────

  const handlers: Array<[string, EventListener]> = [
    ['loadstart', () => update({ isLoading: true, error: null })],
    [
      'loadedmetadata',
      () => {
        update({ isLoading: false, duration: element.duration });
        opts.onLoadedMetadata?.(element.duration);
      },
    ],
    ['loadeddata', () => opts.onLoadedData?.()],
    ['canplay', () => update({ isLoading: false, isBuffering: false })],
    ['canplaythrough', () => opts.onCanPlayThrough?.()],
    ['waiting', () => update({ isBuffering: true })],
    [
      // `playing` means frames are actually moving, which is the moment
      // buffering is genuinely over — `play` only means it was asked to.
      'playing',
      () => update({ isPlaying: true, isPaused: false, isBuffering: false, isEnded: false }),
    ],
    [
      'play',
      () => {
        update({ isPlaying: true, isPaused: false, isEnded: false });
        opts.onPlay?.();
      },
    ],
    [
      'pause',
      () => {
        update({ isPlaying: false, isPaused: true });
        opts.onPause?.();
      },
    ],
    [
      'ended',
      () => {
        update({ isPlaying: false, isPaused: true, isEnded: true });
        opts.onEnded?.();
      },
    ],
    [
      'timeupdate',
      () => {
        update({ currentTime: element.currentTime });
        opts.onTimeUpdate?.(element.currentTime);
      },
    ],
    [
      'progress',
      () => {
        if (element.buffered.length > 0) {
          update({ buffered: element.buffered.end(element.buffered.length - 1) });
        }
      },
    ],
    [
      // Hardware keys and OS volume change the element directly, bypassing the
      // controls entirely — without this the UI would drift out of step.
      'volumechange',
      () => update({ volume: element.volume, isMuted: element.muted }),
    ],
    ['ratechange', () => update({ playbackRate: element.playbackRate })],
    [
      'error',
      () => {
        const err = new Error(element.error?.message || 'Media error');
        update({ error: err, isLoading: false });
        opts.onError?.(err);
      },
    ],
  ];

  handlers.forEach(([type, handler]) => element.addEventListener(type, handler));

  // Seed the element from the options it was created with.
  //
  // Read into locals first. Assigning `volume` fires `volumechange`, whose
  // handler writes `isMuted` back from the element — so reading `state.isMuted`
  // on the next line would read a value the assignment above had just
  // clobbered, and a player configured muted would start audible.
  const seedVolume = state.volume;
  const seedMuted = state.isMuted;
  const seedRate = state.playbackRate;

  element.muted = seedMuted;
  element.volume = seedVolume;
  element.playbackRate = seedRate;

  // ── Source ─────────────────────────────────────────────────────────────────

  let appliedSource: string | undefined;

  function setSource(src: string | undefined, autoPlay = false): void {
    if (!src || src === appliedSource) return;

    appliedSource = src;
    element.src = src;
    element.load();

    if (autoPlay) void play();
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    controls: {
      play,
      pause,
      toggle,
      stop,
      seek,
      seekTo,
      skipForward,
      skipBackward,
      setVolume,
      toggleMute,
      setPlaybackRate,
    },
    setSource,
    setCallbacks(next) {
      opts = next;
    },
    destroy() {
      handlers.forEach(([type, handler]) => element.removeEventListener(type, handler));
      listeners.clear();
    },
  };
}
