/**
 * The React side of A-B repeat.
 *
 * `src/core/abLoop.test.ts` covers the rules. What is left to prove here is the
 * part only React can get wrong: that the controls survive a playhead that
 * moves several times a second, and that reaching B asks for exactly one seek
 * per lap rather than one per `timeupdate`.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useABLoop } from './useABLoop';

/** Drive the hook the way a player does: a new `currentTime` on every render. */
function playing(onSeek: (time: number) => void = () => {}) {
  const { result, rerender } = renderHook(
    ({ time }: { time: number }) =>
      // An inline arrow, as every caller writes it.
      useABLoop({ currentTime: time, onSeek: (t) => onSeek(t) }),
    { initialProps: { time: 0 } }
  );

  return {
    result,
    /** Report a new playhead position. */
    advanceTo(time: number) {
      rerender({ time });
    },
  };
}

describe('useABLoop', () => {
  describe('marking the points', () => {
    it('takes the points from the playhead when none is given', () => {
      const { result, advanceTo } = playing();

      advanceTo(10);
      act(() => result.current.controls.setA());
      advanceTo(25);
      act(() => result.current.controls.setB());

      expect(result.current.state).toMatchObject({
        loopStart: 10,
        loopEnd: 25,
        isLooping: true,
      });
    });

    it('takes an explicit time', () => {
      const { result } = playing();

      act(() => result.current.controls.setA(4));
      act(() => result.current.controls.setB(8));

      expect(result.current.state).toMatchObject({ loopStart: 4, loopEnd: 8 });
    });

    it('clears both points', () => {
      const { result } = playing();

      act(() => result.current.controls.setA(4));
      act(() => result.current.controls.setB(8));
      act(() => result.current.controls.clearLoop());

      expect(result.current.state).toMatchObject({
        loopStart: null,
        loopEnd: null,
        isLooping: false,
      });
    });

    it('ignores the controls while disabled', () => {
      const { result } = renderHook(() =>
        useABLoop({ currentTime: 5, onSeek: () => {}, enabled: false })
      );

      act(() => result.current.controls.setA(4));
      act(() => result.current.controls.setB(8));

      expect(result.current.state.isLooping).toBe(false);
    });
  });

  describe('identity', () => {
    it('keeps the controls stable while the playhead moves', () => {
      const { result, advanceTo } = playing();
      const first = result.current.controls;

      advanceTo(1);
      advanceTo(2);
      advanceTo(3);

      // Controls rebuilt several times a second defeat every memo a consumer
      // wraps around them — and `onSeek` is an inline arrow at every call site.
      expect(result.current.controls).toBe(first);
    });

    it('keeps the state stable until a point moves', () => {
      const { result, advanceTo } = playing();
      act(() => result.current.controls.setA(4));
      const first = result.current.state;

      advanceTo(1);
      advanceTo(2);

      expect(result.current.state).toBe(first);
    });
  });

  describe('looping', () => {
    it('seeks back to A on reaching B', () => {
      const onSeek = vi.fn();
      const { result, advanceTo } = playing(onSeek);

      act(() => result.current.controls.setA(10));
      act(() => result.current.controls.setB(20));

      advanceTo(19);
      expect(onSeek).not.toHaveBeenCalled();

      advanceTo(20);
      expect(onSeek).toHaveBeenCalledWith(10);
    });

    it('asks once per lap, not once per timeupdate', () => {
      const onSeek = vi.fn();
      const { result, advanceTo } = playing(onSeek);

      act(() => result.current.controls.setA(10));
      act(() => result.current.controls.setB(20));

      // The element does not move the instant it is told to, so the next few
      // updates still read past B.
      advanceTo(20);
      advanceTo(20.1);
      advanceTo(20.2);

      expect(onSeek).toHaveBeenCalledTimes(1);
    });

    it('loops again on the next lap', () => {
      const onSeek = vi.fn();
      const { result, advanceTo } = playing(onSeek);

      act(() => result.current.controls.setA(10));
      act(() => result.current.controls.setB(20));

      advanceTo(20);
      advanceTo(10);   // the seek landed
      advanceTo(15);
      advanceTo(20);

      expect(onSeek).toHaveBeenCalledTimes(2);
    });

    it('does nothing with only one point marked', () => {
      const onSeek = vi.fn();
      const { result, advanceTo } = playing(onSeek);

      act(() => result.current.controls.setA(10));
      advanceTo(50);

      expect(onSeek).not.toHaveBeenCalled();
    });

    it('stops looping once the points are cleared', () => {
      const onSeek = vi.fn();
      const { result, advanceTo } = playing(onSeek);

      act(() => result.current.controls.setA(10));
      act(() => result.current.controls.setB(20));
      act(() => result.current.controls.clearLoop());

      advanceTo(25);

      expect(onSeek).not.toHaveBeenCalled();
    });

    it('does not loop while disabled', () => {
      const onSeek = vi.fn();
      const { result, rerender } = renderHook(
        ({ time }: { time: number }) =>
          useABLoop({ currentTime: time, onSeek, enabled: false }),
        { initialProps: { time: 0 } }
      );

      act(() => result.current.controls.setA(10));
      rerender({ time: 50 });

      expect(onSeek).not.toHaveBeenCalled();
    });

    it('picks the loop back up after a seek out of it', () => {
      const onSeek = vi.fn();
      const { result, advanceTo } = playing(onSeek);

      act(() => result.current.controls.setA(10));
      act(() => result.current.controls.setB(20));

      advanceTo(20);
      expect(onSeek).toHaveBeenCalledTimes(1);

      // The viewer scrubbed away and back — the loop is still set, so it holds.
      advanceTo(2);
      advanceTo(30);

      expect(onSeek).toHaveBeenCalledTimes(2);
      expect(onSeek).toHaveBeenLastCalledWith(10);
    });
  });
});
