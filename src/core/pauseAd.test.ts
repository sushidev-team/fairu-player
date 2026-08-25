/**
 * When a pause banner belongs on screen.
 */

import { describe, it, expect } from 'vitest';
import { shouldShow, type PauseAd } from './pauseAd';

const AD: PauseAd = { id: 'p1', imageUrl: 'https://cdn.example.test/banner.png' };

const paused = (over = {}) => ({
  isPaused: true,
  hasPlayed: true,
  pausedFor: 5,
  enabled: true,
  ...over,
});

describe('pauseAd core', () => {
  it('shows while playback is stopped', () => {
    expect(shouldShow(AD, paused())).toBe(true);
  });

  it('shows nothing while playing', () => {
    expect(shouldShow(AD, paused({ isPaused: false }))).toBe(false);
  });

  it('shows nothing before playback has ever started', () => {
    // A player sits paused before anyone presses anything. An advert over a
    // poster nobody asked to watch is the version everyone complains about.
    expect(shouldShow(AD, paused({ hasPlayed: false }))).toBe(false);
  });

  it('waits out the minimum pause', () => {
    const slow = { ...AD, minPauseDuration: 3 };

    // Separates "stopped to read something" from "nudged the scrub bar".
    expect(shouldShow(slow, paused({ pausedFor: 1 }))).toBe(false);
    expect(shouldShow(slow, paused({ pausedFor: 3 }))).toBe(true);
  });

  it('shows nothing without an ad or while switched off', () => {
    expect(shouldShow(undefined, paused())).toBe(false);
    expect(shouldShow(AD, paused({ enabled: false }))).toBe(false);
  });
});
