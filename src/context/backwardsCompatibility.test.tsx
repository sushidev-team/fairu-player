/**
 * Guards for existing embeds.
 *
 * Media Session and persistence were added to providers that shipped without
 * them, and both default to on. That is only acceptable if a page that upgrades
 * without touching its config behaves exactly as it did before — so the rules
 * are pinned here rather than left to a changelog note.
 *
 * The one behaviour that *would* be visible, seeking to a remembered position,
 * is opt-in. These tests are what stops that default from being flipped by
 * accident.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useContext } from 'react';
import { PlayerProvider, PlayerContext } from './PlayerContext';
import { VideoProvider, useVideoPlayer } from './VideoContext';
import { readStored, writeStored, resetStorageAvailability } from '@/utils/storage';
import type { Track } from '@/types/player';
import type { VideoTrack } from '@/types/video';

const TRACK: Track = {
  id: 'ep-1',
  src: 'https://example.test/ep-1.mp3',
  title: 'Folge 1',
};

const VIDEO_TRACK: VideoTrack = {
  id: 'v-1',
  src: 'https://example.test/v-1.mp4',
  title: 'Video 1',
};

function AudioProbe() {
  const ctx = useContext(PlayerContext);
  return (
    <div>
      <span data-testid="volume">{ctx?.state.volume}</span>
      <span data-testid="muted">{String(ctx?.state.isMuted)}</span>
      <span data-testid="rate">{ctx?.state.playbackRate}</span>
    </div>
  );
}

function VideoProbe() {
  const { state } = useVideoPlayer();
  return (
    <div>
      <span data-testid="volume">{state.volume}</span>
      <span data-testid="muted">{String(state.isMuted)}</span>
    </div>
  );
}

/** Seed a stored position as though the viewer had listened before. */
function seedResume(trackId: string, position: number) {
  writeStored('resume', {
    [trackId]: { position, duration: 600, updatedAt: Date.now(), completed: false },
  });
}

describe('backwards compatibility', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStorageAvailability();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('a config from before these features existed', () => {
    it('still honours config.volume when nothing is stored', () => {
      render(
        <PlayerProvider config={{ track: TRACK, volume: 0.42 }}>
          <AudioProbe />
        </PlayerProvider>
      );

      expect(screen.getByTestId('volume').textContent).toBe('0.42');
    });

    it('still honours config.muted when nothing is stored', () => {
      render(
        <PlayerProvider config={{ track: TRACK, muted: true }}>
          <AudioProbe />
        </PlayerProvider>
      );

      expect(screen.getByTestId('muted').textContent).toBe('true');
    });

    it('renders without any of the new config keys', () => {
      expect(() =>
        render(
          <PlayerProvider config={{ track: TRACK }}>
            <AudioProbe />
          </PlayerProvider>
        )
      ).not.toThrow();
    });

    it('does the same for video', () => {
      render(
        <VideoProvider config={{ track: VIDEO_TRACK, volume: 0.3, muted: true }}>
          <VideoProbe />
        </VideoProvider>
      );

      expect(screen.getByTestId('volume').textContent).toBe('0.3');
      expect(screen.getByTestId('muted').textContent).toBe('true');
    });
  });

  describe('auto-resume is opt-in', () => {
    it('does NOT seek on load by default, even with a stored position', () => {
      seedResume('ep-1', 120);
      const seek = vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set');

      render(
        <PlayerProvider config={{ track: TRACK }}>
          <AudioProbe />
        </PlayerProvider>
      );

      // Moving the playhead is the one visible change an existing embed did not
      // ask for. Without `resume.autoResume` it must not happen.
      const seekedTo120 = seek.mock.calls.some(([value]) => value === 120);
      expect(seekedTo120).toBe(false);
    });

    it('does not seek for video either', () => {
      seedResume('v-1', 200);
      const seek = vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set');

      render(
        <VideoProvider config={{ track: VIDEO_TRACK }}>
          <VideoProbe />
        </VideoProvider>
      );

      expect(seek.mock.calls.some(([value]) => value === 200)).toBe(false);
    });

    it('DOES seek once autoResume is switched on', async () => {
      // The counterpart to the two tests above. Without this, they would pass
      // even if the restore effect were broken or removed entirely, and the
      // guard they claim to enforce would be worth nothing.
      seedResume('ep-1', 120);

      // jsdom reports duration 0, and the restore path deliberately waits for a
      // usable duration — so it has to be supplied for the effect to fire.
      vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(600);
      const seek = vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set');

      render(
        <PlayerProvider config={{ track: TRACK, resume: { autoResume: true } }}>
          <AudioProbe />
        </PlayerProvider>
      );

      // The duration reaches state via loadedmetadata.
      await act(async () => {
        const audio = document.querySelector('audio');
        audio?.dispatchEvent(new Event('loadedmetadata'));
      });

      expect(seek.mock.calls.some(([value]) => value === 120)).toBe(true);
    });

    it('exposes the stored position regardless, so a host page can prompt', () => {
      // Recording stays on with auto-resume off — that is what makes a
      // "Continue from 12:34?" prompt possible without the player deciding.
      seedResume('ep-1', 120);
      const stored = readStored<Record<string, { position: number }>>('resume');
      expect(stored?.['ep-1'].position).toBe(120);
    });
  });

  describe('persistence can be switched off entirely', () => {
    it('writes nothing when disabled', () => {
      render(
        <PlayerProvider config={{ track: TRACK, persistence: { enabled: false } }}>
          <AudioProbe />
        </PlayerProvider>
      );

      act(() => {});

      expect(readStored('preferences')).toBeNull();
      expect(readStored('resume')).toBeNull();
    });

    it('ignores stored preferences when disabled', () => {
      writeStored('preferences', { volume: 0.1 });

      render(
        <PlayerProvider
          config={{ track: TRACK, volume: 0.9, persistence: { enabled: false } }}
        >
          <AudioProbe />
        </PlayerProvider>
      );

      expect(screen.getByTestId('volume').textContent).toBe('0.9');
    });
  });

  describe('hostile storage does not break the player', () => {
    it('mounts when localStorage throws on every access', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });

      expect(() =>
        render(
          <PlayerProvider config={{ track: TRACK, volume: 0.5 }}>
            <AudioProbe />
          </PlayerProvider>
        )
      ).not.toThrow();

      // Blocked storage is the normal case inside a cross-origin embed iframe;
      // the config default has to survive it.
      expect(screen.getByTestId('volume').textContent).toBe('0.5');
    });
  });

  describe('Media Session is absent-safe', () => {
    it('mounts on a browser without the API', () => {
      Reflect.deleteProperty(navigator, 'mediaSession');

      expect(() =>
        render(
          <PlayerProvider config={{ track: TRACK }}>
            <AudioProbe />
          </PlayerProvider>
        )
      ).not.toThrow();
    });

    it('can be switched off without affecting playback state', () => {
      render(
        <PlayerProvider
          config={{ track: TRACK, volume: 0.7, mediaSession: { enabled: false } }}
        >
          <AudioProbe />
        </PlayerProvider>
      );

      expect(screen.getByTestId('volume').textContent).toBe('0.7');
    });
  });
});
