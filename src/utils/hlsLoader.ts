import type Hls from 'hls.js';

/** The `Hls` class itself, as the default export of the module. */
export type HlsConstructor = typeof Hls;

/**
 * hls.js, fetched on demand.
 *
 * It was a static import, which put roughly 150 kB gzipped into the video chunk
 * for every consumer — including everyone who only ever plays progressive MP4
 * and never touches a manifest. For a package whose first line calls itself
 * lightweight, that was the single largest thing in it.
 *
 * The promise is cached at module scope, so several players on one page share
 * one fetch and one parse.
 */
let pending: Promise<HlsConstructor> | null = null;

export function loadHls(): Promise<HlsConstructor> {
  pending ??= import('hls.js').then((module) => module.default);
  return pending;
}

/** Test seam: forget the cached module promise. */
export function resetHlsLoader(): void {
  pending = null;
}

/**
 * Whether it is worth fetching hls.js at all.
 *
 * `Hls.isSupported()` is the authority, but asking it means downloading the
 * library first — which defeats the point on a browser that cannot use it. This
 * checks the precondition hls.js itself checks first: Media Source Extensions.
 * A `true` here is a maybe, confirmed against the real `isSupported()` once the
 * module has landed; a `false` is definite and costs nothing.
 */
export function mayUseHlsJs(): boolean {
  if (typeof window === 'undefined') return false;

  const w = window as unknown as {
    MediaSource?: unknown;
    // ManagedMediaSource is the iOS 17+ spelling; Safari there has MSE under a
    // different name and hls.js knows how to use it.
    ManagedMediaSource?: unknown;
  };
  return typeof w.MediaSource !== 'undefined' || typeof w.ManagedMediaSource !== 'undefined';
}
