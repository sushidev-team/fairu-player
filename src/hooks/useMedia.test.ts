import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMedia } from './useMedia';
import type { UseMediaOptions } from '@/types/media';
import {
  createMockVideoElement,
  fireMediaEvent,
  simulateTimeUpdate,
  simulateLoadedMetadata,
} from '@/test/helpers';

/**
 * Helper: render the hook, attach a video element to the ref, then force
 * the event-listener effect to re-run so it discovers the element.
 *
 * The strategy: render once (effect sees null ref), set the ref, then
 * rerender with a changed callback identity in the effect dependency list.
 */
function renderMediaHook(options: UseMediaOptions = {}) {
  const video = createMockVideoElement();

  // We wrap onCanPlayThrough with two different wrapper identities.
  // This changes the effect dependency without altering observable behaviour.
  const userCb = options.onCanPlayThrough;
  const wrapper1 = () => { userCb?.(); };
  const wrapper2 = () => { userCb?.(); };

  const hookResult = renderHook(
    ({ opts }: { opts: UseMediaOptions }) => useMedia<HTMLVideoElement>(opts),
    {
      initialProps: {
        opts: { ...options, onCanPlayThrough: wrapper1 },
      },
    }
  );

  // Attach the mock element to the ref
  (hookResult.result.current.mediaRef as React.MutableRefObject<HTMLVideoElement | null>).current = video;

  // Rerender with a new wrapper identity to force the effect to re-run
  hookResult.rerender({
    opts: { ...options, onCanPlayThrough: wrapper2 },
  });

  return { ...hookResult, video };
}

describe('useMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Initial State ──────────────────────────────────────────────────

  describe('initial state', () => {
    it('returns default initial state', () => {
      const { result } = renderHook(() => useMedia());
      const { state } = result.current;

      expect(state.isPlaying).toBe(false);
      expect(state.isPaused).toBe(true);
      expect(state.isLoading).toBe(true);
      expect(state.isBuffering).toBe(false);
      expect(state.isEnded).toBe(false);
      expect(state.isMuted).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.duration).toBe(0);
      expect(state.buffered).toBe(0);
      expect(state.volume).toBe(1);
      expect(state.playbackRate).toBe(1);
      expect(state.error).toBeNull();
    });

    it('accepts custom initial volume', () => {
      const { result } = renderHook(() => useMedia({ volume: 0.5 }));
      expect(result.current.state.volume).toBe(0.5);
    });

    it('accepts custom initial muted', () => {
      const { result } = renderHook(() => useMedia({ muted: true }));
      expect(result.current.state.isMuted).toBe(true);
    });

    it('accepts custom initial playback rate', () => {
      const { result } = renderHook(() => useMedia({ playbackRate: 2 }));
      expect(result.current.state.playbackRate).toBe(2);
    });

    it('provides a mediaRef', () => {
      const { result } = renderHook(() => useMedia());
      expect(result.current.mediaRef).toBeDefined();
      expect(result.current.mediaRef.current).toBeNull();
    });
  });

  // ─── Event Handling ─────────────────────────────────────────────────

  describe('event handling', () => {
    it('updates state on loadstart', () => {
      const { result, video } = renderMediaHook();

      act(() => {
        fireMediaEvent(video, 'loadstart');
      });

      expect(result.current.state.isLoading).toBe(true);
      expect(result.current.state.error).toBeNull();
    });

    it('updates state on loadedmetadata', () => {
      const onLoadedMetadata = vi.fn();
      const { result, video } = renderMediaHook({ onLoadedMetadata });

      act(() => {
        simulateLoadedMetadata(video, 120);
      });

      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.duration).toBe(120);
      expect(onLoadedMetadata).toHaveBeenCalledWith(120);
    });

    it('calls onLoadedData callback on loadeddata', () => {
      const onLoadedData = vi.fn();
      const { video } = renderMediaHook({ onLoadedData });

      act(() => {
        fireMediaEvent(video, 'loadeddata');
      });

      expect(onLoadedData).toHaveBeenCalledTimes(1);
    });

    it('updates state on canplay', () => {
      const { result, video } = renderMediaHook();

      act(() => {
        fireMediaEvent(video, 'loadstart');
      });
      expect(result.current.state.isLoading).toBe(true);

      act(() => {
        fireMediaEvent(video, 'canplay');
      });
      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.isBuffering).toBe(false);
    });

    it('calls onCanPlayThrough callback', () => {
      const onCanPlayThrough = vi.fn();
      const { video } = renderMediaHook({ onCanPlayThrough });

      act(() => {
        fireMediaEvent(video, 'canplaythrough');
      });

      expect(onCanPlayThrough).toHaveBeenCalledTimes(1);
    });

    it('updates state on waiting', () => {
      const { result, video } = renderMediaHook();

      act(() => {
        fireMediaEvent(video, 'waiting');
      });

      expect(result.current.state.isBuffering).toBe(true);
    });

    it('updates state on playing', () => {
      const { result, video } = renderMediaHook();

      act(() => {
        fireMediaEvent(video, 'playing');
      });

      expect(result.current.state.isPlaying).toBe(true);
      expect(result.current.state.isPaused).toBe(false);
      expect(result.current.state.isBuffering).toBe(false);
      expect(result.current.state.isEnded).toBe(false);
    });

    it('updates state on play event and calls onPlay', () => {
      const onPlay = vi.fn();
      const { result, video } = renderMediaHook({ onPlay });

      act(() => {
        fireMediaEvent(video, 'play');
      });

      expect(result.current.state.isPlaying).toBe(true);
      expect(result.current.state.isPaused).toBe(false);
      expect(result.current.state.isEnded).toBe(false);
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    it('updates state on pause event and calls onPause', () => {
      const onPause = vi.fn();
      const { result, video } = renderMediaHook({ onPause });

      act(() => {
        fireMediaEvent(video, 'play');
      });
      act(() => {
        fireMediaEvent(video, 'pause');
      });

      expect(result.current.state.isPlaying).toBe(false);
      expect(result.current.state.isPaused).toBe(true);
      expect(onPause).toHaveBeenCalledTimes(1);
    });

    it('updates state on ended event and calls onEnded', () => {
      const onEnded = vi.fn();
      const { result, video } = renderMediaHook({ onEnded });

      act(() => {
        fireMediaEvent(video, 'ended');
      });

      expect(result.current.state.isPlaying).toBe(false);
      expect(result.current.state.isPaused).toBe(true);
      expect(result.current.state.isEnded).toBe(true);
      expect(onEnded).toHaveBeenCalledTimes(1);
    });

    it('updates currentTime on timeupdate and calls onTimeUpdate', () => {
      const onTimeUpdate = vi.fn();
      const { result, video } = renderMediaHook({ onTimeUpdate });

      act(() => {
        simulateTimeUpdate(video, 42);
      });

      expect(result.current.state.currentTime).toBe(42);
      expect(onTimeUpdate).toHaveBeenCalledWith(42);
    });

    it('updates buffered on progress', () => {
      const { result, video } = renderMediaHook();

      // Mock the buffered TimeRanges
      Object.defineProperty(video, 'buffered', {
        writable: true,
        value: {
          length: 1,
          start: () => 0,
          end: () => 60,
        },
      });

      act(() => {
        fireMediaEvent(video, 'progress');
      });

      expect(result.current.state.buffered).toBe(60);
    });

    it('handles progress event with empty buffer', () => {
      const { result, video } = renderMediaHook();

      Object.defineProperty(video, 'buffered', {
        writable: true,
        value: { length: 0, start: () => 0, end: () => 0 },
      });

      act(() => {
        fireMediaEvent(video, 'progress');
      });

      expect(result.current.state.buffered).toBe(0);
    });

    it('updates volume and muted on volumechange', () => {
      const { result, video } = renderMediaHook();

      (video as any).volume = 0.7;
      (video as any).muted = true;

      act(() => {
        fireMediaEvent(video, 'volumechange');
      });

      expect(result.current.state.volume).toBe(0.7);
      expect(result.current.state.isMuted).toBe(true);
    });

    it('updates playbackRate on ratechange', () => {
      const { result, video } = renderMediaHook();

      (video as any).playbackRate = 1.5;

      act(() => {
        fireMediaEvent(video, 'ratechange');
      });

      expect(result.current.state.playbackRate).toBe(1.5);
    });

    it('updates error state on error event and calls onError', () => {
      vi.useFakeTimers();
      const onError = vi.fn();
      const { result, video } = renderMediaHook({ onError });

      Object.defineProperty(video, 'error', {
        writable: true,
        value: { message: 'Decode error' },
      });

      // The error handler now retries up to 3 times before setting error state.
      // We need to fire enough error events to exhaust all retries (4 errors total).
      for (let i = 0; i < 4; i++) {
        act(() => {
          fireMediaEvent(video, 'error');
        });
      }

      expect(result.current.state.error).toBeInstanceOf(Error);
      expect(result.current.state.error?.message).toBe('Decode error');
      expect(result.current.state.isLoading).toBe(false);
      expect(onError).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('handles error event with no error message', () => {
      vi.useFakeTimers();
      const { result, video } = renderMediaHook();

      Object.defineProperty(video, 'error', {
        writable: true,
        value: {},
      });

      // Fire enough errors to exhaust retries
      for (let i = 0; i < 4; i++) {
        act(() => {
          fireMediaEvent(video, 'error');
        });
      }

      expect(result.current.state.error?.message).toBe('Media error');
      vi.useRealTimers();
    });
  });

  // ─── Controls ───────────────────────────────────────────────────────

  describe('controls', () => {
    it('play() calls media.play()', async () => {
      const { result, video } = renderMediaHook();
      const playSpy = vi.spyOn(video, 'play');

      await act(async () => {
        await result.current.controls.play();
      });

      expect(playSpy).toHaveBeenCalledTimes(1);
    });

    it('play() handles play rejection', async () => {
      const onError = vi.fn();
      const { result, video } = renderMediaHook({ onError });

      vi.spyOn(video, 'play').mockRejectedValue(new Error('Autoplay blocked'));

      await act(async () => {
        await result.current.controls.play();
      });

      expect(result.current.state.error?.message).toBe('Autoplay blocked');
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('play() handles non-Error rejections', async () => {
      const { result, video } = renderMediaHook();

      vi.spyOn(video, 'play').mockRejectedValue('string error');

      await act(async () => {
        await result.current.controls.play();
      });

      expect(result.current.state.error?.message).toBe('Failed to play');
    });

    it('pause() calls media.pause()', () => {
      const { result, video } = renderMediaHook();
      const pauseSpy = vi.spyOn(video, 'pause');

      act(() => {
        result.current.controls.pause();
      });

      expect(pauseSpy).toHaveBeenCalledTimes(1);
    });

    it('toggle() plays when paused', async () => {
      const { result, video } = renderMediaHook();
      const playSpy = vi.spyOn(video, 'play');

      await act(async () => {
        await result.current.controls.toggle();
      });

      expect(playSpy).toHaveBeenCalled();
    });

    it('toggle() pauses when playing', async () => {
      const { result, video } = renderMediaHook();
      const pauseSpy = vi.spyOn(video, 'pause');

      // First set playing state
      act(() => {
        fireMediaEvent(video, 'play');
      });

      await act(async () => {
        await result.current.controls.toggle();
      });

      expect(pauseSpy).toHaveBeenCalled();
    });

    it('stop() pauses and resets currentTime', () => {
      const { result, video } = renderMediaHook();
      const pauseSpy = vi.spyOn(video, 'pause');

      (video as any).currentTime = 50;

      act(() => {
        result.current.controls.stop();
      });

      expect(pauseSpy).toHaveBeenCalled();
      expect(video.currentTime).toBe(0);
    });

    it('seek() sets currentTime directly', () => {
      const { result, video } = renderMediaHook();

      act(() => {
        result.current.controls.seek(45);
      });

      expect(video.currentTime).toBe(45);
    });

    it('seek() clamps to 0 for negative values', () => {
      const { result, video } = renderMediaHook();

      act(() => {
        result.current.controls.seek(-10);
      });

      expect(video.currentTime).toBe(0);
    });

    it('seek() clamps to duration for values beyond duration', () => {
      const { result, video } = renderMediaHook();

      act(() => {
        result.current.controls.seek(999);
      });

      expect(video.currentTime).toBe(video.duration);
    });

    it('seekTo() seeks to a percentage of duration', () => {
      const { result, video } = renderMediaHook();

      act(() => {
        result.current.controls.seekTo(50);
      });

      // 50% of 300 = 150
      expect(video.currentTime).toBe(150);
    });

    it('seekTo() does nothing when duration is 0', () => {
      const { result, video } = renderMediaHook();

      Object.defineProperty(video, 'duration', { writable: true, value: 0 });

      act(() => {
        result.current.controls.seekTo(50);
      });

      expect(video.currentTime).toBe(0);
    });

    it('skipForward() skips by default amount (30s)', () => {
      const { result, video } = renderMediaHook();

      (video as any).currentTime = 10;

      act(() => {
        result.current.controls.skipForward();
      });

      expect(video.currentTime).toBe(40);
    });

    it('skipForward() skips by custom amount', () => {
      const { result, video } = renderMediaHook();

      (video as any).currentTime = 10;

      act(() => {
        result.current.controls.skipForward(15);
      });

      expect(video.currentTime).toBe(25);
    });

    it('skipForward() respects custom skipForwardSeconds option', () => {
      const { result, video } = renderMediaHook({ skipForwardSeconds: 10 });

      (video as any).currentTime = 5;

      act(() => {
        result.current.controls.skipForward();
      });

      expect(video.currentTime).toBe(15);
    });

    it('skipForward() clamps to duration', () => {
      const { result, video } = renderMediaHook();

      (video as any).currentTime = 290;

      act(() => {
        result.current.controls.skipForward();
      });

      expect(video.currentTime).toBe(300);
    });

    it('skipBackward() skips by default amount (10s)', () => {
      const { result, video } = renderMediaHook();

      (video as any).currentTime = 50;

      act(() => {
        result.current.controls.skipBackward();
      });

      expect(video.currentTime).toBe(40);
    });

    it('skipBackward() skips by custom amount', () => {
      const { result, video } = renderMediaHook();

      (video as any).currentTime = 50;

      act(() => {
        result.current.controls.skipBackward(20);
      });

      expect(video.currentTime).toBe(30);
    });

    it('skipBackward() respects custom skipBackwardSeconds option', () => {
      const { result, video } = renderMediaHook({ skipBackwardSeconds: 5 });

      (video as any).currentTime = 20;

      act(() => {
        result.current.controls.skipBackward();
      });

      expect(video.currentTime).toBe(15);
    });

    it('skipBackward() clamps to 0', () => {
      const { result, video } = renderMediaHook();

      (video as any).currentTime = 3;

      act(() => {
        result.current.controls.skipBackward();
      });

      expect(video.currentTime).toBe(0);
    });

    it('setVolume() updates volume', () => {
      const { result, video } = renderMediaHook();

      act(() => {
        result.current.controls.setVolume(0.5);
      });

      expect(video.volume).toBe(0.5);
      expect(result.current.state.volume).toBe(0.5);
    });

    it('setVolume() clamps to 0', () => {
      const { result, video } = renderMediaHook();

      act(() => {
        result.current.controls.setVolume(-0.5);
      });

      expect(video.volume).toBe(0);
      expect(result.current.state.volume).toBe(0);
    });

    it('setVolume() clamps to 1', () => {
      const { result, video } = renderMediaHook();

      act(() => {
        result.current.controls.setVolume(1.5);
      });

      expect(video.volume).toBe(1);
      expect(result.current.state.volume).toBe(1);
    });

    it('toggleMute() mutes when unmuted', () => {
      const { result, video } = renderMediaHook();

      act(() => {
        result.current.controls.toggleMute();
      });

      expect(video.muted).toBe(true);
      expect(result.current.state.isMuted).toBe(true);
    });

    it('toggleMute() unmutes when muted', () => {
      const { result, video } = renderMediaHook({ muted: true });

      act(() => {
        result.current.controls.toggleMute();
      });

      expect(video.muted).toBe(false);
      expect(result.current.state.isMuted).toBe(false);
    });

    it('toggleMute() works without media element', () => {
      const { result } = renderHook(() => useMedia());

      act(() => {
        result.current.controls.toggleMute();
      });

      expect(result.current.state.isMuted).toBe(true);

      act(() => {
        result.current.controls.toggleMute();
      });

      expect(result.current.state.isMuted).toBe(false);
    });

    it('setPlaybackRate() updates playback rate', () => {
      const { result, video } = renderMediaHook();

      act(() => {
        result.current.controls.setPlaybackRate(2);
      });

      expect(video.playbackRate).toBe(2);
      expect(result.current.state.playbackRate).toBe(2);
    });
  });

  // ─── Source handling ────────────────────────────────────────────────

  describe('source handling', () => {
    it('sets src and calls load when src changes', () => {
      const video = createMockVideoElement();
      const loadSpy = vi.spyOn(video, 'load');

      const hookResult = renderHook(
        ({ src }: { src?: string }) => useMedia<HTMLVideoElement>({ src }),
        { initialProps: { src: undefined as string | undefined } }
      );

      // Attach video to the ref
      (hookResult.result.current.mediaRef as React.MutableRefObject<HTMLVideoElement | null>).current = video;

      // Now rerender with a src to trigger the src effect
      hookResult.rerender({ src: 'https://example.com/video.mp4' });

      expect(video.src).toBe('https://example.com/video.mp4');
      expect(loadSpy).toHaveBeenCalled();
    });
  });

  // ─── Controls without media element ─────────────────────────────────

  describe('controls without media element', () => {
    it('play() does nothing without media element', async () => {
      const { result } = renderHook(() => useMedia());

      await act(async () => {
        await result.current.controls.play();
      });

      // Should not throw
      expect(result.current.state.isPlaying).toBe(false);
    });

    it('pause() does nothing without media element', () => {
      const { result } = renderHook(() => useMedia());

      act(() => {
        result.current.controls.pause();
      });

      expect(result.current.state.isPaused).toBe(true);
    });

    it('stop() does nothing without media element', () => {
      const { result } = renderHook(() => useMedia());

      act(() => {
        result.current.controls.stop();
      });

      expect(result.current.state.currentTime).toBe(0);
    });

    it('seek() does nothing without media element', () => {
      const { result } = renderHook(() => useMedia());

      act(() => {
        result.current.controls.seek(50);
      });

      expect(result.current.state.currentTime).toBe(0);
    });

    it('setPlaybackRate() does nothing without media element', () => {
      const { result } = renderHook(() => useMedia());

      act(() => {
        result.current.controls.setPlaybackRate(2);
      });

      expect(result.current.state.playbackRate).toBe(1);
    });
  });

  // ─── Full lifecycle ─────────────────────────────────────────────────

  describe('full lifecycle', () => {
    it('handles a complete play-pause-seek-ended lifecycle', async () => {
      const onPlay = vi.fn();
      const onPause = vi.fn();
      const onEnded = vi.fn();
      const onTimeUpdate = vi.fn();

      const { result, video } = renderMediaHook({
        onPlay,
        onPause,
        onEnded,
        onTimeUpdate,
      });

      // Load metadata
      act(() => {
        simulateLoadedMetadata(video, 100);
      });
      expect(result.current.state.duration).toBe(100);

      // Play
      act(() => {
        fireMediaEvent(video, 'play');
      });
      expect(result.current.state.isPlaying).toBe(true);
      expect(onPlay).toHaveBeenCalledTimes(1);

      // Time update
      act(() => {
        simulateTimeUpdate(video, 50);
      });
      expect(result.current.state.currentTime).toBe(50);
      expect(onTimeUpdate).toHaveBeenCalledWith(50);

      // Pause
      act(() => {
        fireMediaEvent(video, 'pause');
      });
      expect(result.current.state.isPaused).toBe(true);
      expect(onPause).toHaveBeenCalledTimes(1);

      // Seek
      act(() => {
        result.current.controls.seek(90);
      });
      expect(video.currentTime).toBe(90);

      // Ended
      act(() => {
        fireMediaEvent(video, 'ended');
      });
      expect(result.current.state.isEnded).toBe(true);
      expect(onEnded).toHaveBeenCalledTimes(1);
    });

    it('handles buffering during playback', () => {
      const { result, video } = renderMediaHook();

      act(() => {
        fireMediaEvent(video, 'play');
      });
      expect(result.current.state.isPlaying).toBe(true);

      act(() => {
        fireMediaEvent(video, 'waiting');
      });
      expect(result.current.state.isBuffering).toBe(true);

      act(() => {
        fireMediaEvent(video, 'playing');
      });
      expect(result.current.state.isBuffering).toBe(false);
      expect(result.current.state.isPlaying).toBe(true);
    });
  });
});
