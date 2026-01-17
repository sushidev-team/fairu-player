import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { OverlayAdProvider, useOverlayAds, useOverlayAdControls } from './OverlayAdContext';
import type { OverlayAd, InfoCard } from '@/types/video';

// Sample test data
const sampleOverlayAd: OverlayAd = {
  id: 'overlay-1',
  imageUrl: 'https://example.com/ad.png',
  clickThroughUrl: 'https://example.com',
  displayAt: 5,
  duration: 10,
  position: 'bottom',
  closeable: true,
  altText: 'Test Ad',
};

const sampleOverlayAd2: OverlayAd = {
  id: 'overlay-2',
  imageUrl: 'https://example.com/ad2.png',
  displayAt: 15,
  duration: 10,
  position: 'top',
};

const sampleInfoCard: InfoCard = {
  id: 'card-1',
  type: 'product',
  title: 'Test Product',
  description: 'A test product card',
  displayAt: 10,
  duration: 20,
  price: '$99.99',
  position: 'top-right',
};

const sampleInfoCard2: InfoCard = {
  id: 'card-2',
  type: 'video',
  title: 'Related Video',
  displayAt: 30,
  position: 'top-right',
};

// Helper function to create wrapper with custom props
const createWrapper = (props: {
  overlayAds?: OverlayAd[];
  infoCards?: InfoCard[];
  currentTime?: number;
  duration?: number;
  onOverlayAdShow?: (ad: OverlayAd) => void;
  onOverlayAdHide?: (ad: OverlayAd) => void;
  onInfoCardShow?: (card: InfoCard) => void;
  onInfoCardHide?: (card: InfoCard) => void;
} = {}) => {
  return ({ children }: { children: React.ReactNode }) => (
    <OverlayAdProvider {...props}>{children}</OverlayAdProvider>
  );
};

describe('OverlayAdContext', () => {
  describe('useOverlayAds hook', () => {
    it('throws error when used outside provider', () => {
      expect(() => {
        renderHook(() => useOverlayAds());
      }).toThrow('useOverlayAds must be used within an OverlayAdProvider');
    });

    it('provides initial empty state', () => {
      const { result } = renderHook(() => useOverlayAds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.activeOverlayAds).toEqual([]);
      expect(result.current.state.activeInfoCards).toEqual([]);
      expect(result.current.state.manualOverlayAds).toEqual([]);
      expect(result.current.state.manualInfoCards).toEqual([]);
    });
  });

  describe('useOverlayAdControls hook', () => {
    it('returns controls object', () => {
      const { result } = renderHook(() => useOverlayAdControls(), {
        wrapper: createWrapper(),
      });

      expect(result.current.showOverlayAd).toBeDefined();
      expect(result.current.hideOverlayAd).toBeDefined();
      expect(result.current.hideAllOverlayAds).toBeDefined();
      expect(result.current.showInfoCard).toBeDefined();
      expect(result.current.hideInfoCard).toBeDefined();
      expect(result.current.hideAllInfoCards).toBeDefined();
      expect(result.current.resetDismissed).toBeDefined();
      expect(result.current.isOverlayAdVisible).toBeDefined();
      expect(result.current.isInfoCardVisible).toBeDefined();
    });
  });

  describe('Overlay Ad Controls', () => {
    describe('showOverlayAd', () => {
      it('shows an overlay ad immediately', () => {
        const onShow = vi.fn();
        const { result } = renderHook(() => useOverlayAds(), {
          wrapper: createWrapper({ onOverlayAdShow: onShow }),
        });

        act(() => {
          result.current.controls.showOverlayAd(sampleOverlayAd);
        });

        expect(result.current.state.manualOverlayAds).toContainEqual(sampleOverlayAd);
        expect(result.current.state.activeOverlayAds).toContainEqual(sampleOverlayAd);
        expect(onShow).toHaveBeenCalledWith(sampleOverlayAd);
      });

      it('replaces existing ad with same id', () => {
        const { result } = renderHook(() => useOverlayAds(), {
          wrapper: createWrapper(),
        });

        const updatedAd = { ...sampleOverlayAd, imageUrl: 'https://example.com/updated.png' };

        act(() => {
          result.current.controls.showOverlayAd(sampleOverlayAd);
        });

        act(() => {
          result.current.controls.showOverlayAd(updatedAd);
        });

        expect(result.current.state.manualOverlayAds).toHaveLength(1);
        expect(result.current.state.manualOverlayAds[0].imageUrl).toBe('https://example.com/updated.png');
      });

      it('removes ad from dismissed list when shown again', () => {
        const { result } = renderHook(() => useOverlayAds(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.controls.showOverlayAd(sampleOverlayAd);
        });

        act(() => {
          result.current.controls.hideOverlayAd(sampleOverlayAd.id);
        });

        expect(result.current.state.dismissedOverlayAds.has(sampleOverlayAd.id)).toBe(true);

        act(() => {
          result.current.controls.showOverlayAd(sampleOverlayAd);
        });

        expect(result.current.state.dismissedOverlayAds.has(sampleOverlayAd.id)).toBe(false);
      });
    });

    describe('hideOverlayAd', () => {
      it('hides a specific overlay ad', () => {
        const onHide = vi.fn();
        const { result } = renderHook(() => useOverlayAds(), {
          wrapper: createWrapper({ onOverlayAdHide: onHide }),
        });

        act(() => {
          result.current.controls.showOverlayAd(sampleOverlayAd);
        });

        act(() => {
          result.current.controls.hideOverlayAd(sampleOverlayAd.id);
        });

        expect(result.current.state.manualOverlayAds).not.toContainEqual(sampleOverlayAd);
        expect(result.current.state.dismissedOverlayAds.has(sampleOverlayAd.id)).toBe(true);
        expect(onHide).toHaveBeenCalledWith(sampleOverlayAd);
      });

      it('handles hiding non-existent ad gracefully', () => {
        const { result } = renderHook(() => useOverlayAds(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.controls.hideOverlayAd('non-existent');
        });

        expect(result.current.state.dismissedOverlayAds.has('non-existent')).toBe(true);
      });
    });

    describe('hideAllOverlayAds', () => {
      it('hides all overlay ads', () => {
        const { result } = renderHook(() => useOverlayAds(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.controls.showOverlayAd(sampleOverlayAd);
          result.current.controls.showOverlayAd(sampleOverlayAd2);
        });

        expect(result.current.state.activeOverlayAds).toHaveLength(2);

        act(() => {
          result.current.controls.hideAllOverlayAds();
        });

        expect(result.current.state.manualOverlayAds).toHaveLength(0);
        expect(result.current.state.dismissedOverlayAds.has(sampleOverlayAd.id)).toBe(true);
        expect(result.current.state.dismissedOverlayAds.has(sampleOverlayAd2.id)).toBe(true);
      });
    });

    describe('isOverlayAdVisible', () => {
      it('returns true for visible manual ad', () => {
        const { result } = renderHook(() => useOverlayAds(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.controls.showOverlayAd(sampleOverlayAd);
        });

        expect(result.current.controls.isOverlayAdVisible(sampleOverlayAd.id)).toBe(true);
      });

      it('returns false for dismissed ad', () => {
        const { result } = renderHook(() => useOverlayAds(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.controls.showOverlayAd(sampleOverlayAd);
          result.current.controls.hideOverlayAd(sampleOverlayAd.id);
        });

        expect(result.current.controls.isOverlayAdVisible(sampleOverlayAd.id)).toBe(false);
      });

      it('returns true for time-based ad within display window', () => {
        const { result } = renderHook(() => useOverlayAds(), {
          wrapper: createWrapper({
            overlayAds: [sampleOverlayAd],
            currentTime: 10, // Ad displays at 5, duration 10, so visible at 10
          }),
        });

        expect(result.current.controls.isOverlayAdVisible(sampleOverlayAd.id)).toBe(true);
      });

      it('returns false for time-based ad outside display window', () => {
        const { result } = renderHook(() => useOverlayAds(), {
          wrapper: createWrapper({
            overlayAds: [sampleOverlayAd],
            currentTime: 20, // Ad displays at 5, duration 10, so not visible at 20
          }),
        });

        expect(result.current.controls.isOverlayAdVisible(sampleOverlayAd.id)).toBe(false);
      });
    });
  });

  describe('Info Card Controls', () => {
    describe('showInfoCard', () => {
      it('shows an info card immediately', () => {
        const onShow = vi.fn();
        const { result } = renderHook(() => useOverlayAds(), {
          wrapper: createWrapper({ onInfoCardShow: onShow }),
        });

        act(() => {
          result.current.controls.showInfoCard(sampleInfoCard);
        });

        expect(result.current.state.manualInfoCards).toContainEqual(sampleInfoCard);
        expect(result.current.state.activeInfoCards).toContainEqual(sampleInfoCard);
        expect(onShow).toHaveBeenCalledWith(sampleInfoCard);
      });
    });

    describe('hideInfoCard', () => {
      it('hides a specific info card', () => {
        const onHide = vi.fn();
        const { result } = renderHook(() => useOverlayAds(), {
          wrapper: createWrapper({ onInfoCardHide: onHide }),
        });

        act(() => {
          result.current.controls.showInfoCard(sampleInfoCard);
        });

        act(() => {
          result.current.controls.hideInfoCard(sampleInfoCard.id);
        });

        expect(result.current.state.manualInfoCards).not.toContainEqual(sampleInfoCard);
        expect(result.current.state.dismissedInfoCards.has(sampleInfoCard.id)).toBe(true);
        expect(onHide).toHaveBeenCalledWith(sampleInfoCard);
      });
    });

    describe('hideAllInfoCards', () => {
      it('hides all info cards', () => {
        const { result } = renderHook(() => useOverlayAds(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.controls.showInfoCard(sampleInfoCard);
          result.current.controls.showInfoCard(sampleInfoCard2);
        });

        expect(result.current.state.activeInfoCards).toHaveLength(2);

        act(() => {
          result.current.controls.hideAllInfoCards();
        });

        expect(result.current.state.manualInfoCards).toHaveLength(0);
        expect(result.current.state.dismissedInfoCards.has(sampleInfoCard.id)).toBe(true);
        expect(result.current.state.dismissedInfoCards.has(sampleInfoCard2.id)).toBe(true);
      });
    });

    describe('isInfoCardVisible', () => {
      it('returns true for visible manual card', () => {
        const { result } = renderHook(() => useOverlayAds(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.controls.showInfoCard(sampleInfoCard);
        });

        expect(result.current.controls.isInfoCardVisible(sampleInfoCard.id)).toBe(true);
      });

      it('returns false for dismissed card', () => {
        const { result } = renderHook(() => useOverlayAds(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.controls.showInfoCard(sampleInfoCard);
          result.current.controls.hideInfoCard(sampleInfoCard.id);
        });

        expect(result.current.controls.isInfoCardVisible(sampleInfoCard.id)).toBe(false);
      });
    });
  });

  describe('resetDismissed', () => {
    it('resets all dismissed states', () => {
      const { result } = renderHook(() => useOverlayAds(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.controls.showOverlayAd(sampleOverlayAd);
        result.current.controls.showInfoCard(sampleInfoCard);
      });

      act(() => {
        result.current.controls.hideOverlayAd(sampleOverlayAd.id);
        result.current.controls.hideInfoCard(sampleInfoCard.id);
      });

      expect(result.current.state.dismissedOverlayAds.size).toBe(1);
      expect(result.current.state.dismissedInfoCards.size).toBe(1);

      act(() => {
        result.current.controls.resetDismissed();
      });

      expect(result.current.state.dismissedOverlayAds.size).toBe(0);
      expect(result.current.state.dismissedInfoCards.size).toBe(0);
    });
  });

  describe('Time-based visibility', () => {
    it('shows overlay ads based on currentTime', () => {
      const { result } = renderHook(() => useOverlayAds(), {
        wrapper: createWrapper({
          overlayAds: [sampleOverlayAd], // displayAt: 5, duration: 10
          currentTime: 0,
        }),
      });

      // Before displayAt
      expect(result.current.state.activeOverlayAds).toHaveLength(0);

      // Update wrapper with new currentTime
      const WrapperAt10 = createWrapper({
        overlayAds: [sampleOverlayAd],
        currentTime: 10, // Within display window (5-15)
      });

      const { result: result2 } = renderHook(() => useOverlayAds(), {
        wrapper: WrapperAt10,
      });

      expect(result2.current.state.activeOverlayAds).toHaveLength(1);
      expect(result2.current.state.activeOverlayAds[0].id).toBe(sampleOverlayAd.id);
    });

    it('shows info cards based on currentTime', () => {
      const { result } = renderHook(() => useOverlayAds(), {
        wrapper: createWrapper({
          infoCards: [sampleInfoCard], // displayAt: 10, duration: 20
          currentTime: 15, // Within display window (10-30)
          duration: 60,
        }),
      });

      expect(result.current.state.activeInfoCards).toHaveLength(1);
      expect(result.current.state.activeInfoCards[0].id).toBe(sampleInfoCard.id);
    });

    it('excludes dismissed time-based ads', () => {
      const { result } = renderHook(() => useOverlayAds(), {
        wrapper: createWrapper({
          overlayAds: [sampleOverlayAd],
          currentTime: 10,
        }),
      });

      expect(result.current.state.activeOverlayAds).toHaveLength(1);

      act(() => {
        result.current.controls.hideOverlayAd(sampleOverlayAd.id);
      });

      expect(result.current.state.activeOverlayAds).toHaveLength(0);
    });

    it('merges time-based and manual ads without duplicates', () => {
      const { result } = renderHook(() => useOverlayAds(), {
        wrapper: createWrapper({
          overlayAds: [sampleOverlayAd],
          currentTime: 10, // Ad is visible by time
        }),
      });

      // Time-based ad is visible
      expect(result.current.state.activeOverlayAds).toHaveLength(1);

      // Show same ad manually
      act(() => {
        result.current.controls.showOverlayAd(sampleOverlayAd);
      });

      // Should still only have 1 ad (no duplicates)
      expect(result.current.state.activeOverlayAds).toHaveLength(1);
    });
  });

  describe('Multiple ads interaction', () => {
    it('handles showing multiple ads simultaneously', () => {
      const { result } = renderHook(() => useOverlayAds(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.controls.showOverlayAd(sampleOverlayAd);
        result.current.controls.showOverlayAd(sampleOverlayAd2);
        result.current.controls.showInfoCard(sampleInfoCard);
        result.current.controls.showInfoCard(sampleInfoCard2);
      });

      expect(result.current.state.activeOverlayAds).toHaveLength(2);
      expect(result.current.state.activeInfoCards).toHaveLength(2);
    });

    it('hides specific ads while keeping others', () => {
      const { result } = renderHook(() => useOverlayAds(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.controls.showOverlayAd(sampleOverlayAd);
        result.current.controls.showOverlayAd(sampleOverlayAd2);
      });

      act(() => {
        result.current.controls.hideOverlayAd(sampleOverlayAd.id);
      });

      expect(result.current.state.activeOverlayAds).toHaveLength(1);
      expect(result.current.state.activeOverlayAds[0].id).toBe(sampleOverlayAd2.id);
    });
  });
});
