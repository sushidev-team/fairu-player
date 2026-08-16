/**
 * The audio ad break: capping, pods, the skip countdown, and the media events
 * that drive it.
 *
 * Ads are the part of the player with money attached, so the interesting cases
 * are the ones where a break ends early or never starts — a capped break that
 * still fires callbacks, or a countdown that keeps ticking after the player is
 * gone, both cost someone something.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { AdProvider, useAds } from './AdContext';
import type { Ad, AdBreak, AdConfig } from '@/types/ads';

function makeAd(overrides: Partial<Ad> = {}): Ad {
  return {
    id: 'ad-1',
    src: 'https://example.test/ad-1.mp3',
    duration: 15,
    title: 'Beispielkampagne',
    ...overrides,
  };
}

function makeBreak(ads: Ad[], overrides: Partial<AdBreak> = {}): AdBreak {
  return { id: 'break-1', position: 'pre-roll', ads, ...overrides };
}

function setup(config: Partial<AdConfig> = {}) {
  const utils = renderHook(() => useAds(), {
    wrapper: ({ children }) => <AdProvider config={config}>{children}</AdProvider>,
  });

  // The provider renders its own <audio>; playback is stubbed per instance so
  // the tests can drive it. `document.body` is cleared before each test, so
  // this is the element belonging to the provider under test.
  const audio = document.querySelector('audio')!;
  let currentTime = 0;
  Object.defineProperty(audio, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: (v: number) => {
      currentTime = v;
    },
  });
  Object.defineProperty(audio, 'duration', { configurable: true, value: 15 });
  audio.play = vi.fn(async () => {});
  audio.pause = vi.fn();

  return { ...utils, audio };
}

function fire(audio: HTMLAudioElement, type: string) {
  act(() => {
    audio.dispatchEvent(new Event(type));
  });
}

describe('AdContext', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('is not playing an ad', () => {
      const { result } = setup();

      expect(result.current.state.isPlayingAd).toBe(false);
      expect(result.current.state.currentAd).toBeNull();
    });

    it('throws outside a provider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => renderHook(() => useAds())).toThrow(/within an AdProvider/i);
      consoleError.mockRestore();
    });
  });

  describe('starting a break', () => {
    it('plays the first ad', () => {
      const onAdStart = vi.fn();
      const ad = makeAd();
      const { result, audio } = setup({ onAdStart });

      act(() => result.current.controls.startAdBreak(makeBreak([ad])));

      expect(result.current.state.isPlayingAd).toBe(true);
      expect(result.current.state.currentAd?.id).toBe('ad-1');
      expect(audio.src).toContain('ad-1.mp3');
      expect(audio.play).toHaveBeenCalled();
      expect(onAdStart).toHaveBeenCalledOnce();
    });

    it('counts the ads still to come', () => {
      const { result } = setup();
      const ads = [makeAd(), makeAd({ id: 'ad-2' }), makeAd({ id: 'ad-3' })];

      act(() => result.current.controls.startAdBreak(makeBreak(ads)));

      expect(result.current.state.adsRemaining).toBe(2);
    });

    it('ignores a break with no ads', () => {
      const onAdStart = vi.fn();
      const { result } = setup({ onAdStart });

      act(() => result.current.controls.startAdBreak(makeBreak([])));

      expect(result.current.state.isPlayingAd).toBe(false);
      expect(onAdStart).not.toHaveBeenCalled();
    });
  });

  describe('the skip countdown', () => {
    it('inherits the shipped default offset of 5s', () => {
      // `defaultSkipAfter: 5` is the shipping default, so an ad that declares
      // no offset is skippable after five seconds rather than unskippable.
      const { result } = setup();

      act(() => result.current.controls.startAdBreak(makeBreak([makeAd()])));

      expect(result.current.state.skipCountdown).toBe(5);
      expect(result.current.state.canSkip).toBe(false);
    });

    it('is unskippable when the default is cleared', () => {
      // `undefined` rather than `null`, because `defaultSkipAfter` is typed
      // `number | undefined` — an explicit undefined still wins over the
      // default through the config spread. Workable, but obscure enough that a
      // publisher who needs non-skippable ads will not guess it.
      const { result } = setup({ defaultSkipAfter: undefined });

      act(() => result.current.controls.startAdBreak(makeBreak([makeAd()])));

      expect(result.current.state.canSkip).toBe(false);
      expect(result.current.state.skipCountdown).toBe(0);
    });

    it('is skippable immediately at offset 0', () => {
      const { result } = setup();

      act(() =>
        result.current.controls.startAdBreak(makeBreak([makeAd({ skipAfterSeconds: 0 })]))
      );

      expect(result.current.state.canSkip).toBe(true);
    });

    it('counts down and then unlocks', () => {
      vi.useFakeTimers();
      const { result } = setup();

      act(() =>
        result.current.controls.startAdBreak(makeBreak([makeAd({ skipAfterSeconds: 3 })]))
      );
      expect(result.current.state.skipCountdown).toBe(3);
      expect(result.current.state.canSkip).toBe(false);

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.state.canSkip).toBe(true);
    });

    it('falls back to the configured default offset', () => {
      const { result } = setup({ defaultSkipAfter: 5 });

      act(() => result.current.controls.startAdBreak(makeBreak([makeAd()])));

      expect(result.current.state.skipCountdown).toBe(5);
    });

    it('stops ticking when the provider unmounts', () => {
      // A countdown that outlives the player keeps calling setState on a gone
      // component — and on a page that swaps players, one per ad break.
      vi.useFakeTimers();
      const clearInterval = vi.spyOn(globalThis, 'clearInterval');
      const { result, unmount } = setup();

      act(() =>
        result.current.controls.startAdBreak(makeBreak([makeAd({ skipAfterSeconds: 10 })]))
      );
      clearInterval.mockClear();

      unmount();

      expect(clearInterval).toHaveBeenCalled();
    });
  });

  describe('skipping', () => {
    it('does nothing while the ad is not skippable', () => {
      const onAdSkip = vi.fn();
      const { result } = setup({ onAdSkip });

      act(() => result.current.controls.startAdBreak(makeBreak([makeAd()])));
      act(() => result.current.controls.skipAd());

      expect(onAdSkip).not.toHaveBeenCalled();
      expect(result.current.state.isPlayingAd).toBe(true);
    });

    it('advances to the next ad in the pod', () => {
      const onAdSkip = vi.fn();
      const { result } = setup({ onAdSkip });
      const ads = [makeAd({ skipAfterSeconds: 0 }), makeAd({ id: 'ad-2' })];

      act(() => result.current.controls.startAdBreak(makeBreak(ads)));
      act(() => result.current.controls.skipAd());

      expect(onAdSkip).toHaveBeenCalledOnce();
      expect(result.current.state.currentAd?.id).toBe('ad-2');
    });

    it('ends the break after the last ad', () => {
      const onAllAdsComplete = vi.fn();
      const { result } = setup({ onAllAdsComplete });

      act(() =>
        result.current.controls.startAdBreak(makeBreak([makeAd({ skipAfterSeconds: 0 })]))
      );
      act(() => result.current.controls.skipAd());

      expect(onAllAdsComplete).toHaveBeenCalledOnce();
      expect(result.current.state.isPlayingAd).toBe(false);
    });
  });

  describe('playback events', () => {
    it('reports progress', () => {
      const onAdProgress = vi.fn();
      const { result, audio } = setup({ onAdProgress });

      act(() => result.current.controls.startAdBreak(makeBreak([makeAd()])));
      audio.currentTime = 5;
      fire(audio, 'timeupdate');

      expect(result.current.state.adProgress).toBe(5);
      expect(onAdProgress).toHaveBeenCalledWith(
        expect.objectContaining({ currentTime: 5, duration: 15 }),
        expect.anything(),
        expect.anything()
      );
    });

    it('moves to the next ad when one ends', () => {
      const onAdComplete = vi.fn();
      const { result, audio } = setup({ onAdComplete });
      const ads = [makeAd(), makeAd({ id: 'ad-2' })];

      act(() => result.current.controls.startAdBreak(makeBreak(ads)));
      fire(audio, 'ended');

      expect(onAdComplete).toHaveBeenCalledOnce();
      expect(result.current.state.currentAd?.id).toBe('ad-2');
    });

    it('ends the break when the last ad ends', () => {
      const onAllAdsComplete = vi.fn();
      const { result, audio } = setup({ onAllAdsComplete });

      act(() => result.current.controls.startAdBreak(makeBreak([makeAd()])));
      fire(audio, 'ended');

      expect(onAllAdsComplete).toHaveBeenCalledOnce();
      expect(result.current.state.isPlayingAd).toBe(false);
    });

    it('abandons the break on a playback error', () => {
      // A creative that will not load must not wedge the player in an ad state
      // with no way out.
      const onAdError = vi.fn();
      const { result, audio } = setup({ onAdError });

      act(() => result.current.controls.startAdBreak(makeBreak([makeAd()])));
      fire(audio, 'error');

      expect(onAdError).toHaveBeenCalled();
      expect(result.current.state.isPlayingAd).toBe(false);
    });

    it('reports pause and resume', () => {
      const onAdPause = vi.fn();
      const onAdResume = vi.fn();
      const { result, audio } = setup({ onAdPause, onAdResume });

      act(() => result.current.controls.startAdBreak(makeBreak([makeAd()])));
      fire(audio, 'pause');
      fire(audio, 'play');

      expect(onAdPause).toHaveBeenCalledOnce();
      expect(onAdResume).toHaveBeenCalledOnce();
    });

    it('ignores media events outside a break', () => {
      const onAdComplete = vi.fn();
      const { audio } = setup({ onAdComplete });

      fire(audio, 'ended');
      fire(audio, 'pause');

      expect(onAdComplete).not.toHaveBeenCalled();
    });
  });

  describe('click-through', () => {
    it('opens the target and reports the click', () => {
      const open = vi.spyOn(window, 'open').mockImplementation(() => null);
      const onAdClick = vi.fn();
      const { result } = setup({ onAdClick });

      act(() =>
        result.current.controls.startAdBreak(
          makeBreak([makeAd({ clickThroughUrl: 'https://example.test/landing' })])
        )
      );
      act(() => result.current.controls.clickThrough());

      expect(onAdClick).toHaveBeenCalledOnce();
      expect(open).toHaveBeenCalledWith('https://example.test/landing', '_blank');
    });

    it('still reports a click on an ad with no destination', () => {
      const open = vi.spyOn(window, 'open').mockImplementation(() => null);
      const onAdClick = vi.fn();
      const { result } = setup({ onAdClick });

      act(() => result.current.controls.startAdBreak(makeBreak([makeAd()])));
      act(() => result.current.controls.clickThrough());

      expect(onAdClick).toHaveBeenCalledOnce();
      expect(open).not.toHaveBeenCalled();
    });

    it('does nothing outside a break', () => {
      const onAdClick = vi.fn();
      const { result } = setup({ onAdClick });

      act(() => result.current.controls.clickThrough());

      expect(onAdClick).not.toHaveBeenCalled();
    });
  });

  describe('stopAds', () => {
    it('clears the state and the audio', () => {
      const { result, audio } = setup();

      act(() => result.current.controls.startAdBreak(makeBreak([makeAd()])));
      act(() => result.current.controls.stopAds());

      expect(result.current.state.isPlayingAd).toBe(false);
      expect(audio.pause).toHaveBeenCalled();
      // Read through the attribute: the `src` property resolves '' against the
      // document base URL, so it never reads back as empty.
      expect(audio.getAttribute('src')).toBe('');
    });
  });

  describe('capping', () => {
    it('does not start a break past the per-session limit', () => {
      const onAdCapped = vi.fn();
      const onAdStart = vi.fn();
      const { result } = setup({ maxAdsPerSession: 1, onAdCapped, onAdStart });

      act(() => result.current.controls.startAdBreak(makeBreak([makeAd()])));
      act(() => result.current.controls.stopAds());
      act(() => result.current.controls.startAdBreak(makeBreak([makeAd({ id: 'ad-2' })])));

      expect(onAdStart).toHaveBeenCalledOnce();
      expect(onAdCapped).toHaveBeenCalledOnce();
      expect(result.current.state.isPlayingAd).toBe(false);
    });

    it('trims a pod to the per-break duration budget', () => {
      // The trimmed pod is what plays, so the remaining count has to be against
      // it and not the original — an "ad 2 of 3" that never reaches 3 is worse
      // than no counter.
      const { result } = setup({ maxAdDurationPerBreak: 20 });
      const ads = [
        makeAd({ id: 'a', duration: 15 }),
        makeAd({ id: 'b', duration: 15 }),
        makeAd({ id: 'c', duration: 15 }),
      ];

      act(() => result.current.controls.startAdBreak(makeBreak(ads)));

      expect(result.current.state.adsRemaining).toBe(0);
      expect(result.current.state.currentAdBreak?.ads).toHaveLength(1);
    });
  });

  describe('the ad element', () => {
    it('is rendered by the provider', () => {
      render(
        <AdProvider>
          <span />
        </AdProvider>
      );

      expect(document.querySelectorAll('audio')).toHaveLength(1);
    });
  });
});
