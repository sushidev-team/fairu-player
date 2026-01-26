/**
 * Event types for the Player Event Bus
 */
export type PlayerEventType =
  | 'enterPictureInPicture'
  | 'exitPictureInPicture'
  | 'castStart'
  | 'castStop'
  | 'tabHidden'
  | 'tabVisible'
  | 'triggerReturnAd';

/**
 * Event payload types
 */
export interface PlayerEventPayloads {
  enterPictureInPicture: void;
  exitPictureInPicture: void;
  castStart: void;
  castStop: void;
  tabHidden: { timestamp: number };
  tabVisible: { timestamp: number; hiddenDuration: number };
  triggerReturnAd: { hiddenDuration: number };
}

/**
 * Event listener callback type
 */
export type PlayerEventListener<T extends PlayerEventType> = (
  payload: PlayerEventPayloads[T]
) => void;

/**
 * Player Event Bus - A typed event emitter for PiP and tab visibility events
 *
 * @example
 * ```tsx
 * const playerEventBus = createPlayerEventBus();
 *
 * // Pass to VideoPlayer
 * <VideoPlayer playerEventBus={playerEventBus} track={track} />
 *
 * // Listen for events
 * playerEventBus.on('enterPictureInPicture', () => {
 *   console.log('PiP activated');
 * });
 *
 * playerEventBus.on('tabVisible', ({ hiddenDuration }) => {
 *   console.log(`Tab was hidden for ${hiddenDuration}s`);
 * });
 * ```
 */
export interface PlayerEventBus {
  /**
   * Emit an event
   */
  emit<T extends PlayerEventType>(
    event: T,
    ...args: PlayerEventPayloads[T] extends void ? [] : [PlayerEventPayloads[T]]
  ): void;

  /**
   * Subscribe to an event
   */
  on<T extends PlayerEventType>(event: T, listener: PlayerEventListener<T>): () => void;

  /**
   * Subscribe to an event (one-time)
   */
  once<T extends PlayerEventType>(event: T, listener: PlayerEventListener<T>): () => void;

  /**
   * Unsubscribe from an event
   */
  off<T extends PlayerEventType>(event: T, listener: PlayerEventListener<T>): void;

  /**
   * Remove all listeners
   */
  removeAllListeners(): void;
}

/**
 * Creates a new Player Event Bus instance
 */
export function createPlayerEventBus(): PlayerEventBus {
  const listeners = new Map<PlayerEventType, Set<PlayerEventListener<PlayerEventType>>>();

  const getListeners = (event: PlayerEventType) => {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    return listeners.get(event)!;
  };

  const bus: PlayerEventBus = {
    emit<T extends PlayerEventType>(
      event: T,
      ...args: PlayerEventPayloads[T] extends void ? [] : [PlayerEventPayloads[T]]
    ): void {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        const payload = args[0] as PlayerEventPayloads[T];
        eventListeners.forEach((listener) => {
          try {
            (listener as PlayerEventListener<T>)(payload);
          } catch (error) {
            console.error(`Error in PlayerEventBus listener for "${event}":`, error);
          }
        });
      }
    },

    on<T extends PlayerEventType>(
      event: T,
      listener: PlayerEventListener<T>
    ): () => void {
      const eventListeners = getListeners(event);
      eventListeners.add(listener as PlayerEventListener<PlayerEventType>);

      return () => {
        eventListeners.delete(listener as PlayerEventListener<PlayerEventType>);
      };
    },

    once<T extends PlayerEventType>(
      event: T,
      listener: PlayerEventListener<T>
    ): () => void {
      const wrappedListener: PlayerEventListener<T> = (payload) => {
        bus.off(event, wrappedListener);
        listener(payload);
      };
      return bus.on(event, wrappedListener);
    },

    off<T extends PlayerEventType>(
      event: T,
      listener: PlayerEventListener<T>
    ): void {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(listener as PlayerEventListener<PlayerEventType>);
      }
    },

    removeAllListeners(): void {
      listeners.clear();
    },
  };

  return bus;
}

/**
 * Global singleton event bus (optional - for apps that prefer a global instance)
 */
let globalPlayerEventBus: PlayerEventBus | null = null;

export function getGlobalPlayerEventBus(): PlayerEventBus {
  if (!globalPlayerEventBus) {
    globalPlayerEventBus = createPlayerEventBus();
  }
  return globalPlayerEventBus;
}

export function resetGlobalPlayerEventBus(): void {
  if (globalPlayerEventBus) {
    globalPlayerEventBus.removeAllListeners();
    globalPlayerEventBus = null;
  }
}
