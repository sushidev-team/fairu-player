import { describe, it, expect } from 'vitest';
import { parseDataAttributes, parseUrlParams } from './parseConfig';

/**
 * Helper to create an HTMLElement with the given data attributes
 */
function createElement(dataAttributes: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('div');
  for (const [key, value] of Object.entries(dataAttributes)) {
    el.dataset[key] = value;
  }
  return el;
}

describe('parseDataAttributes', () => {
  describe('track parsing', () => {
    it('parses a track when data-src is present', () => {
      const el = createElement({ src: 'https://example.com/audio.mp3' });
      const config = parseDataAttributes(el);

      expect(config.player.track).toBeDefined();
      expect(config.player.track!.src).toBe('https://example.com/audio.mp3');
    });

    it('returns undefined track when data-src is missing', () => {
      const el = createElement({});
      const config = parseDataAttributes(el);

      expect(config.player.track).toBeUndefined();
    });

    it('uses data-id for track id when present', () => {
      const el = createElement({ src: 'audio.mp3', id: 'my-track-id' });
      const config = parseDataAttributes(el);

      expect(config.player.track!.id).toBe('my-track-id');
    });

    it('generates an id when data-id is missing', () => {
      const el = createElement({ src: 'audio.mp3' });
      const config = parseDataAttributes(el);

      expect(config.player.track!.id).toBeDefined();
      expect(config.player.track!.id).toContain('track-');
    });

    it('parses title from data-title', () => {
      const el = createElement({ src: 'audio.mp3', title: 'My Song' });
      const config = parseDataAttributes(el);

      expect(config.player.track!.title).toBe('My Song');
    });

    it('parses artist from data-artist', () => {
      const el = createElement({ src: 'audio.mp3', artist: 'Artist Name' });
      const config = parseDataAttributes(el);

      expect(config.player.track!.artist).toBe('Artist Name');
    });

    it('parses artwork from data-artwork', () => {
      const el = createElement({ src: 'audio.mp3', artwork: 'https://example.com/cover.jpg' });
      const config = parseDataAttributes(el);

      expect(config.player.track!.artwork).toBe('https://example.com/cover.jpg');
    });

    it('parses duration as a float', () => {
      const el = createElement({ src: 'audio.mp3', duration: '180.5' });
      const config = parseDataAttributes(el);

      expect(config.player.track!.duration).toBe(180.5);
    });

    it('returns undefined duration when not provided', () => {
      const el = createElement({ src: 'audio.mp3' });
      const config = parseDataAttributes(el);

      expect(config.player.track!.duration).toBeUndefined();
    });

    it('parses chapters from JSON data-chapters', () => {
      const chapters = [{ id: '1', title: 'Intro', startTime: 0 }];
      const el = createElement({ src: 'audio.mp3', chapters: JSON.stringify(chapters) });
      const config = parseDataAttributes(el);

      expect(config.player.track!.chapters).toEqual(chapters);
    });

    it('returns undefined chapters when not provided', () => {
      const el = createElement({ src: 'audio.mp3' });
      const config = parseDataAttributes(el);

      expect(config.player.track!.chapters).toBeUndefined();
    });
  });

  describe('playlist parsing', () => {
    it('parses playlist from JSON data-playlist', () => {
      const playlist = [
        { id: '1', src: 'track1.mp3', title: 'Track 1' },
        { id: '2', src: 'track2.mp3', title: 'Track 2' },
      ];
      const el = createElement({ playlist: JSON.stringify(playlist) });
      const config = parseDataAttributes(el);

      expect(config.player.playlist).toEqual(playlist);
    });

    it('returns undefined playlist when not provided', () => {
      const el = createElement({});
      const config = parseDataAttributes(el);

      expect(config.player.playlist).toBeUndefined();
    });
  });

  describe('features parsing', () => {
    it('defaults all features to true when not specified', () => {
      const el = createElement({});
      const config = parseDataAttributes(el);

      expect(config.player.features).toEqual({
        chapters: true,
        volumeControl: true,
        playbackSpeed: true,
        skipButtons: true,
        progressBar: true,
        timeDisplay: true,
        playlistView: true,
      });
    });

    it('disables chapters when data-chapters is "false"', () => {
      const el = createElement({ chapters: 'false' });
      const config = parseDataAttributes(el);

      expect(config.player.features!.chapters).toBe(false);
    });

    it('disables volume control when data-volume is "false"', () => {
      const el = createElement({ volume: 'false' });
      const config = parseDataAttributes(el);

      expect(config.player.features!.volumeControl).toBe(false);
    });

    it('disables playback speed when data-speed is "false"', () => {
      const el = createElement({ speed: 'false' });
      const config = parseDataAttributes(el);

      expect(config.player.features!.playbackSpeed).toBe(false);
    });

    it('disables skip buttons when data-skip is "false"', () => {
      const el = createElement({ skip: 'false' });
      const config = parseDataAttributes(el);

      expect(config.player.features!.skipButtons).toBe(false);
    });

    it('disables progress bar when data-progress is "false"', () => {
      const el = createElement({ progress: 'false' });
      const config = parseDataAttributes(el);

      expect(config.player.features!.progressBar).toBe(false);
    });

    it('disables time display when data-time is "false"', () => {
      const el = createElement({ time: 'false' });
      const config = parseDataAttributes(el);

      expect(config.player.features!.timeDisplay).toBe(false);
    });

    it('disables playlist view when data-playlist-view is "false"', () => {
      const el = createElement({ playlistView: 'false' });
      const config = parseDataAttributes(el);

      expect(config.player.features!.playlistView).toBe(false);
    });

    it('keeps features true for any value other than "false"', () => {
      const el = createElement({
        volume: 'true',
        speed: 'yes',
        skip: '1',
        progress: 'on',
      });
      const config = parseDataAttributes(el);

      expect(config.player.features!.volumeControl).toBe(true);
      expect(config.player.features!.playbackSpeed).toBe(true);
      expect(config.player.features!.skipButtons).toBe(true);
      expect(config.player.features!.progressBar).toBe(true);
    });
  });

  describe('player config parsing', () => {
    it('defaults autoPlayNext to true', () => {
      const el = createElement({});
      const config = parseDataAttributes(el);

      expect(config.player.autoPlayNext).toBe(true);
    });

    it('disables autoPlayNext when data-auto-play-next is "false"', () => {
      const el = createElement({ autoPlayNext: 'false' });
      const config = parseDataAttributes(el);

      expect(config.player.autoPlayNext).toBe(false);
    });

    it('defaults shuffle to false', () => {
      const el = createElement({});
      const config = parseDataAttributes(el);

      expect(config.player.shuffle).toBe(false);
    });

    it('enables shuffle when data-shuffle is "true"', () => {
      const el = createElement({ shuffle: 'true' });
      const config = parseDataAttributes(el);

      expect(config.player.shuffle).toBe(true);
    });

    it('does not enable shuffle for value other than "true"', () => {
      const el = createElement({ shuffle: 'yes' });
      const config = parseDataAttributes(el);

      expect(config.player.shuffle).toBe(false);
    });

    it('defaults repeat to "none"', () => {
      const el = createElement({});
      const config = parseDataAttributes(el);

      expect(config.player.repeat).toBe('none');
    });

    it('parses repeat mode "one"', () => {
      const el = createElement({ repeat: 'one' });
      const config = parseDataAttributes(el);

      expect(config.player.repeat).toBe('one');
    });

    it('parses repeat mode "all"', () => {
      const el = createElement({ repeat: 'all' });
      const config = parseDataAttributes(el);

      expect(config.player.repeat).toBe('all');
    });

    it('defaults skipForwardSeconds to 30', () => {
      const el = createElement({});
      const config = parseDataAttributes(el);

      expect(config.player.skipForwardSeconds).toBe(30);
    });

    it('parses custom skipForward value', () => {
      const el = createElement({ skipForward: '15' });
      const config = parseDataAttributes(el);

      expect(config.player.skipForwardSeconds).toBe(15);
    });

    it('defaults skipBackwardSeconds to 10', () => {
      const el = createElement({});
      const config = parseDataAttributes(el);

      expect(config.player.skipBackwardSeconds).toBe(10);
    });

    it('parses custom skipBackward value', () => {
      const el = createElement({ skipBackward: '5' });
      const config = parseDataAttributes(el);

      expect(config.player.skipBackwardSeconds).toBe(5);
    });

    it('parses playbackSpeeds from JSON', () => {
      const speeds = [0.5, 1, 1.5, 2];
      const el = createElement({ speeds: JSON.stringify(speeds) });
      const config = parseDataAttributes(el);

      expect(config.player.playbackSpeeds).toEqual(speeds);
    });

    it('returns undefined playbackSpeeds when not provided', () => {
      const el = createElement({});
      const config = parseDataAttributes(el);

      expect(config.player.playbackSpeeds).toBeUndefined();
    });

    it('defaults volume to 1', () => {
      const el = createElement({});
      const config = parseDataAttributes(el);

      expect(config.player.volume).toBe(1);
    });

    it('parses custom initialVolume', () => {
      const el = createElement({ initialVolume: '0.5' });
      const config = parseDataAttributes(el);

      expect(config.player.volume).toBe(0.5);
    });

    it('defaults muted to false', () => {
      const el = createElement({});
      const config = parseDataAttributes(el);

      expect(config.player.muted).toBe(false);
    });

    it('enables muted when data-muted is "true"', () => {
      const el = createElement({ muted: 'true' });
      const config = parseDataAttributes(el);

      expect(config.player.muted).toBe(true);
    });

    it('defaults autoPlay to false', () => {
      const el = createElement({});
      const config = parseDataAttributes(el);

      expect(config.player.autoPlay).toBe(false);
    });

    it('enables autoPlay when data-auto-play is "true"', () => {
      const el = createElement({ autoPlay: 'true' });
      const config = parseDataAttributes(el);

      expect(config.player.autoPlay).toBe(true);
    });
  });

  describe('tracking config parsing', () => {
    it('returns undefined tracking when data-tracking-endpoint is missing', () => {
      const el = createElement({});
      const config = parseDataAttributes(el);

      expect(config.tracking).toBeUndefined();
    });

    it('parses tracking config when endpoint is provided', () => {
      const el = createElement({ trackingEndpoint: 'https://analytics.example.com/track' });
      const config = parseDataAttributes(el);

      expect(config.tracking).toBeDefined();
      expect(config.tracking!.endpoint).toBe('https://analytics.example.com/track');
      expect(config.tracking!.enabled).toBe(true);
    });

    it('disables tracking when data-tracking-enabled is "false"', () => {
      const el = createElement({
        trackingEndpoint: 'https://analytics.example.com/track',
        trackingEnabled: 'false',
      });
      const config = parseDataAttributes(el);

      expect(config.tracking!.enabled).toBe(false);
    });
  });

  describe('theme parsing', () => {
    it('defaults theme to "light"', () => {
      const el = createElement({});
      const config = parseDataAttributes(el);

      expect(config.theme).toBe('light');
    });

    it('parses theme "dark"', () => {
      const el = createElement({ theme: 'dark' });
      const config = parseDataAttributes(el);

      expect(config.theme).toBe('dark');
    });

    it('parses theme "high-contrast"', () => {
      const el = createElement({ theme: 'high-contrast' });
      const config = parseDataAttributes(el);

      expect(config.theme).toBe('high-contrast');
    });

    it('parses theme "auto"', () => {
      const el = createElement({ theme: 'auto' });
      const config = parseDataAttributes(el);

      expect(config.theme).toBe('auto');
    });
  });

  describe('container parsing', () => {
    it('returns undefined container when not specified', () => {
      const el = createElement({});
      const config = parseDataAttributes(el);

      expect(config.container).toBeUndefined();
    });

    it('parses container selector', () => {
      const el = createElement({ container: '#player-root' });
      const config = parseDataAttributes(el);

      expect(config.container).toBe('#player-root');
    });
  });

  describe('full config parsing', () => {
    it('parses a complete configuration', () => {
      const el = createElement({
        src: 'https://example.com/song.mp3',
        id: 'song-1',
        title: 'Test Song',
        artist: 'Test Artist',
        artwork: 'https://example.com/art.jpg',
        duration: '240',
        volume: 'false',
        shuffle: 'true',
        repeat: 'all',
        autoPlay: 'true',
        muted: 'true',
        initialVolume: '0.8',
        theme: 'dark',
        container: '#app',
        trackingEndpoint: 'https://track.example.com',
      });

      const config = parseDataAttributes(el);

      expect(config.player.track!.src).toBe('https://example.com/song.mp3');
      expect(config.player.track!.id).toBe('song-1');
      expect(config.player.track!.title).toBe('Test Song');
      expect(config.player.features!.volumeControl).toBe(false);
      expect(config.player.shuffle).toBe(true);
      expect(config.player.repeat).toBe('all');
      expect(config.player.autoPlay).toBe(true);
      expect(config.player.muted).toBe(true);
      expect(config.player.volume).toBe(0.8);
      expect(config.theme).toBe('dark');
      expect(config.container).toBe('#app');
      expect(config.tracking!.endpoint).toBe('https://track.example.com');
    });
  });
});

describe('parseUrlParams', () => {
  const baseUrl = 'https://embed.example.com/player';

  describe('track parsing', () => {
    it('parses a track when src param is present', () => {
      const config = parseUrlParams(`${baseUrl}?src=https://example.com/audio.mp3`);

      expect(config.player.track).toBeDefined();
      expect(config.player.track!.src).toBe('https://example.com/audio.mp3');
    });

    it('returns undefined track when src param is missing', () => {
      const config = parseUrlParams(`${baseUrl}?title=Test`);

      expect(config.player.track).toBeUndefined();
    });

    it('uses id param for track id when present', () => {
      const config = parseUrlParams(`${baseUrl}?src=audio.mp3&id=my-id`);

      expect(config.player.track!.id).toBe('my-id');
    });

    it('generates an id when id param is missing', () => {
      const config = parseUrlParams(`${baseUrl}?src=audio.mp3`);

      expect(config.player.track!.id).toBeDefined();
      expect(config.player.track!.id).toContain('track-');
    });

    it('parses title param', () => {
      const config = parseUrlParams(`${baseUrl}?src=audio.mp3&title=My+Song`);

      expect(config.player.track!.title).toBe('My Song');
    });

    it('returns undefined title when not provided', () => {
      const config = parseUrlParams(`${baseUrl}?src=audio.mp3`);

      expect(config.player.track!.title).toBeUndefined();
    });

    it('parses artist param', () => {
      const config = parseUrlParams(`${baseUrl}?src=audio.mp3&artist=The+Band`);

      expect(config.player.track!.artist).toBe('The Band');
    });

    it('parses artwork param', () => {
      const config = parseUrlParams(`${baseUrl}?src=audio.mp3&artwork=https://img.example.com/cover.jpg`);

      expect(config.player.track!.artwork).toBe('https://img.example.com/cover.jpg');
    });

    it('parses duration as float', () => {
      const config = parseUrlParams(`${baseUrl}?src=audio.mp3&duration=245.5`);

      expect(config.player.track!.duration).toBe(245.5);
    });

    it('returns undefined duration when not provided', () => {
      const config = parseUrlParams(`${baseUrl}?src=audio.mp3`);

      expect(config.player.track!.duration).toBeUndefined();
    });
  });

  describe('playlist parsing', () => {
    it('parses playlist from encoded JSON param', () => {
      const playlist = [
        { id: '1', src: 'track1.mp3', title: 'Track 1' },
        { id: '2', src: 'track2.mp3', title: 'Track 2' },
      ];
      const encoded = encodeURIComponent(JSON.stringify(playlist));
      const config = parseUrlParams(`${baseUrl}?playlist=${encoded}`);

      expect(config.player.playlist).toEqual(playlist);
    });

    it('returns undefined playlist when not provided', () => {
      const config = parseUrlParams(baseUrl);

      expect(config.player.playlist).toBeUndefined();
    });
  });

  describe('features parsing', () => {
    it('defaults all features to true when not specified', () => {
      const config = parseUrlParams(baseUrl);

      expect(config.player.features).toEqual({
        chapters: true,
        volumeControl: true,
        playbackSpeed: true,
        skipButtons: true,
        progressBar: true,
        timeDisplay: true,
        playlistView: true,
      });
    });

    it('disables chapters when chapters=false', () => {
      const config = parseUrlParams(`${baseUrl}?chapters=false`);

      expect(config.player.features!.chapters).toBe(false);
    });

    it('disables volume when volume=false', () => {
      const config = parseUrlParams(`${baseUrl}?volume=false`);

      expect(config.player.features!.volumeControl).toBe(false);
    });

    it('disables speed when speed=false', () => {
      const config = parseUrlParams(`${baseUrl}?speed=false`);

      expect(config.player.features!.playbackSpeed).toBe(false);
    });

    it('disables skip when skip=false', () => {
      const config = parseUrlParams(`${baseUrl}?skip=false`);

      expect(config.player.features!.skipButtons).toBe(false);
    });

    it('disables progress when progress=false', () => {
      const config = parseUrlParams(`${baseUrl}?progress=false`);

      expect(config.player.features!.progressBar).toBe(false);
    });

    it('disables time when time=false', () => {
      const config = parseUrlParams(`${baseUrl}?time=false`);

      expect(config.player.features!.timeDisplay).toBe(false);
    });

    it('disables playlistView when playlistView=false', () => {
      const config = parseUrlParams(`${baseUrl}?playlistView=false`);

      expect(config.player.features!.playlistView).toBe(false);
    });

    it('keeps features true for any value other than "false"', () => {
      const config = parseUrlParams(`${baseUrl}?volume=true&speed=yes&skip=1`);

      expect(config.player.features!.volumeControl).toBe(true);
      expect(config.player.features!.playbackSpeed).toBe(true);
      expect(config.player.features!.skipButtons).toBe(true);
    });
  });

  describe('player config parsing', () => {
    it('defaults autoPlayNext to true', () => {
      const config = parseUrlParams(baseUrl);

      expect(config.player.autoPlayNext).toBe(true);
    });

    it('disables autoPlayNext when autoPlayNext=false', () => {
      const config = parseUrlParams(`${baseUrl}?autoPlayNext=false`);

      expect(config.player.autoPlayNext).toBe(false);
    });

    it('defaults shuffle to false', () => {
      const config = parseUrlParams(baseUrl);

      expect(config.player.shuffle).toBe(false);
    });

    it('enables shuffle when shuffle=true', () => {
      const config = parseUrlParams(`${baseUrl}?shuffle=true`);

      expect(config.player.shuffle).toBe(true);
    });

    it('defaults repeat to "none"', () => {
      const config = parseUrlParams(baseUrl);

      expect(config.player.repeat).toBe('none');
    });

    it('parses repeat=one', () => {
      const config = parseUrlParams(`${baseUrl}?repeat=one`);

      expect(config.player.repeat).toBe('one');
    });

    it('parses repeat=all', () => {
      const config = parseUrlParams(`${baseUrl}?repeat=all`);

      expect(config.player.repeat).toBe('all');
    });

    it('defaults skipForwardSeconds to 30', () => {
      const config = parseUrlParams(baseUrl);

      expect(config.player.skipForwardSeconds).toBe(30);
    });

    it('parses custom skipForward', () => {
      const config = parseUrlParams(`${baseUrl}?skipForward=15`);

      expect(config.player.skipForwardSeconds).toBe(15);
    });

    it('defaults skipBackwardSeconds to 10', () => {
      const config = parseUrlParams(baseUrl);

      expect(config.player.skipBackwardSeconds).toBe(10);
    });

    it('parses custom skipBackward', () => {
      const config = parseUrlParams(`${baseUrl}?skipBackward=5`);

      expect(config.player.skipBackwardSeconds).toBe(5);
    });

    it('defaults volume to 1', () => {
      const config = parseUrlParams(baseUrl);

      expect(config.player.volume).toBe(1);
    });

    it('parses custom initialVolume', () => {
      const config = parseUrlParams(`${baseUrl}?initialVolume=0.7`);

      expect(config.player.volume).toBe(0.7);
    });

    it('defaults muted to false', () => {
      const config = parseUrlParams(baseUrl);

      expect(config.player.muted).toBe(false);
    });

    it('enables muted when muted=true', () => {
      const config = parseUrlParams(`${baseUrl}?muted=true`);

      expect(config.player.muted).toBe(true);
    });

    it('defaults autoPlay to false', () => {
      const config = parseUrlParams(baseUrl);

      expect(config.player.autoPlay).toBe(false);
    });

    it('enables autoPlay when autoPlay=true', () => {
      const config = parseUrlParams(`${baseUrl}?autoPlay=true`);

      expect(config.player.autoPlay).toBe(true);
    });
  });

  describe('theme parsing', () => {
    it('defaults theme to "light"', () => {
      const config = parseUrlParams(baseUrl);

      expect(config.theme).toBe('light');
    });

    it('parses theme=dark', () => {
      const config = parseUrlParams(`${baseUrl}?theme=dark`);

      expect(config.theme).toBe('dark');
    });

    it('parses theme=high-contrast', () => {
      const config = parseUrlParams(`${baseUrl}?theme=high-contrast`);

      expect(config.theme).toBe('high-contrast');
    });

    it('parses theme=auto', () => {
      const config = parseUrlParams(`${baseUrl}?theme=auto`);

      expect(config.theme).toBe('auto');
    });
  });

  describe('tracking', () => {
    it('does not include tracking in URL params config', () => {
      const config = parseUrlParams(baseUrl);

      expect(config.tracking).toBeUndefined();
    });
  });

  describe('container', () => {
    it('does not include container in URL params config', () => {
      const config = parseUrlParams(baseUrl);

      expect(config.container).toBeUndefined();
    });
  });

  describe('full config parsing', () => {
    it('parses a complete URL configuration', () => {
      const params = new URLSearchParams({
        src: 'https://example.com/song.mp3',
        id: 'song-1',
        title: 'Test Song',
        artist: 'Test Artist',
        artwork: 'https://example.com/art.jpg',
        duration: '240',
        volume: 'false',
        shuffle: 'true',
        repeat: 'all',
        autoPlay: 'true',
        muted: 'true',
        initialVolume: '0.8',
        theme: 'dark',
      });

      const config = parseUrlParams(`${baseUrl}?${params.toString()}`);

      expect(config.player.track!.src).toBe('https://example.com/song.mp3');
      expect(config.player.track!.id).toBe('song-1');
      expect(config.player.track!.title).toBe('Test Song');
      expect(config.player.track!.artist).toBe('Test Artist');
      expect(config.player.features!.volumeControl).toBe(false);
      expect(config.player.shuffle).toBe(true);
      expect(config.player.repeat).toBe('all');
      expect(config.player.autoPlay).toBe(true);
      expect(config.player.muted).toBe(true);
      expect(config.player.volume).toBe(0.8);
      expect(config.theme).toBe('dark');
    });
  });

  describe('edge cases', () => {
    it('handles URL with no search params', () => {
      const config = parseUrlParams(baseUrl);

      expect(config.player.track).toBeUndefined();
      expect(config.player.playlist).toBeUndefined();
      expect(config.player.shuffle).toBe(false);
      expect(config.player.repeat).toBe('none');
      expect(config.theme).toBe('light');
    });

    it('handles URL with empty string values', () => {
      const config = parseUrlParams(`${baseUrl}?src=audio.mp3&title=&artist=`);

      // empty string is falsy, so title/artist become undefined
      expect(config.player.track!.title).toBeUndefined();
      expect(config.player.track!.artist).toBeUndefined();
    });
  });
});
