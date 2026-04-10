import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useEffect } from 'react';
import { renderHook, act, render } from '@testing-library/react';
import { VideoAdProvider, useVideoAds } from './VideoAdContext';
import type { VideoAdConfig, VideoAd, VideoAdBreak, CustomAdComponentProps } from '@/types/video';

// Mock fetch
const mockFetch = vi.fn(() => Promise.resolve(new Response()));

// Mock Hls
vi.mock('hls.js', () => {
  const MockHls = vi.fn(() => ({
    loadSource: vi.fn(),
    attachMedia: vi.fn(),
    detachMedia: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    levels: [],
    currentLevel: -1,
  }));
  (MockHls as unknown as Record<string, unknown>).isSupported = vi.fn(() => true);
  (MockHls as unknown as Record<string, unknown>).Events = {
    ERROR: 'hlsError',
    MANIFEST_PARSED: 'hlsManifestParsed',
    LEVEL_SWITCHED: 'hlsLevelSwitched',
  };
  return { default: MockHls };
});

// Mock HLS helpers
vi.mock('@/hooks/useHLS', () => ({
  isHLSSource: vi.fn((src: string) => src?.endsWith('.m3u8') ?? false),
  supportsNativeHLS: vi.fn(() => false),
}));

beforeEach(() => {
  vi.useFakeTimers();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// Helper to create a video ad
function createVideoAd(overrides: Partial<VideoAd> = {}): VideoAd {
  return {
    id: 'video-ad-1',
    src: 'https://example.com/ad.mp4',
    duration: 15,
    skipAfterSeconds: 5,
    clickThroughUrl: 'https://example.com/click',
    ...overrides,
  };
}

// Helper to create a video ad break
function createVideoAdBreak(overrides: Partial<VideoAdBreak> = {}): VideoAdBreak {
  return {
    id: 'break-1',
    position: 'pre-roll',
    ads: [createVideoAd()],
    played: false,
    ...overrides,
  };
}

// A mock component for component ads
const MockAdComponent = (props: CustomAdComponentProps) => <div data-testid="mock-ad">Ad: {props.ad.id}</div>;

const createWrapper = (config: Partial<VideoAdConfig> = {}) => {
  return ({ children }: { children: React.ReactNode }) => (
    <VideoAdProvider config={config}>{children}</VideoAdProvider>
  );
};

/**
 * Helper wrapper that connects adVideoRef to an actual <video> element,
 * enabling non-component video ad tests to work.
 */
function createWrapperWithVideoElement(config: Partial<VideoAdConfig> = {}) {
  function VideoRefConnector({ children }: { children: React.ReactNode }) {
    const ctx = useVideoAds();
    useEffect(() => {
      const video = document.createElement('video');
      // Override play() to resolve immediately
      video.play = vi.fn(() => Promise.resolve());
      video.pause = vi.fn();
      (ctx.adVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = video;
      return () => {
        (ctx.adVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = null;
      };
    }, [ctx.adVideoRef]);
    return <>{children}</>;
  }

  return ({ children }: { children: React.ReactNode }) => (
    <VideoAdProvider config={config}>
      <VideoRefConnector>{children}</VideoRefConnector>
    </VideoAdProvider>
  );
}

describe('VideoAdContext', () => {
  describe('useVideoAds hook', () => {
    it('throws error when used outside provider', () => {
      expect(() => {
        renderHook(() => useVideoAds());
      }).toThrow('useVideoAds must be used within a VideoAdProvider');
    });

    it('returns context inside provider', () => {
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(result.current.state).toBeDefined();
      expect(result.current.controls).toBeDefined();
      expect(result.current.config).toBeDefined();
      expect(result.current.adVideoRef).toBeDefined();
    });
  });

  describe('Initial state', () => {
    it('is not playing ad initially', () => {
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.isPlayingAd).toBe(false);
    });

    it('has no current ad initially', () => {
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.currentAd).toBeNull();
    });

    it('has no current ad break initially', () => {
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.currentAdBreak).toBeNull();
    });

    it('has zero ad progress', () => {
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.adProgress).toBe(0);
    });

    it('has zero ad duration', () => {
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.adDuration).toBe(0);
    });

    it('cannot skip initially', () => {
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.canSkip).toBe(false);
    });

    it('has zero skip countdown', () => {
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.skipCountdown).toBe(0);
    });

    it('has zero ads remaining', () => {
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.adsRemaining).toBe(0);
    });

    it('is not a component ad initially', () => {
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.isComponentAd).toBe(false);
    });

    it('has null componentAdProps initially', () => {
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.componentAdProps).toBeNull();
    });
  });

  describe('Config defaults', () => {
    it('defaults enabled to false', () => {
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.enabled).toBe(false);
    });

    it('defaults adBreaks to empty', () => {
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.adBreaks).toEqual([]);
    });

    it('defaults skipAllowed to true', () => {
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.skipAllowed).toBe(true);
    });

    it('defaults defaultSkipAfter to 5', () => {
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.defaultSkipAfter).toBe(5);
    });

    it('merges user config with defaults', () => {
      const { result } = renderHook(() => useVideoAds(), {
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
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.controls.skipAd).toBeDefined();
      expect(result.current.controls.clickThrough).toBeDefined();
      expect(result.current.controls.startAdBreak).toBeDefined();
      expect(result.current.controls.stopAds).toBeDefined();
      expect(result.current.controls.completeComponentAd).toBeDefined();
    });
  });

  // ================================================================
  // Video ad tests using the wrapper that connects adVideoRef
  // ================================================================

  describe('startAdBreak (with video element)', () => {
    it('starts playing the first ad in the break', () => {
      const onAdStart = vi.fn();
      const ad = createVideoAd();
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapperWithVideoElement({ enabled: true, onAdStart }),
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

    it('sets ads remaining correctly', () => {
      const ads = [
        createVideoAd({ id: 'ad-1' }),
        createVideoAd({ id: 'ad-2' }),
        createVideoAd({ id: 'ad-3' }),
      ];
      const adBreak = createVideoAdBreak({ ads });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapperWithVideoElement({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.adsRemaining).toBe(2);
    });

    it('resets ad progress to zero', () => {
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapperWithVideoElement({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(createVideoAdBreak());
      });

      expect(result.current.state.adProgress).toBe(0);
    });

    it('fires impression and start tracking', () => {
      const ad = createVideoAd({
        trackingUrls: {
          impression: 'https://example.com/impression',
          start: 'https://example.com/start',
        },
      });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapperWithVideoElement({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/impression', expect.objectContaining({
        method: 'GET',
        mode: 'no-cors',
      }));
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/start', expect.objectContaining({
        method: 'GET',
      }));
    });

    it('sets isComponentAd to false for standard video ads', () => {
      const ad = createVideoAd();
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapperWithVideoElement({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.isComponentAd).toBe(false);
    });
  });

  describe('startAdBreak (general)', () => {
    it('ignores empty ad breaks', () => {
      const onAdStart = vi.fn();
      const adBreak = createVideoAdBreak({ ads: [] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true, onAdStart }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.isPlayingAd).toBe(false);
      expect(onAdStart).not.toHaveBeenCalled();
    });

    it('does not update state when video ref is not connected for non-component ad', () => {
      // Without the video element wrapper, playAd returns early
      const ad = createVideoAd();
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      // playAd returns early because adVideoRef.current is null
      expect(result.current.state.isPlayingAd).toBe(false);
    });
  });

  describe('Bumper ads', () => {
    it('sets bumper ad as non-skippable', () => {
      const ad = createVideoAd({
        type: 'bumper',
        duration: 6,
        skipAfterSeconds: 5,
        component: MockAdComponent, // Use component to avoid needing video ref
      });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.canSkip).toBe(false);

      // Even after waiting, should still be non-skippable
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(result.current.state.canSkip).toBe(false);
    });

    it('calls onBumperStart callback', () => {
      const onBumperStart = vi.fn();
      const ad = createVideoAd({
        type: 'bumper',
        duration: 6,
        component: MockAdComponent,
      });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true, onBumperStart }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(onBumperStart).toHaveBeenCalledWith(ad);
    });

    it('does not start skip countdown for bumper ads', () => {
      const ad = createVideoAd({
        type: 'bumper',
        duration: 6,
        skipAfterSeconds: 3,
        component: MockAdComponent,
      });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.skipCountdown).toBe(0);
      expect(result.current.state.canSkip).toBe(false);
    });

    it('bumper ad with video element starts correctly', () => {
      const onBumperStart = vi.fn();
      const ad = createVideoAd({ type: 'bumper', duration: 6 });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapperWithVideoElement({ enabled: true, onBumperStart }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.isPlayingAd).toBe(true);
      expect(result.current.state.canSkip).toBe(false);
      expect(onBumperStart).toHaveBeenCalledWith(ad);
    });
  });

  describe('Skip countdown', () => {
    it('sets skipCountdown from ad skipAfterSeconds', () => {
      const ad = createVideoAd({ skipAfterSeconds: 5, component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.skipCountdown).toBe(5);
      expect(result.current.state.canSkip).toBe(false);
    });

    it('decrements countdown every second', () => {
      const ad = createVideoAd({ skipAfterSeconds: 3, component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
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
      const ad = createVideoAd({ skipAfterSeconds: 2, component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
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
      const ad = createVideoAd({ skipAfterSeconds: 0, component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.canSkip).toBe(true);
      expect(result.current.state.skipCountdown).toBe(0);
    });

    it('uses defaultSkipAfter from config when ad has no skipAfterSeconds', () => {
      const ad = createVideoAd({ skipAfterSeconds: undefined, component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true, defaultSkipAfter: 8 }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.skipCountdown).toBe(8);
    });

    it('does not allow skip when skipAfterSeconds is null and no defaultSkipAfter', () => {
      const ad = createVideoAd({ skipAfterSeconds: null, component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true, defaultSkipAfter: undefined }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      // null skipAfterSeconds causes skipAfter to remain null when no default
      expect(result.current.state.canSkip).toBe(false);
    });

    it('disables skip globally when skipAllowed is false', () => {
      const ad = createVideoAd({ skipAfterSeconds: 0, component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true, skipAllowed: false }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.canSkip).toBe(false);
    });
  });

  describe('skipAd', () => {
    it('skips the current ad when allowed', () => {
      const onAdSkip = vi.fn();
      const ad = createVideoAd({ skipAfterSeconds: 0, component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
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
      const ad = createVideoAd({ skipAfterSeconds: 10, component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
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
      const ad = createVideoAd({
        skipAfterSeconds: 0,
        trackingUrls: { skip: 'https://example.com/skip' },
        component: MockAdComponent,
      });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
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

    it('advances to next component ad when skipping', () => {
      const ad1 = createVideoAd({ id: 'ad-1', skipAfterSeconds: 0, component: MockAdComponent });
      const ad2 = createVideoAd({ id: 'ad-2', skipAfterSeconds: 0, component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad1, ad2] });

      const { result } = renderHook(() => useVideoAds(), {
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
      const ad = createVideoAd({ skipAfterSeconds: 0, component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
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
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true, onAdSkip }),
      });

      act(() => {
        result.current.controls.skipAd();
      });

      expect(onAdSkip).not.toHaveBeenCalled();
    });

    it('skips video ad with connected video element', () => {
      const onAdSkip = vi.fn();
      const ad = createVideoAd({ skipAfterSeconds: 0 });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapperWithVideoElement({ enabled: true, onAdSkip }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      act(() => {
        result.current.controls.skipAd();
      });

      expect(onAdSkip).toHaveBeenCalledWith(ad, adBreak);
    });
  });

  describe('clickThrough', () => {
    it('opens click-through URL in new tab', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
      const ad = createVideoAd({ clickThroughUrl: 'https://advertiser.com', component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
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
      const ad = createVideoAd({
        trackingUrls: { click: 'https://example.com/click' },
        component: MockAdComponent,
      });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
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
      const ad = createVideoAd({ component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
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
      const { result } = renderHook(() => useVideoAds(), {
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
      const ad = createVideoAd({ clickThroughUrl: undefined, component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
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
      const ad = createVideoAd({ component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
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
      expect(result.current.state.isComponentAd).toBe(false);
    });

    it('clears skip countdown timer', () => {
      const ad = createVideoAd({ skipAfterSeconds: 10, component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      act(() => {
        result.current.controls.stopAds();
      });

      act(() => {
        vi.advanceTimersByTime(15000);
      });

      expect(result.current.state.skipCountdown).toBe(0);
    });

    it('stops video ad with connected video element', () => {
      const ad = createVideoAd();
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapperWithVideoElement({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.isPlayingAd).toBe(true);

      act(() => {
        result.current.controls.stopAds();
      });

      expect(result.current.state.isPlayingAd).toBe(false);
    });
  });

  describe('Multiple ads in break', () => {
    it('starts with first component ad', () => {
      const ads = [
        createVideoAd({ id: 'ad-1', duration: 10, component: MockAdComponent }),
        createVideoAd({ id: 'ad-2', duration: 20, component: MockAdComponent }),
        createVideoAd({ id: 'ad-3', duration: 15, component: MockAdComponent }),
      ];
      const adBreak = createVideoAdBreak({ ads });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.currentAd?.id).toBe('ad-1');
      expect(result.current.state.adsRemaining).toBe(2);
    });

    it('starts with first video ad when ref is connected', () => {
      const ads = [
        createVideoAd({ id: 'ad-1', duration: 10 }),
        createVideoAd({ id: 'ad-2', duration: 20 }),
        createVideoAd({ id: 'ad-3', duration: 15 }),
      ];
      const adBreak = createVideoAdBreak({ ads });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapperWithVideoElement({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.currentAd?.id).toBe('ad-1');
      expect(result.current.state.adsRemaining).toBe(2);
    });

    it('tracks remaining ads count after skip', () => {
      const ads = [
        createVideoAd({ id: 'ad-1', skipAfterSeconds: 0, component: MockAdComponent }),
        createVideoAd({ id: 'ad-2', skipAfterSeconds: 0, component: MockAdComponent }),
        createVideoAd({ id: 'ad-3', skipAfterSeconds: 0, component: MockAdComponent }),
      ];
      const adBreak = createVideoAdBreak({ ads });

      const { result } = renderHook(() => useVideoAds(), {
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

  describe('Component ads', () => {
    it('sets isComponentAd for ads with component property', () => {
      const ad = createVideoAd({ component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.isComponentAd).toBe(true);
    });

    it('provides componentAdProps for component ads', () => {
      const ad = createVideoAd({
        id: 'comp-ad-1',
        component: MockAdComponent,
        duration: 10,
        skipAfterSeconds: 3,
      });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.componentAdProps).not.toBeNull();
      expect(result.current.componentAdProps?.ad.id).toBe('comp-ad-1');
      expect(result.current.componentAdProps?.duration).toBe(10);
      expect(result.current.componentAdProps?.onComplete).toBeDefined();
      expect(result.current.componentAdProps?.onSkip).toBeDefined();
    });

    it('has null componentAdProps for non-component ads', () => {
      const ad = createVideoAd();
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapperWithVideoElement({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.componentAdProps).toBeNull();
    });

    it('tracks progress for component ads via timer', () => {
      const ad = createVideoAd({ component: MockAdComponent, duration: 10 });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      // Component ad progress is tracked via setInterval at 100ms
      act(() => {
        vi.advanceTimersByTime(500); // 5 ticks of 100ms = 0.5 progress
      });

      expect(result.current.state.adProgress).toBeGreaterThan(0);
    });
  });

  describe('completeComponentAd', () => {
    it('completes a component ad and advances to next', () => {
      const onAdComplete = vi.fn();
      const ad1 = createVideoAd({ id: 'comp-1', component: MockAdComponent, skipAfterSeconds: 0 });
      const ad2 = createVideoAd({ id: 'comp-2', component: MockAdComponent, skipAfterSeconds: 0 });
      const adBreak = createVideoAdBreak({ ads: [ad1, ad2] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true, onAdComplete }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.currentAd?.id).toBe('comp-1');

      act(() => {
        result.current.controls.completeComponentAd();
      });

      expect(onAdComplete).toHaveBeenCalledWith(ad1, adBreak);
      expect(result.current.state.currentAd?.id).toBe('comp-2');
    });

    it('ends ad break when completing last component ad', () => {
      const onAllAdsComplete = vi.fn();
      const ad = createVideoAd({ id: 'comp-1', component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true, onAllAdsComplete }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      act(() => {
        result.current.controls.completeComponentAd();
      });

      expect(result.current.state.isPlayingAd).toBe(false);
      expect(onAllAdsComplete).toHaveBeenCalledWith(adBreak);
    });

    it('does nothing when not a component ad', () => {
      const onAdComplete = vi.fn();
      const ad = createVideoAd();
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapperWithVideoElement({ enabled: true, onAdComplete }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      act(() => {
        result.current.controls.completeComponentAd();
      });

      expect(onAdComplete).not.toHaveBeenCalled();
    });

    it('does nothing when no ad is playing', () => {
      const onAdComplete = vi.fn();
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true, onAdComplete }),
      });

      act(() => {
        result.current.controls.completeComponentAd();
      });

      expect(onAdComplete).not.toHaveBeenCalled();
    });
  });

  describe('Ad lifecycle callbacks', () => {
    it('calls onAdStart when component ad begins', () => {
      const onAdStart = vi.fn();
      const ad = createVideoAd({ component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true, onAdStart }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(onAdStart).toHaveBeenCalledWith(ad, adBreak);
    });

    it('calls onAdStart when video ad begins with video ref', () => {
      const onAdStart = vi.fn();
      const ad = createVideoAd();
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapperWithVideoElement({ enabled: true, onAdStart }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(onAdStart).toHaveBeenCalledWith(ad, adBreak);
    });

    it('calls onAllAdsComplete when all ads in break finish', () => {
      const onAllAdsComplete = vi.fn();
      const ad = createVideoAd({ skipAfterSeconds: 0, component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
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
    it('does not call fetch when no tracking URLs configured', () => {
      const ad = createVideoAd({ trackingUrls: undefined, component: MockAdComponent });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      mockFetch.mockClear();

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles fetch errors gracefully for component ads', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const ad = createVideoAd({
        trackingUrls: { impression: 'https://example.com/impression' },
        component: MockAdComponent,
      });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.isPlayingAd).toBe(true);
      consoleSpy.mockRestore();
    });

    it('handles fetch errors gracefully for video ads', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const ad = createVideoAd({
        trackingUrls: { impression: 'https://example.com/impression' },
      });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapperWithVideoElement({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      expect(result.current.state.isPlayingAd).toBe(true);
      consoleSpy.mockRestore();
    });
  });

  describe('adVideoRef', () => {
    it('provides adVideoRef', () => {
      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.adVideoRef).toBeDefined();
    });
  });

  // =============================================================
  // Video element event handler tests
  // =============================================================

  /**
   * Helper that renders the provider with a real video element connected
   * via ref, starts an ad break, and returns both the hook result
   * and the video element for dispatching events.
   */
  function renderAndStartVideoAd(config: Partial<VideoAdConfig>, adBreak: VideoAdBreak) {
    // Use a mutable container so re-renders update the reference the caller reads
    const hookRef = { current: null as ReturnType<typeof useVideoAds> | null };
    let videoEl: HTMLVideoElement | null = null;

    function Consumer() {
      const ctx = useVideoAds();
      hookRef.current = ctx;

      // Connect a video element to the ref on first render
      React.useEffect(() => {
        const video = document.createElement('video');
        video.play = vi.fn(() => Promise.resolve());
        video.pause = vi.fn();
        (ctx.adVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = video;
        videoEl = video;
        return () => {
          (ctx.adVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = null;
        };
      }, [ctx.adVideoRef]);

      return null;
    }

    render(
      <VideoAdProvider config={config}>
        <Consumer />
      </VideoAdProvider>
    );

    // Start the ad break
    act(() => {
      hookRef.current!.controls.startAdBreak(adBreak);
    });

    return { hookRef, videoEl: videoEl! };
  }

  describe('Video element event handlers', () => {
    describe('timeupdate handler', () => {
      it('fires onAdProgress callback with progress info', () => {
        const onAdProgress = vi.fn();
        const ad = createVideoAd({
          duration: 30,
          skipAfterSeconds: 0,
          trackingUrls: {},
        });
        const adBreak = createVideoAdBreak({ ads: [ad] });

        const { videoEl } = renderAndStartVideoAd(
          { enabled: true, onAdProgress },
          adBreak
        );

        Object.defineProperty(videoEl, 'currentTime', { writable: true, value: 15 });
        Object.defineProperty(videoEl, 'duration', { writable: true, value: 30 });

        act(() => {
          videoEl.dispatchEvent(new Event('timeupdate'));
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
        const ad = createVideoAd({
          duration: 40,
          skipAfterSeconds: 0,
          trackingUrls: { firstQuartile: 'https://example.com/vq1' },
        });
        const adBreak = createVideoAdBreak({ ads: [ad] });

        const { videoEl } = renderAndStartVideoAd(
          { enabled: true, onFirstQuartile },
          adBreak
        );

        mockFetch.mockClear();

        Object.defineProperty(videoEl, 'currentTime', { writable: true, value: 10 });
        Object.defineProperty(videoEl, 'duration', { writable: true, value: 40 });

        act(() => {
          videoEl.dispatchEvent(new Event('timeupdate'));
        });

        expect(onFirstQuartile).toHaveBeenCalledWith(
          expect.objectContaining({ id: ad.id }),
          expect.objectContaining({ id: adBreak.id })
        );
        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/vq1',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );
      });

      it('fires midpoint callback at 50%', () => {
        const onMidpoint = vi.fn();
        const ad = createVideoAd({
          duration: 40,
          skipAfterSeconds: 0,
          trackingUrls: { midpoint: 'https://example.com/vmid' },
        });
        const adBreak = createVideoAdBreak({ ads: [ad] });

        const { videoEl } = renderAndStartVideoAd(
          { enabled: true, onMidpoint },
          adBreak
        );

        mockFetch.mockClear();

        Object.defineProperty(videoEl, 'currentTime', { writable: true, value: 20 });
        Object.defineProperty(videoEl, 'duration', { writable: true, value: 40 });

        act(() => {
          videoEl.dispatchEvent(new Event('timeupdate'));
        });

        expect(onMidpoint).toHaveBeenCalledWith(
          expect.objectContaining({ id: ad.id }),
          expect.objectContaining({ id: adBreak.id })
        );
        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/vmid',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );
      });

      it('fires thirdQuartile callback at 75%', () => {
        const onThirdQuartile = vi.fn();
        const ad = createVideoAd({
          duration: 40,
          skipAfterSeconds: 0,
          trackingUrls: { thirdQuartile: 'https://example.com/vq3' },
        });
        const adBreak = createVideoAdBreak({ ads: [ad] });

        const { videoEl } = renderAndStartVideoAd(
          { enabled: true, onThirdQuartile },
          adBreak
        );

        mockFetch.mockClear();

        Object.defineProperty(videoEl, 'currentTime', { writable: true, value: 30 });
        Object.defineProperty(videoEl, 'duration', { writable: true, value: 40 });

        act(() => {
          videoEl.dispatchEvent(new Event('timeupdate'));
        });

        expect(onThirdQuartile).toHaveBeenCalledWith(
          expect.objectContaining({ id: ad.id }),
          expect.objectContaining({ id: adBreak.id })
        );
        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/vq3',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );
      });

      it('tracks custom progress offsets for video ads', () => {
        const ad = createVideoAd({
          duration: 30,
          skipAfterSeconds: 0,
          trackingUrls: {
            progress: [
              { offset: 5, url: 'https://example.com/vprog-5' },
              { offset: 10, url: 'https://example.com/vprog-10' },
            ],
          },
        });
        const adBreak = createVideoAdBreak({ ads: [ad] });

        const { videoEl } = renderAndStartVideoAd(
          { enabled: true },
          adBreak
        );

        mockFetch.mockClear();

        Object.defineProperty(videoEl, 'currentTime', { writable: true, value: 5 });
        Object.defineProperty(videoEl, 'duration', { writable: true, value: 30 });

        act(() => {
          videoEl.dispatchEvent(new Event('timeupdate'));
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/vprog-5',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );

        mockFetch.mockClear();

        Object.defineProperty(videoEl, 'currentTime', { writable: true, value: 10 });

        act(() => {
          videoEl.dispatchEvent(new Event('timeupdate'));
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/vprog-10',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );
      });
    });

    describe('ended handler', () => {
      it('fires complete tracking and onAdComplete callback', () => {
        const onAdComplete = vi.fn();
        const ad = createVideoAd({
          skipAfterSeconds: 0,
          trackingUrls: { complete: 'https://example.com/vcomplete' },
        });
        const adBreak = createVideoAdBreak({ ads: [ad] });

        const { videoEl } = renderAndStartVideoAd(
          { enabled: true, onAdComplete },
          adBreak
        );

        mockFetch.mockClear();

        act(() => {
          videoEl.dispatchEvent(new Event('ended'));
        });

        expect(onAdComplete).toHaveBeenCalledWith(
          expect.objectContaining({ id: ad.id }),
          expect.objectContaining({ id: adBreak.id })
        );
        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/vcomplete',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );
      });

      it('advances to next video ad when current ad ends', () => {
        const ad1 = createVideoAd({ id: 'vad-1', skipAfterSeconds: 0 });
        const ad2 = createVideoAd({ id: 'vad-2', skipAfterSeconds: 0 });
        const adBreak = createVideoAdBreak({ ads: [ad1, ad2] });

        const { hookRef, videoEl } = renderAndStartVideoAd(
          { enabled: true },
          adBreak
        );

        expect(hookRef.current!.state.currentAd?.id).toBe('vad-1');

        act(() => {
          videoEl.dispatchEvent(new Event('ended'));
        });

        expect(hookRef.current!.state.currentAd?.id).toBe('vad-2');
        expect(hookRef.current!.state.isPlayingAd).toBe(true);
      });

      it('ends ad break and calls onAllAdsComplete when last video ad ends', () => {
        const onAllAdsComplete = vi.fn();
        const ad = createVideoAd({ skipAfterSeconds: 0 });
        const adBreak = createVideoAdBreak({ ads: [ad] });

        const { hookRef, videoEl } = renderAndStartVideoAd(
          { enabled: true, onAllAdsComplete },
          adBreak
        );

        act(() => {
          videoEl.dispatchEvent(new Event('ended'));
        });

        expect(hookRef.current!.state.isPlayingAd).toBe(false);
        expect(hookRef.current!.state.currentAd).toBeNull();
        expect(onAllAdsComplete).toHaveBeenCalledWith(adBreak);
      });

      it('fires onBumperComplete when a bumper video ad ends', () => {
        const onBumperComplete = vi.fn();
        const ad = createVideoAd({
          type: 'bumper',
          duration: 6,
          skipAfterSeconds: null,
        });
        const adBreak = createVideoAdBreak({ ads: [ad] });

        const { videoEl } = renderAndStartVideoAd(
          { enabled: true, onBumperComplete },
          adBreak
        );

        act(() => {
          videoEl.dispatchEvent(new Event('ended'));
        });

        expect(onBumperComplete).toHaveBeenCalledWith(
          expect.objectContaining({ id: ad.id, type: 'bumper' })
        );
      });
    });

    describe('error handler', () => {
      it('fires error tracking and onAdError callback', () => {
        const onAdError = vi.fn();
        const ad = createVideoAd({
          skipAfterSeconds: 0,
          trackingUrls: { error: 'https://example.com/verror' },
        });
        const adBreak = createVideoAdBreak({ ads: [ad] });

        const { videoEl } = renderAndStartVideoAd(
          { enabled: true, onAdError },
          adBreak
        );

        mockFetch.mockClear();

        act(() => {
          videoEl.dispatchEvent(new Event('error'));
        });

        expect(onAdError).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({ id: ad.id }),
          expect.objectContaining({ id: adBreak.id })
        );
        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/verror',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );
      });

      it('resets state after video ad error', () => {
        const ad = createVideoAd({ skipAfterSeconds: 0 });
        const adBreak = createVideoAdBreak({ ads: [ad] });

        const { hookRef, videoEl } = renderAndStartVideoAd(
          { enabled: true },
          adBreak
        );

        expect(hookRef.current!.state.isPlayingAd).toBe(true);

        act(() => {
          videoEl.dispatchEvent(new Event('error'));
        });

        expect(hookRef.current!.state.isPlayingAd).toBe(false);
        expect(hookRef.current!.state.currentAd).toBeNull();
      });
    });

    describe('pause handler', () => {
      it('fires pause tracking and onAdPause callback', () => {
        const onAdPause = vi.fn();
        const ad = createVideoAd({
          skipAfterSeconds: 0,
          trackingUrls: { pause: 'https://example.com/vpause' },
        });
        const adBreak = createVideoAdBreak({ ads: [ad] });

        const { videoEl } = renderAndStartVideoAd(
          { enabled: true, onAdPause },
          adBreak
        );

        mockFetch.mockClear();

        act(() => {
          videoEl.dispatchEvent(new Event('pause'));
        });

        expect(onAdPause).toHaveBeenCalledWith(
          expect.objectContaining({ id: ad.id }),
          expect.objectContaining({ id: adBreak.id })
        );
        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/vpause',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );
      });
    });

    describe('resume (play) handler', () => {
      it('fires resume tracking and onAdResume callback', () => {
        const onAdResume = vi.fn();
        const ad = createVideoAd({
          skipAfterSeconds: 0,
          trackingUrls: { resume: 'https://example.com/vresume' },
        });
        const adBreak = createVideoAdBreak({ ads: [ad] });

        const { videoEl } = renderAndStartVideoAd(
          { enabled: true, onAdResume },
          adBreak
        );

        mockFetch.mockClear();

        act(() => {
          videoEl.dispatchEvent(new Event('play'));
        });

        expect(onAdResume).toHaveBeenCalledWith(
          expect.objectContaining({ id: ad.id }),
          expect.objectContaining({ id: adBreak.id })
        );
        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/vresume',
          expect.objectContaining({ method: 'GET', mode: 'no-cors' })
        );
      });
    });
  });

  // =============================================================
  // Skip timer cleanup in event handlers
  // =============================================================

  describe('Skip timer cleanup', () => {
    it('clears skip timer when video ad ends before countdown finishes', () => {
      const onAdComplete = vi.fn();
      const ad = createVideoAd({
        skipAfterSeconds: 10, // long countdown
      });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { hookRef, videoEl } = renderAndStartVideoAd(
        { enabled: true, onAdComplete },
        adBreak
      );

      // Skip timer is running
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(hookRef.current!.state.skipCountdown).toBe(8);

      // Ad ends while skip timer is still running
      act(() => {
        videoEl.dispatchEvent(new Event('ended'));
      });

      expect(onAdComplete).toHaveBeenCalled();
      expect(hookRef.current!.state.isPlayingAd).toBe(false);
    });

    it('clears skip timer when skipping a video ad after countdown completes', () => {
      const onAdSkip = vi.fn();
      const ad = createVideoAd({ skipAfterSeconds: 2 });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { hookRef } = renderAndStartVideoAd(
        { enabled: true, onAdSkip },
        adBreak
      );

      // Wait for countdown to finish
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(hookRef.current!.state.canSkip).toBe(true);

      act(() => {
        hookRef.current!.controls.skipAd();
      });

      expect(onAdSkip).toHaveBeenCalled();
    });
  });

  // =============================================================
  // Component ad progress timer quartile tracking
  // =============================================================

  describe('Component ad progress timer quartiles', () => {
    it('fires firstQuartile when component ad progress reaches 25%', () => {
      const onFirstQuartile = vi.fn();
      const ad = createVideoAd({
        component: MockAdComponent,
        duration: 4, // 25% = 1s = 10 ticks
        skipAfterSeconds: null,
      });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true, onFirstQuartile }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      // Advance past 25% threshold (extra tick for floating point accumulation of 0.1)
      act(() => {
        vi.advanceTimersByTime(1100);
      });

      expect(onFirstQuartile).toHaveBeenCalledWith(
        expect.objectContaining({ id: ad.id }),
        expect.objectContaining({ id: adBreak.id })
      );
    });

    it('fires midpoint when component ad progress reaches 50%', () => {
      const onMidpoint = vi.fn();
      const ad = createVideoAd({
        component: MockAdComponent,
        duration: 4, // 50% = 2s = 20 ticks
        skipAfterSeconds: null,
      });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true, onMidpoint }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      // Advance to 2s (50% of 4s)
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(onMidpoint).toHaveBeenCalledWith(
        expect.objectContaining({ id: ad.id }),
        expect.objectContaining({ id: adBreak.id })
      );
    });

    it('fires thirdQuartile when component ad progress reaches 75%', () => {
      const onThirdQuartile = vi.fn();
      const ad = createVideoAd({
        component: MockAdComponent,
        duration: 4, // 75% = 3s = 30 ticks
        skipAfterSeconds: null,
      });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true, onThirdQuartile }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      // Advance to 3s (75% of 4s)
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(onThirdQuartile).toHaveBeenCalledWith(
        expect.objectContaining({ id: ad.id }),
        expect.objectContaining({ id: adBreak.id })
      );
    });

    it('fires all quartile tracking URLs for component ads', () => {
      const ad = createVideoAd({
        component: MockAdComponent,
        duration: 4,
        skipAfterSeconds: null,
        trackingUrls: {
          firstQuartile: 'https://example.com/cq1',
          midpoint: 'https://example.com/cmid',
          thirdQuartile: 'https://example.com/cq3',
        },
      });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      mockFetch.mockClear();

      // Advance past 75% (3s of 4s)
      act(() => {
        vi.advanceTimersByTime(3100);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/cq1',
        expect.objectContaining({ method: 'GET', mode: 'no-cors' })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/cmid',
        expect.objectContaining({ method: 'GET', mode: 'no-cors' })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/cq3',
        expect.objectContaining({ method: 'GET', mode: 'no-cors' })
      );
    });

    it('cleans up component ad timer on stopAds', () => {
      const onFirstQuartile = vi.fn();
      const ad = createVideoAd({
        component: MockAdComponent,
        duration: 10,
        skipAfterSeconds: null,
      });
      const adBreak = createVideoAdBreak({ ads: [ad] });

      const { result } = renderHook(() => useVideoAds(), {
        wrapper: createWrapper({ enabled: true, onFirstQuartile }),
      });

      act(() => {
        result.current.controls.startAdBreak(adBreak);
      });

      act(() => {
        result.current.controls.stopAds();
      });

      // Advance time - timer should be stopped, no quartile callback
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(onFirstQuartile).not.toHaveBeenCalled();
    });
  });
});
