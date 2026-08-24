import { useEffect, useMemo, useState } from 'react';
import {
  cuesFromConfig,
  findCueAtTime,
  parseThumbnailVtt,
  type ThumbnailConfig,
  type ThumbnailCue,
} from '@/core/thumbnails';

/** One shared empty list, so "nothing loaded" keeps a stable identity. */
const EMPTY: ThumbnailCue[] = [];

export interface UseThumbnailsReturn {
  cues: ThumbnailCue[];
  /** The thumbnail covering a time, or `null`. */
  cueAt: (time: number) => ThumbnailCue | null;
  /** There is something to show. */
  ready: boolean;
}

/**
 * Load the thumbnails a scrub preview draws from.
 *
 * A VTT file takes priority; failing that, a sprite sheet described by its
 * geometry. The parsing lives in `@/core/thumbnails` — what is here is the
 * fetch and its cancellation.
 *
 * A failed load is not an error worth surfacing: previews are a nicety, and a
 * player that refuses to scrub because a thumbnail sheet 404'd is worse than
 * one that scrubs without pictures.
 */
export function useThumbnails(config?: ThumbnailConfig): UseThumbnailsReturn {
  /**
   * Keyed by the URL it came from.
   *
   * Holding a bare array would leave the previous track's frames on screen
   * while the next manifest is still in flight — and clearing it on the way in
   * would mean a `setState` in the effect body for something that is really
   * just a stale read.
   */
  const [loaded, setLoaded] = useState<{ url: string; cues: ThumbnailCue[] } | null>(null);

  const vttUrl = config?.vttUrl;

  useEffect(() => {
    if (!vttUrl) return;

    const controller = new AbortController();

    fetch(vttUrl, { signal: controller.signal })
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error('not ok'))))
      // The cue URLs are relative to the manifest, so it has to be the base.
      .then((text) => setLoaded({ url: vttUrl, cues: parseThumbnailVtt(text, vttUrl) }))
      .catch(() => {
        // Including the abort on unmount, which is not a failure at all.
      });

    return () => controller.abort();
  }, [vttUrl]);

  const spriteCues = useMemo(
    () => (config && !config.vttUrl ? cuesFromConfig(config) : []),
    [config]
  );

  const cues = useMemo(
    () => (vttUrl ? (loaded?.url === vttUrl ? loaded.cues : EMPTY) : spriteCues),
    [vttUrl, loaded, spriteCues]
  );

  return useMemo(
    () => ({
      cues,
      cueAt: (time: number) => findCueAtTime(cues, time),
      ready: cues.length > 0,
    }),
    [cues]
  );
}
