/**
 * When a rewarded spot counts as watched.
 */

import { describe, it, expect } from 'vitest';
import { REWARD_THRESHOLD, remainingSeconds, rewardProgress } from './rewardedAd';

describe('rewardedAd core', () => {
  describe('progress', () => {
    it('reports how far along the spot is', () => {
      expect(rewardProgress(15, 30)).toEqual({ percentage: 50, earned: false });
    });

    it('earns the reward just short of the end', () => {
      // A media element rarely reports the last fraction of a second, and a
      // reward withheld at 29.8 of 30 is a support ticket.
      expect(rewardProgress(28.5, 30).earned).toBe(true);
      expect(rewardProgress(30 * REWARD_THRESHOLD, 30).earned).toBe(true);
    });

    it('does not earn it early', () => {
      expect(rewardProgress(28, 30).earned).toBe(false);
    });

    it('clamps past the end', () => {
      expect(rewardProgress(99, 30)).toEqual({ percentage: 100, earned: true });
    });

    it('reports nothing before a duration is known', () => {
      expect(rewardProgress(5, 0)).toEqual({ percentage: 0, earned: false });
      expect(rewardProgress(5, Number.NaN)).toEqual({ percentage: 0, earned: false });
      expect(rewardProgress(Number.NaN, 30)).toEqual({ percentage: 0, earned: false });
    });

    it('never goes negative', () => {
      expect(rewardProgress(-5, 30).percentage).toBe(0);
    });
  });

  describe('the countdown', () => {
    it('counts to the threshold, not to the end', () => {
      expect(remainingSeconds(0, 30)).toBe(29);
      expect(remainingSeconds(20, 30)).toBe(9);
    });

    it('rounds up, so it never shows zero while the reward is out of reach', () => {
      expect(remainingSeconds(28.2, 30)).toBe(1);
    });

    it('shows zero once it is earned', () => {
      expect(remainingSeconds(29, 30)).toBe(0);
      expect(remainingSeconds(5, 0)).toBe(0);
    });
  });
});
