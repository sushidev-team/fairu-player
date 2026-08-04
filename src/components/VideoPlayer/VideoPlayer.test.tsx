import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { VideoPlayer, type VideoPlayerRef } from './VideoPlayer';
import type { VideoAd, VideoAdBreak, VideoTrack } from '@/types/video';

// Sample test data
const sampleTrack: VideoTrack = {
  id: 'test-video',
  src: 'https://example.com/video.mp4',
  title: 'Test Video',
  duration: 60,
};

describe('VideoPlayer', () => {
  describe('Ref Controls', () => {
    it('exposes overlayAdControls via ref', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(ref.current).not.toBeNull();
      expect(ref.current?.overlayAdControls).toBeDefined();
    });

    it('exposes showOverlayAd control', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(ref.current?.overlayAdControls.showOverlayAd).toBeDefined();
      expect(typeof ref.current?.overlayAdControls.showOverlayAd).toBe('function');
    });

    it('exposes hideOverlayAd control', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(ref.current?.overlayAdControls.hideOverlayAd).toBeDefined();
      expect(typeof ref.current?.overlayAdControls.hideOverlayAd).toBe('function');
    });

    it('exposes hideAllOverlayAds control', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(ref.current?.overlayAdControls.hideAllOverlayAds).toBeDefined();
      expect(typeof ref.current?.overlayAdControls.hideAllOverlayAds).toBe('function');
    });

    it('exposes showInfoCard control', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(ref.current?.overlayAdControls.showInfoCard).toBeDefined();
      expect(typeof ref.current?.overlayAdControls.showInfoCard).toBe('function');
    });

    it('exposes hideInfoCard control', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(ref.current?.overlayAdControls.hideInfoCard).toBeDefined();
      expect(typeof ref.current?.overlayAdControls.hideInfoCard).toBe('function');
    });

    it('exposes hideAllInfoCards control', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(ref.current?.overlayAdControls.hideAllInfoCards).toBeDefined();
      expect(typeof ref.current?.overlayAdControls.hideAllInfoCards).toBe('function');
    });

    it('exposes resetDismissed control', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(ref.current?.overlayAdControls.resetDismissed).toBeDefined();
      expect(typeof ref.current?.overlayAdControls.resetDismissed).toBe('function');
    });

    it('exposes isOverlayAdVisible control', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(ref.current?.overlayAdControls.isOverlayAdVisible).toBeDefined();
      expect(typeof ref.current?.overlayAdControls.isOverlayAdVisible).toBe('function');
    });

    it('exposes isInfoCardVisible control', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(ref.current?.overlayAdControls.isInfoCardVisible).toBeDefined();
      expect(typeof ref.current?.overlayAdControls.isInfoCardVisible).toBe('function');
    });
  });

  describe('Basic Rendering', () => {
    it('renders video player', () => {
      render(<VideoPlayer track={sampleTrack} />);

      // Should have at least one play button (may have multiple in controls)
      const playButtons = screen.getAllByRole('button', { name: /play/i });
      expect(playButtons.length).toBeGreaterThan(0);
    });

    it('renders with track title', () => {
      render(<VideoPlayer track={sampleTrack} />);

      // VideoPlayer should render without errors
      expect(document.querySelector('.fairu-video-player')).toBeInTheDocument();
    });

    it('renders with overlay ads config', () => {
      render(
        <VideoPlayer
          track={sampleTrack}
          config={{
            overlayAds: [
              {
                id: 'test-ad',
                imageUrl: 'https://example.com/ad.png',
                displayAt: 0,
              },
            ],
          }}
        />
      );

      expect(document.querySelector('.fairu-video-player')).toBeInTheDocument();
    });

    it('renders with info cards config', () => {
      render(
        <VideoPlayer
          track={sampleTrack}
          config={{
            infoCards: [
              {
                id: 'test-card',
                type: 'product',
                title: 'Test Product',
                displayAt: 0,
              },
            ],
          }}
        />
      );

      expect(document.querySelector('.fairu-video-player')).toBeInTheDocument();
    });
  });

  describe('VideoPlayer source survives an adConfig.enabled toggle', () => {
    // Regression: `adConfig.enabled` commonly flips false → true while ad tags
    // resolve. The player used to branch on it, which unmounted one subtree and
    // mounted the other — the new <video> never received a source, so the
    // content showed a poster and a permanent spinner with no error anywhere.
    const contentVideo = (container: HTMLElement) =>
      container.querySelector('video') as HTMLVideoElement;

    it('keeps the same video element across the toggle', () => {
      const { container, rerender } = render(
        <VideoPlayer track={sampleTrack} adConfig={{ enabled: false, adBreaks: [] }} />
      );

      const before = contentVideo(container);
      expect(before).toBeTruthy();

      rerender(<VideoPlayer track={sampleTrack} adConfig={{ enabled: true, adBreaks: [] }} />);

      expect(contentVideo(container)).toBe(before);
    });

    it('has a source in both states', () => {
      const { container, rerender } = render(
        <VideoPlayer track={sampleTrack} adConfig={{ enabled: false, adBreaks: [] }} />
      );

      expect(contentVideo(container).src).toContain(sampleTrack.src);

      rerender(<VideoPlayer track={sampleTrack} adConfig={{ enabled: true, adBreaks: [] }} />);

      expect(contentVideo(container).src).toContain(sampleTrack.src);
    });

    it('has a source after a full remount', () => {
      // `key` remounts the whole player, so `useMedia` is recreated too. The
      // harder case — element swapped under a *living* hook — is covered in
      // `useMedia.test.tsx`, since this one passes either way.
      const { container, rerender } = render(
        <VideoPlayer key="a" track={sampleTrack} adConfig={{ enabled: true, adBreaks: [] }} />
      );

      const before = contentVideo(container);
      rerender(
        <VideoPlayer key="b" track={sampleTrack} adConfig={{ enabled: true, adBreaks: [] }} />
      );

      const after = contentVideo(container);
      expect(after).not.toBe(before);
      expect(after.src).toContain(sampleTrack.src);
    });
  });

  describe('VideoPlayer with adConfig', () => {
    it('renders with ad config without errors', () => {
      const ref = createRef<VideoPlayerRef>();

      render(
        <VideoPlayer
          ref={ref}
          track={sampleTrack}
          adConfig={{
            enabled: true,
            adBreaks: [],
          }}
        />
      );

      expect(ref.current?.overlayAdControls).toBeDefined();
    });

    it('still exposes overlay controls when ads are enabled', () => {
      const ref = createRef<VideoPlayerRef>();

      render(
        <VideoPlayer
          ref={ref}
          track={sampleTrack}
          adConfig={{
            enabled: true,
            adBreaks: [],
          }}
        />
      );

      expect(ref.current?.overlayAdControls.showOverlayAd).toBeDefined();
      expect(ref.current?.overlayAdControls.showInfoCard).toBeDefined();
      expect(ref.current?.overlayAdControls.hideOverlayAd).toBeDefined();
      expect(ref.current?.overlayAdControls.hideInfoCard).toBeDefined();
    });
  });

  describe('Control Functions', () => {
    it('isOverlayAdVisible returns false for non-existent ad', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(ref.current?.overlayAdControls.isOverlayAdVisible('non-existent')).toBe(false);
    });

    it('isInfoCardVisible returns false for non-existent card', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(ref.current?.overlayAdControls.isInfoCardVisible('non-existent')).toBe(false);
    });

    it('showOverlayAd can be called without errors', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(() => {
        ref.current?.overlayAdControls.showOverlayAd({
          id: 'test-ad',
          imageUrl: 'https://example.com/ad.png',
          displayAt: 0,
        });
      }).not.toThrow();
    });

    it('showInfoCard can be called without errors', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(() => {
        ref.current?.overlayAdControls.showInfoCard({
          id: 'test-card',
          type: 'product',
          title: 'Test',
          displayAt: 0,
        });
      }).not.toThrow();
    });

    it('hideOverlayAd can be called without errors', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(() => {
        ref.current?.overlayAdControls.hideOverlayAd('test-ad');
      }).not.toThrow();
    });

    it('hideInfoCard can be called without errors', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(() => {
        ref.current?.overlayAdControls.hideInfoCard('test-card');
      }).not.toThrow();
    });

    it('hideAllOverlayAds can be called without errors', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(() => {
        ref.current?.overlayAdControls.hideAllOverlayAds();
      }).not.toThrow();
    });

    it('hideAllInfoCards can be called without errors', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(() => {
        ref.current?.overlayAdControls.hideAllInfoCards();
      }).not.toThrow();
    });

    it('resetDismissed can be called without errors', () => {
      const ref = createRef<VideoPlayerRef>();

      render(<VideoPlayer ref={ref} track={sampleTrack} />);

      expect(() => {
        ref.current?.overlayAdControls.resetDismissed();
      }).not.toThrow();
    });
  });
});

/**
 * The ad surfaces the player is responsible for rendering.
 *
 * Both were parsed and mapped long before anything displayed them, so these
 * pin the wiring rather than the conversion — which is covered in
 * `toVideoAd.test.ts`.
 */
describe('VideoPlayer ad surfaces', () => {
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
  });

  afterEach(() => vi.unstubAllGlobals());

  const spot: VideoAd = {
    id: 'spot-1',
    src: 'https://cdn.example.com/spot.mp4',
    duration: 15,
    title: 'Nordwind Kaffee',
    icons: [
      {
        program: 'AdChoices',
        staticResource: 'https://cdn.example.com/adchoices.png',
        clickThroughUrl: 'https://privacy.example.com',
        clickTrackingUrls: [],
        viewTrackingUrls: ['https://t.example.com/icon-view'],
      },
    ],
    companion: {
      imageUrl: 'https://cdn.example.com/companion.png',
      clickUrl: 'https://nordwind.example.com',
      width: 300,
      height: 250,
      clickTrackingUrls: [],
      trackingEvents: { creativeView: ['https://t.example.com/companion-view'] },
    },
  };

  const preRoll: VideoAdBreak = { id: 'pre', position: 'pre-roll', ads: [spot] };

  /** Render the player and intercept the first play so the pre-roll starts. */
  const startPreRoll = (adConfig: Record<string, unknown> = {}) => {
    const utils = render(
      <VideoPlayer
        track={sampleTrack}
        adConfig={{ enabled: true, adBreaks: [preRoll], ...adConfig }}
      />
    );

    // jsdom never loads media, so the overlay would sit on its spinner and the
    // play button would not exist yet.
    const video = utils.container.querySelector('video') as HTMLVideoElement;
    act(() => {
      video.dispatchEvent(new Event('loadedmetadata'));
    });

    // The player intercepts the *first play* through its own controls, not
    // through a native `play` event, so press the big play button.
    act(() => {
      screen.getByRole('button', { name: /play video/i }).click();
    });

    return utils;
  };

  it('renders the AdChoices badge the creative declared', () => {
    startPreRoll();

    const badge = screen
      .getAllByRole('link')
      .find((el) => el.getAttribute('href') === 'https://privacy.example.com');

    expect(badge).toBeDefined();
  });

  it('fires the icon view pixel when the badge appears', () => {
    startPreRoll();
    expect(beacons.filter((u) => u.includes('icon-view'))).toHaveLength(1);
  });

  it('does not render a companion unless asked', () => {
    // The slot adds an element below the player; changing an existing
    // integration's layout silently would be worse than an explicit flag.
    startPreRoll();
    expect(screen.queryByAltText('Nordwind Kaffee')).toBeNull();
  });

  it('renders the companion when showCompanion is set', () => {
    startPreRoll({ showCompanion: true });

    const img = screen.getByAltText('Nordwind Kaffee') as HTMLImageElement;
    expect(img.src).toBe('https://cdn.example.com/companion.png');
  });

  it('fires the companion creativeView pixel on display', () => {
    startPreRoll({ showCompanion: true });
    expect(beacons.filter((u) => u.includes('companion-view'))).toHaveLength(1);
  });

  it('renders neither surface when the creative declares neither', () => {
    const bare: VideoAd = { id: 'bare', src: 'https://cdn.example.com/b.mp4', duration: 10 };

    render(
      <VideoPlayer
        track={sampleTrack}
        adConfig={{
          enabled: true,
          showCompanion: true,
          adBreaks: [{ id: 'pre', position: 'pre-roll', ads: [bare] }],
        }}
      />
    );

    expect(
      screen.queryAllByRole('link').filter((el) => el.getAttribute('href')?.includes('privacy'))
    ).toHaveLength(0);
    expect(beacons).toHaveLength(0);
  });
});
