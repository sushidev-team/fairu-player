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

/**
 * MIME types an `<audio>` element can play, in preference order.
 *
 * VAST 4.1 folded DAAST into the main spec, so an audio ad is an ordinary VAST
 * document whose `<MediaFile>` carries an `audio/*` type. Without these in the
 * allow-list every audio creative fails selection and reports VAST error 403.
 */
const DEFAULT_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/aacp',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
  'application/x-mpegurl',
  'application/vnd.apple.mpegurl',
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
  if (path.endsWith('.ogv')) return 'video/ogg';
  // Audio extensions. `.ogg` is ambiguous but overwhelmingly audio in practice.
  if (path.endsWith('.mp3')) return 'audio/mpeg';
  if (path.endsWith('.m4a')) return 'audio/mp4';
  if (path.endsWith('.aac')) return 'audio/aac';
  if (path.endsWith('.ogg') || path.endsWith('.oga')) return 'audio/ogg';
  if (path.endsWith('.wav')) return 'audio/wav';
  return undefined;
}

/**
 * The MIME allow-list for a given set of options.
 *
 * `audioOnly` switches to the audio list rather than merely adding to it: a
 * podcast player handed a video creative must reject it, not silently play the
 * audio track of an MP4 while the listener sees nothing.
 */
function supportedTypesFor(options: MediaFileSelectionOptions): string[] {
  const explicit = options.supportedTypes;
  if (explicit) return explicit.map((t) => t.toLowerCase());
  return (options.audioOnly ? DEFAULT_AUDIO_TYPES : DEFAULT_SUPPORTED_TYPES).map((t) =>
    t.toLowerCase()
  );
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

  return supportedTypesFor(options).includes(type);
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

  const supported = supportedTypesFor(options);
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
 * Selection defaults for an audio-only player (podcasts).
 *
 * Resolution is meaningless here, so ranking falls through to MIME preference
 * and bitrate. The cap is generous because a 128 kbps spot next to a 128 kbps
 * episode is the normal case and there is no pixel budget to trade against.
 */
export function audioAdMediaOptions(
  overrides: MediaFileSelectionOptions = {}
): MediaFileSelectionOptions {
  return {
    audioOnly: true,
    maxBitrate: 320,
    allowHls: true,
    ...overrides,
  };
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
