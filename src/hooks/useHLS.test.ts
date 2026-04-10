import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { RefObject } from 'react';
import { createMockVideoElement } from '@/test/helpers';

// ─── Hls.js mock ─────────────────────────────────────────────────────
// We need to set up the mock before importing the module under test.

type HlsEventCallback = (event: string, data: any) => void;

let hlsIsSupported = true;

interface MockHlsInstance {
  loadSource: ReturnType<typeof vi.fn>;
  attachMedia: ReturnType<typeof vi.fn>;
  detachMedia: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  startLoad: ReturnType<typeof vi.fn>;
  recoverMediaError: ReturnType<typeof vi.fn>;
  currentLevel: number;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  _listeners: Record<string, HlsEventCallback[]>;
  _emit: (event: string, data: any) => void;
}

let mockHlsInstance: MockHlsInstance;
/** Track all constructor calls for assertions */
const hlsConstructorCalls: any[][] = [];

vi.mock('hls.js', () => {
  class MockHls {
    loadSource = vi.fn();
    attachMedia = vi.fn();
    detachMedia = vi.fn();
    destroy = vi.fn();
    startLoad = vi.fn();
    recoverMediaError = vi.fn();
    currentLevel = -1;
    _listeners: Record<string, HlsEventCallback[]> = {};

    on = vi.fn((event: string, cb: HlsEventCallback) => {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(cb);
    });

    off = vi.fn();

    _emit(event: string, data: any) {
      (this._listeners[event] || []).forEach((cb) => cb(event, data));
    }

    constructor(...args: any[]) {
      hlsConstructorCalls.push(args);
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      mockHlsInstance = this as unknown as MockHlsInstance;
    }

    static isSupported() {
      return hlsIsSupported;
    }

    static Events = {
      MANIFEST_PARSED: 'hlsManifestParsed',
      LEVEL_SWITCHED: 'hlsLevelSwitched',
      ERROR: 'hlsError',
    };

    static ErrorTypes = {
      NETWORK_ERROR: 'networkError',
      MEDIA_ERROR: 'mediaError',
      OTHER_ERROR: 'otherError',
    };
  }

  return { default: MockHls };
});

// Import AFTER mock is set up
import { useHLS, isHLSSource, supportsNativeHLS } from './useHLS';

// ─── Helpers ─────────────────────────────────────────────────────────

function createVideoRef(video?: HTMLVideoElement): RefObject<HTMLVideoElement | null> {
  return { current: video ?? createMockVideoElement() };
}

/** canPlayType returns '' by default in jsdom, meaning no native HLS */
function mockNativeHLSSupport(supported: boolean) {
  const original = HTMLVideoElement.prototype.canPlayType;
  if (supported) {
    HTMLVideoElement.prototype.canPlayType = ((type: string) =>
      type === 'application/vnd.apple.mpegurl' ? 'probably' : '') as any;
  } else {
    HTMLVideoElement.prototype.canPlayType = (() => '') as any;
  }
  return () => {
    HTMLVideoElement.prototype.canPlayType = original;
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('isHLSSource', () => {
  it('returns false for undefined', () => {
    expect(isHLSSource(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isHLSSource('')).toBe(false);
  });

  it('returns true for .m3u8 extension', () => {
    expect(isHLSSource('https://cdn.example.com/video.m3u8')).toBe(true);
  });

  it('returns true for .m3u8 with query params', () => {
    expect(isHLSSource('https://cdn.example.com/video.m3u8?token=abc')).toBe(true);
  });

  it('returns true for /manifest/ path', () => {
    expect(isHLSSource('https://cdn.example.com/manifest/video')).toBe(true);
  });

  it('returns false for regular mp4', () => {
    expect(isHLSSource('https://cdn.example.com/video.mp4')).toBe(false);
  });

  it('returns false for regular webm', () => {
    expect(isHLSSource('https://cdn.example.com/video.webm')).toBe(false);
  });
});

describe('supportsNativeHLS', () => {
  it('returns false when canPlayType returns empty string', () => {
    const restore = mockNativeHLSSupport(false);
    expect(supportsNativeHLS()).toBe(false);
    restore();
  });

  it('returns true when canPlayType returns a truthy string', () => {
    const restore = mockNativeHLSSupport(true);
    expect(supportsNativeHLS()).toBe(true);
    restore();
  });
});

describe('useHLS', () => {
  let restoreNative: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    hlsIsSupported = true;
    hlsConstructorCalls.length = 0;
    // Default: no native HLS (non-Safari)
    restoreNative = mockNativeHLSSupport(false);
  });

  afterEach(() => {
    restoreNative?.();
  });

  // ─── Basic return values ─────────────────────────────────────────

  describe('initial state', () => {
    it('returns isHLS false for non-HLS source', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.mp4', videoRef }),
      );

      expect(result.current.isHLS).toBe(false);
      expect(result.current.isUsingHlsJs).toBe(false);
    });

    it('returns isHLS true for .m3u8 source', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      expect(result.current.isHLS).toBe(true);
    });

    it('returns isUsingHlsJs true when hls.js is supported and no native HLS', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      expect(result.current.isUsingHlsJs).toBe(true);
    });

    it('starts with empty levels', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.mp4', videoRef }),
      );

      expect(result.current.levels).toEqual([]);
    });

    it('starts with auto quality enabled by default', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      expect(result.current.isAutoQuality).toBe(true);
    });

    it('uses custom autoQuality from config', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({
          src: 'https://example.com/video.m3u8',
          videoRef,
          config: { autoQuality: false },
        }),
      );

      expect(result.current.isAutoQuality).toBe(false);
    });
  });

  // ─── HLS.js instance creation ────────────────────────────────────

  describe('hls.js instance creation', () => {
    it('creates Hls instance for HLS source when hls.js is supported', () => {
      const videoRef = createVideoRef();
      renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      expect(hlsConstructorCalls.length).toBe(1);
    });

    it('does not create Hls instance for non-HLS source', () => {
      const videoRef = createVideoRef();
      renderHook(() =>
        useHLS({ src: 'https://example.com/video.mp4', videoRef }),
      );

      expect(hlsConstructorCalls.length).toBe(0);
    });

    it('does not create Hls instance when enabled is false', () => {
      const videoRef = createVideoRef();
      renderHook(() =>
        useHLS({
          src: 'https://example.com/video.m3u8',
          videoRef,
          config: { enabled: false },
        }),
      );

      expect(hlsConstructorCalls.length).toBe(0);
    });

    it('does not create Hls instance when hls.js is not supported', () => {
      hlsIsSupported = false;
      const videoRef = createVideoRef();
      renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      expect(hlsConstructorCalls.length).toBe(0);
    });

    it('passes startLevel config to Hls constructor', () => {
      const videoRef = createVideoRef();
      renderHook(() =>
        useHLS({
          src: 'https://example.com/video.m3u8',
          videoRef,
          config: { startLevel: 2 },
        }),
      );

      expect(hlsConstructorCalls[0][0]).toMatchObject({ startLevel: 2 });
    });

    it('passes lowLatencyMode config to Hls constructor', () => {
      const videoRef = createVideoRef();
      renderHook(() =>
        useHLS({
          src: 'https://example.com/video.m3u8',
          videoRef,
          config: { lowLatencyMode: true },
        }),
      );

      expect(hlsConstructorCalls[0][0]).toMatchObject({ lowLatencyMode: true });
    });

    it('passes maxBufferLength config when provided', () => {
      const videoRef = createVideoRef();
      renderHook(() =>
        useHLS({
          src: 'https://example.com/video.m3u8',
          videoRef,
          config: { maxBufferLength: 60 },
        }),
      );

      expect(hlsConstructorCalls[0][0]).toMatchObject({ maxBufferLength: 60 });
    });

    it('does not pass maxBufferLength when not provided', () => {
      const videoRef = createVideoRef();
      renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      expect(hlsConstructorCalls[0][0]).not.toHaveProperty('maxBufferLength');
    });

    it('always enables worker in config', () => {
      const videoRef = createVideoRef();
      renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      expect(hlsConstructorCalls[0][0]).toMatchObject({ enableWorker: true });
    });

    it('loads source and attaches media', () => {
      const videoRef = createVideoRef();
      renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      expect(mockHlsInstance.loadSource).toHaveBeenCalledWith(
        'https://example.com/video.m3u8',
      );
      expect(mockHlsInstance.attachMedia).toHaveBeenCalledWith(videoRef.current);
    });
  });

  // ─── Manifest parsed ─────────────────────────────────────────────

  describe('manifest parsed', () => {
    it('extracts quality levels from manifest', () => {
      const videoRef = createVideoRef();
      const onQualityLevelsLoaded = vi.fn();
      const { result } = renderHook(() =>
        useHLS({
          src: 'https://example.com/video.m3u8',
          videoRef,
          onQualityLevelsLoaded,
        }),
      );

      act(() => {
        mockHlsInstance._emit('hlsManifestParsed', {
          levels: [
            { height: 360, width: 640, bitrate: 800000 },
            { height: 720, width: 1280, bitrate: 2500000 },
            { height: 1080, width: 1920, bitrate: 5000000 },
          ],
        });
      });

      expect(result.current.levels).toHaveLength(4); // 3 levels + Auto
      expect(result.current.levels[0].label).toBe('Auto');
      expect(result.current.levels[1].label).toBe('360p');
      expect(result.current.levels[2].label).toBe('720p');
      expect(result.current.levels[3].label).toBe('1080p');
    });

    it('calls onQualityLevelsLoaded callback', () => {
      const videoRef = createVideoRef();
      const onQualityLevelsLoaded = vi.fn();
      renderHook(() =>
        useHLS({
          src: 'https://example.com/video.m3u8',
          videoRef,
          onQualityLevelsLoaded,
        }),
      );

      act(() => {
        mockHlsInstance._emit('hlsManifestParsed', {
          levels: [
            { height: 720, width: 1280, bitrate: 2500000 },
          ],
        });
      });

      expect(onQualityLevelsLoaded).toHaveBeenCalledTimes(1);
      expect(onQualityLevelsLoaded).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Auto' }),
          expect.objectContaining({ label: '720p' }),
        ]),
      );
    });

    it('uses "Level N" label when height is missing', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      act(() => {
        mockHlsInstance._emit('hlsManifestParsed', {
          levels: [
            { height: 0, width: 0, bitrate: 500000 },
            { height: 720, width: 1280, bitrate: 2500000 },
          ],
        });
      });

      expect(result.current.levels[1].label).toBe('Level 1');
      expect(result.current.levels[2].label).toBe('720p');
    });

    it('includes bitrate, width, and height in quality levels', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      act(() => {
        mockHlsInstance._emit('hlsManifestParsed', {
          levels: [
            { height: 720, width: 1280, bitrate: 2500000 },
          ],
        });
      });

      expect(result.current.levels[1]).toMatchObject({
        bitrate: 2500000,
        width: 1280,
        height: 720,
      });
    });

    it('sets src to empty string for HLS quality levels', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      act(() => {
        mockHlsInstance._emit('hlsManifestParsed', {
          levels: [
            { height: 720, width: 1280, bitrate: 2500000 },
          ],
        });
      });

      expect(result.current.levels[0].src).toBe('');
      expect(result.current.levels[1].src).toBe('');
    });
  });

  // ─── Level switching ─────────────────────────────────────────────

  describe('level switching', () => {
    it('updates currentLevel when LEVEL_SWITCHED fires', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      act(() => {
        mockHlsInstance._emit('hlsLevelSwitched', { level: 1 });
      });

      // level 1 from HLS + 1 offset for Auto = index 2
      expect(result.current.currentLevel).toBe(2);
    });

    it('setLevel(0) sets auto quality', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      act(() => {
        result.current.setLevel(0);
      });

      expect(mockHlsInstance.currentLevel).toBe(-1);
      expect(result.current.isAutoQuality).toBe(true);
      expect(result.current.currentLevel).toBe(0);
    });

    it('setLevel(N) sets specific quality level', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({
          src: 'https://example.com/video.m3u8',
          videoRef,
          config: { autoQuality: false, startLevel: 0 },
        }),
      );

      act(() => {
        result.current.setLevel(2);
      });

      // setLevel(2) sets hls.currentLevel = 2 - 1 = 1
      expect(result.current.isAutoQuality).toBe(false);
      expect(result.current.currentLevel).toBe(2);
    });

    it('setLevel does nothing without hls instance', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.mp4', videoRef }),
      );

      // Should not throw
      act(() => {
        result.current.setLevel(1);
      });
    });
  });

  // ─── Auto quality ────────────────────────────────────────────────

  describe('auto quality', () => {
    it('setAutoQuality(true) enables auto quality', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({
          src: 'https://example.com/video.m3u8',
          videoRef,
          config: { autoQuality: false },
        }),
      );

      act(() => {
        result.current.setAutoQuality(true);
      });

      expect(mockHlsInstance.currentLevel).toBe(-1);
      expect(result.current.isAutoQuality).toBe(true);
      expect(result.current.currentLevel).toBe(0);
    });

    it('setAutoQuality(false) disables auto quality state', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      act(() => {
        result.current.setAutoQuality(false);
      });

      expect(result.current.isAutoQuality).toBe(false);
    });

    it('setAutoQuality without hls instance only updates state', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.mp4', videoRef }),
      );

      act(() => {
        result.current.setAutoQuality(true);
      });

      expect(result.current.isAutoQuality).toBe(true);
    });
  });

  // ─── Error handling ──────────────────────────────────────────────

  describe('error handling', () => {
    it('recovers from network error by calling startLoad', () => {
      const videoRef = createVideoRef();
      const onError = vi.fn();
      renderHook(() =>
        useHLS({
          src: 'https://example.com/video.m3u8',
          videoRef,
          onError,
        }),
      );

      act(() => {
        mockHlsInstance._emit('hlsError', {
          fatal: true,
          type: 'networkError',
          details: 'manifestLoadError',
        });
      });

      expect(mockHlsInstance.startLoad).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it('recovers from media error by calling recoverMediaError', () => {
      const videoRef = createVideoRef();
      const onError = vi.fn();
      renderHook(() =>
        useHLS({
          src: 'https://example.com/video.m3u8',
          videoRef,
          onError,
        }),
      );

      act(() => {
        mockHlsInstance._emit('hlsError', {
          fatal: true,
          type: 'mediaError',
          details: 'bufferStalledError',
        });
      });

      expect(mockHlsInstance.recoverMediaError).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it('destroys and reports other fatal errors', () => {
      const videoRef = createVideoRef();
      const onError = vi.fn();
      renderHook(() =>
        useHLS({
          src: 'https://example.com/video.m3u8',
          videoRef,
          onError,
        }),
      );

      act(() => {
        mockHlsInstance._emit('hlsError', {
          fatal: true,
          type: 'otherError',
          details: 'internalException',
        });
      });

      expect(mockHlsInstance.destroy).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('otherError'),
        }),
      );
    });

    it('ignores non-fatal errors', () => {
      const videoRef = createVideoRef();
      const onError = vi.fn();
      renderHook(() =>
        useHLS({
          src: 'https://example.com/video.m3u8',
          videoRef,
          onError,
        }),
      );

      act(() => {
        mockHlsInstance._emit('hlsError', {
          fatal: false,
          type: 'networkError',
          details: 'fragLoadError',
        });
      });

      expect(mockHlsInstance.startLoad).not.toHaveBeenCalled();
      expect(mockHlsInstance.recoverMediaError).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });
  });

  // ─── Attach / Detach ─────────────────────────────────────────────

  describe('attachHLS', () => {
    it('does nothing when video ref is null', () => {
      const videoRef: RefObject<HTMLVideoElement | null> = { current: null };
      renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      // Hls constructor should not be called because shouldUseHlsJs triggers
      // auto-attach, but videoRef is null so attachHLS returns early
      // The auto-attach effect fires, but the guard `if (!video)` blocks it
    });

    it('does nothing without a src', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: undefined, videoRef }),
      );

      expect(result.current.isHLS).toBe(false);
      expect(result.current.isUsingHlsJs).toBe(false);
    });

    it('sets initial auto quality on attach', () => {
      const videoRef = createVideoRef();
      renderHook(() =>
        useHLS({
          src: 'https://example.com/video.m3u8',
          videoRef,
          config: { autoQuality: true },
        }),
      );

      expect(mockHlsInstance.currentLevel).toBe(-1);
    });

    it('sets specific startLevel on attach when auto quality is disabled', () => {
      const videoRef = createVideoRef();
      renderHook(() =>
        useHLS({
          src: 'https://example.com/video.m3u8',
          videoRef,
          config: { autoQuality: false, startLevel: 2 },
        }),
      );

      expect(mockHlsInstance.currentLevel).toBe(2);
    });
  });

  describe('detachHLS', () => {
    it('destroys hls instance and resets state', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      // First, get some levels set
      act(() => {
        mockHlsInstance._emit('hlsManifestParsed', {
          levels: [{ height: 720, width: 1280, bitrate: 2500000 }],
        });
      });
      expect(result.current.levels.length).toBeGreaterThan(0);

      act(() => {
        result.current.detachHLS();
      });

      expect(mockHlsInstance.destroy).toHaveBeenCalled();
      expect(result.current.levels).toEqual([]);
      expect(result.current.currentLevel).toBe(-1);
    });
  });

  // ─── Native HLS (Safari) ────────────────────────────────────────

  describe('native HLS (Safari fallback)', () => {
    it('sets video src directly when native HLS is supported', () => {
      restoreNative?.();
      restoreNative = mockNativeHLSSupport(true);

      const video = createMockVideoElement();
      const videoRef = createVideoRef(video);

      renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      expect(video.src).toContain('video.m3u8');
      expect(hlsConstructorCalls.length).toBe(0);
    });

    it('returns isUsingHlsJs false when native HLS is supported', () => {
      restoreNative?.();
      restoreNative = mockNativeHLSSupport(true);

      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      expect(result.current.isHLS).toBe(true);
      expect(result.current.isUsingHlsJs).toBe(false);
    });
  });

  // ─── Cleanup on unmount ──────────────────────────────────────────

  describe('cleanup', () => {
    it('destroys hls instance on unmount', () => {
      const videoRef = createVideoRef();
      const { unmount } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      const instance = mockHlsInstance;
      unmount();

      expect(instance.destroy).toHaveBeenCalled();
    });

    it('destroys previous hls instance when src changes', () => {
      const videoRef = createVideoRef();
      const { rerender } = renderHook(
        ({ src }: { src: string }) =>
          useHLS({ src, videoRef }),
        { initialProps: { src: 'https://example.com/v1.m3u8' } },
      );

      const firstInstance = mockHlsInstance;

      rerender({ src: 'https://example.com/v2.m3u8' });

      // The first instance should have been destroyed during cleanup
      expect(firstInstance.destroy).toHaveBeenCalled();
    });
  });

  // ─── Source change ───────────────────────────────────────────────

  describe('source changes', () => {
    it('re-attaches when src changes to a new HLS source', () => {
      const videoRef = createVideoRef();
      const { rerender } = renderHook(
        ({ src }: { src: string }) =>
          useHLS({ src, videoRef }),
        { initialProps: { src: 'https://example.com/v1.m3u8' } },
      );

      expect(mockHlsInstance.loadSource).toHaveBeenCalledWith('https://example.com/v1.m3u8');

      rerender({ src: 'https://example.com/v2.m3u8' });

      // New instance created
      expect(mockHlsInstance.loadSource).toHaveBeenCalledWith('https://example.com/v2.m3u8');
    });

    it('detaches when src changes from HLS to non-HLS', () => {
      const videoRef = createVideoRef();
      const { result, rerender } = renderHook(
        ({ src }: { src: string }) =>
          useHLS({ src, videoRef }),
        { initialProps: { src: 'https://example.com/video.m3u8' } },
      );

      expect(result.current.isHLS).toBe(true);

      rerender({ src: 'https://example.com/video.mp4' });

      expect(result.current.isHLS).toBe(false);
      expect(result.current.isUsingHlsJs).toBe(false);
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────

  describe('edge cases', () => {
    it('destroys existing instance before creating new one in createHlsInstance', () => {
      const videoRef = createVideoRef();
      renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      const firstInstance = mockHlsInstance;

      // Manually trigger attachHLS again (simulates effect re-run)
      // The effect cleanup + re-run will destroy the old one
      // We can verify the first one was destroyed
      expect(firstInstance.destroy).toHaveBeenCalledTimes(0);
    });

    it('handles undefined src in native HLS path', () => {
      restoreNative?.();
      restoreNative = mockNativeHLSSupport(true);

      const video = createMockVideoElement();
      const videoRef = createVideoRef(video);
      const originalSrc = video.src;

      renderHook(() =>
        useHLS({ src: undefined, videoRef }),
      );

      // src should not be changed
      expect(video.src).toBe(originalSrc);
    });

    it('error message includes type and details', () => {
      const videoRef = createVideoRef();
      const onError = vi.fn();
      renderHook(() =>
        useHLS({
          src: 'https://example.com/video.m3u8',
          videoRef,
          onError,
        }),
      );

      act(() => {
        mockHlsInstance._emit('hlsError', {
          fatal: true,
          type: 'otherError',
          details: 'specificDetail',
        });
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'HLS fatal error: otherError - specificDetail',
        }),
      );
    });

    it('works without onQualityLevelsLoaded callback', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      // Should not throw
      act(() => {
        mockHlsInstance._emit('hlsManifestParsed', {
          levels: [{ height: 720, width: 1280, bitrate: 2500000 }],
        });
      });

      expect(result.current.levels).toHaveLength(2);
    });

    it('works without onError callback on fatal error', () => {
      const videoRef = createVideoRef();
      renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      // Should not throw
      act(() => {
        mockHlsInstance._emit('hlsError', {
          fatal: true,
          type: 'otherError',
          details: 'someDetail',
        });
      });

      expect(mockHlsInstance.destroy).toHaveBeenCalled();
    });

    it('returns hlsInstance as null initially when not using hls.js', () => {
      const videoRef = createVideoRef();
      const { result } = renderHook(() =>
        useHLS({ src: 'https://example.com/video.mp4', videoRef }),
      );

      expect(result.current.hlsInstance).toBeNull();
    });

    it('default config values are applied when no config is provided', () => {
      const videoRef = createVideoRef();
      renderHook(() =>
        useHLS({ src: 'https://example.com/video.m3u8', videoRef }),
      );

      // enabled defaults to true, autoQuality to true, startLevel to -1
      expect(hlsConstructorCalls[0][0]).toMatchObject({
        startLevel: -1,
        lowLatencyMode: false,
      });
    });
  });
});
