/**
 * Scrubbing thumbnails — the frames a viewer sees while dragging the bar.
 *
 * Ported from PR #16. Two shapes are supported because both are in the wild: a
 * WebVTT file whose cue payload is an image URL (usually with a `#xywh=`
 * fragment pointing into a sprite sheet), and a bare sprite sheet described by
 * its geometry.
 *
 * Pure by construction — no fetch, no DOM. The hook does the loading.
 */

export interface ThumbnailCue {
  startTime: number;
  endTime: number;
  /** Image URL. A sprite sheet when the crop fields are set. */
  url: string;
  /** Crop within the sprite sheet, in pixels. */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ThumbnailConfig {
  /** WebVTT file describing the thumbnails. Takes priority over `spriteUrl`. */
  vttUrl?: string;
  /** A sprite sheet with no VTT alongside it. */
  spriteUrl?: string;
  spriteColumns?: number;
  spriteRows?: number;
  thumbWidth?: number;
  thumbHeight?: number;
  /** Seconds each thumbnail covers. Derived from the duration when absent. */
  interval?: number;
  /** Needed to lay a bare sprite sheet over the timeline. */
  duration?: number;
}

const SAFE_SCHEMES = ['http:', 'https:', 'blob:', 'data:'];

/**
 * `HH:MM:SS.mmm`, `MM:SS.mmm` or bare seconds → seconds, or `null`.
 *
 * Returns `null` rather than `NaN` for anything malformed: a cue with NaN
 * bounds matches no time at all, so it would fail silently and the preview
 * would simply never appear.
 */
export function parseVttTime(value: string): number | null {
  const parts = value.trim().split(':');
  if (parts.length > 3) return null;

  let seconds = 0;
  for (const part of parts) {
    if (!/^\d+(?:\.\d+)?$/.test(part.trim())) return null;
    seconds = seconds * 60 + Number(part);
  }

  return Number.isFinite(seconds) ? seconds : null;
}

/**
 * Split a cue payload into its URL and the crop it points at.
 *
 * `#xywh=` is the spatial media fragment every thumbnail generator emits; it is
 * what makes one sprite sheet serve a whole film.
 */
export function parseSpatialFragment(payload: string): {
  url: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
} {
  const marker = payload.indexOf('#xywh=');
  if (marker === -1) return { url: payload };

  const url = payload.slice(0, marker);
  const numbers = payload
    .slice(marker + '#xywh='.length)
    .split(',')
    .map((part) => Number(part.trim()));

  // All four or none: a partial crop would place the sprite window somewhere
  // arbitrary, which looks like a broken image rather than a missing feature.
  if (numbers.length !== 4 || numbers.some((n) => !Number.isFinite(n))) {
    return { url };
  }

  const [x, y, width, height] = numbers;
  return { url, x, y, width, height };
}

/**
 * Resolve a cue URL against the VTT it came from, and reject odd schemes.
 *
 * Thumbnail VTTs almost always use relative paths — `shots/042.jpg` sitting
 * next to the manifest — so resolving against the file's own address is not a
 * nicety, it is the common case. The scheme check is because the file is
 * third-party content that ends up in `background-image`.
 */
export function resolveThumbnailUrl(url: string, baseUrl?: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const base = baseUrl ?? (typeof window !== 'undefined' ? window.location.href : undefined);
    const resolved = base ? new URL(trimmed, base) : new URL(trimmed);
    return SAFE_SCHEMES.includes(resolved.protocol) ? resolved.toString() : null;
  } catch {
    return null;
  }
}

/**
 * A thumbnail VTT → cues.
 *
 * `baseUrl` should be the address the VTT was fetched from; cue URLs resolve
 * against it.
 */
export function parseThumbnailVtt(content: string, baseUrl?: string): ThumbnailCue[] {
  const cues: ThumbnailCue[] = [];
  // Tolerate CRLF, which is what a good half of the generators emit.
  const lines = content.replace(/\r\n?/g, '\n').split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.includes('-->')) continue;

    const [startRaw, endRaw] = line.split('-->');
    const startTime = parseVttTime(startRaw ?? '');
    // A cue may carry settings after the end time; only the first token is one.
    const endTime = parseVttTime((endRaw ?? '').trim().split(/\s+/)[0] ?? '');
    if (startTime === null || endTime === null || endTime <= startTime) continue;

    const payload = (lines[i + 1] ?? '').trim();
    if (!payload) continue;
    i += 1;

    const { url, x, y, width, height } = parseSpatialFragment(payload);
    const resolved = resolveThumbnailUrl(url, baseUrl);
    if (!resolved) continue;

    cues.push({ startTime, endTime, url: resolved, x, y, width, height });
  }

  return cues;
}

export interface SpriteSheet {
  spriteUrl: string;
  columns: number;
  rows: number;
  thumbWidth: number;
  thumbHeight: number;
  interval: number;
  duration: number;
}

/** Lay a bare sprite sheet over the timeline. */
export function generateSpriteCues(sheet: SpriteSheet): ThumbnailCue[] {
  const { spriteUrl, columns, rows, thumbWidth, thumbHeight, interval, duration } = sheet;
  if (columns <= 0 || rows <= 0 || interval <= 0 || duration <= 0) return [];

  const cues: ThumbnailCue[] = [];
  const total = columns * rows;

  for (let index = 0; index < total; index += 1) {
    const startTime = index * interval;
    if (startTime >= duration) break;

    cues.push({
      startTime,
      endTime: Math.min((index + 1) * interval, duration),
      url: spriteUrl,
      x: (index % columns) * thumbWidth,
      y: Math.floor(index / columns) * thumbHeight,
      width: thumbWidth,
      height: thumbHeight,
    });
  }

  return cues;
}

/** Turn a config with no VTT into cues, if it describes enough to do so. */
export function cuesFromConfig(config: ThumbnailConfig): ThumbnailCue[] {
  const { spriteUrl, spriteColumns, spriteRows, thumbWidth, thumbHeight, duration } = config;
  if (!spriteUrl || !spriteColumns || !spriteRows || !thumbWidth || !thumbHeight || !duration) {
    return [];
  }

  const url = resolveThumbnailUrl(spriteUrl);
  if (!url) return [];

  return generateSpriteCues({
    spriteUrl: url,
    columns: spriteColumns,
    rows: spriteRows,
    thumbWidth,
    thumbHeight,
    interval: config.interval ?? duration / (spriteColumns * spriteRows),
    duration,
  });
}

/**
 * The cue covering `time`.
 *
 * A binary search rather than a scan: cues are sorted — WebVTT requires it, and
 * `generateSpriteCues` emits them that way — and this runs on every pointer
 * move across the bar. A two-hour film at five-second shots is 1,440 cues, and
 * walking all of them per mouse event is felt.
 */
export function findCueAtTime(cues: ThumbnailCue[], time: number): ThumbnailCue | null {
  if (!Number.isFinite(time)) return null;

  let low = 0;
  let high = cues.length - 1;

  while (low <= high) {
    const middle = (low + high) >> 1;
    const cue = cues[middle];

    if (time < cue.startTime) high = middle - 1;
    else if (time >= cue.endTime) low = middle + 1;
    else return cue;
  }

  return null;
}
