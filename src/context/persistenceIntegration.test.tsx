/**
 * Preferences have to survive the round trip *through a provider*, not just
 * through the hook that stores them.
 *
 * `usePersistentPreferences` is well covered on its own, but the provider is
 * where a stored value is turned back into player state — and a preference that
 * is read and then never applied is worse than one that was never stored: the
 * persist effect sees state disagreeing with storage and writes the default
 * back over it, so the setting is silently destroyed on the next mount.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useContext, useRef } from 'react';
import { PlayerProvider, PlayerContext } from './PlayerContext';
import { VideoProvider, useVideoPlayer } from './VideoContext';
import { readStored, writeStored, resetStorageAvailability } from '@/utils/storage';
import type { PersistedPreferences } from '@/types/persistence';
import type { Track } from '@/types/player';
import type { VideoTrack } from '@/types/video';

/**
 * Write a fixture and assert it landed.
 *
 * `writeStored` returns false when storage is unavailable or the write fails,
 * and a silently missing fixture would let a test render with no stored
 * preferences and pass without exercising restoration at all.
 */
function seed(preferences: PersistedPreferences): void {
  expect(writeStored<PersistedPreferences>('preferences', preferences)).toBe(true);
}

const TRACK: Track = { id: 'ep-1', src: 'https://example.test/ep-1.mp3' };
const VIDEO_TRACK: VideoTrack = { id: 'v-1', src: 'https://example.test/v-1.mp4' };

function AudioProbe() {
  const ctx = useContext(PlayerContext);
  return (
    <>
      <span data-testid="volume">{ctx?.state.volume}</span>
      <span data-testid="muted">{String(ctx?.state.isMuted)}</span>
      <span data-testid="rate">{ctx?.state.playbackRate}</span>
    </>
  );
}

function VideoProbe() {
  const { state, videoRef } = useVideoPlayer();
  return (
    <>
      {/*
        The real player renders the <video> from a child component, and the
        provider restores onto that element. A probe without one is not a
        lighter version of the player, it is a different situation — so it
        renders the element the same way VideoPlayer does.
      */}
      <video ref={videoRef as React.RefObject<HTMLVideoElement>} />
      <span data-testid="volume">{state.volume}</span>
      <span data-testid="rate">{state.playbackRate}</span>
    </>
  );
}

/** Counts its own renders, to catch an effect that never settles. */
let renderCount = 0;
function CountingProbe() {
  const ctx = useContext(PlayerContext);
  const seen = useRef(0);
  seen.current += 1;
  renderCount = seen.current;
  return <span data-testid="volume">{ctx?.state.volume}</span>;
}

describe('persistence through the providers', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStorageAvailability();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('audio', () => {
    it('applies a stored volume', () => {
      seed({ volume: 0.25 });

      render(
        <PlayerProvider config={{ track: TRACK, volume: 1 }}>
          <AudioProbe />
        </PlayerProvider>
      );

      expect(Number(screen.getByTestId('volume').textContent)).toBeCloseTo(0.25);
    });

    it('applies a stored mute', () => {
      seed({ muted: true });

      render(
        <PlayerProvider config={{ track: TRACK, muted: false }}>
          <AudioProbe />
        </PlayerProvider>
      );

      expect(screen.getByTestId('muted').textContent).toBe('true');
    });

    it('applies a stored playback rate', () => {
      seed({ playbackRate: 1.5 });

      render(
        <PlayerProvider config={{ track: TRACK }}>
          <AudioProbe />
        </PlayerProvider>
      );

      expect(Number(screen.getByTestId('rate').textContent)).toBe(1.5);
    });

    it('does not overwrite a stored playback rate with the default', () => {
      // The damaging half. If the rate is read but never applied, state stays
      // at 1, the persist effect sees a mismatch and writes 1 back — so a
      // listener's 1.5x is destroyed just by opening the page.
      seed({ playbackRate: 1.5 });

      render(
        <PlayerProvider config={{ track: TRACK }}>
          <AudioProbe />
        </PlayerProvider>
      );

      expect(readStored<PersistedPreferences>('preferences')?.playbackRate).toBe(1.5);
    });

    it('does not overwrite a stored volume with the default', () => {
      seed({ volume: 0.25 });

      render(
        <PlayerProvider config={{ track: TRACK, volume: 1 }}>
          <AudioProbe />
        </PlayerProvider>
      );

      expect(readStored<PersistedPreferences>('preferences')?.volume).toBeCloseTo(0.25);
    });
  });

  describe('video', () => {
    it('applies a stored volume', () => {
      seed({ volume: 0.4 });

      render(
        <VideoProvider config={{ track: VIDEO_TRACK, volume: 1 }}>
          <VideoProbe />
        </VideoProvider>
      );

      expect(Number(screen.getByTestId('volume').textContent)).toBeCloseTo(0.4);
    });

    it('applies a stored playback rate', () => {
      seed({ playbackRate: 2 });

      render(
        <VideoProvider config={{ track: VIDEO_TRACK }}>
          <VideoProbe />
        </VideoProvider>
      );

      expect(Number(screen.getByTestId('rate').textContent)).toBe(2);
    });

    it('does not overwrite a stored playback rate with the default', () => {
      seed({ playbackRate: 2 });

      render(
        <VideoProvider config={{ track: VIDEO_TRACK }}>
          <VideoProbe />
        </VideoProvider>
      );

      expect(readStored<PersistedPreferences>('preferences')?.playbackRate).toBe(2);
    });
  });

  describe('the restore effect settles', () => {
    it('does not re-render without end', () => {
      // The restore effect deliberately has no dependency array: the media
      // element may not exist yet, and a ref appearing is invisible to React,
      // so it retries every render until it lands. That is only safe because a
      // ref guard makes every later run a no-op — if that guard ever breaks,
      // the effect and its setState calls would feed each other forever.
      renderCount = 0;
      seed({ volume: 0.25, playbackRate: 1.5 });

      render(
        <PlayerProvider config={{ track: TRACK }}>
          <CountingProbe />
        </PlayerProvider>
      );

      // Four in practice. The bound is loose because the exact count depends on
      // React's batching, but a loop would blow past any bound at all.
      expect(renderCount).toBeLessThan(15);
    });
  });
});
