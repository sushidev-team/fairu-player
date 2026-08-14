/**
 * The published surface of `@fairu/player`.
 *
 * Everything listed here is something a consumer can already be importing, so
 * removing or renaming one is a breaking change. Pinning the list means that
 * happens on purpose — a barrel re-export is easy to drop by accident during a
 * refactor, and `tsc` cannot catch it because nothing inside the repo depends
 * on the barrel.
 *
 * Adding an export is expected and only needs the name added below.
 */

import { describe, it, expect } from 'vitest';
import * as api from './index';

/** Present before this branch. Removing one breaks an existing consumer. */
const ESTABLISHED_EXPORTS = [
  // Components
  'Player',
  'AudioPlayer',
  'VideoPlayer',
  // Providers
  'PlayerProvider',
  'VideoProvider',
  'AdProvider',
  'TrackingProvider',
  'OverlayAdProvider',
  // Hooks
  'usePlayer',
  'useVideoPlayer',
  'useMedia',
  'useAudio',
  'useVideo',
  'useHLS',
  'useFullscreen',
  'usePictureInPicture',
  'useCast',
  'usePlaylist',
  'useChapters',
  'useMarkers',
  'useKeyboardControls',
  'useTabVisibility',
  'useAds',
  'useVideoAds',
  // Utils
  'formatTime',
  'formatDuration',
  'parseTime',
  'calculatePercentage',
  'cn',
  'isHLSSource',
  'supportsNativeHLS',
  // Fairu helpers
  'getFairuAudioUrl',
  'getFairuVideoUrl',
  'getFairuHlsUrl',
  'getFairuCoverUrl',
  'getFairuThumbnailUrl',
  'createTrackFromFairu',
  'createVideoTrackFromFairu',
  'createPlaylistFromFairu',
  'createVideoPlaylistFromFairu',
  // Event buses
  'createAdEventBus',
  'getGlobalAdEventBus',
  'resetGlobalAdEventBus',
  'createPlayerEventBus',
  'getGlobalPlayerEventBus',
  'resetGlobalPlayerEventBus',
];

/** Added on this branch. */
const NEW_EXPORTS = [
  'useMediaSession',
  'isMediaSessionSupported',
  'usePersistentPreferences',
  'useResumePosition',
  'isStorageAvailable',
  'readStored',
  'writeStored',
  'removeStored',
  'clearStored',
];

describe('public API', () => {
  describe('established exports still exist', () => {
    it.each(ESTABLISHED_EXPORTS)('exports %s', (name) => {
      expect(api).toHaveProperty(name);
      expect(api[name as keyof typeof api]).toBeDefined();
    });
  });

  describe('new exports', () => {
    it.each(NEW_EXPORTS)('exports %s', (name) => {
      expect(api).toHaveProperty(name);
      expect(api[name as keyof typeof api]).toBeDefined();
    });
  });

  it('exports nothing undefined', () => {
    // A broken re-export chain shows up as a defined key holding `undefined`,
    // which a `toHaveProperty` check alone would not catch.
    const broken = Object.entries(api)
      .filter(([, value]) => value === undefined)
      .map(([name]) => name);

    expect(broken).toEqual([]);
  });

  it('keeps the new hooks callable as plain functions', () => {
    // Guards against a hook accidentally being exported as a type-only symbol.
    expect(typeof api.useMediaSession).toBe('function');
    expect(typeof api.usePersistentPreferences).toBe('function');
    expect(typeof api.useResumePosition).toBe('function');
    expect(typeof api.isMediaSessionSupported).toBe('function');
  });
});
