import { renderHook, act } from '@testing-library/react';
import { useAudio } from './useAudio';

describe('useAudio', () => {
  // ── Return shape ──────────────────────────────────────────────────

  it('should return audioRef, state, and controls', () => {
    const { result } = renderHook(() => useAudio());
    expect(result.current).toHaveProperty('audioRef');
    expect(result.current).toHaveProperty('state');
    expect(result.current).toHaveProperty('controls');
  });

  it('should return audioRef as a ref object', () => {
    const { result } = renderHook(() => useAudio());
    expect(result.current.audioRef).toHaveProperty('current');
  });

  // ── Default state ─────────────────────────────────────────────────

  it('should start with isPlaying false', () => {
    const { result } = renderHook(() => useAudio());
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('should start with isPaused true', () => {
    const { result } = renderHook(() => useAudio());
    expect(result.current.state.isPaused).toBe(true);
  });

  it('should start with volume 1', () => {
    const { result } = renderHook(() => useAudio());
    expect(result.current.state.volume).toBe(1);
  });

  it('should start with isMuted false', () => {
    const { result } = renderHook(() => useAudio());
    expect(result.current.state.isMuted).toBe(false);
  });

  it('should start with currentTime 0', () => {
    const { result } = renderHook(() => useAudio());
    expect(result.current.state.currentTime).toBe(0);
  });

  it('should start with duration 0', () => {
    const { result } = renderHook(() => useAudio());
    expect(result.current.state.duration).toBe(0);
  });

  it('should start with playbackRate 1', () => {
    const { result } = renderHook(() => useAudio());
    expect(result.current.state.playbackRate).toBe(1);
  });

  it('should start with error null', () => {
    const { result } = renderHook(() => useAudio());
    expect(result.current.state.error).toBeNull();
  });

  // ── Custom initial options ────────────────────────────────────────

  it('should accept a custom initial volume', () => {
    const { result } = renderHook(() => useAudio({ volume: 0.5 }));
    expect(result.current.state.volume).toBe(0.5);
  });

  it('should accept initial muted state', () => {
    const { result } = renderHook(() => useAudio({ muted: true }));
    expect(result.current.state.isMuted).toBe(true);
  });

  it('should accept initial playback rate', () => {
    const { result } = renderHook(() => useAudio({ playbackRate: 1.5 }));
    expect(result.current.state.playbackRate).toBe(1.5);
  });

  // ── Controls shape ────────────────────────────────────────────────

  it('should expose play control', () => {
    const { result } = renderHook(() => useAudio());
    expect(typeof result.current.controls.play).toBe('function');
  });

  it('should expose pause control', () => {
    const { result } = renderHook(() => useAudio());
    expect(typeof result.current.controls.pause).toBe('function');
  });

  it('should expose toggle control', () => {
    const { result } = renderHook(() => useAudio());
    expect(typeof result.current.controls.toggle).toBe('function');
  });

  it('should expose stop control', () => {
    const { result } = renderHook(() => useAudio());
    expect(typeof result.current.controls.stop).toBe('function');
  });

  it('should expose seek control', () => {
    const { result } = renderHook(() => useAudio());
    expect(typeof result.current.controls.seek).toBe('function');
  });

  it('should expose seekTo control', () => {
    const { result } = renderHook(() => useAudio());
    expect(typeof result.current.controls.seekTo).toBe('function');
  });

  it('should expose skipForward control', () => {
    const { result } = renderHook(() => useAudio());
    expect(typeof result.current.controls.skipForward).toBe('function');
  });

  it('should expose skipBackward control', () => {
    const { result } = renderHook(() => useAudio());
    expect(typeof result.current.controls.skipBackward).toBe('function');
  });

  it('should expose setVolume control', () => {
    const { result } = renderHook(() => useAudio());
    expect(typeof result.current.controls.setVolume).toBe('function');
  });

  it('should expose toggleMute control', () => {
    const { result } = renderHook(() => useAudio());
    expect(typeof result.current.controls.toggleMute).toBe('function');
  });

  it('should expose setPlaybackRate control', () => {
    const { result } = renderHook(() => useAudio());
    expect(typeof result.current.controls.setPlaybackRate).toBe('function');
  });

  // ── Controls functionality (via useMedia) ────────────────────────

  it('should update volume via setVolume', () => {
    const { result } = renderHook(() => useAudio());

    act(() => {
      result.current.controls.setVolume(0.3);
    });

    expect(result.current.state.volume).toBe(0.3);
  });

  it('should clamp volume to 0-1 range', () => {
    const { result } = renderHook(() => useAudio());

    act(() => {
      result.current.controls.setVolume(1.5);
    });
    expect(result.current.state.volume).toBe(1);

    act(() => {
      result.current.controls.setVolume(-0.5);
    });
    expect(result.current.state.volume).toBe(0);
  });

  it('should toggle mute', () => {
    const { result } = renderHook(() => useAudio());

    act(() => {
      result.current.controls.toggleMute();
    });

    expect(result.current.state.isMuted).toBe(true);

    act(() => {
      result.current.controls.toggleMute();
    });

    expect(result.current.state.isMuted).toBe(false);
  });

  // ── Options passthrough (no-op without real <audio>) ─────────────

  it('should accept empty options', () => {
    expect(() => {
      renderHook(() => useAudio({}));
    }).not.toThrow();
  });

  it('should accept no arguments', () => {
    expect(() => {
      renderHook(() => useAudio());
    }).not.toThrow();
  });

  it('should accept src option', () => {
    expect(() => {
      renderHook(() => useAudio({ src: 'https://example.com/audio.mp3' }));
    }).not.toThrow();
  });

  it('should accept callback options', () => {
    const onPlay = vi.fn();
    const onPause = vi.fn();
    const onEnded = vi.fn();
    const onError = vi.fn();
    const onTimeUpdate = vi.fn();

    expect(() => {
      renderHook(() =>
        useAudio({ onPlay, onPause, onEnded, onError, onTimeUpdate }),
      );
    }).not.toThrow();
  });
});
