/**
 * The sleep timer rules, without a renderer.
 *
 * The point of this design is that nothing counts: the deadline is stored and
 * the remaining time is derived from the clock. So the tests move the clock
 * rather than the timer, including in the jump a backgrounded tab produces.
 */

import { describe, it, expect } from 'vitest';
import * as core from './sleepTimer';

const T0 = 1_700_000_000_000;
const MIN = 60_000;

describe('sleepTimer core', () => {
  describe('arming', () => {
    it('stores a deadline for a duration', () => {
      const timer = core.start(30, T0);

      expect(timer).toEqual({ mode: 30, endsAt: T0 + 30 * MIN });
      expect(core.isActive(timer)).toBe(true);
    });

    it('stores no deadline for end of track', () => {
      const timer = core.start('endOfTrack', T0);

      // That one follows the playhead; pausing a podcast should not eat into it.
      expect(timer).toEqual({ mode: 'endOfTrack', endsAt: null });
    });

    it('refuses a duration that is not one', () => {
      expect(core.start(0, T0)).toEqual(core.idleSleepTimer);
      expect(core.start(-10, T0)).toEqual(core.idleSleepTimer);
      expect(core.start(Number.NaN, T0)).toEqual(core.idleSleepTimer);
    });

    it('is idle to begin with', () => {
      expect(core.isActive(core.idleSleepTimer)).toBe(false);
      expect(core.remainingSeconds(core.idleSleepTimer, T0)).toBe(0);
    });
  });

  describe('counting down', () => {
    it('derives the remaining time from the clock', () => {
      const timer = core.start(10, T0);

      expect(core.remainingSeconds(timer, T0)).toBe(600);
      expect(core.remainingSeconds(timer, T0 + 4 * MIN)).toBe(360);
    });

    it('survives a clock that jumped', () => {
      const timer = core.start(45, T0);

      // A backgrounded tab or a sleeping phone stops firing timers entirely.
      // Nothing here counted, so nothing was missed.
      expect(core.remainingSeconds(timer, T0 + 44 * MIN)).toBe(60);
      expect(core.hasExpired(timer, T0 + 44 * MIN)).toBe(false);
      expect(core.hasExpired(timer, T0 + 46 * MIN)).toBe(true);
    });

    it('never reads below zero', () => {
      const timer = core.start(5, T0);

      expect(core.remainingSeconds(timer, T0 + 60 * MIN)).toBe(0);
    });

    it('follows the playhead in end-of-track mode', () => {
      const timer = core.start('endOfTrack', T0);

      expect(core.remainingSeconds(timer, T0, { currentTime: 100, duration: 400 })).toBe(300);
      // The wall clock has moved a long way; the track has not.
      expect(
        core.remainingSeconds(timer, T0 + 60 * MIN, { currentTime: 100, duration: 400 })
      ).toBe(300);
    });

    it('waits for metadata in end-of-track mode', () => {
      const timer = core.start('endOfTrack', T0);

      // Duration is 0 until loadedmetadata. Expiring here would stop playback
      // the instant the timer was set.
      expect(core.hasExpired(timer, T0, { currentTime: 0, duration: 0 })).toBe(false);
      expect(core.hasExpired(timer, T0)).toBe(false);
    });

    it('expires at the end of the track', () => {
      const timer = core.start('endOfTrack', T0);

      expect(core.hasExpired(timer, T0, { currentTime: 399, duration: 400 })).toBe(false);
      expect(core.hasExpired(timer, T0, { currentTime: 400, duration: 400 })).toBe(true);
    });

    it('reports nothing expired while idle', () => {
      expect(core.hasExpired(core.idleSleepTimer, T0)).toBe(false);
    });
  });

  describe('extending', () => {
    it('adds to what is left, not to the original', () => {
      const timer = core.start(30, T0);
      const later = T0 + 25 * MIN;

      const extended = core.extend(timer, 15, later);

      // Five minutes remained, so twenty are left — not forty-five.
      expect(core.remainingSeconds(extended, later)).toBe(20 * 60);
    });

    it('turns an end-of-track timer into a duration', () => {
      const timer = core.start('endOfTrack', T0);
      const media = { currentTime: 380, duration: 400 };

      const extended = core.extend(timer, 10, T0, media);

      // There is no more track to wait for; the viewer asked for more time.
      expect(extended.mode).toBe(10);
      expect(core.remainingSeconds(extended, T0)).toBe(20 + 10 * 60);
    });

    it('leaves an idle timer alone', () => {
      expect(core.extend(core.idleSleepTimer, 10, T0)).toEqual(core.idleSleepTimer);
    });

    it('refuses an extension that is not one', () => {
      const timer = core.start(30, T0);

      expect(core.extend(timer, 0, T0)).toBe(timer);
      expect(core.extend(timer, Number.NaN, T0)).toBe(timer);
    });
  });

  describe('fading out', () => {
    it('stays at full volume outside the window', () => {
      expect(core.fadeMultiplier(120, 30)).toBe(1);
      expect(core.fadeMultiplier(30, 30)).toBe(1);
    });

    it('falls away across the window', () => {
      expect(core.fadeMultiplier(15, 30)).toBe(0.5);
      expect(core.fadeMultiplier(3, 30)).toBeCloseTo(0.1);
      expect(core.fadeMultiplier(0, 30)).toBe(0);
    });

    it('clamps past the deadline', () => {
      expect(core.fadeMultiplier(-5, 30)).toBe(0);
    });

    it('does nothing without a window', () => {
      expect(core.fadeMultiplier(5, 0)).toBe(1);
    });
  });

  describe('formatRemaining', () => {
    it('writes a countdown', () => {
      expect(core.formatRemaining(7)).toBe('0:07');
      expect(core.formatRemaining(299)).toBe('4:59');
      expect(core.formatRemaining(3605)).toBe('1:00:05');
    });

    it('rounds up, so it never shows 0:00 while time remains', () => {
      expect(core.formatRemaining(0.4)).toBe('0:01');
    });

    it('shows zero for nothing left', () => {
      expect(core.formatRemaining(0)).toBe('0:00');
      expect(core.formatRemaining(Number.NaN)).toBe('0:00');
    });
  });
});
