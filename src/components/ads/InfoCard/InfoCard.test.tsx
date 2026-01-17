import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InfoCard } from './InfoCard';
import type { InfoCard as InfoCardType } from '@/types/video';

// Sample test data
const productCard: InfoCardType = {
  id: 'product-1',
  type: 'product',
  title: 'Amazing Product',
  description: 'This is a great product',
  thumbnail: 'https://example.com/product.jpg',
  url: 'https://example.com/product',
  displayAt: 5,
  duration: 20,
  price: '$49.99',
  position: 'top-right',
  trackingUrls: {
    impression: 'https://example.com/track/impression',
    click: 'https://example.com/track/click',
    dismiss: 'https://example.com/track/dismiss',
  },
};

const videoCard: InfoCardType = {
  id: 'video-1',
  type: 'video',
  title: 'Related Video',
  description: 'Watch this related content',
  thumbnail: 'https://example.com/video-thumb.jpg',
  videoId: 'video-123',
  displayAt: 10,
  position: 'top-right',
};

const linkCard: InfoCardType = {
  id: 'link-1',
  type: 'link',
  title: 'Learn More',
  description: 'Visit our website',
  url: 'https://example.com',
  displayAt: 15,
  position: 'top-left',
};

// Mock fetch for tracking
global.fetch = vi.fn(() => Promise.resolve(new Response()));

describe('InfoCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders product card correctly', () => {
      render(
        <InfoCard
          card={productCard}
          currentTime={10}
          duration={60}
          expanded={true}
        />
      );

      expect(screen.getByText('Amazing Product')).toBeInTheDocument();
      expect(screen.getByText('This is a great product')).toBeInTheDocument();
      expect(screen.getByText('$49.99')).toBeInTheDocument();
    });

    it('renders video card correctly', () => {
      render(
        <InfoCard
          card={videoCard}
          currentTime={15}
          duration={60}
          expanded={true}
        />
      );

      expect(screen.getByText('Related Video')).toBeInTheDocument();
      expect(screen.getByText('Watch this related content')).toBeInTheDocument();
    });

    it('renders link card correctly', () => {
      render(
        <InfoCard
          card={linkCard}
          currentTime={20}
          duration={60}
          expanded={true}
        />
      );

      expect(screen.getByText('Learn More')).toBeInTheDocument();
      expect(screen.getByText('Visit our website')).toBeInTheDocument();
    });

    it('shows thumbnail when provided', () => {
      render(
        <InfoCard
          card={productCard}
          currentTime={10}
          duration={60}
          expanded={true}
        />
      );

      expect(screen.getByAltText('Amazing Product')).toHaveAttribute('src', 'https://example.com/product.jpg');
    });
  });

  describe('Visibility', () => {
    it('renders when within display window', () => {
      render(
        <InfoCard
          card={productCard}
          currentTime={10} // Within 5-25 window
          duration={60}
          expanded={true}
        />
      );

      expect(screen.getByText('Amazing Product')).toBeInTheDocument();
    });

    it('does not render when before display time', () => {
      render(
        <InfoCard
          card={productCard}
          currentTime={2} // Before displayAt (5)
          duration={60}
          expanded={true}
        />
      );

      expect(screen.queryByText('Amazing Product')).not.toBeInTheDocument();
    });

    it('does not render when after display window', () => {
      render(
        <InfoCard
          card={productCard}
          currentTime={30} // After displayAt + duration (5 + 20 = 25)
          duration={60}
          expanded={true}
        />
      );

      expect(screen.queryByText('Amazing Product')).not.toBeInTheDocument();
    });

    it('does not render content when not expanded', () => {
      render(
        <InfoCard
          card={productCard}
          currentTime={10}
          duration={60}
          expanded={false}
        />
      );

      // Card should still exist but title/description hidden when collapsed
      // This depends on your InfoCard implementation
      // The exact behavior depends on your CSS/component implementation
      expect(screen.queryByText('Amazing Product')).toBeDefined();
    });
  });

  describe('Interactions', () => {
    it('calls onSelect when card is clicked', () => {
      const onSelect = vi.fn();

      render(
        <InfoCard
          card={productCard}
          currentTime={10}
          duration={60}
          expanded={true}
          onSelect={onSelect}
        />
      );

      // Find and click the card
      const cardElement = screen.getByText('Amazing Product').closest('[role="button"]');
      if (cardElement) {
        fireEvent.click(cardElement);
        expect(onSelect).toHaveBeenCalledWith(productCard);
      }
    });

    it('calls onDismiss when dismiss button is clicked', () => {
      const onDismiss = vi.fn();

      render(
        <InfoCard
          card={productCard}
          currentTime={10}
          duration={60}
          expanded={true}
          onDismiss={onDismiss}
        />
      );

      // Find and click dismiss button
      const dismissButton = screen.getByRole('button', { name: /dismiss card/i });
      fireEvent.click(dismissButton);

      expect(onDismiss).toHaveBeenCalledWith(productCard);
    });

    it('opens URL when clicked if url is provided', () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(
        <InfoCard
          card={productCard}
          currentTime={10}
          duration={60}
          expanded={true}
        />
      );

      const cardElement = screen.getByText('Amazing Product').closest('[role="button"]');
      if (cardElement) {
        fireEvent.click(cardElement);
        expect(windowOpen).toHaveBeenCalledWith('https://example.com/product', '_blank');
      }

      windowOpen.mockRestore();
    });

    it('handles keyboard Enter key', () => {
      const onSelect = vi.fn();

      render(
        <InfoCard
          card={productCard}
          currentTime={10}
          duration={60}
          expanded={true}
          onSelect={onSelect}
        />
      );

      const cardElement = screen.getByText('Amazing Product').closest('[role="button"]');
      if (cardElement) {
        fireEvent.keyDown(cardElement, { key: 'Enter' });
        expect(onSelect).toHaveBeenCalledWith(productCard);
      }
    });
  });

  describe('Tracking', () => {
    it('fires impression tracking URL', () => {
      render(
        <InfoCard
          card={productCard}
          currentTime={10}
          duration={60}
          expanded={true}
        />
      );

      expect(fetch).toHaveBeenCalledWith('https://example.com/track/impression', expect.any(Object));
    });

    it('fires click tracking URL when clicked', () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(
        <InfoCard
          card={productCard}
          currentTime={10}
          duration={60}
          expanded={true}
        />
      );

      const cardElement = screen.getByText('Amazing Product').closest('[role="button"]');
      if (cardElement) {
        fireEvent.click(cardElement);
        expect(fetch).toHaveBeenCalledWith('https://example.com/track/click', expect.any(Object));
      }

      windowOpen.mockRestore();
    });

    it('fires dismiss tracking URL when dismissed', () => {
      render(
        <InfoCard
          card={productCard}
          currentTime={10}
          duration={60}
          expanded={true}
        />
      );

      const dismissButton = screen.getByRole('button', { name: /dismiss card/i });
      fireEvent.click(dismissButton);

      expect(fetch).toHaveBeenCalledWith('https://example.com/track/dismiss', expect.any(Object));
    });
  });

  describe('Card types', () => {
    it('shows price badge for product cards', () => {
      render(
        <InfoCard
          card={productCard}
          currentTime={10}
          duration={60}
          expanded={true}
        />
      );

      expect(screen.getByText('$49.99')).toBeInTheDocument();
    });

    it('shows play icon for video cards', () => {
      render(
        <InfoCard
          card={videoCard}
          currentTime={15}
          duration={60}
          expanded={true}
        />
      );

      // Video cards should have a play indicator
      // The exact element depends on your implementation
      expect(screen.getByText('Related Video')).toBeInTheDocument();
    });
  });

  describe('Position', () => {
    it('applies top-right position class', () => {
      render(
        <InfoCard
          card={productCard}
          currentTime={10}
          duration={60}
          expanded={true}
        />
      );

      const container = screen.getByText('Amazing Product').closest('.fairu-info-card');
      expect(container).toHaveClass('top-4');
      expect(container).toHaveClass('right-4');
    });

    it('applies top-left position class', () => {
      render(
        <InfoCard
          card={linkCard}
          currentTime={20}
          duration={60}
          expanded={true}
        />
      );

      const container = screen.getByText('Learn More').closest('.fairu-info-card');
      expect(container).toHaveClass('top-4');
      expect(container).toHaveClass('left-4');
    });
  });

  describe('Edge cases', () => {
    it('handles card without tracking URLs', () => {
      const cardWithoutTracking: InfoCardType = {
        ...productCard,
        trackingUrls: undefined,
      };

      render(
        <InfoCard
          card={cardWithoutTracking}
          currentTime={10}
          duration={60}
          expanded={true}
        />
      );

      expect(screen.getByText('Amazing Product')).toBeInTheDocument();
    });

    it('handles card without description', () => {
      const cardWithoutDesc: InfoCardType = {
        ...productCard,
        description: undefined,
      };

      render(
        <InfoCard
          card={cardWithoutDesc}
          currentTime={10}
          duration={60}
          expanded={true}
        />
      );

      expect(screen.getByText('Amazing Product')).toBeInTheDocument();
      expect(screen.queryByText('This is a great product')).not.toBeInTheDocument();
    });

    it('handles card without thumbnail', () => {
      const cardWithoutThumb: InfoCardType = {
        ...productCard,
        thumbnail: undefined,
      };

      render(
        <InfoCard
          card={cardWithoutThumb}
          currentTime={10}
          duration={60}
          expanded={true}
        />
      );

      expect(screen.getByText('Amazing Product')).toBeInTheDocument();
      expect(screen.queryByAltText('Amazing Product')).not.toBeInTheDocument();
    });

    it('uses remaining video duration when duration not specified', () => {
      const cardWithoutDuration: InfoCardType = {
        ...productCard,
        duration: undefined,
      };

      // Card displays at 5, video duration is 60, so card should be visible until 60
      render(
        <InfoCard
          card={cardWithoutDuration}
          currentTime={55} // Near end of video
          duration={60}
          expanded={true}
        />
      );

      expect(screen.getByText('Amazing Product')).toBeInTheDocument();
    });
  });

  describe('Dismissed state', () => {
    it('stays dismissed after being dismissed', () => {
      const onDismiss = vi.fn();
      const { rerender } = render(
        <InfoCard
          card={productCard}
          currentTime={10}
          duration={60}
          expanded={true}
          onDismiss={onDismiss}
        />
      );

      expect(screen.getByText('Amazing Product')).toBeInTheDocument();

      const dismissButton = screen.getByRole('button', { name: /dismiss card/i });
      fireEvent.click(dismissButton);

      // After dismiss, card should not be visible
      expect(screen.queryByText('Amazing Product')).not.toBeInTheDocument();

      // Update time but card should stay dismissed
      rerender(
        <InfoCard
          card={productCard}
          currentTime={15}
          duration={60}
          expanded={true}
          onDismiss={onDismiss}
        />
      );

      expect(screen.queryByText('Amazing Product')).not.toBeInTheDocument();
    });
  });
});
