import { useEffect, useMemo, useState } from 'react';
import { activeCueAt, parseVtt, type SubtitleCue } from '@/core/subtitles';

const EMPTY: SubtitleCue[] = [];

export interface UseSubtitleParserOptions {
  /** A WebVTT file. Nothing loads without one. */
  src?: string;
  /** The playhead. */
  currentTime: number;
  /** Default `true`. */
  enabled?: boolean;
}

export interface UseSubtitleParserReturn {
  /** The cue on screen right now, or `null`. */
  activeCue: SubtitleCue | null;
  /** Its text, for callers that want nothing else. */
  activeText: string | null;
  cues: SubtitleCue[];
  isLoaded: boolean;
  error: Error | null;
}

/**
 * Captions parsed here rather than by the browser.
 *
 * The player normally hands a `<track>` to the platform and lets it draw the
 * cues. This is for when that is not enough — placing captions above the
 * controls bar instead of behind them, or styling past what `::cue` reaches.
 *
 * The parsing lives in `@/core/subtitles`; what is here is the fetch.
 */
export function useSubtitleParser(
  options: UseSubtitleParserOptions
): UseSubtitleParserReturn {
  const { src, currentTime, enabled = true } = options;

  /**
   * Keyed by the file it came from.
   *
   * A bare array would leave the previous track's captions on screen while the
   * next file is in flight, and clearing it on the way in would mean a
   * `setState` in the effect body for what is really a stale read.
   */
  const [loaded, setLoaded] = useState<{
    src: string;
    cues: SubtitleCue[];
    error: Error | null;
  } | null>(null);

  const wanted = enabled ? src : undefined;

  useEffect(() => {
    if (!wanted) return;

    const controller = new AbortController();

    fetch(wanted, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Subtitle file ${response.status} ${response.statusText}`);
        }
        return response.text();
      })
      .then((text) => setLoaded({ src: wanted, cues: parseVtt(text), error: null }))
      .catch((cause: unknown) => {
        // The abort on unmount arrives here too, and is not a failure.
        if (controller.signal.aborted) return;
        setLoaded({
          src: wanted,
          cues: EMPTY,
          error: cause instanceof Error ? cause : new Error(String(cause)),
        });
      });

    return () => controller.abort();
  }, [wanted]);

  const current = wanted && loaded?.src === wanted ? loaded : null;
  const cues = current?.cues ?? EMPTY;

  const activeCue = useMemo(() => activeCueAt(cues, currentTime), [cues, currentTime]);

  return useMemo(
    () => ({
      activeCue,
      activeText: activeCue?.text ?? null,
      cues,
      isLoaded: current !== null && current.error === null,
      error: current?.error ?? null,
    }),
    [activeCue, cues, current]
  );
}

/** Re-exported so a caller needs one import for the common case. */
export { parseVtt, activeCueAt };
export type { SubtitleCue };
