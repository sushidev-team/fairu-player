import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { MediaState, UseMediaOptions, UseMediaReturn } from '@/types/media';
import {
  createMediaController,
  initialMediaState,
  type MediaController,
} from '@/core/mediaController';

/**
 * React binding over the media controller.
 *
 * Everything that touches the element — transport, seeking, volume, the fifteen
 * media events — lives in `@/core/mediaController`. What is left here is React's
 * share: notice the element, subscribe to the controller, hand back its state.
 *
 * `useSyncExternalStore` is the point rather than a detail. The controller is
 * exactly what it is for: state that lives outside React and changes without
 * asking. Reading it any other way means mirroring the same values into
 * `useState` and keeping two copies honest — which is what this hook used to
 * do, in about 350 lines.
 */
export function useMedia<T extends HTMLMediaElement>(
  options: UseMediaOptions = {}
): UseMediaReturn<T> {
  const { src, autoPlay = false } = options;

  const mediaRef = useRef<T | null>(null);
  /** Which element the current controller is bound to. */
  const attachedRef = useRef<T | null>(null);

  // The controller lives in state, not a ref.
  //
  // Render reads it — for the controls, and through `getSnapshot` — and reading
  // a ref during render is unsafe under concurrent rendering, where a render
  // can be discarded. State is also what makes the re-render happen when a
  // controller appears; a ref change is invisible to React. The ref below is
  // only for the lifecycle bookkeeping the effect needs.
  const [controller, setController] = useState<MediaController | null>(null);
  const controllerRef = useRef<MediaController | null>(null);

  // The controller reads its callbacks through this, so passing inline arrow
  // functions — which every caller does — never rebuilds it.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
    controllerRef.current?.setCallbacks(options);
  });

  /**
   * Attach to whatever element is currently in the ref.
   *
   * No dependency array on purpose. An ancestor swapping subtrees replaces the
   * element, and a ref change is invisible to React — a dependency-gated effect
   * would never notice, leaving a controller bound to a detached node and a
   * player showing a permanent spinner with no error anywhere. The guard makes
   * every other run a no-op, so running each render costs nothing.
   */
  useEffect(() => {
    const element = mediaRef.current;

    // Compared against the element the controller is bound to, not merely
    // against whether one exists. An ancestor swapping subtrees hands over a
    // *different* element under a living hook — checking only for presence
    // would leave the controller on the detached node, and the replacement
    // would sit there with an empty `src` behind a permanent spinner.
    if (element === attachedRef.current) return;

    controllerRef.current?.destroy();

    const next = element ? createMediaController(element, optionsRef.current) : null;
    controllerRef.current = next;
    attachedRef.current = element;
    setController(next);
  });

  // Teardown belongs to unmount alone; the effect above deliberately runs on
  // every render and must not tear down what it just built.
  useEffect(
    () => () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
      attachedRef.current = null;
    },
    []
  );

  const subscribe = useCallback(
    (listener: () => void) => controller?.subscribe(listener) ?? (() => {}),
    [controller]
  );

  const getSnapshot = useCallback(
    (): MediaState => controller?.getState() ?? seededInitialState(options),
    [controller, options]
  );

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Source changes go through the controller, which ignores a repeat of what is
  // already loaded.
  useEffect(() => {
    controllerRef.current?.setSource(src, autoPlay);
  });

  return { mediaRef, state, controls: controller?.controls ?? inertControls };
}

/**
 * What to report before an element exists.
 *
 * Seeded from the options so a volume slider renders at the configured level on
 * the first frame rather than jumping once the element attaches. Memoised by
 * value, because `useSyncExternalStore` compares snapshots by identity and a
 * fresh object every call is an infinite loop.
 */
const seededCache = new WeakMap<UseMediaOptions, MediaState>();

function seededInitialState(options: UseMediaOptions): MediaState {
  const cached = seededCache.get(options);
  if (cached) return cached;

  const seeded: MediaState = {
    ...initialMediaState,
    volume: options.volume ?? initialMediaState.volume,
    isMuted: options.muted ?? initialMediaState.isMuted,
    playbackRate: options.playbackRate ?? initialMediaState.playbackRate,
  };
  seededCache.set(options, seeded);
  return seeded;
}

/** Controls before an element exists: every call a no-op, none of them a crash. */
const inertControls: UseMediaReturn<HTMLMediaElement>['controls'] = {
  play: async () => {},
  pause: () => {},
  toggle: async () => {},
  stop: () => {},
  seek: () => {},
  seekTo: () => {},
  skipForward: () => {},
  skipBackward: () => {},
  setVolume: () => {},
  toggleMute: () => {},
  setPlaybackRate: () => {},
};
