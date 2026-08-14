import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMediaSession, isMediaSessionSupported } from './useMediaSession';

type Handler = ((details: { seekTime?: number; seekOffset?: number }) => void) | null;

interface FakeSession {
  metadata: unknown;
  playbackState: string;
  setActionHandler: ReturnType<typeof vi.fn>;
  setPositionState: ReturnType<typeof vi.fn>;
  handlers: Map<string, Handler>;
}

function installMediaSession(options: { unsupported?: string[] } = {}): FakeSession {
  const handlers = new Map<string, Handler>();
  const unsupported = new Set(options.unsupported ?? []);

  const session: FakeSession = {
    metadata: null,
    playbackState: 'none',
    handlers,
    setActionHandler: vi.fn((action: string, handler: Handler) => {
      if (unsupported.has(action)) {
        throw new DOMException('unsupported', 'NotSupportedError');
      }
      handlers.set(action, handler);
    }),
    setPositionState: vi.fn(),
  };

  Object.defineProperty(navigator, 'mediaSession', {
    value: session,
    configurable: true,
    writable: true,
  });

  // The real constructor just records its init object.
  class FakeMediaMetadata {
    constructor(public init: Record<string, unknown>) {}
  }
  (window as unknown as { MediaMetadata: unknown }).MediaMetadata = FakeMediaMetadata;

  return session;
}

function removeMediaSession() {
  Reflect.deleteProperty(navigator, 'mediaSession');
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'MediaMetadata');
}

describe('useMediaSession', () => {
  afterEach(() => {
    removeMediaSession();
    vi.restoreAllMocks();
  });

  describe('feature detection', () => {
    it('reports unsupported when the API is absent', () => {
      removeMediaSession();
      expect(isMediaSessionSupported()).toBe(false);
    });

    it('does not throw when the API is absent', () => {
      removeMediaSession();
      expect(() =>
        renderHook(() =>
          useMediaSession({ metadata: { title: 'Episode 1' }, isPlaying: true })
        )
      ).not.toThrow();
    });

    it('reports supported once the API is present', () => {
      installMediaSession();
      expect(isMediaSessionSupported()).toBe(true);
    });
  });

  describe('metadata', () => {
    it('publishes title, artist, album and artwork', () => {
      const session = installMediaSession();

      renderHook(() =>
        useMediaSession({
          metadata: {
            title: 'Episode 1',
            artist: 'Fairu',
            album: 'Season 2',
            artwork: [{ src: 'https://example.test/cover.png', sizes: '512x512' }],
          },
        })
      );

      const init = (session.metadata as { init: Record<string, unknown> }).init;
      expect(init.title).toBe('Episode 1');
      expect(init.artist).toBe('Fairu');
      expect(init.album).toBe('Season 2');
      expect(init.artwork).toEqual([
        { src: 'https://example.test/cover.png', sizes: '512x512' },
      ]);
    });

    it('clears metadata when there is no track', () => {
      const session = installMediaSession();
      renderHook(() => useMediaSession({ metadata: null }));
      expect(session.metadata).toBeNull();
    });

    it('releases the OS slot on unmount', () => {
      const session = installMediaSession();
      const { unmount } = renderHook(() =>
        useMediaSession({ metadata: { title: 'Episode 1' } })
      );

      unmount();

      expect(session.metadata).toBeNull();
      expect(session.playbackState).toBe('none');
    });

    it('publishes nothing when disabled', () => {
      const session = installMediaSession();
      renderHook(() =>
        useMediaSession({ enabled: false, metadata: { title: 'Episode 1' } })
      );
      expect(session.metadata).toBeNull();
      expect(session.setActionHandler).not.toHaveBeenCalled();
    });
  });

  describe('playback state', () => {
    it('mirrors play and pause into the OS indicator', () => {
      const session = installMediaSession();
      const { rerender } = renderHook(
        ({ playing }) => useMediaSession({ isPlaying: playing }),
        { initialProps: { playing: true } }
      );
      expect(session.playbackState).toBe('playing');

      rerender({ playing: false });
      expect(session.playbackState).toBe('paused');
    });
  });

  describe('action handlers', () => {
    it('routes the transport actions to the callbacks', () => {
      const session = installMediaSession();
      const onPlay = vi.fn();
      const onPause = vi.fn();
      const onNextTrack = vi.fn();
      const onPreviousTrack = vi.fn();

      renderHook(() =>
        useMediaSession({ onPlay, onPause, onNextTrack, onPreviousTrack })
      );

      session.handlers.get('play')?.({});
      session.handlers.get('pause')?.({});
      session.handlers.get('nexttrack')?.({});
      session.handlers.get('previoustrack')?.({});

      expect(onPlay).toHaveBeenCalledOnce();
      expect(onPause).toHaveBeenCalledOnce();
      expect(onNextTrack).toHaveBeenCalledOnce();
      expect(onPreviousTrack).toHaveBeenCalledOnce();
    });

    it('passes the OS scrubber target through to onSeekTo', () => {
      const session = installMediaSession();
      const onSeekTo = vi.fn();

      renderHook(() => useMediaSession({ onSeekTo }));
      session.handlers.get('seekto')?.({ seekTime: 42 });

      expect(onSeekTo).toHaveBeenCalledWith(42);
    });

    it('ignores a seekto without a seekTime', () => {
      const session = installMediaSession();
      const onSeekTo = vi.fn();

      renderHook(() => useMediaSession({ onSeekTo }));
      session.handlers.get('seekto')?.({});

      expect(onSeekTo).not.toHaveBeenCalled();
    });

    it('prefers the offset the platform supplies over the configured one', () => {
      const session = installMediaSession();
      const onSeekForward = vi.fn();

      renderHook(() => useMediaSession({ onSeekForward, seekOffset: 10 }));

      session.handlers.get('seekforward')?.({ seekOffset: 30 });
      expect(onSeekForward).toHaveBeenCalledWith(30);

      session.handlers.get('seekforward')?.({});
      expect(onSeekForward).toHaveBeenCalledWith(10);
    });

    it('registers the remaining actions when one is unsupported', () => {
      // Chrome throws NotSupportedError for actions it does not implement;
      // that must not take the rest of the transport controls down with it.
      const session = installMediaSession({ unsupported: ['seekto'] });
      const onPlay = vi.fn();

      expect(() => renderHook(() => useMediaSession({ onPlay }))).not.toThrow();

      expect(session.handlers.has('seekto')).toBe(false);
      session.handlers.get('play')?.({});
      expect(onPlay).toHaveBeenCalledOnce();
    });

    it('unregisters its handlers on unmount', () => {
      const session = installMediaSession();
      const { unmount } = renderHook(() => useMediaSession({ onPlay: vi.fn() }));

      session.setActionHandler.mockClear();
      unmount();

      const cleared = session.setActionHandler.mock.calls.filter(
        ([, handler]) => handler === null
      );
      expect(cleared.length).toBeGreaterThan(0);
    });

    it('does not re-register handlers when inline callbacks change identity', () => {
      const session = installMediaSession();
      const { rerender } = renderHook(() => useMediaSession({ onPlay: () => {} }));

      const afterMount = session.setActionHandler.mock.calls.length;
      rerender();
      rerender();

      expect(session.setActionHandler.mock.calls.length).toBe(afterMount);
    });

    it('calls the latest callback after a rerender', () => {
      const session = installMediaSession();
      const first = vi.fn();
      const second = vi.fn();

      const { rerender } = renderHook(({ cb }) => useMediaSession({ onPlay: cb }), {
        initialProps: { cb: first },
      });

      rerender({ cb: second });
      session.handlers.get('play')?.({});

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledOnce();
    });
  });

  describe('position state', () => {
    it('publishes position, duration and rate', () => {
      const session = installMediaSession();
      renderHook(() =>
        useMediaSession({ position: 30, duration: 600, playbackRate: 1.5 })
      );

      expect(session.setPositionState).toHaveBeenCalledWith({
        position: 30,
        duration: 600,
        playbackRate: 1.5,
      });
    });

    it('skips an unknown duration rather than throwing', () => {
      // `duration` is NaN until loadedmetadata; the spec rejects that.
      const session = installMediaSession();
      renderHook(() => useMediaSession({ position: 0, duration: NaN }));
      expect(session.setPositionState).not.toHaveBeenCalled();
    });

    it('clamps a position that overshoots the duration', () => {
      // The last timeupdate before `ended` can land a hair past duration.
      const session = installMediaSession();
      renderHook(() => useMediaSession({ position: 600.4, duration: 600 }));

      expect(session.setPositionState).toHaveBeenCalledWith(
        expect.objectContaining({ position: 600 })
      );
    });

    it('substitutes a usable rate for zero', () => {
      const session = installMediaSession();
      renderHook(() =>
        useMediaSession({ position: 10, duration: 600, playbackRate: 0 })
      );

      expect(session.setPositionState).toHaveBeenCalledWith(
        expect.objectContaining({ playbackRate: 1 })
      );
    });
  });
});
