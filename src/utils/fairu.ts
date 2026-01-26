/**
 * Fairu.app file hosting utilities
 *
 * These utilities simplify the use of fairu.app as a hosting solution
 * for audio and video content. Instead of providing full URLs, you can
 * simply provide a UUID and the player will automatically construct
 * the correct URLs for media files and cover images.
 *
 * @see https://files.fairu.app/docs/
 */

/** Base URL for fairu.app file hosting */
export const FAIRU_FILES_BASE_URL = 'https://files.fairu.app';

/** Default cover image dimensions */
export const FAIRU_DEFAULT_COVER_WIDTH = 400;
export const FAIRU_DEFAULT_COVER_HEIGHT = 400;

/**
 * Options for generating fairu.app URLs
 */
export interface FairuUrlOptions {
  /** Custom base URL (defaults to https://files.fairu.app) */
  baseUrl?: string;
}

/**
 * Options for generating cover image URLs
 */
export interface FairuCoverOptions extends FairuUrlOptions {
  /** Width in pixels (1-6000) */
  width?: number;
  /** Height in pixels (1-6000) */
  height?: number;
  /** Output format */
  format?: 'jpg' | 'jpeg' | 'png' | 'webp';
  /** Quality for JPEG/WebP (1-100, default: 95) */
  quality?: number;
  /** Resize mode: cover (crop) or contain (fit) */
  fit?: 'cover' | 'contain';
  /** Focal point for smart crop: "x-y-zoom" (e.g., "50-30-1.5") */
  focal?: string;
}

/**
 * Options for generating video URLs
 */
export interface FairuVideoOptions extends FairuUrlOptions {
  /** Video quality version */
  version?: 'low' | 'medium' | 'high';
}

/**
 * Fairu track configuration - simplified track definition using only UUID
 */
export interface FairuTrack {
  /** File UUID from fairu.app */
  uuid: string;
  /** Track title (optional) */
  title?: string;
  /** Artist name (optional) */
  artist?: string;
  /** Album name (optional) */
  album?: string;
  /** Duration in seconds (optional) */
  duration?: number;
  /** Cover image options (optional) */
  coverOptions?: FairuCoverOptions;
}

/**
 * Fairu video track configuration - simplified video track definition
 */
export interface FairuVideoTrack extends FairuTrack {
  /** Video quality version */
  version?: 'low' | 'medium' | 'high';
  /** Poster image options (optional) */
  posterOptions?: FairuCoverOptions;
}

/**
 * Generate an audio URL for a fairu.app file
 *
 * @param uuid - The file UUID
 * @param options - URL generation options
 * @returns The complete audio URL
 *
 * @example
 * ```ts
 * const url = getFairuAudioUrl('123e4567-e89b-12d3-a456-426614174000');
 * // Returns: https://files.fairu.app/123e4567-e89b-12d3-a456-426614174000/audio.mp3
 * ```
 */
export function getFairuAudioUrl(uuid: string, options: FairuUrlOptions = {}): string {
  const baseUrl = options.baseUrl || FAIRU_FILES_BASE_URL;
  return `${baseUrl}/${uuid}/audio.mp3`;
}

/**
 * Generate a video URL for a fairu.app file
 *
 * @param uuid - The file UUID
 * @param options - URL generation options
 * @returns The complete video URL
 *
 * @example
 * ```ts
 * const url = getFairuVideoUrl('123e4567-e89b-12d3-a456-426614174000');
 * // Returns: https://files.fairu.app/123e4567-e89b-12d3-a456-426614174000/video.mp4
 *
 * const hdUrl = getFairuVideoUrl('123e4567-e89b-12d3-a456-426614174000', { version: 'high' });
 * // Returns: https://files.fairu.app/123e4567-e89b-12d3-a456-426614174000/video.mp4?version=high
 * ```
 */
export function getFairuVideoUrl(uuid: string, options: FairuVideoOptions = {}): string {
  const baseUrl = options.baseUrl || FAIRU_FILES_BASE_URL;
  const params = new URLSearchParams();

  if (options.version) {
    params.set('version', options.version);
  }

  const queryString = params.toString();
  return `${baseUrl}/${uuid}/video.mp4${queryString ? `?${queryString}` : ''}`;
}

/**
 * Generate an HLS streaming URL for a fairu.app file
 *
 * @param uuid - The file UUID
 * @param tenant - The tenant identifier
 * @param options - URL generation options
 * @returns The complete HLS URL
 *
 * @example
 * ```ts
 * const url = getFairuHlsUrl('123e4567-e89b-12d3-a456-426614174000', 'my-tenant');
 * // Returns: https://files.fairu.app/hls/my-tenant/123e4567-e89b-12d3-a456-426614174000/master.m3u8
 * ```
 */
export function getFairuHlsUrl(uuid: string, tenant: string, options: FairuUrlOptions = {}): string {
  const baseUrl = options.baseUrl || FAIRU_FILES_BASE_URL;
  return `${baseUrl}/hls/${tenant}/${uuid}/master.m3u8`;
}

/**
 * Generate a cover/poster image URL for a fairu.app file
 *
 * @param uuid - The file UUID
 * @param options - Cover image options
 * @returns The complete cover image URL
 *
 * @example
 * ```ts
 * const url = getFairuCoverUrl('123e4567-e89b-12d3-a456-426614174000');
 * // Returns: https://files.fairu.app/123e4567-e89b-12d3-a456-426614174000/cover.jpg?width=400&height=400
 *
 * const customUrl = getFairuCoverUrl('123e4567-e89b-12d3-a456-426614174000', {
 *   width: 800,
 *   height: 450,
 *   format: 'webp',
 *   quality: 90,
 * });
 * ```
 */
export function getFairuCoverUrl(uuid: string, options: FairuCoverOptions = {}): string {
  const baseUrl = options.baseUrl || FAIRU_FILES_BASE_URL;
  const params = new URLSearchParams();

  // Default dimensions for cover images
  const width = options.width || FAIRU_DEFAULT_COVER_WIDTH;
  const height = options.height || FAIRU_DEFAULT_COVER_HEIGHT;

  params.set('width', String(width));
  params.set('height', String(height));

  if (options.format) {
    params.set('format', options.format);
  }
  if (options.quality !== undefined) {
    params.set('quality', String(options.quality));
  }
  if (options.fit) {
    params.set('fit', options.fit);
  }
  if (options.focal) {
    params.set('focal', options.focal);
  }

  return `${baseUrl}/${uuid}/cover.jpg?${params.toString()}`;
}

/**
 * Generate a thumbnail URL for a fairu.app video file at a specific timestamp
 *
 * @param uuid - The file UUID
 * @param timestamp - Timestamp in format "HH:MM:SS.mmm" (e.g., "00:01:30.500")
 * @param options - Cover image options
 * @returns The complete thumbnail URL
 *
 * @example
 * ```ts
 * const url = getFairuThumbnailUrl('123e4567-e89b-12d3-a456-426614174000', '00:00:30.000');
 * // Extracts a frame at 30 seconds
 * ```
 */
export function getFairuThumbnailUrl(
  uuid: string,
  timestamp: string,
  options: FairuCoverOptions = {}
): string {
  const baseUrl = options.baseUrl || FAIRU_FILES_BASE_URL;
  const params = new URLSearchParams();

  params.set('timestamp', timestamp);

  if (options.width) {
    params.set('width', String(options.width));
  }
  if (options.height) {
    params.set('height', String(options.height));
  }
  if (options.format) {
    params.set('format', options.format);
  }
  if (options.quality !== undefined) {
    params.set('quality', String(options.quality));
  }

  return `${baseUrl}/${uuid}/thumbnail.jpg?${params.toString()}`;
}

/**
 * Convert a FairuTrack to a standard Track for audio player
 *
 * @param fairuTrack - The fairu track configuration
 * @param options - URL generation options
 * @returns A standard Track object
 *
 * @example
 * ```ts
 * const track = createTrackFromFairu({
 *   uuid: '123e4567-e89b-12d3-a456-426614174000',
 *   title: 'My Podcast Episode',
 *   artist: 'Podcast Host',
 * });
 * ```
 */
export function createTrackFromFairu(
  fairuTrack: FairuTrack,
  options: FairuUrlOptions = {}
): {
  id: string;
  src: string;
  title: string;
  artist?: string;
  album?: string;
  artwork?: string;
  duration?: number;
} {
  return {
    id: fairuTrack.uuid,
    src: getFairuAudioUrl(fairuTrack.uuid, options),
    title: fairuTrack.title || 'Untitled',
    artist: fairuTrack.artist,
    album: fairuTrack.album,
    artwork: getFairuCoverUrl(fairuTrack.uuid, fairuTrack.coverOptions),
    duration: fairuTrack.duration,
  };
}

/**
 * Convert a FairuVideoTrack to a standard VideoTrack for video player
 *
 * @param fairuTrack - The fairu video track configuration
 * @param options - URL generation options
 * @returns A standard VideoTrack object
 *
 * @example
 * ```ts
 * const track = createVideoTrackFromFairu({
 *   uuid: '123e4567-e89b-12d3-a456-426614174000',
 *   title: 'My Video',
 *   version: 'high',
 * });
 * ```
 */
export function createVideoTrackFromFairu(
  fairuTrack: FairuVideoTrack,
  options: FairuUrlOptions = {}
): {
  id: string;
  src: string;
  title: string;
  artist?: string;
  poster?: string;
  duration?: number;
} {
  return {
    id: fairuTrack.uuid,
    src: getFairuVideoUrl(fairuTrack.uuid, { ...options, version: fairuTrack.version }),
    title: fairuTrack.title || 'Untitled',
    artist: fairuTrack.artist,
    poster: getFairuCoverUrl(fairuTrack.uuid, fairuTrack.posterOptions || fairuTrack.coverOptions),
    duration: fairuTrack.duration,
  };
}

/**
 * Convert multiple FairuTracks to standard Tracks
 *
 * @param fairuTracks - Array of fairu track configurations
 * @param options - URL generation options
 * @returns Array of standard Track objects
 */
export function createPlaylistFromFairu(
  fairuTracks: FairuTrack[],
  options: FairuUrlOptions = {}
): ReturnType<typeof createTrackFromFairu>[] {
  return fairuTracks.map((track) => createTrackFromFairu(track, options));
}

/**
 * Convert multiple FairuVideoTracks to standard VideoTracks
 *
 * @param fairuTracks - Array of fairu video track configurations
 * @param options - URL generation options
 * @returns Array of standard VideoTrack objects
 */
export function createVideoPlaylistFromFairu(
  fairuTracks: FairuVideoTrack[],
  options: FairuUrlOptions = {}
): ReturnType<typeof createVideoTrackFromFairu>[] {
  return fairuTracks.map((track) => createVideoTrackFromFairu(track, options));
}

/**
 * Convert seconds to Fairu timestamp format "HH:MM:SS.mmm"
 *
 * @param seconds - Time in seconds
 * @returns Formatted timestamp string
 *
 * @example
 * ```ts
 * secondsToFairuTimestamp(90.5);
 * // Returns: "00:01:30.500"
 * ```
 */
export function secondsToFairuTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  return [
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0'),
  ].join(':') + '.' + String(ms).padStart(3, '0');
}

/**
 * Populate markers with auto-generated Fairu thumbnail URLs
 *
 * For markers that don't already have a `previewImage`, this function
 * generates a thumbnail URL using the video UUID and the marker's timestamp.
 *
 * @param uuid - The fairu.app video file UUID
 * @param markers - Array of timeline markers
 * @param options - Cover/thumbnail image options
 * @returns New array of markers with previewImage filled in
 *
 * @example
 * ```ts
 * const markers = createFairuMarkers('my-uuid', [
 *   { id: '1', time: 30, title: 'Intro' },
 *   { id: '2', time: 90, title: 'Main' },
 * ]);
 * // Each marker now has a previewImage URL pointing to a Fairu thumbnail
 * ```
 */
export function createFairuMarkers(
  uuid: string,
  markers: { id: string; time: number; title?: string; previewImage?: string; color?: string }[],
  options: FairuCoverOptions = {}
): typeof markers {
  const defaultOptions: FairuCoverOptions = {
    width: 160,
    height: 90,
    format: 'webp',
    quality: 80,
    ...options,
  };

  return markers.map((marker) => {
    if (marker.previewImage) return marker;

    return {
      ...marker,
      previewImage: getFairuThumbnailUrl(uuid, secondsToFairuTimestamp(marker.time), defaultOptions),
    };
  });
}
