import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, render } from '@testing-library/react';
import { AdProvider, useAds } from './AdContext';
import { createMockAd, createMockAdBreak } from '@/test/helpers';
import type { AdConfig, Ad, AdBreak } from '@/types/ads';

// Mock fetch
const mockFetch = vi.fn(() => Promise.resolve(new Response()));

beforeEach(() => {
  vi.useFakeTimers();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const createWrapper = (config: Partial<AdConfig> = {}) => {
  return ({ children }: { children: React.ReactNode }) => (
    <AdProvider config={config}>{children}</AdProvider>
  );
};

describe('AdContext', () => {
  describe('useAds hook', () => {
    it('throws error when used outside provider', () => {
      expect(() => {
        renderHook(() => useAds());
      }).toThrow('useAds must be used within an AdProvider');
    });

    it('returns context inside provider', () => {
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(result.current.state).toBeDefined();
      expect(result.current.controls).toBeDefined();
      expect(result.current.config).toBeDefined();
    });
  });

  describe('Initial state', () => {
    it('is not playing ad initially', () => {
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.isPlayingAd).toBe(false);
    });

    it('has no current ad initially', () => {
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.currentAd).toBeNull();
    });

    it('has no current ad break initially', () => {
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.currentAdBreak).toBeNull();
    });

    it('has zero ad progress', () => {
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.adProgress).toBe(0);
    });

    it('has zero ad duration', () => {
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.adDuration).toBe(0);
    });

    it('cannot skip initially', () => {
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.canSkip).toBe(false);
    });

    it('has zero skip countdown', () => {
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.skipCountdown).toBe(0);
    });

    it('has zero ads remaining', () => {
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.adsRemaining).toBe(0);
    });
  });

  describe('Config defaults', () => {
    it('defaults enabled to false', () => {
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.enabled).toBe(false);
    });

    it('defaults adBreaks to empty', () => {
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.adBreaks).toEqual([]);
    });

    it('defaults skipAllowed to true', () => {
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.skipAllowed).toBe(true);
    });

    it('defaults defaultSkipAfter to 5', () => {
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.defaultSkipAfter).toBe(5);
    });

    it('merges user config with defaults', () => {
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({
          enabled: true,
          defaultSkipAfter: 10,
        }),
      });

      expect(result.current.config.enabled).toBe(true);
      expect(result.current.config.defaultSkipAfter).toBe(10);
      expect(result.current.config.skipAllowed).toBe(true);
    });
  });

  describe('Controls', () => {
    it('has all ad controls', () => {
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.controls.skipAd).toBeDefined();
      expect(result.current.controls.clickThrough).toBeDefined();
      expect(result.current.controls.startAdBreak).toBeDefined();
      expect(result.current.controls.stopAds).toBeDefined();
    });
  });

  describe('startAdBreak', () => {
    it('starts playing the first ad in the break', () => {
      const onAdStart = vi.fn();
      const ad = createMockAd();
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true, onAdStart }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.isPlayingAd).toBe(true);
      expect(result.current.state.currentAd?.id).toBe(ad.id);
      expect(result.current.state.currentAdBreak?.id).toBe(adBreak.id);
      expect(result.current.state.adDuration).toBe(ad.duration);
      expect(onAdStart).toHaveBeenCalledWith(ad, adBreak);
    });

    it('ignores empty ad breaks', () => {
      const onAdStart = vi.fn();
      const adBreak = createMockAdBreak({ ads: [] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true, onAdStart }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.isPlayingAd).toBe(false);
      expect(onAdStart).not.toHaveBeenCalled();
    });

    it('sets ads remaining correctly', () => {
      const ads = [
        createMockAd({ id: 'ad-1' }),
        createMockAd({ id: 'ad-2' }),
        createMockAd({ id: 'ad-3' }),
      ];
      const adBreak = createMockAdBreak({ ads });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.adsRemaining).toBe(2);
    });

    it('resets ad progress to zero', () => {
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(createMockAdBreak());
      });

      expect(result.current.state.adProgress).toBe(0);
    });

    it('fires impression tracking', () => {
      const ad = createMockAd({
        trackingUrls: {
          impression: 'https://example.com/impression',
          start: 'https://example.com/start',
        },
      });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/impression', expect.objectContaining({
        method: 'GET',
        mode: 'no-cors',
      }));
    });

    it('fires start tracking', () => {
      const ad = createMockAd({
        trackingUrls: {
          start: 'https://example.com/start',
        },
      });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/start', expect.objectContaining({
        method: 'GET',
      }));
    });
  });

  describe('Skip countdown', () => {
    it('sets skipCountdown from ad skipAfterSeconds', () => {
      const ad = createMockAd({ skipAfterSeconds: 5 });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.skipCountdown).toBe(5);
      expect(result.current.state.canSkip).toBe(false);
    });

    it('decrements countdown every second', () => {
      const ad = createMockAd({ skipAfterSeconds: 3 });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.state.skipCountdown).toBe(2);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.state.skipCountdown).toBe(1);
    });

    it('enables skip when countdown reaches zero', () => {
      const ad = createMockAd({ skipAfterSeconds: 2 });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.state.canSkip).toBe(true);
      expect(result.current.state.skipCountdown).toBe(0);
    });

    it('immediately allows skip when skipAfterSeconds is 0', () => {
      const ad = createMockAd({ skipAfterSeconds: 0 });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.canSkip).toBe(true);
      expect(result.current.state.skipCountdown).toBe(0);
    });

    it('uses defaultSkipAfter from config when ad has no skipAfterSeconds', () => {
      const ad = createMockAd({ skipAfterSeconds: undefined });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true, defaultSkipAfter: 7 }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.skipCountdown).toBe(7);
    });

    it('falls back to defaultSkipAfter when skipAfterSeconds is null', () => {
      // In AdContext, null is treated as nullish and falls through to defaultSkipAfter
      const ad = createMockAd({ skipAfterSeconds: null });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true, defaultSkipAfter: 5 }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.canSkip).toBe(false);
      expect(result.current.state.skipCountdown).toBe(5);

      // After countdown, skip is allowed
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.state.canSkip).toBe(true);
    });
  });

  describe('skipAd', () => {
    it('skips the current ad when allowed', () => {
      const onAdSkip = vi.fn();
      const ad = createMockAd({ skipAfterSeconds: 0 });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true, onAdSkip }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      act(() => {
        result.current.controls.skipAd();
      });

      expect(onAdSkip).toHaveBeenCalledWith(ad, adBreak);
    });

    it('does not skip when canSkip is false', () => {
      const onAdSkip = vi.fn();
      const ad = createMockAd({ skipAfterSeconds: 10 });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true, onAdSkip }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      act(() => {
        result.current.controls.skipAd();
      });

      expect(onAdSkip).not.toHaveBeenCalled();
      expect(result.current.state.isPlayingAd).toBe(true);
    });

    it('fires skip tracking URL', () => {
      const ad = createMockAd({
        skipAfterSeconds: 0,
        trackingUrls: { skip: 'https://example.com/skip' },
      });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      mockFetch.mockClear();

      act(() => {
        result.current.controls.skipAd();
      });

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/skip', expect.objectContaining({
        method: 'GET',
      }));
    });

    it('advances to next ad in break when skipping', () => {
      const ad1 = createMockAd({ id: 'ad-1', skipAfterSeconds: 0 });
      const ad2 = createMockAd({ id: 'ad-2', skipAfterSeconds: 0 });
      const adBreak = createMockAdBreak({ ads: [ad1, ad2] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.currentAd?.id).toBe('ad-1');

      act(() => {
        result.current.controls.skipAd();
      });

      expect(result.current.state.currentAd?.id).toBe('ad-2');
      expect(result.current.state.isPlayingAd).toBe(true);
    });

    it('ends ad break when skipping last ad', () => {
      const onAllAdsComplete = vi.fn();
      const ad = createMockAd({ skipAfterSeconds: 0 });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true, onAllAdsComplete }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      act(() => {
        result.current.controls.skipAd();
      });

      expect(result.current.state.isPlayingAd).toBe(false);
      expect(result.current.state.currentAd).toBeNull();
      expect(onAllAdsComplete).toHaveBeenCalledWith(adBreak);
    });

    it('does nothing when no ad is playing', () => {
      const onAdSkip = vi.fn();
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true, onAdSkip }),
      });

      act(() => {
        result.current.controls.skipAd();
      });

      expect(onAdSkip).not.toHaveBeenCalled();
    });

    it('clears skip timer when skipping after countdown completes', () => {
      const onAdSkip = vi.fn();
      const ad = createMockAd({ skipAfterSeconds: 2 });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true, onAdSkip }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      // Wait for countdown to finish (timer clears itself but ref still holds the ID)
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.state.canSkip).toBe(true);

      act(() => {
        result.current.controls.skipAd();
      });

      expect(onAdSkip).toHaveBeenCalledWith(ad, adBreak);
    });
  });

  describe('clickThrough', () => {
    it('opens click-through URL in new tab', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
      const ad = createMockAd({ clickThroughUrl: 'https://advertiser.com' });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      act(() => {
        result.current.controls.clickThrough();
      });

      expect(windowOpenSpy).toHaveBeenCalledWith('https://advertiser.com', '_blank');
      windowOpenSpy.mockRestore();
    });

    it('fires click tracking URL', () => {
      const ad = createMockAd({
        trackingUrls: { click: 'https://example.com/click' },
      });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      mockFetch.mockClear();

      act(() => {
        result.current.controls.clickThrough();
      });

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/click', expect.objectContaining({
        method: 'GET',
      }));
    });

    it('calls onAdClick callback', () => {
      const onAdClick = vi.fn();
      const ad = createMockAd();
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true, onAdClick }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      act(() => {
        result.current.controls.clickThrough();
      });

      expect(onAdClick).toHaveBeenCalledWith(ad, adBreak);
    });

    it('does nothing when no ad is playing', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.clickThrough();
      });

      expect(windowOpenSpy).not.toHaveBeenCalled();
      windowOpenSpy.mockRestore();
    });

    it('handles ad without clickThroughUrl', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
      const ad = createMockAd({ clickThroughUrl: undefined });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      act(() => {
        result.current.controls.clickThrough();
      });

      expect(windowOpenSpy).not.toHaveBeenCalled();
      windowOpenSpy.mockRestore();
    });
  });

  describe('stopAds', () => {
    it('resets all ad state', () => {
      const ad = createMockAd();
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.isPlayingAd).toBe(true);

      act(() => {
        result.current.controls.stopAds();
      });

      expect(result.current.state.isPlayingAd).toBe(false);
      expect(result.current.state.currentAd).toBeNull();
      expect(result.current.state.currentAdBreak).toBeNull();
      expect(result.current.state.adProgress).toBe(0);
      expect(result.current.state.adDuration).toBe(0);
      expect(result.current.state.canSkip).toBe(false);
      expect(result.current.state.skipCountdown).toBe(0);
      expect(result.current.state.adsRemaining).toBe(0);
    });

    it('clears skip countdown timer', () => {
      const ad = createMockAd({ skipAfterSeconds: 10 });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      act(() => {
        result.current.controls.stopAds();
      });

      // Advance time - countdown should not continue
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.state.skipCountdown).toBe(0);
    });
  });

  describe('Multiple ads in break', () => {
    it('starts with first ad', () => {
      const ads = [
        createMockAd({ id: 'ad-1', duration: 10 }),
        createMockAd({ id: 'ad-2', duration: 20 }),
        createMockAd({ id: 'ad-3', duration: 15 }),
      ];
      const adBreak = createMockAdBreak({ ads });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.currentAd?.id).toBe('ad-1');
      expect(result.current.state.adsRemaining).toBe(2);
    });

    it('tracks remaining ads count after skip', () => {
      const ads = [
        createMockAd({ id: 'ad-1', skipAfterSeconds: 0 }),
        createMockAd({ id: 'ad-2', skipAfterSeconds: 0 }),
        createMockAd({ id: 'ad-3', skipAfterSeconds: 0 }),
      ];
      const adBreak = createMockAdBreak({ ads });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.adsRemaining).toBe(2);

      act(() => {
        result.current.controls.skipAd();
      });

      expect(result.current.state.currentAd?.id).toBe('ad-2');
      expect(result.current.state.adsRemaining).toBe(1);

      act(() => {
        result.current.controls.skipAd();
      });

      expect(result.current.state.currentAd?.id).toBe('ad-3');
      expect(result.current.state.adsRemaining).toBe(0);
    });
  });

  describe('Ad lifecycle callbacks', () => {
    it('calls onAdStart when ad begins', () => {
      const onAdStart = vi.fn();
      const ad = createMockAd();
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true, onAdStart }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(onAdStart).toHaveBeenCalledWith(ad, adBreak);
    });

    it('calls onAllAdsComplete when all ads in break finish', () => {
      const onAllAdsComplete = vi.fn();
      const ad = createMockAd({ skipAfterSeconds: 0 });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true, onAllAdsComplete }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      act(() => {
        result.current.controls.skipAd();
      });

      expect(onAllAdsComplete).toHaveBeenCalledWith(adBreak);
    });
  });

  describe('Tracking URLs', () => {
    it('does not call fetch when no tracking URLs are configured', () => {
      const ad = createMockAd({ trackingUrls: undefined });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      mockFetch.mockClear();

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles fetch errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const ad = createMockAd({
        trackingUrls: { impression: 'https://example.com/impression' },
      });
      const adBreak = createMockAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      // Should not throw
      expect(result.current.state.isPlayingAd).toBe(true);
      consoleSpy.mockRestore();
    });
  });

  // =============================================================
  // Audio element event handler tests
  // =============================================================

  describe('Audio element event handlers', () => {
    /**
     * Helper: renders the AdProvider, starts an ad break, and returns
     * the internal <audio> element plus the hook result so we can
     * dispatch native events and assert state/callback changes.
     */
    function setupWithAudio(config: Partial<AdConfig>, adBreak: AdBreak) {
      let audioElement: HTMLAudioElement | null = null;

      // Consumer component that captures the audio element from the DOM
      function AudioCapture() {
        const ctx = useAds();
        return null;
      }

      const { container, rerender } = render(
        <AdProvider config={config}>
          <AudioCapture />
        </AdProvider>
      );

      // The AdProvider renders an <audio> element internally
      audioElement = container.querySelector('audio');

      // Override play so jsdom does not throw
      if (audioElement) {
        audioElement.play = vi.fn(() => Promise.resolve());
      }

      return { audioElement: audioElement!, container };
    }

    /**
     * Helper that renders the provider, starts an ad break via the hook,
     * and returns both the hook result and the audio element.
     */
    function renderAndStartAd(config: Partial<AdConfig>, adBreak: AdBreak) {
      let hookResult: ReturnType<typeof useAds> | null = null;

      function Consumer() {
        hookResult = useAds();
        return null;
      }

      const { container } = render(
        <AdProvider config={config}>
          <Consumer />
        </AdProvider>
      );

      const audioElement = container.querySelector('audio')!;
      audioElement.play = vi.fn(() => Promise.resolve());

      // Start the ad break
      act(() => {
        hookResult!.controls.startAdBreak(adBreak);
      });

      return { hookResult: hookResult!, audioElement, container };
    }

    describe('timeupdate handler', () => {
      it('fires onAdProgress callback with progress info', () => {
        const onAdProgress = vi.fn();
        const ad = createMockAd({
          duration: 30,
          skipAfterSeconds: 0,
          trackingUrls: {},
        });
        const adBreak = createMockAdBreak({ ads: [ad] });

        const { hookResult, audioElement } = renderAndStartAd(
          { enabled: true, onAdProgress },
          adBreak
        );

        // Simulate time update at 15s of 30s (50%)
        Object.defineProperty(audioElement, 'currentTime', { writable: true, value: 15 });
        Object.defineProperty(audioElement, 'duration', { writable: true, value: 30 });

        act(() => {
          audioElement.dispatchEvent(new Event('timeupdate'));
        });

        expect(onAdProgress).toHaveBeenCalledWith(
          expect.objectContaining({
            currentTime: 15,
            duration: 30,
            percentage: 50,
            remainingTime: 15,
          }),
          expect.objectContaining({ id: ad.id }),
          expect.objectContaining({ id: adBreak.id })
        );
      });

      it('fires firstQuartile callback at 25%', () => {
        const onFirstQuartile = vi.fn();
        const ad = createMockAd({
          duration: 40,
          skipAfterSeconds: 0,
          trackingUrls: { firstQuartile: 'https://example.com/q1' },
        });
        const adBreak = createMockAdBreak({ ads: [ad] });

        const { audioElement } = renderAndStartAd(
          { enabled: true, onFirstQuartile },
          adBreak
        );

        mockFetch.mockClear();

        Object.defineProperty(audioElement, 'currentTime', { writable: true, value: 10 });
        Object.defineProperty(audioElement, 'duration', { writable: true, value: 40 });

        act(() => {
          audioElement.dispatchEvent(new Event('timeupdate'));
        });

        expect(onFirstQuartile).toHaveBeenCalledWith(
          expect.objectContaining({ id: ad.id }),
          expect.objectContaining({ id: adBreak.id })
        );
        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/q1',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );
      });

      it('fires midpoint callback at 50%', () => {
        const onMidpoint = vi.fn();
        const ad = createMockAd({
          duration: 40,
          skipAfterSeconds: 0,
          trackingUrls: { midpoint: 'https://example.com/mid' },
        });
        const adBreak = createMockAdBreak({ ads: [ad] });

        const { audioElement } = renderAndStartAd(
          { enabled: true, onMidpoint },
          adBreak
        );

        mockFetch.mockClear();

        Object.defineProperty(audioElement, 'currentTime', { writable: true, value: 20 });
        Object.defineProperty(audioElement, 'duration', { writable: true, value: 40 });

        act(() => {
          audioElement.dispatchEvent(new Event('timeupdate'));
        });

        expect(onMidpoint).toHaveBeenCalledWith(
          expect.objectContaining({ id: ad.id }),
          expect.objectContaining({ id: adBreak.id })
        );
        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/mid',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );
      });

      it('fires thirdQuartile callback at 75%', () => {
        const onThirdQuartile = vi.fn();
        const ad = createMockAd({
          duration: 40,
          skipAfterSeconds: 0,
          trackingUrls: { thirdQuartile: 'https://example.com/q3' },
        });
        const adBreak = createMockAdBreak({ ads: [ad] });

        const { audioElement } = renderAndStartAd(
          { enabled: true, onThirdQuartile },
          adBreak
        );

        mockFetch.mockClear();

        Object.defineProperty(audioElement, 'currentTime', { writable: true, value: 30 });
        Object.defineProperty(audioElement, 'duration', { writable: true, value: 40 });

        act(() => {
          audioElement.dispatchEvent(new Event('timeupdate'));
        });

        expect(onThirdQuartile).toHaveBeenCalledWith(
          expect.objectContaining({ id: ad.id }),
          expect.objectContaining({ id: adBreak.id })
        );
        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/q3',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );
      });

      it('fires each quartile only once even with multiple timeupdates', () => {
        const onFirstQuartile = vi.fn();
        const ad = createMockAd({
          duration: 40,
          skipAfterSeconds: 0,
          trackingUrls: { firstQuartile: 'https://example.com/q1' },
        });
        const adBreak = createMockAdBreak({ ads: [ad] });

        const { audioElement } = renderAndStartAd(
          { enabled: true, onFirstQuartile },
          adBreak
        );

        Object.defineProperty(audioElement, 'currentTime', { writable: true, value: 10 });
        Object.defineProperty(audioElement, 'duration', { writable: true, value: 40 });

        act(() => {
          audioElement.dispatchEvent(new Event('timeupdate'));
        });

        act(() => {
          audioElement.dispatchEvent(new Event('timeupdate'));
        });

        act(() => {
          audioElement.dispatchEvent(new Event('timeupdate'));
        });

        // Should only fire once
        expect(onFirstQuartile).toHaveBeenCalledTimes(1);
      });

      it('tracks custom progress offsets', () => {
        const ad = createMockAd({
          duration: 30,
          skipAfterSeconds: 0,
          trackingUrls: {
            progress: [
              { offset: 5, url: 'https://example.com/progress-5' },
              { offset: 10, url: 'https://example.com/progress-10' },
            ],
          },
        });
        const adBreak = createMockAdBreak({ ads: [ad] });

        const { audioElement } = renderAndStartAd(
          { enabled: true },
          adBreak
        );

        mockFetch.mockClear();

        // First update at 5s - should fire first progress offset
        Object.defineProperty(audioElement, 'currentTime', { writable: true, value: 5 });
        Object.defineProperty(audioElement, 'duration', { writable: true, value: 30 });

        act(() => {
          audioElement.dispatchEvent(new Event('timeupdate'));
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/progress-5',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );

        mockFetch.mockClear();

        // Second update at 10s - should fire second progress offset
        Object.defineProperty(audioElement, 'currentTime', { writable: true, value: 10 });

        act(() => {
          audioElement.dispatchEvent(new Event('timeupdate'));
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/progress-10',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );
      });

      it('does not re-fire already tracked progress offsets', () => {
        const ad = createMockAd({
          duration: 30,
          skipAfterSeconds: 0,
          trackingUrls: {
            progress: [
              { offset: 5, url: 'https://example.com/progress-5' },
            ],
          },
        });
        const adBreak = createMockAdBreak({ ads: [ad] });

        const { audioElement } = renderAndStartAd(
          { enabled: true },
          adBreak
        );

        mockFetch.mockClear();

        Object.defineProperty(audioElement, 'currentTime', { writable: true, value: 5 });
        Object.defineProperty(audioElement, 'duration', { writable: true, value: 30 });

        act(() => {
          audioElement.dispatchEvent(new Event('timeupdate'));
        });

        // Fire again at same offset - should not fetch again
        mockFetch.mockClear();

        act(() => {
          audioElement.dispatchEvent(new Event('timeupdate'));
        });

        expect(mockFetch).not.toHaveBeenCalledWith(
          'https://example.com/progress-5',
          expect.anything()
        );
      });
    });

    describe('ended handler', () => {
      it('clears skip timer when ad ends before countdown finishes', () => {
        const onAdComplete = vi.fn();
        const ad = createMockAd({
          skipAfterSeconds: 10, // long countdown, ad will end before it finishes
          trackingUrls: { complete: 'https://example.com/complete' },
        });
        const adBreak = createMockAdBreak({ ads: [ad] });

        let hookRef: ReturnType<typeof useAds> | null = null;
        function Consumer() {
          hookRef = useAds();
          return null;
        }

        const { container } = render(
          <AdProvider config={{ enabled: true, onAdComplete }}>
            <Consumer />
          </AdProvider>
        );

        const audioElement = container.querySelector('audio')!;
        audioElement.play = vi.fn(() => Promise.resolve());

        act(() => {
          hookRef!.controls.startAdBreak(adBreak);
        });

        // Skip timer is running (countdown from 10)
        act(() => {
          vi.advanceTimersByTime(2000); // countdown at 8
        });
        expect(hookRef!.state.skipCountdown).toBe(8);

        // Ad ends while skip timer is still running
        act(() => {
          audioElement.dispatchEvent(new Event('ended'));
        });

        expect(onAdComplete).toHaveBeenCalled();
        expect(hookRef!.state.isPlayingAd).toBe(false);

        // Skip timer should not continue counting after ended
        act(() => {
          vi.advanceTimersByTime(5000);
        });
        expect(hookRef!.state.skipCountdown).toBe(0);
      });

      it('fires complete tracking and onAdComplete callback', () => {
        const onAdComplete = vi.fn();
        const ad = createMockAd({
          skipAfterSeconds: 0,
          trackingUrls: { complete: 'https://example.com/complete' },
        });
        const adBreak = createMockAdBreak({ ads: [ad] });

        const { audioElement } = renderAndStartAd(
          { enabled: true, onAdComplete },
          adBreak
        );

        mockFetch.mockClear();

        act(() => {
          audioElement.dispatchEvent(new Event('ended'));
        });

        expect(onAdComplete).toHaveBeenCalledWith(
          expect.objectContaining({ id: ad.id }),
          expect.objectContaining({ id: adBreak.id })
        );
        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/complete',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );
      });

      it('advances to next ad in break when current ad ends', () => {
        const onAdStart = vi.fn();
        const ad1 = createMockAd({ id: 'ad-1', skipAfterSeconds: 0 });
        const ad2 = createMockAd({ id: 'ad-2', skipAfterSeconds: 0 });
        const adBreak = createMockAdBreak({ ads: [ad1, ad2] });

        let hookRef: ReturnType<typeof useAds> | null = null;
        function Consumer() {
          hookRef = useAds();
          return null;
        }

        const { container } = render(
          <AdProvider config={{ enabled: true, onAdStart }}>
            <Consumer />
          </AdProvider>
        );

        const audioElement = container.querySelector('audio')!;
        audioElement.play = vi.fn(() => Promise.resolve());

        act(() => {
          hookRef!.controls.startAdBreak(adBreak);
        });

        expect(hookRef!.state.currentAd?.id).toBe('ad-1');

        act(() => {
          audioElement.dispatchEvent(new Event('ended'));
        });

        expect(hookRef!.state.currentAd?.id).toBe('ad-2');
        expect(hookRef!.state.isPlayingAd).toBe(true);
      });

      it('ends ad break and calls onAllAdsComplete when last ad ends', () => {
        const onAllAdsComplete = vi.fn();
        const ad = createMockAd({ skipAfterSeconds: 0 });
        const adBreak = createMockAdBreak({ ads: [ad] });

        let hookRef: ReturnType<typeof useAds> | null = null;
        function Consumer() {
          hookRef = useAds();
          return null;
        }

        const { container } = render(
          <AdProvider config={{ enabled: true, onAllAdsComplete }}>
            <Consumer />
          </AdProvider>
        );

        const audioElement = container.querySelector('audio')!;
        audioElement.play = vi.fn(() => Promise.resolve());

        act(() => {
          hookRef!.controls.startAdBreak(adBreak);
        });

        act(() => {
          audioElement.dispatchEvent(new Event('ended'));
        });

        expect(hookRef!.state.isPlayingAd).toBe(false);
        expect(hookRef!.state.currentAd).toBeNull();
        expect(onAllAdsComplete).toHaveBeenCalledWith(adBreak);
      });
    });

    describe('error handler', () => {
      it('fires error tracking and onAdError callback', () => {
        const onAdError = vi.fn();
        const ad = createMockAd({
          skipAfterSeconds: 0,
          trackingUrls: { error: 'https://example.com/error' },
        });
        const adBreak = createMockAdBreak({ ads: [ad] });

        const { audioElement } = renderAndStartAd(
          { enabled: true, onAdError },
          adBreak
        );

        mockFetch.mockClear();

        act(() => {
          audioElement.dispatchEvent(new Event('error'));
        });

        expect(onAdError).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({ id: ad.id }),
          expect.objectContaining({ id: adBreak.id })
        );
        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/error',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );
      });

      it('resets state after error', () => {
        const ad = createMockAd({ skipAfterSeconds: 0 });
        const adBreak = createMockAdBreak({ ads: [ad] });

        let hookRef: ReturnType<typeof useAds> | null = null;
        function Consumer() {
          hookRef = useAds();
          return null;
        }

        const { container } = render(
          <AdProvider config={{ enabled: true }}>
            <Consumer />
          </AdProvider>
        );

        const audioElement = container.querySelector('audio')!;
        audioElement.play = vi.fn(() => Promise.resolve());

        act(() => {
          hookRef!.controls.startAdBreak(adBreak);
        });

        expect(hookRef!.state.isPlayingAd).toBe(true);

        act(() => {
          audioElement.dispatchEvent(new Event('error'));
        });

        expect(hookRef!.state.isPlayingAd).toBe(false);
        expect(hookRef!.state.currentAd).toBeNull();
      });
    });

    describe('pause handler', () => {
      it('fires pause tracking and onAdPause callback', () => {
        const onAdPause = vi.fn();
        const ad = createMockAd({
          skipAfterSeconds: 0,
          trackingUrls: { pause: 'https://example.com/pause' },
        });
        const adBreak = createMockAdBreak({ ads: [ad] });

        const { audioElement } = renderAndStartAd(
          { enabled: true, onAdPause },
          adBreak
        );

        mockFetch.mockClear();

        act(() => {
          audioElement.dispatchEvent(new Event('pause'));
        });

        expect(onAdPause).toHaveBeenCalledWith(
          expect.objectContaining({ id: ad.id }),
          expect.objectContaining({ id: adBreak.id })
        );
        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/pause',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );
      });
    });

    describe('resume (play) handler', () => {
      it('fires resume tracking and onAdResume callback', () => {
        const onAdResume = vi.fn();
        const ad = createMockAd({
          skipAfterSeconds: 0,
          trackingUrls: { resume: 'https://example.com/resume' },
        });
        const adBreak = createMockAdBreak({ ads: [ad] });

        const { audioElement } = renderAndStartAd(
          { enabled: true, onAdResume },
          adBreak
        );

        mockFetch.mockClear();

        act(() => {
          audioElement.dispatchEvent(new Event('play'));
        });

        expect(onAdResume).toHaveBeenCalledWith(
          expect.objectContaining({ id: ad.id }),
          expect.objectContaining({ id: adBreak.id })
        );
        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/resume',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );
      });
    });
  });
});
