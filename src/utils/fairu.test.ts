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

const TEST_UUID = '123e4567-e89b-12d3-a456-426614174000';
const CUSTOM_BASE = 'https://custom.cdn.example.com';

describe('constants', () => {
  it('FAIRU_FILES_BASE_URL is the expected value', () => {
    expect(FAIRU_FILES_BASE_URL).toBe('https://files.fairu.app');
  });

  it('FAIRU_DEFAULT_COVER_WIDTH is 400', () => {
    expect(FAIRU_DEFAULT_COVER_WIDTH).toBe(400);
  });

  it('FAIRU_DEFAULT_COVER_HEIGHT is 400', () => {
    expect(FAIRU_DEFAULT_COVER_HEIGHT).toBe(400);
  });
});

describe('getFairuAudioUrl', () => {
  it('returns the correct audio URL with default base', () => {
    const url = getFairuAudioUrl(TEST_UUID);
    expect(url).toBe(`https://files.fairu.app/${TEST_UUID}/audio.mp3`);
  });

  it('uses a custom base URL when provided', () => {
    const url = getFairuAudioUrl(TEST_UUID, { baseUrl: CUSTOM_BASE });
    expect(url).toBe(`${CUSTOM_BASE}/${TEST_UUID}/audio.mp3`);
  });

  it('works with a simple uuid string', () => {
    const url = getFairuAudioUrl('abc-123');
    expect(url).toBe('https://files.fairu.app/abc-123/audio.mp3');
  });
});

describe('getFairuVideoUrl', () => {
  it('returns the correct video URL without version', () => {
    const url = getFairuVideoUrl(TEST_UUID);
    expect(url).toBe(`https://files.fairu.app/${TEST_UUID}/video.mp4`);
  });

  it('appends version=low query parameter', () => {
    const url = getFairuVideoUrl(TEST_UUID, { version: 'low' });
    expect(url).toBe(`https://files.fairu.app/${TEST_UUID}/video.mp4?version=low`);
  });

  it('appends version=medium query parameter', () => {
    const url = getFairuVideoUrl(TEST_UUID, { version: 'medium' });
    expect(url).toBe(`https://files.fairu.app/${TEST_UUID}/video.mp4?version=medium`);
  });

  it('appends version=high query parameter', () => {
    const url = getFairuVideoUrl(TEST_UUID, { version: 'high' });
    expect(url).toBe(`https://files.fairu.app/${TEST_UUID}/video.mp4?version=high`);
  });

  it('uses a custom base URL when provided', () => {
    const url = getFairuVideoUrl(TEST_UUID, { baseUrl: CUSTOM_BASE });
    expect(url).toBe(`${CUSTOM_BASE}/${TEST_UUID}/video.mp4`);
  });

  it('uses a custom base URL and version together', () => {
    const url = getFairuVideoUrl(TEST_UUID, { baseUrl: CUSTOM_BASE, version: 'high' });
    expect(url).toBe(`${CUSTOM_BASE}/${TEST_UUID}/video.mp4?version=high`);
  });
});

describe('getFairuHlsUrl', () => {
  it('returns the correct HLS URL', () => {
    const url = getFairuHlsUrl(TEST_UUID, 'my-tenant');
    expect(url).toBe(`https://files.fairu.app/hls/my-tenant/${TEST_UUID}/master.m3u8`);
  });

  it('uses a custom base URL when provided', () => {
    const url = getFairuHlsUrl(TEST_UUID, 'tenant-x', { baseUrl: CUSTOM_BASE });
    expect(url).toBe(`${CUSTOM_BASE}/hls/tenant-x/${TEST_UUID}/master.m3u8`);
  });

  it('handles different tenant values', () => {
    const url = getFairuHlsUrl(TEST_UUID, 'org-123');
    expect(url).toBe(`https://files.fairu.app/hls/org-123/${TEST_UUID}/master.m3u8`);
  });
});

describe('getFairuCoverUrl', () => {
  it('returns URL with default 400x400 dimensions', () => {
    const url = getFairuCoverUrl(TEST_UUID);
    expect(url).toContain(`/${TEST_UUID}/cover.jpg?`);
    expect(url).toContain('width=400');
    expect(url).toContain('height=400');
  });

  it('uses custom width and height', () => {
    const url = getFairuCoverUrl(TEST_UUID, { width: 800, height: 600 });
    expect(url).toContain('width=800');
    expect(url).toContain('height=600');
  });

  it('includes format parameter when specified', () => {
    const url = getFairuCoverUrl(TEST_UUID, { format: 'webp' });
    expect(url).toContain('format=webp');
  });

  it('includes quality parameter when specified', () => {
    const url = getFairuCoverUrl(TEST_UUID, { quality: 85 });
    expect(url).toContain('quality=85');
  });

  it('includes fit parameter when specified', () => {
    const url = getFairuCoverUrl(TEST_UUID, { fit: 'contain' });
    expect(url).toContain('fit=contain');
  });

  it('includes focal parameter when specified', () => {
    const url = getFairuCoverUrl(TEST_UUID, { focal: '50-30-1.5' });
    expect(url).toContain('focal=50-30-1.5');
  });

  it('includes all optional parameters together', () => {
    const url = getFairuCoverUrl(TEST_UUID, {
      width: 1200,
      height: 675,
      format: 'png',
      quality: 90,
      fit: 'cover',
      focal: '25-75-2',
    });
    expect(url).toContain('width=1200');
    expect(url).toContain('height=675');
    expect(url).toContain('format=png');
    expect(url).toContain('quality=90');
    expect(url).toContain('fit=cover');
    expect(url).toContain('focal=25-75-2');
  });

  it('uses a custom base URL when provided', () => {
    const url = getFairuCoverUrl(TEST_UUID, { baseUrl: CUSTOM_BASE });
    expect(url).toContain(`${CUSTOM_BASE}/${TEST_UUID}/cover.jpg?`);
  });

  it('does not include format when not specified', () => {
    const url = getFairuCoverUrl(TEST_UUID);
    expect(url).not.toContain('format=');
  });

  it('does not include quality when not specified', () => {
    const url = getFairuCoverUrl(TEST_UUID);
    expect(url).not.toContain('quality=');
  });

  it('includes quality=0 when explicitly set to 0', () => {
    const url = getFairuCoverUrl(TEST_UUID, { quality: 0 });
    expect(url).toContain('quality=0');
  });
});

describe('getFairuThumbnailUrl', () => {
  it('returns URL with timestamp parameter', () => {
    const url = getFairuThumbnailUrl(TEST_UUID, '00:00:30.000');
    expect(url).toContain(`/${TEST_UUID}/thumbnail.jpg?`);
    expect(url).toContain('timestamp=00%3A00%3A30.000');
  });

  it('includes optional width', () => {
    const url = getFairuThumbnailUrl(TEST_UUID, '00:01:00.000', { width: 320 });
    expect(url).toContain('width=320');
  });

  it('includes optional height', () => {
    const url = getFairuThumbnailUrl(TEST_UUID, '00:01:00.000', { height: 180 });
    expect(url).toContain('height=180');
  });

  it('includes optional format', () => {
    const url = getFairuThumbnailUrl(TEST_UUID, '00:01:00.000', { format: 'webp' });
    expect(url).toContain('format=webp');
  });

  it('includes optional quality', () => {
    const url = getFairuThumbnailUrl(TEST_UUID, '00:01:00.000', { quality: 75 });
    expect(url).toContain('quality=75');
  });

  it('does not include width when not specified', () => {
    const url = getFairuThumbnailUrl(TEST_UUID, '00:00:00.000');
    expect(url).not.toContain('width=');
  });

  it('does not include height when not specified', () => {
    const url = getFairuThumbnailUrl(TEST_UUID, '00:00:00.000');
    expect(url).not.toContain('height=');
  });

  it('uses custom base URL', () => {
    const url = getFairuThumbnailUrl(TEST_UUID, '00:00:05.000', { baseUrl: CUSTOM_BASE });
    expect(url).toContain(`${CUSTOM_BASE}/${TEST_UUID}/thumbnail.jpg?`);
  });

  it('includes all optional params together', () => {
    const url = getFairuThumbnailUrl(TEST_UUID, '00:02:15.500', {
      width: 640,
      height: 360,
      format: 'jpg',
      quality: 80,
    });
    expect(url).toContain('width=640');
    expect(url).toContain('height=360');
    expect(url).toContain('format=jpg');
    expect(url).toContain('quality=80');
  });
});

describe('secondsToFairuTimestamp', () => {
  it('converts 0 seconds', () => {
    expect(secondsToFairuTimestamp(0)).toBe('00:00:00.000');
  });

  it('converts fractional seconds', () => {
    expect(secondsToFairuTimestamp(0.5)).toBe('00:00:00.500');
  });

  it('converts whole seconds', () => {
    expect(secondsToFairuTimestamp(5)).toBe('00:00:05.000');
  });

  it('converts to minutes', () => {
    expect(secondsToFairuTimestamp(90)).toBe('00:01:30.000');
  });

  it('converts the documented example (90.5 seconds)', () => {
    expect(secondsToFairuTimestamp(90.5)).toBe('00:01:30.500');
  });

  it('converts to hours', () => {
    expect(secondsToFairuTimestamp(3600)).toBe('01:00:00.000');
  });

  it('converts complex time', () => {
    expect(secondsToFairuTimestamp(3661.123)).toBe('01:01:01.123');
  });

  it('pads hours correctly', () => {
    expect(secondsToFairuTimestamp(36000)).toBe('10:00:00.000');
  });

  it('handles millisecond precision', () => {
    expect(secondsToFairuTimestamp(1.001)).toBe('00:00:01.001');
  });

  it('handles 59 seconds', () => {
    expect(secondsToFairuTimestamp(59)).toBe('00:00:59.000');
  });

  it('handles 59 minutes 59 seconds', () => {
    expect(secondsToFairuTimestamp(3599)).toBe('00:59:59.000');
  });
});

describe('createTrackFromFairu', () => {
  it('creates a track with minimal config', () => {
    const track = createTrackFromFairu({ uuid: TEST_UUID });

    expect(track.id).toBe(TEST_UUID);
    expect(track.src).toBe(`https://files.fairu.app/${TEST_UUID}/audio.mp3`);
    expect(track.title).toBe('Untitled');
    expect(track.artwork).toContain(`/${TEST_UUID}/cover.jpg`);
  });

  it('uses provided title', () => {
    const track = createTrackFromFairu({ uuid: TEST_UUID, title: 'My Song' });
    expect(track.title).toBe('My Song');
  });

  it('includes artist when provided', () => {
    const track = createTrackFromFairu({ uuid: TEST_UUID, artist: 'Artist Name' });
    expect(track.artist).toBe('Artist Name');
  });

  it('includes album when provided', () => {
    const track = createTrackFromFairu({ uuid: TEST_UUID, album: 'Album Name' });
    expect(track.album).toBe('Album Name');
  });

  it('includes duration when provided', () => {
    const track = createTrackFromFairu({ uuid: TEST_UUID, duration: 180 });
    expect(track.duration).toBe(180);
  });

  it('does not include artist when not provided', () => {
    const track = createTrackFromFairu({ uuid: TEST_UUID });
    expect(track.artist).toBeUndefined();
  });

  it('does not include album when not provided', () => {
    const track = createTrackFromFairu({ uuid: TEST_UUID });
    expect(track.album).toBeUndefined();
  });

  it('does not include duration when not provided', () => {
    const track = createTrackFromFairu({ uuid: TEST_UUID });
    expect(track.duration).toBeUndefined();
  });

  it('uses custom base URL for src', () => {
    const track = createTrackFromFairu({ uuid: TEST_UUID }, { baseUrl: CUSTOM_BASE });
    expect(track.src).toBe(`${CUSTOM_BASE}/${TEST_UUID}/audio.mp3`);
  });

  it('applies coverOptions to artwork URL', () => {
    const track = createTrackFromFairu({
      uuid: TEST_UUID,
      coverOptions: { width: 800, height: 800, format: 'webp' },
    });
    expect(track.artwork).toContain('width=800');
    expect(track.artwork).toContain('height=800');
    expect(track.artwork).toContain('format=webp');
  });

  it('creates a complete track with all fields', () => {
    const track = createTrackFromFairu({
      uuid: TEST_UUID,
      title: 'Full Track',
      artist: 'Full Artist',
      album: 'Full Album',
      duration: 300,
    });

    expect(track).toEqual({
      id: TEST_UUID,
      src: `https://files.fairu.app/${TEST_UUID}/audio.mp3`,
      title: 'Full Track',
      artist: 'Full Artist',
      album: 'Full Album',
      artwork: expect.stringContaining(`/${TEST_UUID}/cover.jpg`),
      duration: 300,
    });
  });
});

describe('createVideoTrackFromFairu', () => {
  it('creates a video track with minimal config', () => {
    const track = createVideoTrackFromFairu({ uuid: TEST_UUID });

    expect(track.id).toBe(TEST_UUID);
    expect(track.src).toBe(`https://files.fairu.app/${TEST_UUID}/video.mp4`);
    expect(track.title).toBe('Untitled');
    expect(track.poster).toContain(`/${TEST_UUID}/cover.jpg`);
  });

  it('uses provided title', () => {
    const track = createVideoTrackFromFairu({ uuid: TEST_UUID, title: 'My Video' });
    expect(track.title).toBe('My Video');
  });

  it('includes artist when provided', () => {
    const track = createVideoTrackFromFairu({ uuid: TEST_UUID, artist: 'Director' });
    expect(track.artist).toBe('Director');
  });

  it('includes duration when provided', () => {
    const track = createVideoTrackFromFairu({ uuid: TEST_UUID, duration: 600 });
    expect(track.duration).toBe(600);
  });

  it('appends version to video URL when provided', () => {
    const track = createVideoTrackFromFairu({ uuid: TEST_UUID, version: 'high' });
    expect(track.src).toContain('version=high');
  });

  it('uses posterOptions for poster URL when provided', () => {
    const track = createVideoTrackFromFairu({
      uuid: TEST_UUID,
      posterOptions: { width: 1920, height: 1080 },
    });
    expect(track.poster).toContain('width=1920');
    expect(track.poster).toContain('height=1080');
  });

  it('falls back to coverOptions for poster URL when posterOptions not provided', () => {
    const track = createVideoTrackFromFairu({
      uuid: TEST_UUID,
      coverOptions: { width: 640, height: 360 },
    });
    expect(track.poster).toContain('width=640');
    expect(track.poster).toContain('height=360');
  });

  it('uses custom base URL for src', () => {
    const track = createVideoTrackFromFairu({ uuid: TEST_UUID }, { baseUrl: CUSTOM_BASE });
    expect(track.src).toBe(`${CUSTOM_BASE}/${TEST_UUID}/video.mp4`);
  });
});

describe('createPlaylistFromFairu', () => {
  it('returns empty array for empty input', () => {
    const playlist = createPlaylistFromFairu([]);
    expect(playlist).toEqual([]);
  });

  it('converts a single track', () => {
    const playlist = createPlaylistFromFairu([{ uuid: 'uuid-1', title: 'Track 1' }]);
    expect(playlist).toHaveLength(1);
    expect(playlist[0].id).toBe('uuid-1');
    expect(playlist[0].title).toBe('Track 1');
  });

  it('converts multiple tracks', () => {
    const playlist = createPlaylistFromFairu([
      { uuid: 'uuid-1', title: 'Track 1' },
      { uuid: 'uuid-2', title: 'Track 2' },
      { uuid: 'uuid-3', title: 'Track 3' },
    ]);
    expect(playlist).toHaveLength(3);
    expect(playlist[0].id).toBe('uuid-1');
    expect(playlist[1].id).toBe('uuid-2');
    expect(playlist[2].id).toBe('uuid-3');
  });

  it('applies shared options to all tracks', () => {
    const playlist = createPlaylistFromFairu(
      [{ uuid: 'uuid-1' }, { uuid: 'uuid-2' }],
      { baseUrl: CUSTOM_BASE }
    );
    expect(playlist[0].src).toContain(CUSTOM_BASE);
    expect(playlist[1].src).toContain(CUSTOM_BASE);
  });
});

describe('createVideoPlaylistFromFairu', () => {
  it('returns empty array for empty input', () => {
    const playlist = createVideoPlaylistFromFairu([]);
    expect(playlist).toEqual([]);
  });

  it('converts a single video track', () => {
    const playlist = createVideoPlaylistFromFairu([{ uuid: 'uuid-1', title: 'Video 1' }]);
    expect(playlist).toHaveLength(1);
    expect(playlist[0].src).toContain('video.mp4');
  });

  it('converts multiple video tracks', () => {
    const playlist = createVideoPlaylistFromFairu([
      { uuid: 'uuid-1', title: 'Video 1', version: 'low' },
      { uuid: 'uuid-2', title: 'Video 2', version: 'high' },
    ]);
    expect(playlist).toHaveLength(2);
    expect(playlist[0].src).toContain('version=low');
    expect(playlist[1].src).toContain('version=high');
  });

  it('applies shared options to all video tracks', () => {
    const playlist = createVideoPlaylistFromFairu(
      [{ uuid: 'uuid-1' }, { uuid: 'uuid-2' }],
      { baseUrl: CUSTOM_BASE }
    );
    expect(playlist[0].src).toContain(CUSTOM_BASE);
    expect(playlist[1].src).toContain(CUSTOM_BASE);
  });
});

describe('createFairuMarkers', () => {
  it('adds previewImage to markers without one', () => {
    const markers = createFairuMarkers(TEST_UUID, [
      { id: '1', time: 30, title: 'Intro' },
    ]);

    expect(markers[0].previewImage).toBeDefined();
    expect(markers[0].previewImage).toContain(`/${TEST_UUID}/thumbnail.jpg`);
  });

  it('preserves existing previewImage on markers', () => {
    const existingImage = 'https://example.com/custom-thumb.jpg';
    const markers = createFairuMarkers(TEST_UUID, [
      { id: '1', time: 30, title: 'Intro', previewImage: existingImage },
    ]);

    expect(markers[0].previewImage).toBe(existingImage);
  });

  it('uses default thumbnail options (160x90 webp quality 80)', () => {
    const markers = createFairuMarkers(TEST_UUID, [
      { id: '1', time: 10 },
    ]);

    expect(markers[0].previewImage).toContain('width=160');
    expect(markers[0].previewImage).toContain('height=90');
    expect(markers[0].previewImage).toContain('format=webp');
    expect(markers[0].previewImage).toContain('quality=80');
  });

  it('allows overriding default thumbnail options', () => {
    const markers = createFairuMarkers(
      TEST_UUID,
      [{ id: '1', time: 10 }],
      { width: 320, height: 180, format: 'jpg', quality: 95 }
    );

    expect(markers[0].previewImage).toContain('width=320');
    expect(markers[0].previewImage).toContain('height=180');
    expect(markers[0].previewImage).toContain('format=jpg');
    expect(markers[0].previewImage).toContain('quality=95');
  });

  it('converts marker time to correct timestamp in URL', () => {
    const markers = createFairuMarkers(TEST_UUID, [
      { id: '1', time: 90 },
    ]);

    // 90 seconds = 00:01:30.000, URL-encoded colon is %3A
    expect(markers[0].previewImage).toContain('timestamp=00%3A01%3A30.000');
  });

  it('handles multiple markers with mixed previewImage presence', () => {
    const markers = createFairuMarkers(TEST_UUID, [
      { id: '1', time: 0, title: 'Start' },
      { id: '2', time: 30, title: 'Middle', previewImage: 'https://custom.com/thumb.jpg' },
      { id: '3', time: 60, title: 'End' },
    ]);

    expect(markers[0].previewImage).toContain('thumbnail.jpg');
    expect(markers[1].previewImage).toBe('https://custom.com/thumb.jpg');
    expect(markers[2].previewImage).toContain('thumbnail.jpg');
  });

  it('returns empty array for empty markers input', () => {
    const markers = createFairuMarkers(TEST_UUID, []);
    expect(markers).toEqual([]);
  });

  it('preserves all original marker properties', () => {
    const markers = createFairuMarkers(TEST_UUID, [
      { id: 'marker-1', time: 15, title: 'Chapter 1', color: '#ff0000' },
    ]);

    expect(markers[0].id).toBe('marker-1');
    expect(markers[0].time).toBe(15);
    expect(markers[0].title).toBe('Chapter 1');
    expect(markers[0].color).toBe('#ff0000');
  });

  it('does not mutate the original markers array', () => {
    const original = [{ id: '1', time: 10 }];
    const result = createFairuMarkers(TEST_UUID, original);

    expect(result).not.toBe(original);
    expect(original[0]).not.toHaveProperty('previewImage');
  });
});
