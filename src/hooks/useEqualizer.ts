import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readStored, writeStored } from '@/utils/storage';
import {
  DEFAULT_BANDS,
  EQUALIZER_PRESETS,
  bandsForPreset,
  matchPreset,
  normalizeStored,
  setBandGain as setGain,
  toStored,
  type EqualizerBand,
  type EqualizerPreset,
} from '@/core/equalizer';

const DEFAULT_KEY = 'equalizer';

export interface UseEqualizerOptions {
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  /**
   * Where the switch starts, not what it is.
   *
   * Named `default…` because it seeds state and nothing more: changing it later
   * does nothing, and `setEnabled` is how the equaliser is turned on and off. A
   * prop called `enabled` that ignores its own updates is a trap.
   *
   * Default `false`. Routing audio through Web Audio is not free — see below.
   */
  defaultEnabled?: boolean;
  /** Preset to start from when nothing was stored. Default `'flat'`. */
  initialPreset?: string;
  persist?: boolean;
  storageKey?: string;
}

export interface UseEqualizerReturn {
  bands: EqualizerBand[];
  setBandGain: (index: number, gain: number) => void;
  applyPreset: (name: string) => void;
  reset: () => void;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  /** The filter chain is live and audio is flowing through it. */
  isConnected: boolean;
  presets: readonly EqualizerPreset[];
  /** Which preset the current bands are, matched by value. */
  currentPreset: string | null;
  /**
   * The element is cross-origin and does not carry `crossorigin`.
   *
   * Routing such an element through Web Audio yields **silence** — the browser
   * refuses to expose samples it cannot prove the page may read. Surfaced so a
   * host can hide the control rather than let a listener mute themselves.
   */
  blockedByCors: boolean;
}

/* -------------------------------------------------------------------------- */

interface Routing {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  filters: BiquadFilterNode[];
}

/**
 * One routing per element, for the lifetime of that element.
 *
 * `createMediaElementSource` may be called **once** per element; a second call
 * throws `InvalidStateError`. The version this was ported from kept the source
 * in a ref, so remounting the component called it again — the throw was caught,
 * `isConnected` went false, and the equaliser was quietly dead for the rest of
 * the session.
 */
const routings = new WeakMap<HTMLMediaElement, Routing>();

function getRouting(element: HTMLMediaElement): Routing | null {
  const existing = routings.get(element);
  if (existing) return existing;

  const Ctor =
    typeof window !== 'undefined'
      ? (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext)
      : undefined;
  if (!Ctor) return null;

  try {
    const context = new Ctor();
    const source = context.createMediaElementSource(element);
    // Straight through until the equaliser is switched on.
    source.connect(context.destination);

    const routing: Routing = { context, source, filters: [] };
    routings.set(element, routing);
    return routing;
  } catch {
    return null;
  }
}

/** Whether Web Audio would silence this element rather than filter it. */
function isCorsBlocked(element: HTMLMediaElement | null): boolean {
  if (!element || typeof window === 'undefined') return false;

  const src = element.currentSrc || element.src;
  if (!src || src.startsWith('blob:') || src.startsWith('data:')) return false;

  try {
    return new URL(src, window.location.href).origin !== window.location.origin
      && !element.crossOrigin;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */

/**
 * A five-band equaliser over the element's audio.
 *
 * The bands and presets live in `@/core/equalizer`; this owns the Web Audio
 * graph, which has three properties worth knowing before switching it on:
 *
 * - **It is one-way.** Once an element is routed through Web Audio it stays
 *   routed. Disabling bypasses the filters; it cannot give the element back.
 * - **The context is never closed while an element is routed into it.** Closing
 *   it silences that element for good, with no way back short of a reload.
 * - **Cross-origin media needs `crossorigin`.** Without it the browser hands
 *   Web Audio silence — see `blockedByCors`.
 */
export function useEqualizer(options: UseEqualizerOptions): UseEqualizerReturn {
  const {
    mediaRef,
    defaultEnabled = false,
    initialPreset = 'flat',
    persist = true,
    storageKey = DEFAULT_KEY,
  } = options;

  const [{ bands, enabled }, setState] = useState(() => {
    const stored = persist ? readStored(storageKey) : null;
    if (stored) return normalizeStored(stored);
    return { bands: bandsForPreset(initialPreset), enabled: defaultEnabled };
  });

  const [isConnected, setIsConnected] = useState(false);
  const [blockedByCors, setBlockedByCors] = useState(false);

  const persistRef = useRef({ persist, storageKey });
  useEffect(() => {
    persistRef.current = { persist, storageKey };
  });

  /* ----------------------------- The graph ----------------------------- */

  useEffect(() => {
    const element = mediaRef.current;
    if (!element) return;

    setBlockedByCors(isCorsBlocked(element));

    if (!enabled) {
      // Bypass rather than tear down: the element cannot be un-routed, so the
      // best "off" available is a straight wire.
      const routing = routings.get(element);
      if (routing) {
        routing.source.disconnect();
        routing.source.connect(routing.context.destination);
        routing.filters = [];
      }
      setIsConnected(false);
      return;
    }

    const routing = getRouting(element);
    if (!routing) {
      setIsConnected(false);
      return;
    }

    const { context, source } = routing;

    const filters = DEFAULT_BANDS.map((band, index) => {
      const filter = context.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.Q.value = band.Q;
      filter.gain.value = bands[index]?.gain ?? 0;
      return filter;
    });

    source.disconnect();
    source.connect(filters[0]);
    filters.forEach((filter, index) => {
      const next = filters[index + 1];
      filter.connect(next ?? context.destination);
    });
    routing.filters = filters;

    // A context created outside a gesture starts suspended, and a suspended
    // context is silence.
    void context.resume?.().catch(() => {});
    setIsConnected(true);
    // `bands` is deliberately absent: a gain change updates the live filters
    // below. Rebuilding the chain for it would be audible as a click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, mediaRef]);

  // Gain changes reach the running filters directly.
  useEffect(() => {
    const element = mediaRef.current;
    const routing = element ? routings.get(element) : undefined;
    if (!routing) return;

    routing.filters.forEach((filter, index) => {
      const gain = bands[index]?.gain ?? 0;
      if (filter.gain.value !== gain) filter.gain.value = gain;
    });
  }, [bands, mediaRef]);

  /*
    No cleanup that closes the context, and none that disconnects the source.

    Closing it silences the element permanently, and disconnecting without
    reconnecting does the same for as long as the element lives. The routing
    outlives this hook on purpose; it belongs to the element.
  */

  /* ----------------------------- Controls ------------------------------ */

  const setBandGain = useCallback((index: number, gain: number) => {
    setState((current) => ({
      bands: setGain(current.bands, index, gain),
      enabled: current.enabled,
    }));
  }, []);

  // Persisting is a side effect, so it happens after the state settles rather
  // than inside the updater — React may run one of those more than once.
  useEffect(() => {
    const { persist: on, storageKey: key } = persistRef.current;
    if (on) writeStored(key, toStored(bands, enabled));
  }, [bands, enabled]);

  const applyPreset = useCallback((name: string) => {
    setState((current) => ({ bands: bandsForPreset(name), enabled: current.enabled }));
  }, []);

  const reset = useCallback(() => applyPreset('flat'), [applyPreset]);

  const setEnabled = useCallback((value: boolean) => {
    setState((current) => ({ ...current, enabled: value }));
  }, []);

  const currentPreset = useMemo(() => matchPreset(bands), [bands]);

  return useMemo(
    () => ({
      bands,
      setBandGain,
      applyPreset,
      reset,
      enabled,
      setEnabled,
      isConnected,
      presets: EQUALIZER_PRESETS,
      currentPreset,
      blockedByCors,
    }),
    [
      bands,
      setBandGain,
      applyPreset,
      reset,
      enabled,
      setEnabled,
      isConnected,
      currentPreset,
      blockedByCors,
    ]
  );
}
