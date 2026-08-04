import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * MRC viewability measurement for an ad element.
 *
 * VAST's `<ViewableImpression>` has three outcomes, and firing `Viewable`
 * unconditionally — which is what a player does when it has no measurement —
 * is not a shortcut but a false claim: the pixel is the player asserting that a
 * human could actually see the ad. This hook makes the assertion true, or fires
 * `NotViewable` / `ViewUndetermined` instead.
 *
 * The MRC video standard is **50 % of the ad's pixels for 2 continuous
 * seconds**. Three things stop the clock, and all three matter in practice:
 *
 * - scrolling the player out of view (`IntersectionObserver`)
 * - backgrounding the tab, where an `IntersectionObserver` still reports the
 *   element as intersecting even though nothing is on screen
 * - pausing the ad — a paused frame is not viewing time
 *
 * Time accumulates rather than resets, matching the MRC definition of
 * contiguous in-view time across brief interruptions of the *measurement*, not
 * of the viewing.
 */

/** Outcome of the measurement, mapping onto VAST's three pixels. */
export type AdViewabilityState = 'pending' | 'viewable' | 'notViewable' | 'undetermined';

/** MRC video: 50 % of pixels. */
const MRC_THRESHOLD = 0.5;
/** MRC video: 2 continuous seconds. */
const MRC_DURATION_MS = 2000;

export interface UseAdViewabilityOptions {
  /**
   * Whether the ad is currently playing. A paused ad accrues no viewing time
   * even while it is fully on screen.
   */
  playing: boolean;
  /** Fraction of the element's pixels that must be visible. Default `0.5`. */
  threshold?: number;
  /** Contiguous milliseconds at or above the threshold. Default `2000`. */
  durationMs?: number;
  /**
   * Called exactly once, when the outcome is known. Wire it straight to
   * {@link import('@/utils/vast').VastTracker.viewable}.
   */
  onResolve?: (state: Exclude<AdViewabilityState, 'pending'>) => void;
  /** Skip measurement entirely. Resolves to `undetermined`. */
  enabled?: boolean;
}

export interface UseAdViewabilityReturn {
  /** Current outcome. `pending` until the criteria are met or `finalize` runs. */
  state: AdViewabilityState;
  /** Whether the element is at or above the threshold right now. */
  inView: boolean;
  /**
   * Settle the measurement. Call when the ad ends, is skipped, or unmounts:
   * an ad that finished without ever being seen owes a `NotViewable` pixel, and
   * without this call it would owe nothing at all.
   */
  finalize: () => void;
}

/**
 * ```tsx
 * const { finalize } = useAdViewability(adVideoRef, {
 *   playing: isPlayingAd,
 *   onResolve: (state) => tracker.viewable(state),
 * });
 * ```
 */
export function useAdViewability(
  ref: React.RefObject<Element | null>,
  options: UseAdViewabilityOptions
): UseAdViewabilityReturn {
  const {
    playing,
    threshold = MRC_THRESHOLD,
    durationMs = MRC_DURATION_MS,
    onResolve,
    enabled = true,
  } = options;

  const [state, setState] = useState<AdViewabilityState>('pending');
  const [inView, setInView] = useState(false);

  const onResolveRef = useRef(onResolve);
  onResolveRef.current = onResolve;

  /** Milliseconds of qualifying viewing time already banked. */
  const accumulatedRef = useRef(0);
  /** When the current qualifying stretch began, or `null` between stretches. */
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvedRef = useRef(false);

  const inViewRef = useRef(false);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const resolve = useCallback((next: Exclude<AdViewabilityState, 'pending'>) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;

    setState(next);
    onResolveRef.current?.(next);
  }, []);

  /**
   * Start or stop the clock to match current conditions.
   *
   * Called from the observer, the visibility listener and the play/pause
   * effect, so it must be safe to run when nothing actually changed.
   */
  const evaluate = useCallback(() => {
    if (resolvedRef.current) return;

    const documentVisible =
      typeof document === 'undefined' || document.visibilityState !== 'hidden';
    const qualifying = inViewRef.current && playingRef.current && documentVisible;

    if (qualifying && startedAtRef.current === null) {
      startedAtRef.current = Date.now();
      const remaining = Math.max(0, durationMs - accumulatedRef.current);
      timerRef.current = setTimeout(() => resolve('viewable'), remaining);
      return;
    }

    if (!qualifying && startedAtRef.current !== null) {
      accumulatedRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [durationMs, resolve]);

  // Observe the element.
  useEffect(() => {
    if (!enabled) {
      resolve('undetermined');
      return;
    }

    const element = ref.current;
    if (!element) return;

    if (typeof IntersectionObserver === 'undefined') {
      // Claiming viewability without being able to measure it is exactly the
      // failure this hook exists to prevent.
      resolve('undetermined');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        inViewRef.current = entry.intersectionRatio >= threshold;
        setInView(inViewRef.current);
        evaluate();
      },
      // A second threshold at 0 keeps the callback firing when the element
      // leaves entirely, which is when the clock has to stop.
      { threshold: [0, threshold] }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, threshold, enabled, evaluate, resolve]);

  // A backgrounded tab shows nothing, however well the element intersects.
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const onVisibilityChange = () => evaluate();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [enabled, evaluate]);

  // Play and pause start and stop the clock.
  useEffect(() => {
    evaluate();
  }, [playing, evaluate]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const finalize = useCallback(() => {
    if (resolvedRef.current) return;
    resolve(enabled ? 'notViewable' : 'undetermined');
  }, [enabled, resolve]);

  return { state, inView, finalize };
}

export default useAdViewability;
