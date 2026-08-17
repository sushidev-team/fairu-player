/**
 * HLS playback, with hls.js replaced by a stand-in.
 *
 * The real library needs a MediaSource and a network, neither of which jsdom
 * has. What matters here is the wiring around it: which engine gets used on
 * which browser, how manifest levels become the quality list, and what happens
 * when a stream fails — the last of which is the part nobody exercises by hand,
 * because it needs a broken CDN to reproduce.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

type Handler = (event: string, data: unknown) => void;

/**
 * The slice of hls.js this hook touches.
 *
 * Built inside `vi.hoisted` because `vi.mock` factories are hoisted above every
 * declaration in the file — referencing a plain `class FakeHls` from one hits
 * the temporal dead zone and takes the whole worker down.
 */
const { FakeHls } = vi.hoisted(() => {
  class FakeHls {
    static isSupported = vi.fn(() => true);
    static Events = {
      MANIFEST_PARSED: 'hlsManifestParsed',
      LEVEL_SWITCHED: 'hlsLevelSwitched',
      LEVEL_LOADED: 'hlsLevelLoaded',
      ERROR: 'hlsError',
    };
    static ErrorTypes = {
      NETWORK_ERROR: 'networkError',
      MEDIA_ERROR: 'mediaError',
      OTHER_ERROR: 'otherError',
    };

    /** Every instance constructed during a test, newest last. */
    static instances: FakeHls[] = [];

    handlers = new Map<string, Handler[]>();
    loadSource = vi.fn();
    attachMedia = vi.fn();
    destroy = vi.fn();
    startLoad = vi.fn();
    recoverMediaError = vi.fn();
    currentLevel = -1;
    config: Record<string, unknown>;

    constructor(config: Record<string, unknown> = {}) {
      this.config = config;
      FakeHls.instances.push(this);
    }

    on(event: string, handler: Handler) {
      const existing = this.handlers.get(event) ?? [];
      this.handlers.set(event, [...existing, handler]);
    }

    /** Test-only: fire an hls.js event at the hook. */
    fire(event: string, data: unknown) {
      this.handlers.get(event)?.forEach((h) => h(event, data));
    }
  }

  return { FakeHls };
});

vi.mock('hls.js', () => ({ default: FakeHls }));

import { useHLS, isHLSSource, supportsNativeHLS } from './useHLS';

type FakeHlsInstance = InstanceType<typeof FakeHls>;

/** Fire an hls.js event and let React flush the state it causes. */
function emit(instance: FakeHlsInstance, event: string, data: unknown) {
  act(() => {
    instance.fire(event, data);
  });
}

/** The most recently constructed fake instance. */
function latest(): FakeHlsInstance {
  return FakeHls.instances[FakeHls.instances.length - 1];
}

/**
 * A ref that survives re-renders.
 *
 * It has to be built outside the `renderHook` callback: `videoRef` is a
 * dependency of the hook's attach effect, so a fresh ref per render re-runs the
 * effect, which constructs another hls.js instance, which sets state, which
 * renders again — an unbounded loop that ends in the worker running out of
 * memory rather than in a failed assertion.
 */
function makeVideoRef() {
  const video = document.createElement('video');
  return { current: video } as React.RefObject<HTMLVideoElement | null>;
}

/** Pretend the browser does or does not play HLS natively. */
function setNativeHLS(supported: boolean) {
  vi.spyOn(HTMLVideoElement.prototype, 'canPlayType').mockImplementation((type: string) =>
    supported && type === 'application/vnd.apple.mpegurl' ? 'maybe' : ''
  );
}

const HLS_SRC = 'https://example.test/master.m3u8';

describe('useHLS', () => {
  /** Recreated per test, but stable within one — see makeVideoRef. */
  let videoRef: React.RefObject<HTMLVideoElement | null>;

  beforeEach(() => {
    videoRef = makeVideoRef();
    FakeHls.instances = [];
    FakeHls.isSupported.mockReturnValue(true);
    setNativeHLS(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isHLSSource', () => {
    it.each([
      ['https://e.test/master.m3u8', true],
      ['https://e.test/master.m3u8?token=abc', true],
      ['https://e.test/manifest/video', true],
      ['https://e.test/video.mp4', false],
      ['', false],
      [undefined, false],
    ])('%s -> %s', (src, expected) => {
      expect(isHLSSource(src as string | undefined)).toBe(expected);
    });
  });

  describe('supportsNativeHLS', () => {
    it('follows what the browser reports', () => {
      setNativeHLS(true);
      expect(supportsNativeHLS()).toBe(true);

      setNativeHLS(false);
      expect(supportsNativeHLS()).toBe(false);
    });
  });

  describe('choosing an engine', () => {
    it('uses hls.js when the browser cannot play HLS itself', () => {
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      expect(result.current.isHLS).toBe(true);
      expect(result.current.isUsingHlsJs).toBe(true);
      expect(latest().loadSource).toHaveBeenCalledWith(HLS_SRC);
    });

    it('leaves it to Safari when HLS is native', () => {
      // Safari plays HLS directly and hls.js would only get in the way, so the
      // source goes straight onto the element.
      setNativeHLS(true);

      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      expect(result.current.isUsingHlsJs).toBe(false);
      expect(FakeHls.instances).toHaveLength(0);
      expect(videoRef.current?.src).toBe(HLS_SRC);
    });

    it('does nothing for a progressive source', () => {
      const { result } = renderHook(() => useHLS({ src: 'https://example.test/video.mp4', videoRef }));

      expect(result.current.isHLS).toBe(false);
      expect(result.current.isUsingHlsJs).toBe(false);
      expect(FakeHls.instances).toHaveLength(0);
    });

    it('stands down where hls.js is unsupported and HLS is not native', () => {
      // No MediaSource and no native support: nothing can play this stream, and
      // pretending otherwise would leave a silent black frame.
      FakeHls.isSupported.mockReturnValue(false);

      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      expect(result.current.isUsingHlsJs).toBe(false);
      expect(FakeHls.instances).toHaveLength(0);
    });

    it('can be switched off entirely', () => {
      const { result } = renderHook(() =>
        useHLS({ src: HLS_SRC, videoRef, config: { enabled: false } })
      );

      expect(result.current.isUsingHlsJs).toBe(false);
      expect(FakeHls.instances).toHaveLength(0);
    });

    it('does nothing without a source', () => {
      renderHook(() => useHLS({ src: undefined, videoRef }));
      expect(FakeHls.instances).toHaveLength(0);
    });

    it('does nothing without a video element', () => {
      const emptyRef = { current: null } as React.RefObject<HTMLVideoElement | null>;
      renderHook(() => useHLS({ src: HLS_SRC, videoRef: emptyRef }));
      expect(FakeHls.instances).toHaveLength(0);
    });
  });

  describe('configuration', () => {
    it('passes the buffer length and latency mode through', () => {
      renderHook(() =>
        useHLS({
          src: HLS_SRC,
          videoRef,
          config: { maxBufferLength: 30, lowLatencyMode: true, startLevel: 2 },
        })
      );

      expect(latest().config).toMatchObject({
        maxBufferLength: 30,
        lowLatencyMode: true,
        startLevel: 2,
      });
    });

    it('omits the buffer length when unset, leaving the library default', () => {
      renderHook(() => useHLS({ src: HLS_SRC, videoRef }));
      expect(latest().config).not.toHaveProperty('maxBufferLength');
    });
  });

  describe('quality levels', () => {
    it('turns manifest levels into a list led by Auto', () => {
      const onQualityLevelsLoaded = vi.fn();
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef, onQualityLevelsLoaded }));

      emit(latest(), FakeHls.Events.MANIFEST_PARSED, {
        levels: [
          { height: 1080, width: 1920, bitrate: 5_000_000 },
          { height: 720, width: 1280, bitrate: 2_800_000 },
        ],
      });

      expect(result.current.levels.map((l) => l.label)).toEqual(['Auto', '1080p', '720p']);
      expect(onQualityLevelsLoaded).toHaveBeenCalledOnce();
    });

    it('labels a level with no height by its position', () => {
      // Audio-only renditions and malformed manifests both produce these.
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      emit(latest(), FakeHls.Events.MANIFEST_PARSED, {
        levels: [{ bitrate: 64_000 }],
      });

      expect(result.current.levels.map((l) => l.label)).toEqual(['Auto', 'Level 1']);
    });

    it('carries bitrate and dimensions across', () => {
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      emit(latest(), FakeHls.Events.MANIFEST_PARSED, {
        levels: [{ height: 720, width: 1280, bitrate: 2_800_000 }],
      });

      expect(result.current.levels[1]).toMatchObject({
        height: 720,
        width: 1280,
        bitrate: 2_800_000,
      });
    });

    it('follows a switch the library made on its own', () => {
      // Adaptive switching is hls.js's decision; the UI only reflects it. The
      // +1 is the Auto entry sitting at index 0.
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      emit(latest(), FakeHls.Events.LEVEL_SWITCHED, { level: 1 });

      expect(result.current.currentLevel).toBe(2);
    });
  });

  describe('picking a level', () => {
    it('pins a specific level', () => {
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      act(() => result.current.setLevel(2));

      // Index 2 in the UI is level 1 in hls.js, because of Auto.
      expect(latest().currentLevel).toBe(1);
      expect(result.current.isAutoQuality).toBe(false);
      expect(result.current.currentLevel).toBe(2);
    });

    it('does not reload the stream to change quality', () => {
      // Switching level is a property assignment on the running instance.
      // Tearing the instance down and re-attaching would restart the stream:
      // a visible stall and a fresh buffer, every time someone picks 720p.
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));
      const instance = latest();

      act(() => result.current.setLevel(2));
      act(() => result.current.setAutoQuality(true));

      expect(FakeHls.instances).toHaveLength(1);
      expect(instance.destroy).not.toHaveBeenCalled();
      expect(instance.loadSource).toHaveBeenCalledTimes(1);
    });

    it('returns to adaptive at index 0', () => {
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      act(() => result.current.setLevel(2));
      act(() => result.current.setLevel(0));

      expect(latest().currentLevel).toBe(-1);
      expect(result.current.isAutoQuality).toBe(true);
    });

    it('setAutoQuality(true) hands control back', () => {
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      act(() => result.current.setLevel(1));
      act(() => result.current.setAutoQuality(true));

      expect(latest().currentLevel).toBe(-1);
      expect(result.current.currentLevel).toBe(0);
      expect(result.current.isAutoQuality).toBe(true);
    });

    it('setAutoQuality(false) leaves the current level alone', () => {
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      act(() => result.current.setLevel(2));
      const pinned = latest().currentLevel;
      act(() => result.current.setAutoQuality(false));

      expect(latest().currentLevel).toBe(pinned);
      expect(result.current.isAutoQuality).toBe(false);
    });

    it('is inert with no instance attached', () => {
      setNativeHLS(true);
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      expect(() => act(() => result.current.setLevel(1))).not.toThrow();
    });
  });

  describe('lifecycle', () => {
    it('destroys the instance on unmount', () => {
      const { unmount } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));
      const instance = latest();

      unmount();

      expect(instance.destroy).toHaveBeenCalled();
    });

    it('replaces the instance when the source changes', () => {
      const { rerender } = renderHook(({ src }) => useHLS({ src, videoRef }), {
        initialProps: { src: HLS_SRC },
      });
      const first = latest();

      rerender({ src: 'https://example.test/other.m3u8' });

      expect(first.destroy).toHaveBeenCalled();
      expect(latest()).not.toBe(first);
      expect(latest().loadSource).toHaveBeenCalledWith('https://example.test/other.m3u8');
    });

    it('detachHLS clears the level list', () => {
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      emit(latest(), FakeHls.Events.MANIFEST_PARSED, { levels: [{ height: 720 }] });
      expect(result.current.levels).toHaveLength(2);

      act(() => result.current.detachHLS());

      expect(result.current.levels).toEqual([]);
    });
  });

  describe('errors', () => {
    it('ignores a non-fatal error', () => {
      // Most hls.js errors are recoverable noise — a single failed segment
      // request retries on its own and must not tear the player down.
      const onError = vi.fn();
      renderHook(() => useHLS({ src: HLS_SRC, videoRef, onError }));
      const instance = latest();

      emit(instance, FakeHls.Events.ERROR, {
        fatal: false,
        type: FakeHls.ErrorTypes.NETWORK_ERROR,
        details: 'fragLoadError',
      });

      expect(onError).not.toHaveBeenCalled();
      expect(instance.destroy).not.toHaveBeenCalled();
    });

    it('restarts loading after a fatal network error', () => {
      vi.useFakeTimers();
      const onError = vi.fn();
      renderHook(() => useHLS({ src: HLS_SRC, videoRef, onError }));
      const instance = latest();

      instance.fire(FakeHls.Events.ERROR, {
        fatal: true,
        type: FakeHls.ErrorTypes.NETWORK_ERROR,
        details: 'manifestLoadError',
      });
      // The retry is delayed now, so it takes a tick to arrive.
      vi.advanceTimersByTime(1000);

      expect(instance.startLoad).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('recovers from a fatal media error', () => {
      renderHook(() => useHLS({ src: HLS_SRC, videoRef }));
      const instance = latest();

      emit(instance, FakeHls.Events.ERROR, {
        fatal: true,
        type: FakeHls.ErrorTypes.MEDIA_ERROR,
        details: 'bufferStalledError',
      });

      expect(instance.recoverMediaError).toHaveBeenCalled();
    });

    it('backs off between network retries instead of hammering the origin', () => {
      vi.useFakeTimers();
      renderHook(() => useHLS({ src: HLS_SRC, videoRef }));
      const instance = latest();

      const failNetwork = () =>
        instance.fire(FakeHls.Events.ERROR, {
          fatal: true,
          type: FakeHls.ErrorTypes.NETWORK_ERROR,
          details: 'manifestLoadError',
        });

      failNetwork();
      expect(instance.startLoad).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(instance.startLoad).toHaveBeenCalledTimes(1);

      failNetwork();
      vi.advanceTimersByTime(1000);
      // Second attempt waits twice as long, so it has not fired yet.
      expect(instance.startLoad).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1000);
      expect(instance.startLoad).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('gives up after the network retry budget and reports the failure', () => {
      // Against a CDN that is actually down, unbounded retries were a tight
      // loop: each attempt failed, fired ERROR again and retried at once —
      // hammering the origin behind a spinner that never resolved.
      vi.useFakeTimers();
      const onError = vi.fn();
      renderHook(() => useHLS({ src: HLS_SRC, videoRef, onError }));
      const instance = latest();

      for (let i = 0; i < 4; i++) {
        instance.fire(FakeHls.Events.ERROR, {
          fatal: true,
          type: FakeHls.ErrorTypes.NETWORK_ERROR,
          details: 'manifestLoadError',
        });
        vi.advanceTimersByTime(10_000);
      }

      expect(instance.startLoad).toHaveBeenCalledTimes(3);
      expect(instance.destroy).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledOnce();

      vi.useRealTimers();
    });

    it('gives up after the media retry budget', () => {
      const onError = vi.fn();
      renderHook(() => useHLS({ src: HLS_SRC, videoRef, onError }));
      const instance = latest();

      for (let i = 0; i < 4; i++) {
        instance.fire(FakeHls.Events.ERROR, {
          fatal: true,
          type: FakeHls.ErrorTypes.MEDIA_ERROR,
          details: 'bufferStalledError',
        });
      }

      expect(instance.recoverMediaError).toHaveBeenCalledTimes(3);
      expect(onError).toHaveBeenCalledOnce();
    });

    it('restores the budget once a level loads again', () => {
      // A blip early in a long stream must not use up the allowance for an
      // unrelated one an hour later.
      const onError = vi.fn();
      renderHook(() => useHLS({ src: HLS_SRC, videoRef, onError }));
      const instance = latest();

      for (let i = 0; i < 3; i++) {
        instance.fire(FakeHls.Events.ERROR, {
          fatal: true,
          type: FakeHls.ErrorTypes.MEDIA_ERROR,
          details: 'bufferStalledError',
        });
      }
      emit(instance, FakeHls.Events.LEVEL_LOADED, {});

      instance.fire(FakeHls.Events.ERROR, {
        fatal: true,
        type: FakeHls.ErrorTypes.MEDIA_ERROR,
        details: 'bufferStalledError',
      });

      expect(instance.recoverMediaError).toHaveBeenCalledTimes(4);
      expect(onError).not.toHaveBeenCalled();
    });

    it('cancels a pending retry when the hook tears down', () => {
      // The timer closes over the instance being destroyed; firing afterwards
      // would call startLoad on a dead object.
      vi.useFakeTimers();
      const { unmount } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));
      const instance = latest();

      instance.fire(FakeHls.Events.ERROR, {
        fatal: true,
        type: FakeHls.ErrorTypes.NETWORK_ERROR,
        details: 'manifestLoadError',
      });

      unmount();
      vi.advanceTimersByTime(10_000);

      expect(instance.startLoad).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('gives up on an unrecoverable error and reports it', () => {
      const onError = vi.fn();
      renderHook(() => useHLS({ src: HLS_SRC, videoRef, onError }));
      const instance = latest();

      emit(instance, FakeHls.Events.ERROR, {
        fatal: true,
        type: FakeHls.ErrorTypes.OTHER_ERROR,
        details: 'internalException',
      });

      expect(instance.destroy).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onError.mock.calls[0][0].message).toContain('internalException');
    });
  });
});
