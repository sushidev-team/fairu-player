import type { OverlayAd, InfoCard } from '@/types/video';

/**
 * Event types for the Ad Event Bus
 */
export type AdEventType =
  | 'showOverlayAd'
  | 'hideOverlayAd'
  | 'hideAllOverlayAds'
  | 'showInfoCard'
  | 'hideInfoCard'
  | 'hideAllInfoCards'
  | 'resetDismissed';

/**
 * Event payload types
 */
export interface AdEventPayloads {
  showOverlayAd: OverlayAd;
  hideOverlayAd: { id: string };
  hideAllOverlayAds: void;
  showInfoCard: InfoCard;
  hideInfoCard: { id: string };
  hideAllInfoCards: void;
  resetDismissed: void;
}

/**
 * Event listener callback type
 */
export type AdEventListener<T extends AdEventType> = (
  payload: AdEventPayloads[T]
) => void;

/**
 * Ad Event Bus - A typed event emitter for controlling ads programmatically
 *
 * @example
 * ```tsx
 * // Create the event bus
 * const adEventBus = createAdEventBus();
 *
 * // Pass to VideoPlayer
 * <VideoPlayer adEventBus={adEventBus} track={track} />
 *
 * // Trigger events from anywhere
 * adEventBus.emit('showOverlayAd', {
 *   id: 'promo-1',
 *   imageUrl: 'https://example.com/ad.png',
 *   displayAt: 0,
 * });
 *
 * adEventBus.emit('hideOverlayAd', { id: 'promo-1' });
 * adEventBus.emit('hideAllOverlayAds');
 * ```
 */
export interface AdEventBus {
  /**
   * Emit an event to trigger ad actions
   */
  emit<T extends AdEventType>(
    event: T,
    ...args: AdEventPayloads[T] extends void ? [] : [AdEventPayloads[T]]
  ): void;

  /**
   * Subscribe to an event
   */
  on<T extends AdEventType>(event: T, listener: AdEventListener<T>): () => void;

  /**
   * Subscribe to an event (one-time)
   */
  once<T extends AdEventType>(event: T, listener: AdEventListener<T>): () => void;

  /**
   * Unsubscribe from an event
   */
  off<T extends AdEventType>(event: T, listener: AdEventListener<T>): void;

  /**
   * Remove all listeners
   */
  removeAllListeners(): void;
}

/**
 * Creates a new Ad Event Bus instance
 */
export function createAdEventBus(): AdEventBus {
  const listeners = new Map<AdEventType, Set<AdEventListener<AdEventType>>>();

  const getListeners = (event: AdEventType) => {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    return listeners.get(event)!;
  };

  return {
    emit<T extends AdEventType>(
      event: T,
      ...args: AdEventPayloads[T] extends void ? [] : [AdEventPayloads[T]]
    ): void {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        const payload = args[0] as AdEventPayloads[T];
        eventListeners.forEach((listener) => {
          try {
            (listener as AdEventListener<T>)(payload);
          } catch (error) {
            console.error(`Error in AdEventBus listener for "${event}":`, error);
          }
        });
      }
    },

    on<T extends AdEventType>(
      event: T,
      listener: AdEventListener<T>
    ): () => void {
      const eventListeners = getListeners(event);
      eventListeners.add(listener as AdEventListener<AdEventType>);

      // Return unsubscribe function
      return () => {
        eventListeners.delete(listener as AdEventListener<AdEventType>);
      };
    },

    once<T extends AdEventType>(
      event: T,
      listener: AdEventListener<T>
    ): () => void {
      const wrappedListener: AdEventListener<T> = (payload) => {
        this.off(event, wrappedListener);
        listener(payload);
      };
      return this.on(event, wrappedListener);
    },

    off<T extends AdEventType>(
      event: T,
      listener: AdEventListener<T>
    ): void {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(listener as AdEventListener<AdEventType>);
      }
    },

    removeAllListeners(): void {
      listeners.clear();
    },
  };
}

/**
 * Global singleton event bus (optional - for apps that prefer a global instance)
 */
let globalAdEventBus: AdEventBus | null = null;

export function getGlobalAdEventBus(): AdEventBus {
  if (!globalAdEventBus) {
    globalAdEventBus = createAdEventBus();
  }
  return globalAdEventBus;
}

export function resetGlobalAdEventBus(): void {
  if (globalAdEventBus) {
    globalAdEventBus.removeAllListeners();
    globalAdEventBus = null;
  }
}
