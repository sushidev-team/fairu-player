import { describe, it, expect } from 'vitest';
import {
  FAIRU_FILES_BASE_URL,
  FAIRU_DEFAULT_COVER_WIDTH,
  FAIRU_DEFAULT_COVER_HEIGHT,
  getFairuAudioUrl,
  getFairuVideoUrl,
  getFairuHlsUrl,
  getFairuCoverUrl,
  getFairuThumbnailUrl,
  createTrackFromFairu,
  createVideoTrackFromFairu,
  createPlaylistFromFairu,
  createVideoPlaylistFromFairu,
  secondsToFairuTimestamp,
  createFairuMarkers,
} from './fairu';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

/** Read the query string of a generated URL as a plain object. */
function params(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams.entries());
}

describe('fairu URL helpers', () => {
  describe('constants', () => {
    it('points at the fairu file host', () => {
      expect(FAIRU_FILES_BASE_URL).toBe('https://files.fairu.app');
    });

    it('defaults covers to a square', () => {
      expect(FAIRU_DEFAULT_COVER_WIDTH).toBe(400);
      expect(FAIRU_DEFAULT_COVER_HEIGHT).toBe(400);
    });
  });

  describe('getFairuAudioUrl', () => {
    it('builds the default URL', () => {
      expect(getFairuAudioUrl(UUID)).toBe(`${FAIRU_FILES_BASE_URL}/${UUID}/audio.mp3`);
    });

    it('honours a custom base URL', () => {
      expect(getFairuAudioUrl(UUID, { baseUrl: 'https://cdn.example.test' })).toBe(
        `https://cdn.example.test/${UUID}/audio.mp3`
      );
    });

    it('produces a parseable URL', () => {
      expect(() => new URL(getFairuAudioUrl(UUID))).not.toThrow();
    });
  });

  describe('getFairuVideoUrl', () => {
    it('builds the default URL with no query string', () => {
      expect(getFairuVideoUrl(UUID)).toBe(`${FAIRU_FILES_BASE_URL}/${UUID}/video.mp4`);
    });

    it('appends the version when given', () => {
      expect(params(getFairuVideoUrl(UUID, { version: 'high' }))).toEqual({ version: 'high' });
    });

    it('omits the "?" entirely when there is nothing to append', () => {
      // A trailing bare "?" would still work but shows up in analytics as a
      // distinct URL from the same asset without it.
      expect(getFairuVideoUrl(UUID)).not.toContain('?');
    });

    it('honours a custom base URL alongside a version', () => {
      const url = getFairuVideoUrl(UUID, { baseUrl: 'https://cdn.example.test', version: 'low' });
      expect(url).toBe(`https://cdn.example.test/${UUID}/video.mp4?version=low`);
    });
  });

  describe('getFairuHlsUrl', () => {
    it('places the tenant in the path', () => {
      expect(getFairuHlsUrl(UUID, 'my-tenant')).toBe(
        `${FAIRU_FILES_BASE_URL}/hls/my-tenant/${UUID}/master.m3u8`
      );
    });

    it('honours a custom base URL', () => {
      expect(getFairuHlsUrl(UUID, 't', { baseUrl: 'https://cdn.example.test' })).toBe(
        `https://cdn.example.test/hls/t/${UUID}/master.m3u8`
      );
    });

    it('ends in a manifest so isHLSSource can detect it', () => {
      expect(getFairuHlsUrl(UUID, 't')).toMatch(/\.m3u8$/);
    });
  });

  describe('getFairuCoverUrl', () => {
    it('always sets width and height, defaulting to the square', () => {
      expect(params(getFairuCoverUrl(UUID))).toEqual({ width: '400', height: '400' });
    });

    it('honours explicit dimensions', () => {
      expect(params(getFairuCoverUrl(UUID, { width: 800, height: 450 }))).toEqual({
        width: '800',
        height: '450',
      });
    });

    it('passes format, quality, fit and focal through', () => {
      expect(
        params(
          getFairuCoverUrl(UUID, {
            width: 200,
            height: 200,
            format: 'webp',
            quality: 90,
            fit: 'cover',
            focal: 'center',
          })
        )
      ).toEqual({
        width: '200',
        height: '200',
        format: 'webp',
        quality: '90',
        fit: 'cover',
        focal: 'center',
      });
    });

    it('keeps a quality of 0 rather than treating it as absent', () => {
      // `quality` is checked against undefined, not truthiness — 0 is a value.
      expect(params(getFairuCoverUrl(UUID, { quality: 0 })).quality).toBe('0');
    });

    it('falls back to the default when a dimension is 0', () => {
      // Documented behaviour of the `||` fallback: a zero dimension is not a
      // meaningful request, so the default stands.
      expect(params(getFairuCoverUrl(UUID, { width: 0 })).width).toBe('400');
    });

    it('omits optional params that were not given', () => {
      const keys = Object.keys(params(getFairuCoverUrl(UUID)));
      expect(keys).not.toContain('format');
      expect(keys).not.toContain('quality');
    });
  });

  describe('getFairuThumbnailUrl', () => {
    it('always sets the timestamp', () => {
      expect(params(getFairuThumbnailUrl(UUID, '00:00:30.000')).timestamp).toBe('00:00:30.000');
    });

    it('targets the thumbnail endpoint', () => {
      expect(getFairuThumbnailUrl(UUID, '00:00:01.000')).toContain(`/${UUID}/thumbnail.jpg`);
    });

    it('omits dimensions when not given — unlike covers, which default', () => {
      const keys = Object.keys(params(getFairuThumbnailUrl(UUID, '00:00:01.000')));
      expect(keys).toEqual(['timestamp']);
    });

    it('passes dimensions, format and quality through', () => {
      expect(
        params(
          getFairuThumbnailUrl(UUID, '00:01:00.000', {
            width: 160,
            height: 90,
            format: 'webp',
            quality: 80,
          })
        )
      ).toEqual({
        timestamp: '00:01:00.000',
        width: '160',
        height: '90',
        format: 'webp',
        quality: '80',
      });
    });

    it('encodes the colons in the timestamp', () => {
      expect(getFairuThumbnailUrl(UUID, '00:01:30.500')).toContain('timestamp=00%3A01%3A30.500');
    });

    it('keeps a quality of 0', () => {
      expect(params(getFairuThumbnailUrl(UUID, '00:00:01.000', { quality: 0 })).quality).toBe('0');
    });
  });

  describe('secondsToFairuTimestamp', () => {
    it.each([
      [0, '00:00:00.000'],
      [1, '00:00:01.000'],
      [59, '00:00:59.000'],
      [60, '00:01:00.000'],
      [90.5, '00:01:30.500'],
      [3600, '01:00:00.000'],
      [3661.25, '01:01:01.250'],
      [36000, '10:00:00.000'],
    ])('formats %ss as %s', (seconds, expected) => {
      expect(secondsToFairuTimestamp(seconds)).toBe(expected);
    });

    it('pads every field to a fixed width', () => {
      expect(secondsToFairuTimestamp(5)).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
    });

    it('rounds sub-millisecond precision', () => {
      expect(secondsToFairuTimestamp(1.0004)).toBe('00:00:01.000');
    });
  });

  describe('createTrackFromFairu', () => {
    it('maps a full track', () => {
      const track = createTrackFromFairu({
        uuid: UUID,
        title: 'Folge 1',
        artist: 'Fairu',
        album: 'Staffel 2',
        duration: 1800,
      });

      expect(track.id).toBe(UUID);
      expect(track.src).toBe(getFairuAudioUrl(UUID));
      expect(track.title).toBe('Folge 1');
      expect(track.artist).toBe('Fairu');
      expect(track.album).toBe('Staffel 2');
      expect(track.duration).toBe(1800);
      expect(track.artwork).toContain('/cover.jpg');
    });

    it('falls back to "Untitled" for a missing title', () => {
      expect(createTrackFromFairu({ uuid: UUID }).title).toBe('Untitled');
    });

    it('falls back to "Untitled" for an empty title', () => {
      expect(createTrackFromFairu({ uuid: UUID, title: '' }).title).toBe('Untitled');
    });

    it('applies the base URL to the audio source', () => {
      const track = createTrackFromFairu({ uuid: UUID }, { baseUrl: 'https://cdn.example.test' });
      expect(track.src).toContain('https://cdn.example.test');
    });

    it('applies coverOptions to the artwork', () => {
      const track = createTrackFromFairu({
        uuid: UUID,
        coverOptions: { width: 800, height: 800, format: 'webp' },
      });
      expect(params(track.artwork!)).toMatchObject({
        width: '800',
        height: '800',
        format: 'webp',
      });
    });
  });

  describe('createVideoTrackFromFairu', () => {
    it('maps a full video track', () => {
      const track = createVideoTrackFromFairu({
        uuid: UUID,
        title: 'Video 1',
        artist: 'Fairu',
        duration: 600,
      });

      expect(track.id).toBe(UUID);
      expect(track.title).toBe('Video 1');
      expect(track.duration).toBe(600);
      expect(track.poster).toContain('/cover.jpg');
    });

    it('threads the version into the video source', () => {
      const track = createVideoTrackFromFairu({ uuid: UUID, version: 'high' });
      expect(track.src).toContain('version=high');
    });

    it('prefers posterOptions over coverOptions', () => {
      const track = createVideoTrackFromFairu({
        uuid: UUID,
        coverOptions: { width: 400 },
        posterOptions: { width: 1280, height: 720 },
      });

      expect(params(track.poster!)).toMatchObject({ width: '1280', height: '720' });
    });

    it('falls back to coverOptions when there are no posterOptions', () => {
      const track = createVideoTrackFromFairu({
        uuid: UUID,
        coverOptions: { width: 640, height: 360 },
      });

      expect(params(track.poster!)).toMatchObject({ width: '640', height: '360' });
    });

    it('falls back to "Untitled" for a missing title', () => {
      expect(createVideoTrackFromFairu({ uuid: UUID }).title).toBe('Untitled');
    });
  });

  describe('playlist converters', () => {
    it('maps every audio track', () => {
      const tracks = createPlaylistFromFairu([
        { uuid: 'a', title: 'A' },
        { uuid: 'b', title: 'B' },
      ]);

      expect(tracks).toHaveLength(2);
      expect(tracks.map((t) => t.id)).toEqual(['a', 'b']);
    });

    it('passes options to every audio track', () => {
      const tracks = createPlaylistFromFairu([{ uuid: 'a' }, { uuid: 'b' }], {
        baseUrl: 'https://cdn.example.test',
      });

      expect(tracks.every((t) => t.src.startsWith('https://cdn.example.test'))).toBe(true);
    });

    it('maps every video track', () => {
      const tracks = createVideoPlaylistFromFairu([
        { uuid: 'a', version: 'high' },
        { uuid: 'b' },
      ]);

      expect(tracks).toHaveLength(2);
      expect(tracks[0].src).toContain('version=high');
      expect(tracks[1].src).not.toContain('version');
    });

    it('returns an empty array for an empty input', () => {
      expect(createPlaylistFromFairu([])).toEqual([]);
      expect(createVideoPlaylistFromFairu([])).toEqual([]);
    });
  });

  describe('createFairuMarkers', () => {
    it('fills in a preview image per marker', () => {
      const markers = createFairuMarkers(UUID, [
        { id: '1', time: 30, title: 'Intro' },
        { id: '2', time: 90, title: 'Main' },
      ]);

      expect(markers[0].previewImage).toContain('timestamp=00%3A00%3A30.000');
      expect(markers[1].previewImage).toContain('timestamp=00%3A01%3A30.000');
    });

    it('leaves a marker that already has a preview image untouched', () => {
      const existing = { id: '1', time: 30, previewImage: 'https://example.test/custom.jpg' };
      const [marker] = createFairuMarkers(UUID, [existing]);

      expect(marker.previewImage).toBe('https://example.test/custom.jpg');
      // Returned by reference — nothing to copy when nothing changed.
      expect(marker).toBe(existing);
    });

    it('uses thumbnail-sized defaults', () => {
      const [marker] = createFairuMarkers(UUID, [{ id: '1', time: 10 }]);

      expect(params(marker.previewImage!)).toMatchObject({
        width: '160',
        height: '90',
        format: 'webp',
        quality: '80',
      });
    });

    it('lets options override the defaults', () => {
      const [marker] = createFairuMarkers(UUID, [{ id: '1', time: 10 }], {
        width: 320,
        height: 180,
        quality: 95,
      });

      expect(params(marker.previewImage!)).toMatchObject({
        width: '320',
        height: '180',
        quality: '95',
        // Not overridden, so the default survives.
        format: 'webp',
      });
    });

    it('preserves the other marker fields', () => {
      const [marker] = createFairuMarkers(UUID, [
        { id: '1', time: 10, title: 'Kapitel', color: '#f59e0b' },
      ]);

      expect(marker).toMatchObject({ id: '1', time: 10, title: 'Kapitel', color: '#f59e0b' });
    });

    it('does not mutate the input array', () => {
      const input = [{ id: '1', time: 10 }];
      createFairuMarkers(UUID, input);
      expect(input[0]).not.toHaveProperty('previewImage');
    });

    it('returns an empty array for no markers', () => {
      expect(createFairuMarkers(UUID, [])).toEqual([]);
    });
  });
});
