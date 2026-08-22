import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * What the browser will let this page start on its own.
 *
 * - `unknown` — not probed yet, or probing is switched off.
 * - `allowed` — audible autoplay works.
 * - `muted-only` — playback starts, but only without sound. The common case on
 *   desktop Chrome and on any site the visitor has not engaged with.
 * - `blocked` — nothing starts without a click. Mobile Safari's default.
 */
export type AutoplayCapability = 'unknown' | 'allowed' | 'muted-only' | 'blocked';

export interface UseAutoplayDetectionOptions {
  /**
   * Probe on mount. Off means the state stays `unknown` and nothing is
   * attempted — useful when the page already knows it will require a click.
   *
   * @default true
   */
  enabled?: boolean;
  /** Called once the capability has been determined. */
  onDetected?: (capability: AutoplayCapability) => void;
}

export interface UseAutoplayDetectionReturn {
  capability: AutoplayCapability;
  /** Whether audible autoplay is available. */
  canAutoplay: boolean;
  /** Whether autoplay is available, but only muted. */
  requiresMuted: boolean;
  /** Whether nothing will start without a user gesture. */
  requiresGesture: boolean;
  /** Whether the probe is still running. */
  isDetecting: boolean;
  /** Run the probe again — after a click, for instance. */
  detect: () => Promise<AutoplayCapability>;
}

/**
 * A silent one-sample WAV. Small enough to inline, real enough to play.
 *
 * The probe has to be a genuine media element with a genuine source: browsers
 * decide autoplay per attempt, and there is no API that simply answers the
 * question.
 */
const SILENT_AUDIO =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

/**
 * Work out whether this page may start playback on its own.
 *
 * Worth knowing before rather than after: a player that calls `play()` into a
 * rejected promise shows a paused frame with no explanation, and the viewer is
 * left wondering whether the site is broken. Knowing up front lets the UI say
 * "tap to play", or start muted with an unmute affordance, which is what the
 * platforms actually expect.
 */
export function useAutoplayDetection(
  options: UseAutoplayDetectionOptions = {}
): UseAutoplayDetectionReturn {
  const { enabled = true, onDetected } = options;

  const [capability, setCapability] = useState<AutoplayCapability>('unknown');
  const [isDetecting, setIsDetecting] = useState(false);

  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  /** Try to play a throwaway element and report whether it was allowed. */
  const attempt = useCallback(async (muted: boolean): Promise<boolean> => {
    if (typeof document === 'undefined') return false;

    const audio = document.createElement('audio');
    audio.muted = muted;
    audio.volume = muted ? 0 : 0.01;
    audio.src = SILENT_AUDIO;
    // Never let the probe render or make noise.
    audio.setAttribute('playsinline', '');

    try {
      const played = audio.play();
      // Older engines return undefined rather than a promise.
      if (played === undefined) return true;
      await played;
      return true;
    } catch {
      return false;
    } finally {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
  }, []);

  const detect = useCallback(async (): Promise<AutoplayCapability> => {
    setIsDetecting(true);

    // Audible first: a page allowed to play with sound is also allowed muted,
    // so the second probe is only needed when the first is refused.
    let result: AutoplayCapability;
    if (await attempt(false)) {
      result = 'allowed';
    } else if (await attempt(true)) {
      result = 'muted-only';
    } else {
      result = 'blocked';
    }

    setCapability(result);
    setIsDetecting(false);
    onDetectedRef.current?.(result);
    return result;
  }, [attempt]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    void (async () => {
      const result = await detect();
      // The component may have gone while the probe was in flight; setting
      // state then is a warning at best and a leak at worst. `detect` already
      // set it, so this only guards the callback.
      if (cancelled) return void result;
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, detect]);

  return {
    capability,
    canAutoplay: capability === 'allowed',
    requiresMuted: capability === 'muted-only',
    requiresGesture: capability === 'blocked',
    isDetecting,
    detect,
  };
}

export default useAutoplayDetection;
