/**
 * The banner shown while playback is stopped.
 *
 * Two things the ported version got wrong drive most of this: it sent none of
 * the tracking URLs its own type declares, and it measured the pause with an
 * interval whose cleanup ran before the interval was started — so the elapsed
 * time never moved when a minimum pause was configured.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePauseAd } from './usePauseAd';
import type { PauseAd } from '@/core/pauseAd';

let beacons: string[];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  beacons = [];
  vi.stubGlobal('navigator', {
    ...globalThis.navigator,
    sendBeacon: (url: string) => {
      beacons.push(url);
      return true;
    },
  });
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    beacons.push(String(url));
    return Promise.resolve({ ok: true } as Response);
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const sent = (needle: string) => beacons.filter((url) => url.includes(needle)).length;

const AD: PauseAd = {
  id: 'p1',
  imageUrl: 'https://cdn.example.test/banner.png',
  clickThroughUrl: 'https://example.test/landing',
  trackingUrls: {
    impression: 'https://track.test/imp',
    click: 'https://track.test/click',
    close: 'https://track.test/close',
  },
};

// No default parameter: `mount(undefined)` would then quietly get `AD`, which
// is exactly the case the last test is about.
function mountWith(ad: PauseAd | undefined) {
  return renderHook(
    ({ isPaused, isPlaying }: { isPaused: boolean; isPlaying: boolean }) =>
      usePauseAd({ ad, isPaused, isPlaying }),
    { initialProps: { isPaused: true, isPlaying: false } }
  );
}

const mount = (ad: PauseAd = AD) => mountWith(ad);

const wait = (seconds: number) =>
  act(() => {
    vi.advanceTimersByTime(seconds * 1000);
  });

describe('usePauseAd', () => {
  it('shows nothing before playback has ever started', () => {
    const { result } = mount();

    // A player sits paused before anyone presses anything.
    expect(result.current.isVisible).toBe(false);
  });

  it('shows once playback has run and stopped', () => {
    const { result, rerender } = mount();

    rerender({ isPaused: false, isPlaying: true });
    rerender({ isPaused: true, isPlaying: false });

    expect(result.current.isVisible).toBe(true);
    expect(result.current.currentAd?.id).toBe('p1');
  });

  it('hides again when playback resumes', () => {
    const { result, rerender } = mount();
    rerender({ isPaused: false, isPlaying: true });
    rerender({ isPaused: true, isPlaying: false });

    rerender({ isPaused: false, isPlaying: true });

    expect(result.current.isVisible).toBe(false);
  });

  describe('a minimum pause', () => {
    const slow = { ...AD, minPauseDuration: 3 };

    it('waits it out', () => {
      const { result, rerender } = mount(slow);
      rerender({ isPaused: false, isPlaying: true });
      rerender({ isPaused: true, isPlaying: false });

      expect(result.current.isVisible).toBe(false);

      // The ported version never advanced this: its interval sat after a
      // `return`, so the elapsed time stayed at zero forever.
      wait(4);

      expect(result.current.isVisible).toBe(true);
    });

    it('measures each pause from its own start', () => {
      const { result, rerender } = mount(slow);
      rerender({ isPaused: false, isPlaying: true });
      rerender({ isPaused: true, isPlaying: false });
      wait(4);
      rerender({ isPaused: false, isPlaying: true });

      rerender({ isPaused: true, isPlaying: false });

      expect(result.current.isVisible).toBe(false);
    });
  });

  describe('dismissing', () => {
    function shown() {
      const view = mount();
      view.rerender({ isPaused: false, isPlaying: true });
      view.rerender({ isPaused: true, isPlaying: false });
      return view;
    }

    it('takes it off screen and reports it', () => {
      const { result } = shown();

      act(() => result.current.dismiss());

      expect(result.current.isVisible).toBe(false);
      expect(sent('track.test/close')).toBe(1);
    });

    it('stays dismissed for this pause but not the next', () => {
      const { result, rerender } = shown();
      act(() => result.current.dismiss());

      rerender({ isPaused: false, isPlaying: true });
      rerender({ isPaused: true, isPlaying: false });

      expect(result.current.isVisible).toBe(true);
    });
  });

  describe('tracking', () => {
    function shown() {
      const view = mount();
      view.rerender({ isPaused: false, isPlaying: true });
      view.rerender({ isPaused: true, isPlaying: false });
      return view;
    }

    it('sends the impression once per pause', () => {
      const { rerender } = shown();

      expect(sent('track.test/imp')).toBe(1);

      // Still the same pause.
      rerender({ isPaused: true, isPlaying: false });
      expect(sent('track.test/imp')).toBe(1);
    });

    it('sends a fresh impression for the next pause', () => {
      const { rerender } = shown();

      rerender({ isPaused: false, isPlaying: true });
      rerender({ isPaused: true, isPlaying: false });

      expect(sent('track.test/imp')).toBe(2);
    });

    it('sends the click and opens the page safely', () => {
      const open = vi.fn();
      vi.stubGlobal('open', open);
      const { result } = shown();

      act(() => result.current.click());

      expect(sent('track.test/click')).toBe(1);
      expect(open).toHaveBeenCalledWith(
        'https://example.test/landing',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('sends nothing while no banner is up', () => {
      const { result } = mount();

      act(() => result.current.click());

      expect(beacons).toHaveLength(0);
    });
  });

  it('shows nothing without an ad', () => {
    const { result, rerender } = mountWith(undefined);
    rerender({ isPaused: false, isPlaying: true });
    rerender({ isPaused: true, isPlaying: false });

    expect(result.current.isVisible).toBe(false);
  });
});
