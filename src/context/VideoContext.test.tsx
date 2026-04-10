import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import { VideoProvider, useVideoPlayer } from './VideoContext';
import {
  createMockVideoTrack,
  createMockVideoPlaylist,
} from '@/test/helpers';
import type { VideoConfig } from '@/types/video';

const createWrapper = (config: Partial<VideoConfig> = {}) => {
  return ({ children }: { children: React.ReactNode }) => (
    <VideoProvider config={config}>{children}</VideoProvider>
  );
};

describe('VideoContext', () => {
  describe('Provider rendering', () => {
    it('renders children', () => {
      render(
        <VideoProvider>
          <div data-testid="child">Hello</div>
        </VideoProvider>
      );
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('renders multiple children', () => {
      render(
        <VideoProvider>
          <div data-testid="child-1">First</div>
          <div data-testid="child-2">Second</div>
        </VideoProvider>
      );
      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });
  });

  describe('useVideoPlayer hook', () => {
    it('throws error when used outside provider', () => {
      expect(() => {
        renderHook(() => useVideoPlayer());
      }).toThrow('useVideoPlayer must be used within a VideoProvider');
    });

    it('returns context inside provider', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(result.current.state).toBeDefined();
      expect(result.current.controls).toBeDefined();
      expect(result.current.playlistState).toBeDefined();
      expect(result.current.playlistControls).toBeDefined();
      expect(result.current.config).toBeDefined();
      expect(result.current.videoRef).toBeDefined();
      expect(result.current.containerRef).toBeDefined();
    });
  });

  describe('Initial state', () => {
    it('has correct default playing state', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.isPlaying).toBe(false);
      expect(result.current.state.isPaused).toBe(true);
      expect(result.current.state.isEnded).toBe(false);
    });

    it('has correct default time state', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.currentTime).toBe(0);
      expect(result.current.state.duration).toBe(0);
      expect(result.current.state.buffered).toBe(0);
    });

    it('has correct default volume state', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.volume).toBe(1);
      expect(result.current.state.isMuted).toBe(false);
    });

    it('has correct default playback rate', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.playbackRate).toBe(1);
    });

    it('has no error initially', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.error).toBeNull();
    });

    it('has default fullscreen state', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.isFullscreen).toBe(false);
    });

    it('has default picture-in-picture state', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.isPictureInPicture).toBe(false);
    });

    it('has default controls visible state', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.controlsVisible).toBe(true);
    });

    it('has default quality state', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.currentQuality).toBe('auto');
      expect(result.current.state.availableQualities).toEqual([]);
    });

    it('has default watch progress', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.watchProgress).toEqual({
        watchedSegments: [],
        percentageWatched: 0,
        isFullyWatched: false,
        furthestPoint: 0,
      });
    });

    it('has default HLS state', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.isHLS).toBe(false);
      // isAutoQuality defaults to false when no HLS source is set
      expect(result.current.state.isAutoQuality).toBe(false);
    });

    it('has default subtitle state', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.currentSubtitle).toBeNull();
    });

    it('has default tab visibility state', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.isTabVisible).toBe(true);
    });

    it('has default casting state', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.isCasting).toBe(false);
    });
  });

  describe('Config defaults', () => {
    it('has default video features enabled', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.features?.fullscreen).toBe(true);
      expect(result.current.config.features?.qualitySelector).toBe(true);
      expect(result.current.config.features?.subtitles).toBe(true);
      expect(result.current.config.features?.autoHideControls).toBe(true);
      expect(result.current.config.features?.chapters).toBe(true);
      expect(result.current.config.features?.volumeControl).toBe(true);
    });

    it('defaults PiP to false', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.features?.pictureInPicture).toBe(false);
    });

    it('has correct default skip seconds for video', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.skipForwardSeconds).toBe(10);
      expect(result.current.config.skipBackwardSeconds).toBe(10);
    });

    it('has default controls hide delay', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.controlsHideDelay).toBe(3000);
    });

    it('defaults autoPlay to false', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.autoPlay).toBe(false);
    });

    it('defaults autoPlayNext to true', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.autoPlayNext).toBe(true);
    });
  });

  describe('Config overrides', () => {
    it('overrides volume', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper({ volume: 0.3 }),
      });

      expect(result.current.config.volume).toBe(0.3);
    });

    it('overrides muted', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper({ muted: true }),
      });

      expect(result.current.config.muted).toBe(true);
    });

    it('overrides skip seconds', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper({
          skipForwardSeconds: 30,
          skipBackwardSeconds: 5,
        }),
      });

      expect(result.current.config.skipForwardSeconds).toBe(30);
      expect(result.current.config.skipBackwardSeconds).toBe(5);
    });

    it('overrides features while keeping defaults', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper({
          features: { pictureInPicture: true, fullscreen: false },
        }),
      });

      expect(result.current.config.features?.pictureInPicture).toBe(true);
      expect(result.current.config.features?.fullscreen).toBe(false);
      // Defaults preserved
      expect(result.current.config.features?.qualitySelector).toBe(true);
      expect(result.current.config.features?.subtitles).toBe(true);
    });

    it('overrides controls hide delay', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper({ controlsHideDelay: 5000 }),
      });

      expect(result.current.config.controlsHideDelay).toBe(5000);
    });

    it('accepts custom playback speeds', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper({ playbackSpeeds: [0.25, 0.5, 1, 3] }),
      });

      expect(result.current.config.playbackSpeeds).toEqual([0.25, 0.5, 1, 3]);
    });

    it('accepts poster config', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper({ poster: 'https://example.com/poster.jpg' }),
      });

      expect(result.current.config.poster).toBe('https://example.com/poster.jpg');
    });
  });

  describe('Track and playlist', () => {
    it('sets current track from config track', () => {
      const track = createMockVideoTrack();
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper({ track }),
      });

      expect(result.current.playlistState.currentTrack).toEqual(track);
      expect(result.current.currentTrack).toEqual(track);
    });

    it('sets playlist tracks from config playlist', () => {
      const playlist = createMockVideoPlaylist(3);
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper({ playlist }),
      });

      expect(result.current.playlistState.tracks).toHaveLength(3);
      expect(result.current.playlistState.currentIndex).toBe(0);
      expect(result.current.currentTrack).toEqual(playlist[0]);
    });

    it('has null currentTrack when no track or playlist', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.currentTrack).toBeNull();
      expect(result.current.playlistState.currentTrack).toBeNull();
    });

    it('prefers playlist over single track', () => {
      const track = createMockVideoTrack({ id: 'single' });
      const playlist = createMockVideoPlaylist(2);
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper({ track, playlist }),
      });

      expect(result.current.playlistState.tracks).toHaveLength(2);
      expect(result.current.currentTrack?.id).toBe(playlist[0].id);
    });
  });

  describe('Controls', () => {
    it('has all video controls', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
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
      expect(result.current.controls.enterFullscreen).toBeDefined();
      expect(result.current.controls.exitFullscreen).toBeDefined();
      expect(result.current.controls.toggleFullscreen).toBeDefined();
      expect(result.current.controls.enterPictureInPicture).toBeDefined();
      expect(result.current.controls.exitPictureInPicture).toBeDefined();
      expect(result.current.controls.togglePictureInPicture).toBeDefined();
      expect(result.current.controls.setQuality).toBeDefined();
      expect(result.current.controls.setSubtitle).toBeDefined();
      expect(result.current.controls.showControls).toBeDefined();
      expect(result.current.controls.hideControls).toBeDefined();
      expect(result.current.controls.setAutoQuality).toBeDefined();
    });

    it('has all playlist controls', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
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
    it('navigates to next track', () => {
      const playlist = createMockVideoPlaylist(3);
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper({ playlist }),
      });

      expect(result.current.playlistState.currentIndex).toBe(0);

      act(() => {
        result.current.playlistControls.next();
      });

      expect(result.current.playlistState.currentIndex).toBe(1);
      expect(result.current.currentTrack?.id).toBe(playlist[1].id);
    });

    it('navigates to previous track', () => {
      const playlist = createMockVideoPlaylist(3);
      const { result } = renderHook(() => useVideoPlayer(), {
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
      const playlist = createMockVideoPlaylist(4);
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper({ playlist }),
      });

      act(() => {
        result.current.playlistControls.goToTrack(3);
      });

      expect(result.current.playlistState.currentIndex).toBe(3);
      expect(result.current.currentTrack?.id).toBe(playlist[3].id);
    });

    it('toggles shuffle', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper({ playlist: createMockVideoPlaylist() }),
      });

      expect(result.current.playlistState.shuffle).toBe(false);

      act(() => {
        result.current.playlistControls.toggleShuffle();
      });

      expect(result.current.playlistState.shuffle).toBe(true);
    });

    it('sets repeat mode', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper({ playlist: createMockVideoPlaylist() }),
      });

      act(() => {
        result.current.playlistControls.setRepeat('one');
      });

      expect(result.current.playlistState.repeat).toBe('one');
    });
  });

  describe('Callbacks', () => {
    it('calls onTrackChange when track changes', () => {
      const onTrackChange = vi.fn();
      const playlist = createMockVideoPlaylist(3);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VideoProvider config={{ playlist }} onTrackChange={onTrackChange}>
          {children}
        </VideoProvider>
      );

      const { result } = renderHook(() => useVideoPlayer(), { wrapper });

      act(() => {
        result.current.playlistControls.next();
      });

      expect(onTrackChange).toHaveBeenCalledWith(playlist[1], 1);
    });

    it('accepts onStart callback prop', () => {
      const onStart = vi.fn();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VideoProvider config={{ track: createMockVideoTrack() }} onStart={onStart}>
          {children}
        </VideoProvider>
      );

      const { result } = renderHook(() => useVideoPlayer(), { wrapper });
      expect(result.current).toBeDefined();
    });

    it('accepts onFinished callback prop', () => {
      const onFinished = vi.fn();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VideoProvider config={{ track: createMockVideoTrack() }} onFinished={onFinished}>
          {children}
        </VideoProvider>
      );

      const { result } = renderHook(() => useVideoPlayer(), { wrapper });
      expect(result.current).toBeDefined();
    });

    it('accepts onError callback prop', () => {
      const onError = vi.fn();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VideoProvider config={{ track: createMockVideoTrack() }} onError={onError}>
          {children}
        </VideoProvider>
      );

      const { result } = renderHook(() => useVideoPlayer(), { wrapper });
      expect(result.current).toBeDefined();
    });
  });

  describe('Refs', () => {
    it('provides videoRef', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.videoRef).toBeDefined();
    });

    it('provides containerRef', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.containerRef).toBeDefined();
    });
  });

  describe('Labels integration', () => {
    it('wraps children in LabelsProvider with config labels', () => {
      const { result } = renderHook(() => useVideoPlayer(), {
        wrapper: createWrapper({
          labels: { play: 'Reproducir' },
        }),
      });

      expect(result.current).toBeDefined();
    });
  });
});
