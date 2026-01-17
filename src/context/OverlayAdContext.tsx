import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { OverlayAd, InfoCard } from '@/types/video';

/**
 * State for dynamic overlay ads and info cards
 */
export interface OverlayAdState {
  /** Currently active overlay ads (both time-based and manually triggered) */
  activeOverlayAds: OverlayAd[];
  /** Currently active info cards (both time-based and manually triggered) */
  activeInfoCards: InfoCard[];
  /** Manually triggered overlay ads (not time-based) */
  manualOverlayAds: OverlayAd[];
  /** Manually triggered info cards (not time-based) */
  manualInfoCards: InfoCard[];
  /** IDs of dismissed overlay ads */
  dismissedOverlayAds: Set<string>;
  /** IDs of dismissed info cards */
  dismissedInfoCards: Set<string>;
}

/**
 * Controls for managing dynamic overlay ads and info cards
 */
export interface OverlayAdControls {
  /** Show an overlay ad immediately (ignores displayAt) */
  showOverlayAd: (ad: OverlayAd) => void;
  /** Hide/dismiss a specific overlay ad */
  hideOverlayAd: (adId: string) => void;
  /** Hide all currently showing overlay ads */
  hideAllOverlayAds: () => void;
  /** Show an info card immediately (ignores displayAt) */
  showInfoCard: (card: InfoCard) => void;
  /** Hide/dismiss a specific info card */
  hideInfoCard: (cardId: string) => void;
  /** Hide all currently showing info cards */
  hideAllInfoCards: () => void;
  /** Reset all dismissed states (allow ads/cards to show again) */
  resetDismissed: () => void;
  /** Check if an overlay ad is currently visible */
  isOverlayAdVisible: (adId: string) => boolean;
  /** Check if an info card is currently visible */
  isInfoCardVisible: (cardId: string) => boolean;
}

/**
 * Context value for overlay ad management
 */
export interface OverlayAdContextValue {
  state: OverlayAdState;
  controls: OverlayAdControls;
}

export const OverlayAdContext = createContext<OverlayAdContextValue | null>(null);

export interface OverlayAdProviderProps {
  children: React.ReactNode;
  /** Pre-configured overlay ads (time-based) */
  overlayAds?: OverlayAd[];
  /** Pre-configured info cards (time-based) */
  infoCards?: InfoCard[];
  /** Current video time for time-based visibility */
  currentTime?: number;
  /** Video duration */
  duration?: number;
  /** Callback when an overlay ad is shown */
  onOverlayAdShow?: (ad: OverlayAd) => void;
  /** Callback when an overlay ad is hidden/dismissed */
  onOverlayAdHide?: (ad: OverlayAd) => void;
  /** Callback when an info card is shown */
  onInfoCardShow?: (card: InfoCard) => void;
  /** Callback when an info card is hidden/dismissed */
  onInfoCardHide?: (card: InfoCard) => void;
}

/**
 * Provider for managing dynamic overlay ads and info cards
 */
export function OverlayAdProvider({
  children,
  overlayAds = [],
  infoCards = [],
  currentTime = 0,
  duration = 0,
  onOverlayAdShow,
  onOverlayAdHide,
  onInfoCardShow,
  onInfoCardHide,
}: OverlayAdProviderProps) {
  const [manualOverlayAds, setManualOverlayAds] = useState<OverlayAd[]>([]);
  const [manualInfoCards, setManualInfoCards] = useState<InfoCard[]>([]);
  const [dismissedOverlayAds, setDismissedOverlayAds] = useState<Set<string>>(new Set());
  const [dismissedInfoCards, setDismissedInfoCards] = useState<Set<string>>(new Set());

  // Show an overlay ad immediately
  const showOverlayAd = useCallback((ad: OverlayAd) => {
    setManualOverlayAds((prev) => {
      // Remove if already exists (to reset/update)
      const filtered = prev.filter((a) => a.id !== ad.id);
      return [...filtered, ad];
    });
    // Remove from dismissed if it was dismissed
    setDismissedOverlayAds((prev) => {
      const next = new Set(prev);
      next.delete(ad.id);
      return next;
    });
    onOverlayAdShow?.(ad);
  }, [onOverlayAdShow]);

  // Hide a specific overlay ad
  const hideOverlayAd = useCallback((adId: string) => {
    const ad = manualOverlayAds.find((a) => a.id === adId) || overlayAds.find((a) => a.id === adId);
    setManualOverlayAds((prev) => prev.filter((a) => a.id !== adId));
    setDismissedOverlayAds((prev) => new Set(prev).add(adId));
    if (ad) {
      onOverlayAdHide?.(ad);
    }
  }, [manualOverlayAds, overlayAds, onOverlayAdHide]);

  // Hide all overlay ads
  const hideAllOverlayAds = useCallback(() => {
    const allIds = [...manualOverlayAds.map((a) => a.id), ...overlayAds.map((a) => a.id)];
    setManualOverlayAds([]);
    setDismissedOverlayAds((prev) => {
      const next = new Set(prev);
      allIds.forEach((id) => next.add(id));
      return next;
    });
  }, [manualOverlayAds, overlayAds]);

  // Show an info card immediately
  const showInfoCard = useCallback((card: InfoCard) => {
    setManualInfoCards((prev) => {
      const filtered = prev.filter((c) => c.id !== card.id);
      return [...filtered, card];
    });
    setDismissedInfoCards((prev) => {
      const next = new Set(prev);
      next.delete(card.id);
      return next;
    });
    onInfoCardShow?.(card);
  }, [onInfoCardShow]);

  // Hide a specific info card
  const hideInfoCard = useCallback((cardId: string) => {
    const card = manualInfoCards.find((c) => c.id === cardId) || infoCards.find((c) => c.id === cardId);
    setManualInfoCards((prev) => prev.filter((c) => c.id !== cardId));
    setDismissedInfoCards((prev) => new Set(prev).add(cardId));
    if (card) {
      onInfoCardHide?.(card);
    }
  }, [manualInfoCards, infoCards, onInfoCardHide]);

  // Hide all info cards
  const hideAllInfoCards = useCallback(() => {
    const allIds = [...manualInfoCards.map((c) => c.id), ...infoCards.map((c) => c.id)];
    setManualInfoCards([]);
    setDismissedInfoCards((prev) => {
      const next = new Set(prev);
      allIds.forEach((id) => next.add(id));
      return next;
    });
  }, [manualInfoCards, infoCards]);

  // Reset all dismissed states
  const resetDismissed = useCallback(() => {
    setDismissedOverlayAds(new Set());
    setDismissedInfoCards(new Set());
  }, []);

  // Check if an overlay ad is visible
  const isOverlayAdVisible = useCallback((adId: string) => {
    if (dismissedOverlayAds.has(adId)) return false;

    // Check manual ads
    if (manualOverlayAds.some((a) => a.id === adId)) return true;

    // Check time-based ads
    const ad = overlayAds.find((a) => a.id === adId);
    if (ad) {
      const adDuration = ad.duration ?? 10;
      return currentTime >= ad.displayAt && currentTime < ad.displayAt + adDuration;
    }

    return false;
  }, [dismissedOverlayAds, manualOverlayAds, overlayAds, currentTime]);

  // Check if an info card is visible
  const isInfoCardVisible = useCallback((cardId: string) => {
    if (dismissedInfoCards.has(cardId)) return false;

    // Check manual cards
    if (manualInfoCards.some((c) => c.id === cardId)) return true;

    // Check time-based cards
    const card = infoCards.find((c) => c.id === cardId);
    if (card) {
      const cardDuration = card.duration ?? (duration - card.displayAt);
      return currentTime >= card.displayAt && currentTime < card.displayAt + cardDuration;
    }

    return false;
  }, [dismissedInfoCards, manualInfoCards, infoCards, currentTime, duration]);

  // Compute active overlay ads (time-based + manual, excluding dismissed)
  const activeOverlayAds = useMemo(() => {
    const timeBasedActive = overlayAds.filter((ad) => {
      if (dismissedOverlayAds.has(ad.id)) return false;
      const adDuration = ad.duration ?? 10;
      return currentTime >= ad.displayAt && currentTime < ad.displayAt + adDuration;
    });

    const manualActive = manualOverlayAds.filter((ad) => !dismissedOverlayAds.has(ad.id));

    // Merge, avoiding duplicates
    const merged = [...timeBasedActive];
    for (const ad of manualActive) {
      if (!merged.some((a) => a.id === ad.id)) {
        merged.push(ad);
      }
    }

    return merged;
  }, [overlayAds, manualOverlayAds, dismissedOverlayAds, currentTime]);

  // Compute active info cards (time-based + manual, excluding dismissed)
  const activeInfoCards = useMemo(() => {
    const timeBasedActive = infoCards.filter((card) => {
      if (dismissedInfoCards.has(card.id)) return false;
      const cardDuration = card.duration ?? (duration - card.displayAt);
      return currentTime >= card.displayAt && currentTime < card.displayAt + cardDuration;
    });

    const manualActive = manualInfoCards.filter((card) => !dismissedInfoCards.has(card.id));

    // Merge, avoiding duplicates
    const merged = [...timeBasedActive];
    for (const card of manualActive) {
      if (!merged.some((c) => c.id === card.id)) {
        merged.push(card);
      }
    }

    return merged;
  }, [infoCards, manualInfoCards, dismissedInfoCards, currentTime, duration]);

  const state: OverlayAdState = {
    activeOverlayAds,
    activeInfoCards,
    manualOverlayAds,
    manualInfoCards,
    dismissedOverlayAds,
    dismissedInfoCards,
  };

  const controls: OverlayAdControls = {
    showOverlayAd,
    hideOverlayAd,
    hideAllOverlayAds,
    showInfoCard,
    hideInfoCard,
    hideAllInfoCards,
    resetDismissed,
    isOverlayAdVisible,
    isInfoCardVisible,
  };

  const contextValue = useMemo(() => ({ state, controls }), [state, controls]);

  return (
    <OverlayAdContext.Provider value={contextValue}>
      {children}
    </OverlayAdContext.Provider>
  );
}

/**
 * Hook to access the overlay ad context
 */
export function useOverlayAds(): OverlayAdContextValue {
  const context = useContext(OverlayAdContext);

  if (!context) {
    throw new Error('useOverlayAds must be used within an OverlayAdProvider');
  }

  return context;
}

/**
 * Hook to get just the overlay ad controls (for external usage)
 */
export function useOverlayAdControls(): OverlayAdControls {
  const { controls } = useOverlayAds();
  return controls;
}

export { OverlayAdContext as default };
