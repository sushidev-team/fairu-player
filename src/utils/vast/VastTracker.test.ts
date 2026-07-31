import { beforeEach, describe, expect, it } from 'vitest';
import { VastTracker } from './VastTracker';
import { VastErrorCode } from '@/types/vast';
import type { ReelAd } from '@/types/reels';

const ad: ReelAd = {
  id: 'ad-1',
  src: 'https://cdn.example.com/ad.mp4',
  duration: 20,
  skipOffset: 5,
  impressionUrls: ['https://t.example.com/imp', 'https://t2.example.com/imp'],
  errorUrls: ['https://t.example.com/err?code=[ERRORCODE]'],
  clickTrackingUrls: ['https://t.example.com/click'],
  trackingEvents: {
    creativeView: ['https://t.example.com/creativeView'],
    start: ['https://t.example.com/start'],
    firstQuartile: ['https://t.example.com/q1'],
    midpoint: ['https://t.example.com/q2'],
    thirdQuartile: ['https://t.example.com/q3'],
    complete: ['https://t.example.com/complete'],
    skip: ['https://t.example.com/skip'],
    mute: ['https://t.example.com/mute'],
    unmute: ['https://t.example.com/unmute'],
    pause: ['https://t.example.com/pause'],
    resume: ['https://t.example.com/resume'],
  },
  progressTrackings: [
    { offset: 10, url: 'https://t.example.com/p10' },
    { offset: 15, url: 'https://t.example.com/p15' },
  ],
};

let sent: string[];
let tracker: VastTracker;

beforeEach(() => {
  sent = [];
  tracker = new VastTracker(ad, { send: (url) => sent.push(url) });
});

const count = (needle: string) => sent.filter((url) => url.includes(needle)).length;

describe('VastTracker', () => {
  it('fires every impression pixel once, no matter how often it is called', () => {
    tracker.impression();
    tracker.impression();
    tracker.impression();

    expect(count('/imp')).toBe(2); // two distinct pixels, one call each
    expect(count('/creativeView')).toBe(1);
  });

  it('fires quartiles in order and only once each', () => {
    tracker.progress(1, 20);
    expect(count('/start')).toBe(1);
    expect(count('/q1')).toBe(0);

    tracker.progress(5, 20); // 25 %
    expect(count('/q1')).toBe(1);

    tracker.progress(10, 20); // 50 %
    expect(count('/q2')).toBe(1);
    expect(count('/p10')).toBe(1);

    tracker.progress(15, 20); // 75 %
    expect(count('/q3')).toBe(1);
    expect(count('/p15')).toBe(1);

    // Re-reporting the same playhead must not double-count anything.
    tracker.progress(15, 20);
    tracker.progress(16, 20);
    expect(count('/q1')).toBe(1);
    expect(count('/q2')).toBe(1);
    expect(count('/q3')).toBe(1);
    expect(count('/p10')).toBe(1);
    expect(count('/p15')).toBe(1);
  });

  it('backfills skipped quartiles when the playhead jumps', () => {
    // A seek (or a slow first timeupdate) can land past several milestones.
    tracker.progress(19, 20);

    expect(count('/start')).toBe(1);
    expect(count('/q1')).toBe(1);
    expect(count('/q2')).toBe(1);
    expect(count('/q3')).toBe(1);
    expect(count('/p10')).toBe(1);
    expect(count('/p15')).toBe(1);
  });

  it('fires complete exactly once, including the quartiles it implies', () => {
    tracker.complete();
    tracker.complete();

    expect(count('/complete')).toBe(1);
    expect(count('/q3')).toBe(1);
  });

  it('does not fire start at playhead zero', () => {
    tracker.progress(0, 20);
    expect(count('/start')).toBe(0);
  });

  it('allows repeatable interaction events to fire more than once', () => {
    tracker.paused(true);
    tracker.paused(false);
    tracker.paused(true);

    expect(count('/pause')).toBe(2);
    expect(count('/resume')).toBe(1);
  });

  it('fires mute and unmute independently', () => {
    tracker.mute(true);
    tracker.mute(false);

    expect(count('/mute')).toBe(1);
    expect(count('/unmute')).toBe(1);
  });

  it('fires skip once', () => {
    tracker.skip();
    tracker.skip();
    expect(count('/skip')).toBe(1);
  });

  it('fires click tracking without navigating', () => {
    tracker.click();
    expect(count('/click')).toBe(1);
  });

  it('substitutes [ERRORCODE] into error pixels', () => {
    tracker.error(VastErrorCode.MEDIAFILE_DISPLAY);

    const errorPixel = sent.find((url) => url.includes('/err'));
    expect(errorPixel).toBe('https://t.example.com/err?code=405');
  });

  it('stamps the ad playhead into pixels that ask for it', () => {
    const withPlayhead = new VastTracker(
      {
        ...ad,
        trackingEvents: { start: ['https://t.example.com/start?ph=[ADPLAYHEAD]'] },
        impressionUrls: [],
      },
      { send: (url) => sent.push(url) }
    );

    withPlayhead.progress(7.5, 20);

    expect(sent[0]).toBe('https://t.example.com/start?ph=00%3A00%3A07.500');
  });

  it('sends nothing after dispose', () => {
    tracker.dispose();

    tracker.impression();
    tracker.progress(10, 20);
    tracker.complete();
    tracker.click();

    expect(sent).toHaveLength(0);
  });

  it('reports every beacon it sends', () => {
    const seen: Array<[string, string]> = [];
    const observed = new VastTracker(ad, {
      send: () => {},
      onBeacon: (event, url) => seen.push([event, url]),
    });

    observed.impression();

    expect(seen.map(([event]) => event)).toEqual([
      'impression',
      'impression',
      'creativeView',
    ]);
  });
});
