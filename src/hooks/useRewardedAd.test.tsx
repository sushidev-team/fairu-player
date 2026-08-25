/**
 * A spot watched in exchange for something.
 *
 * The version this was ported from held `progress`, `percentage` and
 * `isRewarded` in state and had nothing that moved them: the reward could never
 * be earned, and the tracking URLs its own type declares were never sent. Both
 * are what these tests are about.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRewardedAd } from './useRewardedAd';
import type { RewardedAd } from '@/core/rewardedAd';

let beacons: string[];

beforeEach(() => {
  beacons = [];
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
  vi.restoreAllMocks();
});

const sent = (needle: string) => beacons.filter((url) => url.includes(needle)).length;

const AD: RewardedAd = {
  id: 'reward-1',
  src: 'https://cdn.example.test/spot.mp4',
  duration: 30,
  title: 'Weiter ohne Wartezeit',
  rewardDescription: 'Schaltet die nächste Folge frei',
  clickThroughUrl: 'https://example.test/landing',
  trackingUrls: {
    impression: 'https://track.test/imp',
    start: 'https://track.test/start',
    quartile50: 'https://track.test/mid',
    complete: 'https://track.test/complete',
    click: 'https://track.test/click',
  },
};

/** A media element whose playhead the test drives. */
function fakeMedia() {
  const element = document.createElement('video');
  let currentTime = 0;
  Object.defineProperty(element, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: (value: number) => {
      currentTime = value;
    },
  });
  Object.defineProperty(element, 'duration', { configurable: true, value: 30 });
  return { element, ref: { current: element as HTMLMediaElement } };
}

function playTo(element: HTMLMediaElement, seconds: number) {
  act(() => {
    (element as HTMLVideoElement).currentTime = seconds;
    element.dispatchEvent(new Event('timeupdate'));
  });
}

describe('useRewardedAd', () => {
  it('offers nothing without an ad', () => {
    const { ref } = fakeMedia();
    const { result } = renderHook(() => useRewardedAd({ mediaRef: ref }));

    expect(result.current.isAvailable).toBe(false);
    act(() => result.current.show());
    expect(result.current.state.isShowing).toBe(false);
  });

  it('shows the spot and announces the start', () => {
    const { ref } = fakeMedia();
    const onStart = vi.fn();
    const { result } = renderHook(() => useRewardedAd({ ad: AD, mediaRef: ref, onStart }));

    act(() => result.current.show());

    expect(result.current.state.isShowing).toBe(true);
    expect(result.current.state.currentAd?.id).toBe('reward-1');
    expect(onStart).toHaveBeenCalledWith(AD);
  });

  describe('progress', () => {
    it('follows the element', () => {
      const { element, ref } = fakeMedia();
      const { result } = renderHook(() => useRewardedAd({ ad: AD, mediaRef: ref }));
      act(() => result.current.show());

      playTo(element, 15);

      // The ported version left all of this at zero forever.
      expect(result.current.state.percentage).toBe(50);
      expect(result.current.state.progress).toBe(15);
    });

    it('counts down to the reward, not to the end', () => {
      const { element, ref } = fakeMedia();
      const { result } = renderHook(() => useRewardedAd({ ad: AD, mediaRef: ref }));
      act(() => result.current.show());

      playTo(element, 20);

      expect(result.current.state.remaining).toBe(9);
    });
  });

  describe('the reward', () => {
    it('is earned just short of the end', () => {
      const { element, ref } = fakeMedia();
      const onReward = vi.fn();
      const { result } = renderHook(() => useRewardedAd({ ad: AD, mediaRef: ref, onReward }));
      act(() => result.current.show());

      playTo(element, 29);

      expect(result.current.state.isRewarded).toBe(true);
      expect(onReward).toHaveBeenCalledWith(AD);
    });

    it('is not earned early', () => {
      const { element, ref } = fakeMedia();
      const onReward = vi.fn();
      const { result } = renderHook(() => useRewardedAd({ ad: AD, mediaRef: ref, onReward }));
      act(() => result.current.show());

      playTo(element, 20);

      expect(result.current.state.isRewarded).toBe(false);
      expect(onReward).not.toHaveBeenCalled();
    });

    it('is granted once, however long the viewer stays', () => {
      const { element, ref } = fakeMedia();
      const onReward = vi.fn();
      const { result } = renderHook(() => useRewardedAd({ ad: AD, mediaRef: ref, onReward }));
      act(() => result.current.show());

      playTo(element, 29);
      playTo(element, 29.5);
      playTo(element, 30);

      // A host crediting an account would credit it three times.
      expect(onReward).toHaveBeenCalledTimes(1);
    });

    it('is reported on close', () => {
      const { element, ref } = fakeMedia();
      const onClose = vi.fn();
      const { result } = renderHook(() => useRewardedAd({ ad: AD, mediaRef: ref, onClose }));
      act(() => result.current.show());
      playTo(element, 29);

      act(() => result.current.close());

      expect(onClose).toHaveBeenCalledWith(AD, true);
      expect(result.current.state.isShowing).toBe(false);
    });

    it('reports an abandoned spot as unearned', () => {
      const { element, ref } = fakeMedia();
      const onClose = vi.fn();
      const { result } = renderHook(() => useRewardedAd({ ad: AD, mediaRef: ref, onClose }));
      act(() => result.current.show());
      playTo(element, 5);

      act(() => result.current.close());

      expect(onClose).toHaveBeenCalledWith(AD, false);
    });
  });

  describe('tracking', () => {
    it('sends the impression when playback starts', () => {
      const { element, ref } = fakeMedia();
      const { result } = renderHook(() => useRewardedAd({ ad: AD, mediaRef: ref }));
      act(() => result.current.show());

      act(() => element.dispatchEvent(new Event('play')));

      // The creative declares these; the ported version never sent one.
      expect(sent('track.test/imp')).toBe(1);
      expect(sent('track.test/start')).toBe(1);
    });

    it('sends the quartile it passes', () => {
      const { element, ref } = fakeMedia();
      const { result } = renderHook(() => useRewardedAd({ ad: AD, mediaRef: ref }));
      act(() => result.current.show());

      playTo(element, 1);
      playTo(element, 16);

      expect(sent('track.test/mid')).toBe(1);
    });

    it('sends the completion once the spot ends', () => {
      const { element, ref } = fakeMedia();
      const { result } = renderHook(() => useRewardedAd({ ad: AD, mediaRef: ref }));
      act(() => result.current.show());

      playTo(element, 30);
      act(() => element.dispatchEvent(new Event('ended')));

      expect(sent('track.test/complete')).toBe(1);
    });

    it('sends the click and opens the landing page safely', () => {
      const open = vi.fn();
      vi.stubGlobal('open', open);
      const { ref } = fakeMedia();
      const { result } = renderHook(() => useRewardedAd({ ad: AD, mediaRef: ref }));
      act(() => result.current.show());

      act(() => result.current.click());

      expect(sent('track.test/click')).toBe(1);
      expect(open).toHaveBeenCalledWith(
        'https://example.test/landing',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('sends nothing for a spot that was never shown', () => {
      const { ref } = fakeMedia();
      const { result } = renderHook(() => useRewardedAd({ ad: AD, mediaRef: ref }));

      act(() => result.current.click());

      expect(beacons).toHaveLength(0);
    });
  });
});
