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
import { act, renderHook, waitFor } from '@testing-library/react';

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
function emit(target: FakeHlsInstance, event: string, data: unknown) {
  act(() => {
    target.fire(event, data);
  });
}

/** The most recently constructed fake instance. */
function latest(): FakeHlsInstance {
  return FakeHls.instances[FakeHls.instances.length - 1];
}

/**
 * Wait for the lazily loaded module to produce an instance, then return it.
 *
 * hls.js is fetched on demand now, so nothing exists synchronously after the
 * render — every test that touches the instance has to wait for the import to
 * resolve first.
 */
async function instance(): Promise<FakeHlsInstance> {
  await waitFor(() => expect(FakeHls.instances.length).toBeGreaterThan(0));
  return latest();
}

/** Give the pending module load a chance to settle when nothing is expected. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
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
    it('follows what the browser reports', async () => {
      setNativeHLS(true);
      expect(supportsNativeHLS()).toBe(true);

      setNativeHLS(false);
      expect(supportsNativeHLS()).toBe(false);
    });
  });

  describe('choosing an engine', () => {
    it('uses hls.js when the browser cannot play HLS itself', async () => {
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      expect(result.current.isHLS).toBe(true);
      expect(result.current.isUsingHlsJs).toBe(true);
      expect((await instance()).loadSource).toHaveBeenCalledWith(HLS_SRC);
    });

    it('leaves it to Safari when HLS is native', async () => {
      // Safari plays HLS directly and hls.js would only get in the way, so the
      // source goes straight onto the element.
      setNativeHLS(true);

      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      expect(result.current.isUsingHlsJs).toBe(false);
      expect(FakeHls.instances).toHaveLength(0);
      expect(videoRef.current?.src).toBe(HLS_SRC);
    });

    it('does nothing for a progressive source', async () => {
      const { result } = renderHook(() => useHLS({ src: 'https://example.test/video.mp4', videoRef }));

      expect(result.current.isHLS).toBe(false);
      expect(result.current.isUsingHlsJs).toBe(false);
      expect(FakeHls.instances).toHaveLength(0);
    });

    it('stands down where hls.js is unsupported and HLS is not native', async () => {
      // No MediaSource and no native support: nothing can play this stream, and
      // pretending otherwise would leave a silent black frame.
      // MediaSource exists in this environment, so the module is fetched and
      // only then refuses — the hook reports it rather than leaving a black
      // frame.
      FakeHls.isSupported.mockReturnValue(false);
      const onError = vi.fn();

      renderHook(() => useHLS({ src: HLS_SRC, videoRef, onError }));
      await settle();

      expect(FakeHls.instances).toHaveLength(0);
      await waitFor(() => expect(onError).toHaveBeenCalled());
    });

    it('can be switched off entirely', async () => {
      const { result } = renderHook(() =>
        useHLS({ src: HLS_SRC, videoRef, config: { enabled: false } })
      );

      expect(result.current.isUsingHlsJs).toBe(false);
      expect(FakeHls.instances).toHaveLength(0);
    });

    it('does nothing without a source', async () => {
      renderHook(() => useHLS({ src: undefined, videoRef }));
      expect(FakeHls.instances).toHaveLength(0);
    });

    it('does nothing without a video element', async () => {
      const emptyRef = { current: null } as React.RefObject<HTMLVideoElement | null>;
      renderHook(() => useHLS({ src: HLS_SRC, videoRef: emptyRef }));
      expect(FakeHls.instances).toHaveLength(0);
    });
  });

  describe('configuration', () => {
    it('passes the buffer length and latency mode through', async () => {
      renderHook(() =>
        useHLS({
          src: HLS_SRC,
          videoRef,
          config: { maxBufferLength: 30, lowLatencyMode: true, startLevel: 2 },
        })
      );

      expect((await instance()).config).toMatchObject({
        maxBufferLength: 30,
        lowLatencyMode: true,
        startLevel: 2,
      });
    });

    it('omits the buffer length when unset, leaving the library default', async () => {
      renderHook(() => useHLS({ src: HLS_SRC, videoRef }));
      expect((await instance()).config).not.toHaveProperty('maxBufferLength');
    });
  });

  describe('quality levels', () => {
    it('turns manifest levels into a list led by Auto', async () => {
      const onQualityLevelsLoaded = vi.fn();
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef, onQualityLevelsLoaded }));

      emit(await instance(), FakeHls.Events.MANIFEST_PARSED, {
        levels: [
          { height: 1080, width: 1920, bitrate: 5_000_000 },
          { height: 720, width: 1280, bitrate: 2_800_000 },
        ],
      });

      expect(result.current.levels.map((l) => l.label)).toEqual(['Auto', '1080p', '720p']);
      expect(onQualityLevelsLoaded).toHaveBeenCalledOnce();
    });

    it('labels a level with no height by its position', async () => {
      // Audio-only renditions and malformed manifests both produce these.
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      emit(await instance(), FakeHls.Events.MANIFEST_PARSED, {
        levels: [{ bitrate: 64_000 }],
      });

      expect(result.current.levels.map((l) => l.label)).toEqual(['Auto', 'Level 1']);
    });

    it('carries bitrate and dimensions across', async () => {
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      emit(await instance(), FakeHls.Events.MANIFEST_PARSED, {
        levels: [{ height: 720, width: 1280, bitrate: 2_800_000 }],
      });

      expect(result.current.levels[1]).toMatchObject({
        height: 720,
        width: 1280,
        bitrate: 2_800_000,
      });
    });

    it('follows a switch the library made on its own', async () => {
      // Adaptive switching is hls.js's decision; the UI only reflects it. The
      // +1 is the Auto entry sitting at index 0.
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      emit(await instance(), FakeHls.Events.LEVEL_SWITCHED, { level: 1 });

      expect(result.current.currentLevel).toBe(2);
    });
  });

  describe('picking a level', () => {
    it('pins a specific level', async () => {
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));
      // Wait for the module: before it lands there is no instance to pin a
      // level on, and `setLevel` is correctly a no-op. In practice a viewer
      // cannot pick a level earlier either — the list comes from the manifest.
      const hls = await instance();

      act(() => result.current.setLevel(2));

      // Index 2 in the UI is level 1 in hls.js, because of Auto.
      expect(hls.currentLevel).toBe(1);
      expect(result.current.isAutoQuality).toBe(false);
      expect(result.current.currentLevel).toBe(2);
    });

    it('does not reload the stream to change quality', async () => {
      // Switching level is a property assignment on the running instance.
      // Tearing the instance down and re-attaching would restart the stream:
      // a visible stall and a fresh buffer, every time someone picks 720p.
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));
      const hls = await instance();

      act(() => result.current.setLevel(2));
      act(() => result.current.setAutoQuality(true));

      expect(FakeHls.instances).toHaveLength(1);
      expect(hls.destroy).not.toHaveBeenCalled();
      expect(hls.loadSource).toHaveBeenCalledTimes(1);
    });

    it('returns to adaptive at index 0', async () => {
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));
      await instance();

      act(() => result.current.setLevel(2));
      act(() => result.current.setLevel(0));

      expect((await instance()).currentLevel).toBe(-1);
      expect(result.current.isAutoQuality).toBe(true);
    });

    it('setAutoQuality(true) hands control back', async () => {
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));
      await instance();

      act(() => result.current.setLevel(1));
      act(() => result.current.setAutoQuality(true));

      expect((await instance()).currentLevel).toBe(-1);
      expect(result.current.currentLevel).toBe(0);
      expect(result.current.isAutoQuality).toBe(true);
    });

    it('setAutoQuality(false) leaves the current level alone', async () => {
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));
      await instance();

      act(() => result.current.setLevel(2));
      const pinned = latest().currentLevel;
      act(() => result.current.setAutoQuality(false));

      expect((await instance()).currentLevel).toBe(pinned);
      expect(result.current.isAutoQuality).toBe(false);
    });

    it('is inert with no instance attached', async () => {
      setNativeHLS(true);
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      expect(() => act(() => result.current.setLevel(1))).not.toThrow();
    });
  });

  describe('lifecycle', () => {
    it('destroys the instance on unmount', async () => {
      const { unmount } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));
      const hls = await instance();

      unmount();

      expect(hls.destroy).toHaveBeenCalled();
    });

    it('constructs exactly one instance for one source', async () => {
      // The attach effect re-runs whenever `attachHLS` changes identity, and the
      // async load makes that easy to trip: a second instance per mount means a
      // second manifest request and a discarded buffer.
      renderHook(() => useHLS({ src: HLS_SRC, videoRef }));
      await instance();
      await settle();

      expect(FakeHls.instances).toHaveLength(1);
    });

    it('replaces the instance when the source changes', async () => {
      const { rerender } = renderHook(({ src }) => useHLS({ src, videoRef }), {
        initialProps: { src: HLS_SRC },
      });
      const first = await instance();
      const before = FakeHls.instances.length;

      rerender({ src: 'https://example.test/other.m3u8' });

      // Teardown is synchronous, the replacement is not — the module is already
      // cached by now, but it still resolves a microtask later.
      expect(first.destroy).toHaveBeenCalled();
      await waitFor(() => expect(FakeHls.instances.length).toBeGreaterThan(before));

      expect(latest()).not.toBe(first);
      expect(latest().loadSource).toHaveBeenCalledWith('https://example.test/other.m3u8');
    });

    it('detachHLS clears the level list', async () => {
      const { result } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));

      emit(await instance(), FakeHls.Events.MANIFEST_PARSED, { levels: [{ height: 720 }] });
      expect(result.current.levels).toHaveLength(2);

      act(() => result.current.detachHLS());

      expect(result.current.levels).toEqual([]);
    });
  });

  describe('errors', () => {
    it('ignores a non-fatal error', async () => {
      // Most hls.js errors are recoverable noise — a single failed segment
      // request retries on its own and must not tear the player down.
      const onError = vi.fn();
      renderHook(() => useHLS({ src: HLS_SRC, videoRef, onError }));
      const hls = await instance();

      emit(hls, FakeHls.Events.ERROR, {
        fatal: false,
        type: FakeHls.ErrorTypes.NETWORK_ERROR,
        details: 'fragLoadError',
      });

      expect(onError).not.toHaveBeenCalled();
      expect(hls.destroy).not.toHaveBeenCalled();
    });

    it('restarts loading after a fatal network error', async () => {
      const onError = vi.fn();
      renderHook(() => useHLS({ src: HLS_SRC, videoRef, onError }));
      const hls = await instance();
      vi.useFakeTimers();

      hls.fire(FakeHls.Events.ERROR, {
        fatal: true,
        type: FakeHls.ErrorTypes.NETWORK_ERROR,
        details: 'manifestLoadError',
      });
      // The retry is delayed now, so it takes a tick to arrive.
      vi.advanceTimersByTime(1000);

      expect(hls.startLoad).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('recovers from a fatal media error', async () => {
      renderHook(() => useHLS({ src: HLS_SRC, videoRef }));
      const hls = await instance();

      emit(hls, FakeHls.Events.ERROR, {
        fatal: true,
        type: FakeHls.ErrorTypes.MEDIA_ERROR,
        details: 'bufferStalledError',
      });

      expect(hls.recoverMediaError).toHaveBeenCalled();
    });

    it('backs off between network retries instead of hammering the origin', async () => {
      renderHook(() => useHLS({ src: HLS_SRC, videoRef }));
      const hls = await instance();
      vi.useFakeTimers();

      const failNetwork = () =>
        hls.fire(FakeHls.Events.ERROR, {
          fatal: true,
          type: FakeHls.ErrorTypes.NETWORK_ERROR,
          details: 'manifestLoadError',
        });

      failNetwork();
      expect(hls.startLoad).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(hls.startLoad).toHaveBeenCalledTimes(1);

      failNetwork();
      vi.advanceTimersByTime(1000);
      // Second attempt waits twice as long, so it has not fired yet.
      expect(hls.startLoad).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1000);
      expect(hls.startLoad).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('gives up after the network retry budget and reports the failure', async () => {
      // Against a CDN that is actually down, unbounded retries were a tight
      // loop: each attempt failed, fired ERROR again and retried at once —
      // hammering the origin behind a spinner that never resolved.
      const onError = vi.fn();
      renderHook(() => useHLS({ src: HLS_SRC, videoRef, onError }));
      const hls = await instance();
      vi.useFakeTimers();

      for (let i = 0; i < 4; i++) {
        hls.fire(FakeHls.Events.ERROR, {
          fatal: true,
          type: FakeHls.ErrorTypes.NETWORK_ERROR,
          details: 'manifestLoadError',
        });
        vi.advanceTimersByTime(10_000);
      }

      expect(hls.startLoad).toHaveBeenCalledTimes(3);
      expect(hls.destroy).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledOnce();

      vi.useRealTimers();
    });

    it('gives up after the media retry budget', async () => {
      const onError = vi.fn();
      renderHook(() => useHLS({ src: HLS_SRC, videoRef, onError }));
      const hls = await instance();

      for (let i = 0; i < 4; i++) {
        hls.fire(FakeHls.Events.ERROR, {
          fatal: true,
          type: FakeHls.ErrorTypes.MEDIA_ERROR,
          details: 'bufferStalledError',
        });
      }

      expect(hls.recoverMediaError).toHaveBeenCalledTimes(3);
      expect(onError).toHaveBeenCalledOnce();
    });

    it('restores the budget once a level loads again', async () => {
      // A blip early in a long stream must not use up the allowance for an
      // unrelated one an hour later.
      const onError = vi.fn();
      renderHook(() => useHLS({ src: HLS_SRC, videoRef, onError }));
      const hls = await instance();

      for (let i = 0; i < 3; i++) {
        hls.fire(FakeHls.Events.ERROR, {
          fatal: true,
          type: FakeHls.ErrorTypes.MEDIA_ERROR,
          details: 'bufferStalledError',
        });
      }
      emit(hls, FakeHls.Events.LEVEL_LOADED, {});

      hls.fire(FakeHls.Events.ERROR, {
        fatal: true,
        type: FakeHls.ErrorTypes.MEDIA_ERROR,
        details: 'bufferStalledError',
      });

      expect(hls.recoverMediaError).toHaveBeenCalledTimes(4);
      expect(onError).not.toHaveBeenCalled();
    });

    it('cancels a pending retry when the hook tears down', async () => {
      // The timer closes over the instance being destroyed; firing afterwards
      // would call startLoad on a dead object.
      const { unmount } = renderHook(() => useHLS({ src: HLS_SRC, videoRef }));
      const hls = await instance();
      vi.useFakeTimers();

      hls.fire(FakeHls.Events.ERROR, {
        fatal: true,
        type: FakeHls.ErrorTypes.NETWORK_ERROR,
        details: 'manifestLoadError',
      });

      unmount();
      vi.advanceTimersByTime(10_000);

      expect(hls.startLoad).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('gives up on an unrecoverable error and reports it', async () => {
      const onError = vi.fn();
      renderHook(() => useHLS({ src: HLS_SRC, videoRef, onError }));
      const hls = await instance();

      emit(hls, FakeHls.Events.ERROR, {
        fatal: true,
        type: FakeHls.ErrorTypes.OTHER_ERROR,
        details: 'internalException',
      });

      expect(hls.destroy).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onError.mock.calls[0][0].message).toContain('internalException');
    });
  });
});
