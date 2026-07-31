/**
 * `<MediaFile>` selection.
 *
 * VAST responses routinely carry a dozen renditions. The player has to pick one
 * it can actually play, at a sensible resolution for the viewport, without
 * over-fetching on a phone.
 */

import type { MediaFileSelectionOptions, VastMediaFile } from '@/types/vast';

/** MIME types a browser `<video>` element can play, in preference order. */
const DEFAULT_SUPPORTED_TYPES = [
  'video/mp4',
  'application/x-mpegurl',
  'application/vnd.apple.mpegurl',
  'video/webm',
  'video/ogg',
];

const HLS_TYPES = new Set(['application/x-mpegurl', 'application/vnd.apple.mpegurl']);

/**
 * Creative frameworks the player cannot execute. VPAID is an executable ad
 * framework (deprecated in VAST 4.1) and OMID verification files are not media —
 * both must never be handed to a `<video>` element.
 */
const UNPLAYABLE_FRAMEWORKS = new Set(['vpaid', 'omid']);

/** Guess a MIME type from the file extension when the ad server omits `type`. */
function inferType(url: string): string | undefined {
  const path = url.split('?')[0].split('#')[0].toLowerCase();
  if (path.endsWith('.mp4') || path.endsWith('.m4v')) return 'video/mp4';
  if (path.endsWith('.m3u8')) return 'application/x-mpegurl';
  if (path.endsWith('.webm')) return 'video/webm';
  if (path.endsWith('.ogv') || path.endsWith('.ogg')) return 'video/ogg';
  return undefined;
}

/**
 * Whether a media file is playable at all.
 *
 * Rejects executable frameworks, non-video MIME types and entries without a URL.
 */
export function isPlayableMediaFile(
  file: VastMediaFile,
  options: MediaFileSelectionOptions = {}
): boolean {
  if (!file.url) return false;

  const framework = file.apiFramework?.toLowerCase();
  if (framework && UNPLAYABLE_FRAMEWORKS.has(framework)) return false;

  const type = (file.type ?? inferType(file.url))?.toLowerCase();
  if (!type) return false;

  if (HLS_TYPES.has(type) && options.allowHls === false) return false;

  const supported = (options.supportedTypes ?? DEFAULT_SUPPORTED_TYPES).map((t) =>
    t.toLowerCase()
  );
  return supported.includes(type);
}

/**
 * Pick the best `<MediaFile>` for the current viewport.
 *
 * Ranking, in order of weight:
 * 1. MIME-type preference (earlier entries in `supportedTypes` win).
 * 2. Distance from the target pixel height — the closest rendition at or above
 *    the target beats one below it, so the ad never looks softer than the feed.
 * 3. Bitrate, capped by `maxBitrate`.
 *
 * Streaming (HLS) renditions are preferred when nothing else separates two
 * candidates, since they adapt on their own.
 *
 * Returns `undefined` when no rendition is playable — the caller should then
 * report VAST error 403.
 */
export function selectMediaFile(
  files: VastMediaFile[],
  options: MediaFileSelectionOptions = {}
): VastMediaFile | undefined {
  const playable = files.filter((file) => isPlayableMediaFile(file, options));
  if (playable.length === 0) return undefined;
  if (playable.length === 1) return playable[0];

  const supported = (options.supportedTypes ?? DEFAULT_SUPPORTED_TYPES).map((t) =>
    t.toLowerCase()
  );
  const pixelRatio = options.pixelRatio ?? 1;
  const targetHeight = (options.height ?? 0) * pixelRatio;
  const maxBitrate = options.maxBitrate ?? Infinity;

  const score = (file: VastMediaFile) => {
    const type = (file.type ?? inferType(file.url) ?? '').toLowerCase();
    const typeRank = supported.indexOf(type);

    // Files whose bitrate exceeds the cap are pushed to the back but stay
    // eligible — a too-big rendition beats no ad at all.
    const bitrate = file.bitrate ?? file.maxBitrate ?? 0;
    const overBudget = bitrate > maxBitrate ? 1 : 0;

    let resolutionPenalty = 0;
    if (targetHeight > 0 && file.height) {
      const delta = file.height - targetHeight;
      // Undershooting is penalised twice as hard as overshooting.
      resolutionPenalty = delta >= 0 ? delta : -delta * 2;
    }

    return { typeRank: typeRank < 0 ? supported.length : typeRank, overBudget, resolutionPenalty, bitrate, file };
  };

  const ranked = playable.map(score).sort((a, b) => {
    if (a.overBudget !== b.overBudget) return a.overBudget - b.overBudget;
    if (a.typeRank !== b.typeRank) return a.typeRank - b.typeRank;
    if (a.resolutionPenalty !== b.resolutionPenalty) {
      return a.resolutionPenalty - b.resolutionPenalty;
    }
    // No resolution info to separate them: prefer streaming, then lower bitrate.
    const aStreaming = a.file.delivery === 'streaming' ? 0 : 1;
    const bStreaming = b.file.delivery === 'streaming' ? 0 : 1;
    if (aStreaming !== bStreaming) return aStreaming - bStreaming;
    return a.bitrate - b.bitrate;
  });

  return ranked[0]?.file;
}

/**
 * Selection defaults for a full-bleed vertical feed.
 *
 * Reels are 9:16, so the height drives quality. `maxBitrate` is deliberately
 * conservative: an ad that stalls is worse than an ad that looks slightly soft.
 */
export function verticalFeedMediaOptions(
  overrides: MediaFileSelectionOptions = {}
): MediaFileSelectionOptions {
  const height =
    typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 1280;

  return {
    width: Math.round((height * 9) / 16),
    height,
    pixelRatio:
      typeof window !== 'undefined' && window.devicePixelRatio
        ? Math.min(window.devicePixelRatio, 2)
        : 1,
    maxBitrate: 4000,
    allowHls: true,
    ...overrides,
  };
}
