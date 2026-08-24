/**
 * The sleep timer, on the React side.
 *
 * `src/core/sleepTimer.test.ts` covers the rules. What is left is the part that
 * touches a media element: pausing when the deadline passes, easing the volume
 * down first, and putting it back afterwards.
 *
 * The clock is faked throughout — a real one would make every assertion here a
 * race.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSleepTimer } from './useSleepTimer';

const T0 = 1_700_000_000_000;

/** A media element that reports its volume and remembers being paused. */
function fakeMedia(volume = 1) {
  const element = {
    volume,
    pause: vi.fn(),
  } as unknown as HTMLMediaElement & { pause: ReturnType<typeof vi.fn> };

  return { element, ref: { current: element } };
}

function advance(seconds: number) {
  act(() => {
    vi.advanceTimersByTime(seconds * 1000);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useSleepTimer', () => {
  describe('running down', () => {
    it('starts idle', () => {
      const { ref } = fakeMedia();
      const { result } = renderHook(() => useSleepTimer({ mediaRef: ref }));

      expect(result.current.state.isActive).toBe(false);
      expect(result.current.state.remainingTime).toBe(0);
    });

    it('counts a duration down', () => {
      const { ref } = fakeMedia();
      const { result } = renderHook(() => useSleepTimer({ mediaRef: ref }));

      act(() => result.current.controls.startTimer(10));
      expect(result.current.state.remainingTime).toBe(600);

      advance(60);
      expect(result.current.state.remainingTime).toBe(540);
    });

    it('pauses playback at the deadline', () => {
      const { element, ref } = fakeMedia();
      const onTimerEnd = vi.fn();
      const { result } = renderHook(() => useSleepTimer({ mediaRef: ref, onTimerEnd }));

      act(() => result.current.controls.startTimer(5));
      advance(5 * 60);

      expect(element.pause).toHaveBeenCalled();
      expect(onTimerEnd).toHaveBeenCalled();
      expect(result.current.state.isActive).toBe(false);
    });

    it('survives a tab that was asleep past the deadline', () => {
      const { element, ref } = fakeMedia();
      const { result } = renderHook(() => useSleepTimer({ mediaRef: ref }));

      act(() => result.current.controls.startTimer(45));

      // Timers are throttled or stopped in a background tab, so the ticks that
      // an interval-counting timer needed simply never happened.
      act(() => {
        vi.setSystemTime(T0 + 50 * 60_000);
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(element.pause).toHaveBeenCalled();
    });

    it('stops on request without pausing', () => {
      const { element, ref } = fakeMedia();
      const { result } = renderHook(() => useSleepTimer({ mediaRef: ref }));

      act(() => result.current.controls.startTimer(10));
      act(() => result.current.controls.stopTimer());

      expect(result.current.state.isActive).toBe(false);
      expect(element.pause).not.toHaveBeenCalled();
    });

    it('extends what is left', () => {
      const { ref } = fakeMedia();
      const { result } = renderHook(() => useSleepTimer({ mediaRef: ref }));

      act(() => result.current.controls.startTimer(10));
      advance(9 * 60);
      expect(result.current.state.remainingTime).toBe(60);

      act(() => result.current.controls.extendTimer(15));

      expect(result.current.state.remainingTime).toBe(16 * 60);
    });
  });

  describe('end of track', () => {
    it('follows the playhead rather than the clock', () => {
      const { ref } = fakeMedia();
      const { result, rerender } = renderHook(
        ({ time }: { time: number }) =>
          useSleepTimer({ mediaRef: ref, currentTime: time, duration: 400 }),
        { initialProps: { time: 100 } }
      );

      act(() => result.current.controls.startTimer('endOfTrack'));
      expect(result.current.state.remainingTime).toBe(300);

      // Paused for ten minutes; the track has not moved, so neither has this.
      advance(600);
      expect(result.current.state.remainingTime).toBe(300);

      rerender({ time: 200 });
      expect(result.current.state.remainingTime).toBe(200);
    });

    it('pauses when the track runs out', () => {
      const { element, ref } = fakeMedia();
      const { result, rerender } = renderHook(
        ({ time }: { time: number }) =>
          useSleepTimer({ mediaRef: ref, currentTime: time, duration: 400 }),
        { initialProps: { time: 100 } }
      );

      act(() => result.current.controls.startTimer('endOfTrack'));
      rerender({ time: 400 });
      advance(1);

      expect(element.pause).toHaveBeenCalled();
    });

    it('does not fire before the duration is known', () => {
      const { element, ref } = fakeMedia();
      const { result } = renderHook(() =>
        useSleepTimer({ mediaRef: ref, currentTime: 0, duration: 0 })
      );

      act(() => result.current.controls.startTimer('endOfTrack'));
      advance(5);

      // Duration is 0 until loadedmetadata; firing here would stop playback the
      // instant the timer was set.
      expect(element.pause).not.toHaveBeenCalled();
      expect(result.current.state.isActive).toBe(true);
    });
  });

  describe('fading out', () => {
    it('leaves the volume alone outside the window', () => {
      const { element, ref } = fakeMedia(0.8);
      const { result } = renderHook(() =>
        useSleepTimer({ mediaRef: ref, fadeOut: true, fadeOutDuration: 30 })
      );

      act(() => result.current.controls.startTimer(5));
      advance(60);

      expect(element.volume).toBe(0.8);
      expect(result.current.state.isFadingOut).toBe(false);
    });

    it('eases the volume down inside it', () => {
      const { element, ref } = fakeMedia(0.8);
      const { result } = renderHook(() =>
        useSleepTimer({ mediaRef: ref, fadeOut: true, fadeOutDuration: 30 })
      );

      act(() => result.current.controls.startTimer(1));
      advance(45);

      expect(result.current.state.isFadingOut).toBe(true);
      // 15s of a 30s fade, from a starting volume of 0.8.
      expect(element.volume).toBeCloseTo(0.4);
    });

    it('puts the volume back when the timer ends', () => {
      const { element, ref } = fakeMedia(0.8);
      const { result } = renderHook(() =>
        useSleepTimer({ mediaRef: ref, fadeOut: true, fadeOutDuration: 30 })
      );

      act(() => result.current.controls.startTimer(1));
      advance(60);

      // Otherwise the next play starts almost silent, and nobody knows why.
      expect(element.pause).toHaveBeenCalled();
      expect(element.volume).toBe(0.8);
    });

    it('puts the volume back when the timer is cancelled mid-fade', () => {
      const { element, ref } = fakeMedia(0.8);
      const { result } = renderHook(() =>
        useSleepTimer({ mediaRef: ref, fadeOut: true, fadeOutDuration: 30 })
      );

      act(() => result.current.controls.startTimer(1));
      advance(45);
      act(() => result.current.controls.stopTimer());

      expect(element.volume).toBe(0.8);
    });

    it('puts the volume back when the timer is extended mid-fade', () => {
      const { element, ref } = fakeMedia(0.8);
      const { result } = renderHook(() =>
        useSleepTimer({ mediaRef: ref, fadeOut: true, fadeOutDuration: 30 })
      );

      act(() => result.current.controls.startTimer(1));
      advance(45);
      act(() => result.current.controls.extendTimer(10));

      expect(element.volume).toBe(0.8);
      expect(result.current.state.isFadingOut).toBe(false);
    });

    it('puts the volume back on unmount', () => {
      const { element, ref } = fakeMedia(0.8);
      const { result, unmount } = renderHook(() =>
        useSleepTimer({ mediaRef: ref, fadeOut: true, fadeOutDuration: 30 })
      );

      act(() => result.current.controls.startTimer(1));
      advance(45);
      unmount();

      expect(element.volume).toBe(0.8);
    });

    it('does nothing when fading is off', () => {
      const { element, ref } = fakeMedia(0.8);
      const { result } = renderHook(() => useSleepTimer({ mediaRef: ref }));

      act(() => result.current.controls.startTimer(1));
      advance(45);

      expect(element.volume).toBe(0.8);
      expect(result.current.state.isFadingOut).toBe(false);
    });
  });

  describe('without a media element', () => {
    it('still runs and still ends', () => {
      const onTimerEnd = vi.fn();
      const { result } = renderHook(() =>
        useSleepTimer({ mediaRef: { current: null }, onTimerEnd })
      );

      act(() => result.current.controls.startTimer(1));
      expect(() => advance(60)).not.toThrow();

      expect(onTimerEnd).toHaveBeenCalled();
    });
  });
});
