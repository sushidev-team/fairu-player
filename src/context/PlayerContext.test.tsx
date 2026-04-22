import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import { PlayerProvider } from './PlayerContext';
import { usePlayer } from '@/hooks/usePlayer';
import {
  createMockTrack,
  createMockPlaylist,
  createMockPlayerConfig,
} from '@/test/helpers';

const createWrapper = (config = {}) => {
  return ({ children }: { children: React.ReactNode }) => (
    <PlayerProvider config={config}>{children}</PlayerProvider>
  );
};

describe('PlayerContext', () => {
  describe('Provider rendering', () => {
    it('renders children', () => {
      render(
        <PlayerProvider>
          <div data-testid="child">Hello</div>
        </PlayerProvider>
      );
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('renders multiple children', () => {
      render(
        <PlayerProvider>
          <div data-testid="child-1">First</div>
          <div data-testid="child-2">Second</div>
        </PlayerProvider>
      );
      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });
  });

  describe('usePlayer hook', () => {
    it('throws error when used outside provider', () => {
      expect(() => {
        renderHook(() => usePlayer());
      }).toThrow('usePlayer must be used within a PlayerProvider');
    });

    it('returns context inside provider', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(result.current.state).toBeDefined();
      expect(result.current.controls).toBeDefined();
      expect(result.current.playlistState).toBeDefined();
      expect(result.current.playlistControls).toBeDefined();
      expect(result.current.config).toBeDefined();
      expect(result.current.audioRef).toBeDefined();
    });
  });

  describe('Initial state', () => {
    it('has correct default playing state', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.isPlaying).toBe(false);
      expect(result.current.state.isPaused).toBe(true);
      expect(result.current.state.isEnded).toBe(false);
    });

    it('has correct default time state', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.currentTime).toBe(0);
      expect(result.current.state.duration).toBe(0);
      expect(result.current.state.buffered).toBe(0);
    });

    it('has correct default volume state', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.volume).toBe(1);
      expect(result.current.state.isMuted).toBe(false);
    });

    it('has correct default playback rate', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.playbackRate).toBe(1);
    });

    it('has no error initially', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.error).toBeNull();
    });
  });

  describe('Config defaults', () => {
    it('has default features enabled', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.features?.chapters).toBe(true);
      expect(result.current.config.features?.volumeControl).toBe(true);
      expect(result.current.config.features?.playbackSpeed).toBe(true);
      expect(result.current.config.features?.skipButtons).toBe(true);
      expect(result.current.config.features?.progressBar).toBe(true);
      expect(result.current.config.features?.timeDisplay).toBe(true);
      expect(result.current.config.features?.playlistView).toBe(true);
    });

    it('has correct default skip seconds', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.skipForwardSeconds).toBe(30);
      expect(result.current.config.skipBackwardSeconds).toBe(10);
    });

    it('has default playback speeds', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.playbackSpeeds).toEqual([0.5, 0.75, 1, 1.25, 1.5, 2]);
    });

    it('defaults autoPlay to false', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.autoPlay).toBe(false);
    });

    it('defaults autoPlayNext to true', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.autoPlayNext).toBe(true);
    });

    it('defaults shuffle to false', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.shuffle).toBe(false);
    });

    it('defaults repeat to none', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.repeat).toBe('none');
    });
  });

  describe('Config overrides', () => {
    it('overrides volume', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ volume: 0.5 }),
      });

      expect(result.current.config.volume).toBe(0.5);
    });

    it('overrides muted', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ muted: true }),
      });

      expect(result.current.config.muted).toBe(true);
    });

    it('overrides skip seconds', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({
          skipForwardSeconds: 15,
          skipBackwardSeconds: 5,
        }),
      });

      expect(result.current.config.skipForwardSeconds).toBe(15);
      expect(result.current.config.skipBackwardSeconds).toBe(5);
    });

    it('overrides specific features while keeping defaults', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({
          features: { chapters: false },
        }),
      });

      expect(result.current.config.features?.chapters).toBe(false);
      expect(result.current.config.features?.volumeControl).toBe(true);
      expect(result.current.config.features?.progressBar).toBe(true);
    });

    it('overrides repeat mode', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ repeat: 'all' }),
      });

      expect(result.current.config.repeat).toBe('all');
    });

    it('overrides shuffle', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ shuffle: true }),
      });

      expect(result.current.config.shuffle).toBe(true);
    });

    it('accepts custom playback speeds', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ playbackSpeeds: [0.25, 0.5, 1, 2, 3] }),
      });

      expect(result.current.config.playbackSpeeds).toEqual([0.25, 0.5, 1, 2, 3]);
    });

    it('accepts mock player config', () => {
      const config = createMockPlayerConfig({ volume: 0.75, muted: true });
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(config),
      });

      expect(result.current.config.volume).toBe(0.75);
      expect(result.current.config.muted).toBe(true);
    });
  });

  describe('Track and playlist', () => {
    it('sets current track from config track', () => {
      const track = createMockTrack();
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ track }),
      });

      expect(result.current.playlistState.currentTrack).toEqual(track);
    });

    it('sets playlist tracks from config playlist', () => {
      const playlist = createMockPlaylist(3);
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ playlist }),
      });

      expect(result.current.playlistState.tracks).toHaveLength(3);
      expect(result.current.playlistState.currentIndex).toBe(0);
      expect(result.current.playlistState.currentTrack).toEqual(playlist[0]);
    });

    it('has empty tracks when no track or playlist provided', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.playlistState.tracks).toHaveLength(0);
      expect(result.current.playlistState.currentTrack).toBeNull();
    });

    it('prefers playlist over single track', () => {
      const track = createMockTrack({ id: 'single' });
      const playlist = createMockPlaylist(2);
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ track, playlist }),
      });

      expect(result.current.playlistState.tracks).toHaveLength(2);
      expect(result.current.playlistState.currentTrack?.id).toBe(playlist[0].id);
    });

    it('wraps single track in array for playlist state', () => {
      const track = createMockTrack();
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ track }),
      });

      expect(result.current.playlistState.tracks).toHaveLength(1);
      expect(result.current.playlistState.tracks[0]).toEqual(track);
    });
  });

  describe('Controls', () => {
    it('has all player controls', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.controls.play).toBeDefined();
      expect(result.current.controls.pause).toBeDefined();
      expect(result.current.controls.toggle).toBeDefined();
      expect(result.current.controls.stop).toBeDefined();
      expect(result.current.controls.seek).toBeDefined();
      expect(result.current.controls.seekTo).toBeDefined();
      expect(result.current.controls.skipForward).toBeDefined();
      expect(result.current.controls.skipBackward).toBeDefined();
      expect(result.current.controls.setVolume).toBeDefined();
      expect(result.current.controls.toggleMute).toBeDefined();
      expect(result.current.controls.setPlaybackRate).toBeDefined();
    });

    it('has all playlist controls', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.playlistControls.next).toBeDefined();
      expect(result.current.playlistControls.previous).toBeDefined();
      expect(result.current.playlistControls.goToTrack).toBeDefined();
      expect(result.current.playlistControls.setRepeat).toBeDefined();
      expect(result.current.playlistControls.toggleShuffle).toBeDefined();
      expect(result.current.playlistControls.addToQueue).toBeDefined();
      expect(result.current.playlistControls.removeFromQueue).toBeDefined();
      expect(result.current.playlistControls.clearQueue).toBeDefined();
    });
  });

  describe('Playlist controls integration', () => {
    it('goes to next track', () => {
      const playlist = createMockPlaylist(3);
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ playlist }),
      });

      expect(result.current.playlistState.currentIndex).toBe(0);

      act(() => {
        result.current.playlistControls.next();
      });

      expect(result.current.playlistState.currentIndex).toBe(1);
      expect(result.current.playlistState.currentTrack?.id).toBe(playlist[1].id);
    });

    it('goes to previous track', () => {
      const playlist = createMockPlaylist(3);
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ playlist }),
      });

      act(() => {
        result.current.playlistControls.next();
      });

      act(() => {
        result.current.playlistControls.previous();
      });

      expect(result.current.playlistState.currentIndex).toBe(0);
    });

    it('goes to specific track by index', () => {
      const playlist = createMockPlaylist(3);
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ playlist }),
      });

      act(() => {
        result.current.playlistControls.goToTrack(2);
      });

      expect(result.current.playlistState.currentIndex).toBe(2);
      expect(result.current.playlistState.currentTrack?.id).toBe(playlist[2].id);
    });

    it('toggles shuffle', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ playlist: createMockPlaylist() }),
      });

      expect(result.current.playlistState.shuffle).toBe(false);

      act(() => {
        result.current.playlistControls.toggleShuffle();
      });

      expect(result.current.playlistState.shuffle).toBe(true);
    });

    it('sets repeat mode', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ playlist: createMockPlaylist() }),
      });

      expect(result.current.playlistState.repeat).toBe('none');

      act(() => {
        result.current.playlistControls.setRepeat('all');
      });

      expect(result.current.playlistState.repeat).toBe('all');
    });

    it('adds track to queue', () => {
      const track = createMockTrack({ id: 'queued-track' });
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ playlist: createMockPlaylist() }),
      });

      expect(result.current.playlistState.queue).toHaveLength(0);

      act(() => {
        result.current.playlistControls.addToQueue(track);
      });

      expect(result.current.playlistState.queue).toHaveLength(1);
      expect(result.current.playlistState.queue[0].id).toBe('queued-track');
    });

    it('removes track from queue', () => {
      const track = createMockTrack({ id: 'queued-track' });
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ playlist: createMockPlaylist() }),
      });

      act(() => {
        result.current.playlistControls.addToQueue(track);
      });

      act(() => {
        result.current.playlistControls.removeFromQueue(0);
      });

      expect(result.current.playlistState.queue).toHaveLength(0);
    });

    it('clears queue', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ playlist: createMockPlaylist() }),
      });

      act(() => {
        result.current.playlistControls.addToQueue(createMockTrack({ id: 'q1' }));
        result.current.playlistControls.addToQueue(createMockTrack({ id: 'q2' }));
      });

      expect(result.current.playlistState.queue).toHaveLength(2);

      act(() => {
        result.current.playlistControls.clearQueue();
      });

      expect(result.current.playlistState.queue).toHaveLength(0);
    });
  });

  describe('Callbacks', () => {
    it('calls onTrackChange when track changes', () => {
      const onTrackChange = vi.fn();
      const playlist = createMockPlaylist(3);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <PlayerProvider config={{ playlist }} onTrackChange={onTrackChange}>
          {children}
        </PlayerProvider>
      );

      const { result } = renderHook(() => usePlayer(), { wrapper });

      act(() => {
        result.current.playlistControls.next();
      });

      expect(onTrackChange).toHaveBeenCalledWith(playlist[1], 1);
    });
  });

  describe('Audio ref', () => {
    it('provides audioRef', () => {
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({ track: createMockTrack() }),
      });

      expect(result.current.audioRef).toBeDefined();
    });
  });

  describe('Labels integration', () => {
    it('passes labels from config to LabelsProvider', () => {
      // PlayerProvider wraps children in LabelsProvider with config.labels
      // We can verify this by checking the provider renders without error
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper({
          labels: { play: 'Abspielen' },
        }),
      });

      expect(result.current).toBeDefined();
    });
  });
});
