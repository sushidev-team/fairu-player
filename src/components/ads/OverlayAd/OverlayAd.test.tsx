import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OverlayAd } from './OverlayAd';
import type { OverlayAd as OverlayAdType } from '@/types/video';

// Sample test data
const sampleAd: OverlayAdType = {
  id: 'test-overlay',
  imageUrl: 'https://example.com/ad.png',
  clickThroughUrl: 'https://example.com',
  displayAt: 5,
  duration: 10,
  position: 'bottom',
  closeable: true,
  altText: 'Test Advertisement',
  trackingUrls: {
    impression: 'https://example.com/track/impression',
    click: 'https://example.com/track/click',
    close: 'https://example.com/track/close',
  },
};

// Mock fetch for tracking
globalThis.fetch = vi.fn(() => Promise.resolve(new Response()));

describe('OverlayAd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Visibility', () => {
    it('renders when within display window and visible', () => {
      render(
        <OverlayAd
          ad={sampleAd}
          currentTime={10} // Within 5-15 window
          visible={true}
        />
      );

      expect(screen.getByAltText('Test Advertisement')).toBeInTheDocument();
    });

    it('does not render when before display time', () => {
      render(
        <OverlayAd
          ad={sampleAd}
          currentTime={2} // Before displayAt (5)
          visible={true}
        />
      );

      expect(screen.queryByAltText('Test Advertisement')).not.toBeInTheDocument();
    });

    it('does not render when after display window', () => {
      render(
        <OverlayAd
          ad={sampleAd}
          currentTime={20} // After displayAt + duration (5 + 10 = 15)
          visible={true}
        />
      );

      expect(screen.queryByAltText('Test Advertisement')).not.toBeInTheDocument();
    });

    it('does not render when visible is false', () => {
      render(
        <OverlayAd
          ad={sampleAd}
          currentTime={10}
          visible={false}
        />
      );

      expect(screen.queryByAltText('Test Advertisement')).not.toBeInTheDocument();
    });
  });

  describe('Close functionality', () => {
    it('renders close button when closeable is true', () => {
      render(
        <OverlayAd
          ad={sampleAd}
          currentTime={10}
          visible={true}
        />
      );

      expect(screen.getByRole('button', { name: /close ad/i })).toBeInTheDocument();
    });

    it('does not render close button when closeable is false', () => {
      render(
        <OverlayAd
          ad={{ ...sampleAd, closeable: false }}
          currentTime={10}
          visible={true}
        />
      );

      expect(screen.queryByRole('button', { name: /close ad/i })).not.toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();

      render(
        <OverlayAd
          ad={sampleAd}
          currentTime={10}
          visible={true}
          onClose={onClose}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /close ad/i }));

      expect(onClose).toHaveBeenCalledWith(sampleAd);
    });

    it('hides ad after close is clicked', () => {
      render(
        <OverlayAd
          ad={sampleAd}
          currentTime={10}
          visible={true}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /close ad/i }));

      expect(screen.queryByAltText('Test Advertisement')).not.toBeInTheDocument();
    });

    it('tracks close URL when closed', () => {
      render(
        <OverlayAd
          ad={sampleAd}
          currentTime={10}
          visible={true}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /close ad/i }));

      expect(fetch).toHaveBeenCalledWith('https://example.com/track/close', expect.any(Object));
    });
  });

  describe('Click functionality', () => {
    it('calls onClick when banner is clicked', () => {
      const onClick = vi.fn();

      render(
        <OverlayAd
          ad={sampleAd}
          currentTime={10}
          visible={true}
          onClick={onClick}
        />
      );

      // Click on the banner container (not the close button)
      const banner = screen.getByRole('button', { name: /test advertisement/i });
      fireEvent.click(banner);

      expect(onClick).toHaveBeenCalledWith(sampleAd);
    });

    it('tracks click URL when clicked', () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(
        <OverlayAd
          ad={sampleAd}
          currentTime={10}
          visible={true}
        />
      );

      const banner = screen.getByRole('button', { name: /test advertisement/i });
      fireEvent.click(banner);

      expect(fetch).toHaveBeenCalledWith('https://example.com/track/click', expect.any(Object));

      windowOpen.mockRestore();
    });

    it('opens click-through URL in new window', () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(
        <OverlayAd
          ad={sampleAd}
          currentTime={10}
          visible={true}
        />
      );

      const banner = screen.getByRole('button', { name: /test advertisement/i });
      fireEvent.click(banner);

      expect(windowOpen).toHaveBeenCalledWith('https://example.com', '_blank');

      windowOpen.mockRestore();
    });

    it('handles keyboard enter on banner', () => {
      const onClick = vi.fn();

      render(
        <OverlayAd
          ad={sampleAd}
          currentTime={10}
          visible={true}
          onClick={onClick}
        />
      );

      const banner = screen.getByRole('button', { name: /test advertisement/i });
      fireEvent.keyDown(banner, { key: 'Enter' });

      expect(onClick).toHaveBeenCalledWith(sampleAd);
    });
  });

  describe('Impression tracking', () => {
    it('fires impression when ad first becomes visible', () => {
      render(
        <OverlayAd
          ad={sampleAd}
          currentTime={10}
          visible={true}
        />
      );

      expect(fetch).toHaveBeenCalledWith('https://example.com/track/impression', expect.any(Object));
    });

    it('calls onImpression callback when ad first becomes visible', () => {
      const onImpression = vi.fn();

      render(
        <OverlayAd
          ad={sampleAd}
          currentTime={10}
          visible={true}
          onImpression={onImpression}
        />
      );

      expect(onImpression).toHaveBeenCalledWith(sampleAd);
    });
  });

  describe('Position', () => {
    it('positions at bottom by default', () => {
      render(
        <OverlayAd
          ad={sampleAd}
          currentTime={10}
          visible={true}
        />
      );

      const container = screen.getByAltText('Test Advertisement').closest('.fairu-overlay-ad');
      expect(container).toHaveClass('bottom-20');
    });

    it('positions at top when position is top', () => {
      render(
        <OverlayAd
          ad={{ ...sampleAd, position: 'top' }}
          currentTime={10}
          visible={true}
        />
      );

      const container = screen.getByAltText('Test Advertisement').closest('.fairu-overlay-ad');
      expect(container).toHaveClass('top-4');
    });
  });

  describe('AD badge and Learn more', () => {
    it('shows AD badge', () => {
      render(
        <OverlayAd
          ad={sampleAd}
          currentTime={10}
          visible={true}
        />
      );

      expect(screen.getByText('AD')).toBeInTheDocument();
    });

    it('shows Learn more when clickThroughUrl is present', () => {
      render(
        <OverlayAd
          ad={sampleAd}
          currentTime={10}
          visible={true}
        />
      );

      expect(screen.getByText('Learn more')).toBeInTheDocument();
    });

    it('does not show Learn more when no clickThroughUrl', () => {
      render(
        <OverlayAd
          ad={{ ...sampleAd, clickThroughUrl: undefined }}
          currentTime={10}
          visible={true}
        />
      );

      expect(screen.queryByText('Learn more')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles missing tracking URLs gracefully', () => {
      const adWithoutTracking: OverlayAdType = {
        ...sampleAd,
        trackingUrls: undefined,
      };

      render(
        <OverlayAd
          ad={adWithoutTracking}
          currentTime={10}
          visible={true}
        />
      );

      // Should render without errors
      expect(screen.getByAltText('Test Advertisement')).toBeInTheDocument();

      // Close should work without tracking
      fireEvent.click(screen.getByRole('button', { name: /close ad/i }));
      expect(screen.queryByAltText('Test Advertisement')).not.toBeInTheDocument();
    });

    it('uses default duration of 10 when not specified', () => {
      const adWithoutDuration: OverlayAdType = {
        ...sampleAd,
        duration: undefined,
      };

      // At time 14 (within 5-15 window with default duration 10)
      const { rerender } = render(
        <OverlayAd
          ad={adWithoutDuration}
          currentTime={14}
          visible={true}
        />
      );

      expect(screen.getByAltText('Test Advertisement')).toBeInTheDocument();

      // At time 16 (outside 5-15 window)
      rerender(
        <OverlayAd
          ad={adWithoutDuration}
          currentTime={16}
          visible={true}
        />
      );

      expect(screen.queryByAltText('Test Advertisement')).not.toBeInTheDocument();
    });

    it('uses default altText when not provided', () => {
      const adWithoutAltText: OverlayAdType = {
        ...sampleAd,
        altText: undefined,
      };

      render(
        <OverlayAd
          ad={adWithoutAltText}
          currentTime={10}
          visible={true}
        />
      );

      expect(screen.getByAltText('Advertisement')).toBeInTheDocument();
    });
  });

  describe('Closed state persistence', () => {
    it('stays closed after being closed even if still in time window', () => {
      const { rerender } = render(
        <OverlayAd
          ad={sampleAd}
          currentTime={10}
          visible={true}
        />
      );

      expect(screen.getByAltText('Test Advertisement')).toBeInTheDocument();

      // Close the ad
      fireEvent.click(screen.getByRole('button', { name: /close ad/i }));
      expect(screen.queryByAltText('Test Advertisement')).not.toBeInTheDocument();

      // Update time but still in window - should stay closed
      rerender(
        <OverlayAd
          ad={sampleAd}
          currentTime={12}
          visible={true}
        />
      );

      expect(screen.queryByAltText('Test Advertisement')).not.toBeInTheDocument();
    });
  });
});

/**
 * The pixel path, pinned properly.
 *
 * `OverlayAd` was missed when the linear pipeline moved onto the shared beacon,
 * and kept firing a bare `fetch` with one URL and no macro substitution. The
 * assertions elsewhere in this file still passed throughout, because `sendBeacon`
 * falls back to `fetch` in jsdom — so they could not have caught it. These can.
 */
describe('OverlayAd tracking pixels', () => {
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

  const wrapped: OverlayAdType = {
    ...sampleAd,
    trackingUrls: {
      // What a wrapper chain actually produces: the SSP's pixel on top of the
      // DSP's. Dropping either is a billing error.
      impression: ['https://ssp.example.com/imp', 'https://dsp.example.com/imp'],
      click: ['https://ssp.example.com/click', 'https://dsp.example.com/click'],
      close: ['https://ssp.example.com/close', 'https://dsp.example.com/close'],
    },
  };

  const show = (ad: OverlayAdType = wrapped) =>
    render(<OverlayAd ad={ad} currentTime={10} visible />);

  it('prefers sendBeacon so pixels survive page teardown', () => {
    show();
    expect(beacons).toContain('https://ssp.example.com/imp');
  });

  it('fires every impression URL, not just the first', () => {
    show();
    expect(beacons.filter((u) => u.endsWith('/imp'))).toHaveLength(2);
  });

  it('fires every click URL', () => {
    show();
    fireEvent.click(screen.getByAltText('Test Advertisement'));
    expect(beacons.filter((u) => u.endsWith('/click'))).toHaveLength(2);
  });

  it('fires every close URL', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: /close ad/i }));
    expect(beacons.filter((u) => u.endsWith('/close'))).toHaveLength(2);
  });

  it('substitutes macros instead of sending the placeholder verbatim', () => {
    show({
      ...sampleAd,
      trackingUrls: { impression: 'https://t.example.com/imp?cb=[CACHEBUSTING]' },
    });

    const [pixel] = beacons.filter((u) => u.includes('/imp'));
    expect(pixel).not.toContain('[CACHEBUSTING]');
    expect(pixel).toMatch(/cb=\d{8}$/);
  });

  it('fires the impression once, not on every re-render', () => {
    const { rerender } = show();
    rerender(<OverlayAd ad={wrapped} currentTime={11} visible />);
    rerender(<OverlayAd ad={wrapped} currentTime={12} visible />);

    expect(beacons.filter((u) => u.endsWith('/imp'))).toHaveLength(2);
  });

  it('sends nothing when the ad declares no tracking', () => {
    show({ ...sampleAd, trackingUrls: undefined });
    expect(beacons).toHaveLength(0);
  });
});
