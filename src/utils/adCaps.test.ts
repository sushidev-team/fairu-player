import { describe, expect, it } from 'vitest';
import { capPodDuration, checkAdCaps, createAdSession, recordAdStarted } from './adCaps';

const NOW = 1_700_000_000_000;

describe('checkAdCaps', () => {
  it('allows a break when no rules are configured', () => {
    expect(checkAdCaps(undefined, createAdSession(), NOW)).toBeNull();
    expect(checkAdCaps({}, createAdSession(), NOW)).toBeNull();
  });

  it('caps once the session limit is reached', () => {
    const session = { adsShown: 3, lastAdStartedAt: 0 };

    expect(checkAdCaps({ maxAdsPerSession: 4 }, session, NOW)).toBeNull();
    expect(checkAdCaps({ maxAdsPerSession: 3 }, session, NOW)).toBe('session-cap');
  });

  it('enforces a minimum gap between breaks', () => {
    const session = { adsShown: 1, lastAdStartedAt: NOW - 60_000 };

    expect(checkAdCaps({ minSecondsBetweenAds: 60 }, session, NOW)).toBeNull();
    expect(checkAdCaps({ minSecondsBetweenAds: 120 }, session, NOW)).toBe('pacing');
  });

  it('does not pace the first break of a session', () => {
    // `lastAdStartedAt: 0` means nothing has played, not "played at the epoch".
    const session = createAdSession();
    expect(checkAdCaps({ minSecondsBetweenAds: 600 }, session, NOW)).toBeNull();
  });

  it('reports the session cap before pacing', () => {
    // Both apply; the session cap is the one the host can do nothing about.
    const session = { adsShown: 2, lastAdStartedAt: NOW - 1000 };
    expect(checkAdCaps({ maxAdsPerSession: 2, minSecondsBetweenAds: 60 }, session, NOW)).toBe(
      'session-cap'
    );
  });
});

describe('recordAdStarted', () => {
  it('advances the counters without mutating the previous state', () => {
    const before = createAdSession();
    const after = recordAdStarted(before, NOW);

    expect(after).toEqual({ adsShown: 1, lastAdStartedAt: NOW });
    expect(before).toEqual({ adsShown: 0, lastAdStartedAt: 0 });
  });

  it('closes the pacing window it opened', () => {
    const session = recordAdStarted(createAdSession(), NOW);
    expect(checkAdCaps({ minSecondsBetweenAds: 60 }, session, NOW + 30_000)).toBe('pacing');
    expect(checkAdCaps({ minSecondsBetweenAds: 60 }, session, NOW + 61_000)).toBeNull();
  });
});

describe('capPodDuration', () => {
  const pod = [
    { id: 'a', duration: 15 },
    { id: 'b', duration: 15 },
    { id: 'c', duration: 30 },
  ];

  it('passes the pod through when no cap applies', () => {
    expect(capPodDuration(pod, undefined)).toBe(pod);
    expect(capPodDuration(pod, 0)).toBe(pod);
    expect(capPodDuration(pod, 60)).toEqual(pod);
  });

  it('trims to the last ad that still fits', () => {
    expect(capPodDuration(pod, 30).map((a) => a.id)).toEqual(['a', 'b']);
    expect(capPodDuration(pod, 45).map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('keeps the first ad even when it alone exceeds the cap', () => {
    // The first spot is the one that was sold; the impression is owed either
    // way, and an empty break is not something the ad server was told about.
    expect(capPodDuration([{ id: 'long', duration: 90 }], 30).map((a) => a.id)).toEqual(['long']);
  });

  it('handles an empty pod', () => {
    expect(capPodDuration([], 30)).toEqual([]);
  });

  it('treats a missing duration as zero rather than dropping the ad', () => {
    const withUnknown = [{ id: 'a', duration: 0 }, { id: 'b', duration: 15 }];
    expect(capPodDuration(withUnknown, 15).map((a) => a.id)).toEqual(['a', 'b']);
  });
});
