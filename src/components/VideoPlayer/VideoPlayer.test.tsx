import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { VideoPlayer, type VideoPlayerRef } from './VideoPlayer';
import type { VideoTrack } from '@/types/video';

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
