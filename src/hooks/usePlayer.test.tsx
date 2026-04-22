import React from 'react';
import { renderHook } from '@testing-library/react';
import { usePlayer } from './usePlayer';
import { PlayerProvider } from '@/context/PlayerContext';
import { TrackingProvider } from '@/context/TrackingContext';
import { createMockTrack } from '@/test/helpers';

function createWrapper(config = {}) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <TrackingProvider>
        <PlayerProvider config={config}>
          {children}
        </PlayerProvider>
      </TrackingProvider>
    );
  };
}

describe('usePlayer', () => {
  // ── Throws without provider ────────────────────────────────────────

  it('should throw when used outside of PlayerProvider', () => {
    // Suppress console.error for the expected React error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => usePlayer());
    }).toThrow('usePlayer must be used within a PlayerProvider');

    consoleSpy.mockRestore();
  });

  it('should throw with the correct error message', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => usePlayer());
    }).toThrow(/PlayerProvider/);

    consoleSpy.mockRestore();
  });

  // ── Returns context value within provider ─────────────────────────

  it('should not throw when used within PlayerProvider', () => {
    expect(() => {
      renderHook(() => usePlayer(), { wrapper: createWrapper() });
    }).not.toThrow();
  });

  it('should return state object', () => {
    const { result } = renderHook(() => usePlayer(), {
      wrapper: createWrapper(),
    });
    expect(result.current.state).toBeDefined();
    expect(result.current.state).toHaveProperty('isPlaying');
    expect(result.current.state).toHaveProperty('isPaused');
    expect(result.current.state).toHaveProperty('currentTime');
    expect(result.current.state).toHaveProperty('duration');
    expect(result.current.state).toHaveProperty('volume');
  });

  it('should return controls object', () => {
    const { result } = renderHook(() => usePlayer(), {
      wrapper: createWrapper(),
    });
    expect(result.current.controls).toBeDefined();
    expect(typeof result.current.controls.play).toBe('function');
    expect(typeof result.current.controls.pause).toBe('function');
    expect(typeof result.current.controls.toggle).toBe('function');
    expect(typeof result.current.controls.seek).toBe('function');
    expect(typeof result.current.controls.setVolume).toBe('function');
  });

  it('should return playlistState object', () => {
    const { result } = renderHook(() => usePlayer(), {
      wrapper: createWrapper(),
    });
    expect(result.current.playlistState).toBeDefined();
    expect(result.current.playlistState).toHaveProperty('tracks');
    expect(result.current.playlistState).toHaveProperty('currentIndex');
    expect(result.current.playlistState).toHaveProperty('currentTrack');
  });

  it('should return playlistControls object', () => {
    const { result } = renderHook(() => usePlayer(), {
      wrapper: createWrapper(),
    });
    expect(result.current.playlistControls).toBeDefined();
    expect(typeof result.current.playlistControls.next).toBe('function');
    expect(typeof result.current.playlistControls.previous).toBe('function');
    expect(typeof result.current.playlistControls.goToTrack).toBe('function');
  });

  it('should return config object', () => {
    const { result } = renderHook(() => usePlayer(), {
      wrapper: createWrapper(),
    });
    expect(result.current.config).toBeDefined();
  });

  it('should return audioRef', () => {
    const { result } = renderHook(() => usePlayer(), {
      wrapper: createWrapper(),
    });
    expect(result.current.audioRef).toBeDefined();
    expect(result.current.audioRef).toHaveProperty('current');
  });

  // ── Config passthrough ────────────────────────────────────────────

  it('should reflect provided track in playlistState', () => {
    const track = createMockTrack({ id: 'test-track', title: 'My Track' });
    const { result } = renderHook(() => usePlayer(), {
      wrapper: createWrapper({ track }),
    });
    expect(result.current.playlistState.currentTrack).toBeDefined();
    expect(result.current.playlistState.currentTrack?.id).toBe('test-track');
  });

  it('should reflect provided playlist', () => {
    const playlist = [
      createMockTrack({ id: 't1' }),
      createMockTrack({ id: 't2' }),
      createMockTrack({ id: 't3' }),
    ];
    const { result } = renderHook(() => usePlayer(), {
      wrapper: createWrapper({ playlist }),
    });
    expect(result.current.playlistState.tracks).toHaveLength(3);
  });

  it('should use default config values when none provided', () => {
    const { result } = renderHook(() => usePlayer(), {
      wrapper: createWrapper(),
    });
    expect(result.current.config.autoPlayNext).toBe(true);
    expect(result.current.config.shuffle).toBe(false);
    expect(result.current.config.repeat).toBe('none');
  });

  it('should merge user config with defaults', () => {
    const { result } = renderHook(() => usePlayer(), {
      wrapper: createWrapper({ shuffle: true, repeat: 'all' }),
    });
    expect(result.current.config.shuffle).toBe(true);
    expect(result.current.config.repeat).toBe('all');
    // Default values still present
    expect(result.current.config.autoPlayNext).toBe(true);
  });
});
