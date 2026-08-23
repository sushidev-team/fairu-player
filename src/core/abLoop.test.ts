/**
 * The A-B repeat rules, without a renderer.
 *
 * The interesting cases are the ones a viewer produces by accident: marking the
 * points in the wrong order, marking both at the same spot, or holding a loop
 * while seeking around it.
 */

import { describe, it, expect } from 'vitest';
import * as core from './abLoop';

describe('abLoop core', () => {
  describe('purity', () => {
    it('never mutates the loop it is given', () => {
      const loop: core.ABLoop = { start: 10, end: 20 };
      const snapshot = JSON.stringify(loop);

      core.setStart(loop, 5);
      core.setEnd(loop, 30);
      core.seekTarget(loop, 25);

      expect(JSON.stringify(loop)).toBe(snapshot);
    });
  });

  describe('placing the points', () => {
    it('starts with neither point set', () => {
      expect(core.noLoop).toEqual({ start: null, end: null });
      expect(core.isLooping(core.noLoop)).toBe(false);
    });

    it('takes A and B in order', () => {
      const loop = core.setEnd(core.setStart(core.noLoop, 10), 20);

      expect(loop).toEqual({ start: 10, end: 20 });
      expect(core.isLooping(loop)).toBe(true);
    });

    it('swaps when B is marked before A', () => {
      // The viewer pressed B at 10 and then A at 20 — they meant the span.
      const loop = core.setStart(core.setEnd(core.noLoop, 10), 20);

      expect(loop).toEqual({ start: 10, end: 20 });
    });

    it('swaps when A is dragged past B', () => {
      const loop = core.setStart({ start: 5, end: 20 }, 30);

      expect(loop).toEqual({ start: 20, end: 30 });
    });

    it('swaps when B is dragged before A', () => {
      const loop = core.setEnd({ start: 20, end: 40 }, 5);

      expect(loop).toEqual({ start: 5, end: 20 });
    });

    it('moves a point without disturbing the other', () => {
      expect(core.setStart({ start: 5, end: 20 }, 8)).toEqual({ start: 8, end: 20 });
      expect(core.setEnd({ start: 5, end: 20 }, 15)).toEqual({ start: 5, end: 15 });
    });

    it('clamps a negative time to the start of the media', () => {
      expect(core.setStart(core.noLoop, -30)).toEqual({ start: 0, end: null });
    });

    it('refuses a time that is not a number', () => {
      const loop: core.ABLoop = { start: 5, end: 20 };

      // These reach `currentTime` unchallenged otherwise, and an element with a
      // NaN position does not play.
      expect(core.setStart(loop, Number.NaN)).toBe(loop);
      expect(core.setEnd(loop, Number.POSITIVE_INFINITY)).toBe(loop);
    });

    it('clears both points', () => {
      expect(core.clear()).toEqual({ start: null, end: null });
    });
  });

  describe('what counts as looping', () => {
    it('needs both points', () => {
      expect(core.isLooping({ start: 10, end: null })).toBe(false);
      expect(core.isLooping({ start: null, end: 10 })).toBe(false);
    });

    it('does not loop a zero-length span', () => {
      // Both markers stay visible — the viewer is mid-way through defining the
      // loop — but jumping to the position playback is already at would wedge it.
      const loop = core.setEnd(core.setStart(core.noLoop, 12), 12);

      expect(loop).toEqual({ start: 12, end: 12 });
      expect(core.isLooping(loop)).toBe(false);
      expect(core.seekTarget(loop, 12)).toBeNull();
    });

    it('reports the span', () => {
      expect(core.loopDuration({ start: 10, end: 25 })).toBe(15);
      expect(core.loopDuration({ start: 10, end: null })).toBeNull();
    });
  });

  describe('deciding to jump', () => {
    const loop: core.ABLoop = { start: 10, end: 20 };

    it('leaves playback alone inside the loop', () => {
      expect(core.seekTarget(loop, 15)).toBeNull();
    });

    it('jumps back to A on reaching B', () => {
      expect(core.seekTarget(loop, 20)).toBe(10);
    });

    it('jumps back when the playhead is observed past B', () => {
      // `timeupdate` fires a few times a second, so B is never sampled exactly.
      expect(core.seekTarget(loop, 20.3)).toBe(10);
    });

    it('jumps back from before A as well', () => {
      // Seeking to the very end of a video with a loop set still belongs in the
      // loop; the rule is about where the playhead is, not how it got there.
      expect(core.seekTarget(loop, 99)).toBe(10);
    });

    it('leaves playback alone before A', () => {
      expect(core.seekTarget(loop, 3)).toBeNull();
    });

    it('does nothing without a complete loop', () => {
      expect(core.seekTarget({ start: 10, end: null }, 50)).toBeNull();
      expect(core.seekTarget(core.noLoop, 50)).toBeNull();
    });
  });
});
