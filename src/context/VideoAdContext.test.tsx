/**
 * Behavioural tests for the classic player's ad tracking.
 *
 * `VideoAdContext` was moved onto the shared `VastTracker`, which changed how
 * the *released* player fires pixels. The three defects that motivated it —
 * one-URL-per-event, no macro substitution, plain `fetch` — are each pinned
 * here so they cannot come back.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { VideoAdProvider, useVideoAds } from './VideoAdContext';
import type { VideoAd, VideoAdBreak, VideoAdConfig } from '@/types/video';

/** Captures every pixel the player attempts to send. */
let beacons: string[];

beforeEach(() => {
  beacons = [];
  // The tracker prefers sendBeacon and falls back to fetch; stub both so a
  // change of transport cannot make these tests silently pass.
  vi.stubGlobal('navigator', {
    ...globalThis.navigator,
    sendBeacon: (url: string) => {
      beacons.push(url);
      return true;
    },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      beacons.push(String(url));
      return Promise.resolve({ ok: true } as Response);
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const count = (needle: string) => beacons.filter((u) => u.includes(needle)).length;

/**
 * Harness that owns the ad `<video>` and exposes the controls, mirroring what
 * `VideoPlayer` does.
 */
function Harness({
  config,
  onReady,
}: {
  config: VideoAdConfig;
  onReady: (api: {
    controls: ReturnType<typeof useVideoAds>['controls'];
    video: HTMLVideoElement | null;
  }) => void;
}) {
  return (
    <VideoAdProvider config={config}>
      <Inner onReady={onReady} />
    </VideoAdProvider>
  );
}

function Inner({ onReady }: { onReady: Parameters<typeof Harness>[0]['onReady'] }) {
  const { controls, adVideoRef } = useVideoAds();
  return (
    <video
      ref={(el) => {
        // `adVideoRef` is exposed as a read-only RefObject; the player assigns
        // it through JSX's `ref=`, which a callback ref cannot express in types.
        (adVideoRef as { current: HTMLVideoElement | null }).current = el;
        onReady({ controls, video: el });
      }}
      data-testid="ad-video"
    />
  );
}

/** Drive the ad element's playhead and emit `timeupdate`. */
function tick(video: HTMLVideoElement, currentTime: number, duration: number) {
  Object.defineProperty(video, 'currentTime', { configurable: true, value: currentTime });
  Object.defineProperty(video, 'duration', { configurable: true, value: duration });
  act(() => {
    video.dispatchEvent(new Event('timeupdate'));
  });
}

const adBreak = (ads: VideoAd[]): VideoAdBreak => ({ id: 'break-1', position: 'pre-roll', ads });

/** An ad carrying several URLs per event, as a wrapper chain produces. */
const WRAPPED_AD: VideoAd = {
  id: 'wrapped',
  src: 'https://cdn.example.com/ad.mp4',
  duration: 20,
  skipAfterSeconds: 5,
  clickThroughUrl: 'https://example.com/landing',
  trackingUrls: {
    impression: ['https://ssp.example.com/imp', 'https://dsp.example.com/imp'],
    start: ['https://dsp.example.com/start'],
    firstQuartile: ['https://dsp.example.com/q1', 'https://ssp.example.com/q1'],
    midpoint: ['https://dsp.example.com/q2'],
    thirdQuartile: ['https://dsp.example.com/q3'],
    complete: ['https://dsp.example.com/complete', 'https://ssp.example.com/complete'],
    skip: ['https://dsp.example.com/skip'],
    click: ['https://dsp.example.com/click', 'https://ssp.example.com/click'],
    progress: [{ offset: 8, url: 'https://dsp.example.com/p8' }],
  },
};

describe('VideoAdContext tracking', () => {
  let api: { controls: ReturnType<typeof useVideoAds>['controls']; video: HTMLVideoElement | null };

  const start = (config: Partial<VideoAdConfig> = {}, ad: VideoAd = WRAPPED_AD) => {
    render(
      <Harness
        config={{ enabled: true, ...config }}
        onReady={(next) => {
          api = next;
        }}
      />
    );
    act(() => api.controls.startAdBreak(adBreak([ad])));
    return api.video!;
  };

  it('fires every impression URL, not just the first', () => {
    // The regression: `impression` used to be typed `string`, so a wrapper
    // chain's second pixel was dropped.
    start();
    expect(count('/imp')).toBe(2);
  });

  it('substitutes macros instead of sending them verbatim', () => {
    start({}, {
      ...WRAPPED_AD,
      trackingUrls: { impression: 'https://t.example.com/imp?cb=[CACHEBUSTING]' },
    });

    expect(beacons[0]).toMatch(/cb=\d{8}$/);
    expect(beacons.join(' ')).not.toContain('[CACHEBUSTING]');
  });

  it('fires each quartile once, with all of its URLs', () => {
    const video = start();
    beacons.length = 0;

    tick(video, 1, 20);
    expect(count('/start')).toBe(1);
    expect(count('/q1')).toBe(0);

    tick(video, 5, 20); // 25 %
    expect(count('/q1')).toBe(2); // dsp + ssp

    tick(video, 10, 20); // 50 %
    expect(count('/q2')).toBe(1);
    expect(count('/p8')).toBe(1); // offset-based progress

    tick(video, 15, 20); // 75 %
    expect(count('/q3')).toBe(1);

    // Re-reporting the same playhead must not double-count.
    tick(video, 15, 20);
    tick(video, 16, 20);
    expect(count('/q1')).toBe(2);
    expect(count('/q2')).toBe(1);
    expect(count('/q3')).toBe(1);
    expect(count('/p8')).toBe(1);
  });

  it('fires the lifecycle callbacks exactly once each', () => {
    const onFirstQuartile = vi.fn();
    const onMidpoint = vi.fn();
    const onThirdQuartile = vi.fn();

    const video = start({ onFirstQuartile, onMidpoint, onThirdQuartile });

    tick(video, 6, 20);
    tick(video, 11, 20);
    tick(video, 16, 20);
    tick(video, 17, 20); // extra updates must not re-fire

    expect(onFirstQuartile).toHaveBeenCalledTimes(1);
    expect(onMidpoint).toHaveBeenCalledTimes(1);
    expect(onThirdQuartile).toHaveBeenCalledTimes(1);
  });

  it('fires lifecycle callbacks even when the ad declares no pixels', () => {
    // These must not depend on a URL existing for the event.
    const onMidpoint = vi.fn();
    const video = start({ onMidpoint }, { id: 'bare', src: 'x.mp4', duration: 10 });

    tick(video, 6, 10);

    expect(onMidpoint).toHaveBeenCalledTimes(1);
    expect(beacons).toHaveLength(0);
  });

  it('fires complete on ended, with all URLs', () => {
    const onAdComplete = vi.fn();
    const video = start({ onAdComplete });
    beacons.length = 0;

    tick(video, 20, 20);
    act(() => {
      video.dispatchEvent(new Event('ended'));
    });

    expect(count('/complete')).toBe(2);
    expect(onAdComplete).toHaveBeenCalledTimes(1);
  });

  it('fires skip only once skipping is allowed', () => {
    const video = start();

    // Before the skip offset the control is a no-op.
    act(() => api.controls.skipAd());
    expect(count('/skip')).toBe(0);

    // The countdown is driven by a timer; simulate it elapsing.
    vi.useFakeTimers();
    const video2 = start({ defaultSkipAfter: 0 }, { ...WRAPPED_AD, skipAfterSeconds: 0 });
    beacons.length = 0;
    act(() => api.controls.skipAd());
    expect(count('/skip')).toBe(1);
    expect(video2).toBeTruthy();
    expect(video).toBeTruthy();
  });

  it('fires all click-tracking URLs on click-through', () => {
    start();
    beacons.length = 0;

    act(() => api.controls.clickThrough());

    expect(count('/click')).toBe(2);
  });

  it('fires the error pixel with [ERRORCODE] filled in', () => {
    const video = start({}, {
      ...WRAPPED_AD,
      trackingUrls: { error: 'https://t.example.com/err?code=[ERRORCODE]' },
    });
    beacons.length = 0;

    act(() => {
      video.dispatchEvent(new Event('error'));
    });

    expect(beacons.find((u) => u.includes('/err'))).toBe('https://t.example.com/err?code=405');
  });

  it('fires pause and resume, which are repeatable', () => {
    const video = start();
    beacons.length = 0;

    act(() => video.dispatchEvent(new Event('pause')));
    act(() => video.dispatchEvent(new Event('play')));
    act(() => video.dispatchEvent(new Event('pause')));

    expect(count('/pause')).toBe(0); // this ad declares none
    // Prove the path works with an ad that does declare them.
    const video2 = start({}, {
      ...WRAPPED_AD,
      trackingUrls: { pause: 'https://t.example.com/pause', resume: 'https://t.example.com/resume' },
    });
    beacons.length = 0;
    act(() => video2.dispatchEvent(new Event('pause')));
    act(() => video2.dispatchEvent(new Event('play')));
    act(() => video2.dispatchEvent(new Event('pause')));

    expect(count('/pause')).toBe(2);
    expect(count('/resume')).toBe(1);
  });

  it('keeps hand-authored single-string tracking working', () => {
    // Backwards compatibility: configs written against 1.2.0 must not break.
    const video = start({}, {
      id: 'legacy',
      src: 'https://cdn.example.com/a.mp4',
      duration: 10,
      trackingUrls: {
        impression: 'https://t.example.com/imp',
        complete: 'https://t.example.com/complete',
      },
    });

    expect(count('/imp')).toBe(1);

    tick(video, 10, 10);
    act(() => video.dispatchEvent(new Event('ended')));
    expect(count('/complete')).toBe(1);
  });

  it('scopes "fire once" to a single ad, so a pod counts each member', () => {
    const first: VideoAd = {
      id: 'pod-1',
      src: 'a.mp4',
      duration: 10,
      trackingUrls: { impression: 'https://t.example.com/pod1/imp' },
    };
    const second: VideoAd = {
      id: 'pod-2',
      src: 'b.mp4',
      duration: 10,
      trackingUrls: { impression: 'https://t.example.com/pod2/imp' },
    };

    render(
      <Harness
        config={{ enabled: true }}
        onReady={(next) => {
          api = next;
        }}
      />
    );
    act(() => api.controls.startAdBreak(adBreak([first, second])));

    expect(count('/pod1/imp')).toBe(1);

    // Ending the first ad advances the pod; the second gets its own impression.
    const video = api.video!;
    tick(video, 10, 10);
    act(() => video.dispatchEvent(new Event('ended')));

    expect(count('/pod2/imp')).toBe(1);
  });

  it('tracks component ads from their timer', () => {
    vi.useFakeTimers();

    const onMidpoint = vi.fn();
    const ComponentAd = () => <div>component ad</div>;

    render(
      <Harness
        config={{ enabled: true, onMidpoint }}
        onReady={(next) => {
          api = next;
        }}
      />
    );

    act(() =>
      api.controls.startAdBreak(
        adBreak([
          {
            id: 'component',
            src: '',
            duration: 4,
            component: ComponentAd,
            trackingUrls: { midpoint: 'https://t.example.com/component/q2' },
          },
        ])
      )
    );

    // The timer advances the playhead in 100ms steps; 2.1s clears the midpoint.
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(count('/component/q2')).toBe(1);
    expect(onMidpoint).toHaveBeenCalledTimes(1);
  });
});
