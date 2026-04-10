/**
 * A single thumbnail cue from a VTT file
 */
export interface ThumbnailCue {
  startTime: number;
  endTime: number;
  /** URL of the thumbnail image (or sprite sheet) */
  url: string;
  /** If sprite sheet: x position */
  x?: number;
  /** If sprite sheet: y position */
  y?: number;
  /** If sprite sheet: width of this thumbnail */
  width?: number;
  /** If sprite sheet: height of this thumbnail */
  height?: number;
}

/**
 * Configuration for thumbnail previews
 */
export interface ThumbnailConfig {
  /** URL to a WebVTT file containing thumbnail cues */
  vttUrl?: string;
  /** URL to a sprite sheet image (alternative to VTT) */
  spriteUrl?: string;
  /** Number of columns in the sprite sheet */
  spriteColumns?: number;
  /** Number of rows in the sprite sheet */
  spriteRows?: number;
  /** Width of each thumbnail in the sprite */
  thumbWidth?: number;
  /** Height of each thumbnail in the sprite */
  thumbHeight?: number;
  /** Interval between thumbnails in seconds (for sprite sheets without VTT) */
  interval?: number;
  /** Total duration of the video (needed for sprite calculation without VTT) */
  duration?: number;
}

/**
 * Parse a VTT timestamp "HH:MM:SS.mmm" or "MM:SS.mmm" to seconds
 */
function parseVTTTime(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(parts[0]);
}

/**
 * Parse spatial media fragment from URL hash (#xywh=x,y,w,h)
 */
function parseSpatialFragment(url: string): { baseUrl: string; x?: number; y?: number; width?: number; height?: number } {
  const hashIndex = url.indexOf('#xywh=');
  if (hashIndex === -1) {
    return { baseUrl: url };
  }

  const baseUrl = url.substring(0, hashIndex);
  const fragment = url.substring(hashIndex + 6);
  const [x, y, w, h] = fragment.split(',').map(Number);

  return { baseUrl, x, y, width: w, height: h };
}

/**
 * Parse a WebVTT thumbnail file content into ThumbnailCue array
 */
export function parseVTT(vttContent: string): ThumbnailCue[] {
  const cues: ThumbnailCue[] = [];
  const lines = vttContent.trim().split('\n');

  let i = 0;
  // Skip WEBVTT header
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();

    // Look for timestamp line "00:00:00.000 --> 00:00:05.000"
    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->').map(s => s.trim());
      const startTime = parseVTTTime(startStr);
      const endTime = parseVTTTime(endStr);

      // Next line should be the URL (possibly with spatial fragment)
      i++;
      if (i < lines.length) {
        const urlLine = lines[i].trim();
        if (urlLine) {
          const { baseUrl, x, y, width, height } = parseSpatialFragment(urlLine);
          cues.push({ startTime, endTime, url: baseUrl, x, y, width, height });
        }
      }
    }
    i++;
  }

  return cues;
}

/**
 * Find the thumbnail cue for a given time
 */
export function findCueAtTime(cues: ThumbnailCue[], time: number): ThumbnailCue | null {
  for (const cue of cues) {
    if (time >= cue.startTime && time < cue.endTime) {
      return cue;
    }
  }
  return null;
}

/**
 * Generate thumbnail cues from a sprite sheet configuration (no VTT needed)
 */
export function generateSpriteCues(config: {
  spriteUrl: string;
  columns: number;
  rows: number;
  thumbWidth: number;
  thumbHeight: number;
  interval: number;
  duration: number;
}): ThumbnailCue[] {
  const { spriteUrl, columns, rows, thumbWidth, thumbHeight, interval, duration } = config;
  const cues: ThumbnailCue[] = [];
  const totalThumbs = columns * rows;

  for (let i = 0; i < totalThumbs; i++) {
    const startTime = i * interval;
    if (startTime >= duration) break;
    const endTime = Math.min((i + 1) * interval, duration);
    const col = i % columns;
    const row = Math.floor(i / columns);

    cues.push({
      startTime,
      endTime,
      url: spriteUrl,
      x: col * thumbWidth,
      y: row * thumbHeight,
      width: thumbWidth,
      height: thumbHeight,
    });
  }

  return cues;
}
