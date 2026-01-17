import React, { createContext, useContext, useCallback, useMemo, useRef, useState } from 'react';
import type { TrackingConfig, TrackingContextValue, TrackingEvent } from '@/types/tracking';

const DEFAULT_CONFIG: TrackingConfig = {
  enabled: false, // GDPR: default OFF
  events: {
    play: true,
    pause: true,
    seek: true,
    complete: true,
    progress: true,
    chapterChange: true,
    trackChange: true,
    adStart: true,
    adComplete: true,
    adSkip: true,
    error: true,
  },
  progressIntervals: [25, 50, 75, 100],
  batchEvents: false,
  batchSize: 10,
  batchInterval: 5000,
};

export const TrackingContext = createContext<TrackingContextValue | null>(null);

export interface TrackingProviderProps {
  children: React.ReactNode;
  config?: Partial<TrackingConfig>;
}

export function TrackingProvider({ children, config: userConfig = {} }: TrackingProviderProps) {
  const config = useMemo<TrackingConfig>(() => ({
    ...DEFAULT_CONFIG,
    ...userConfig,
    events: {
      ...DEFAULT_CONFIG.events,
      ...userConfig.events,
    },
  }), [userConfig]);

  const [enabled, setEnabled] = useState(config.enabled);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const eventQueue = useRef<TrackingEvent[]>([]);
  const batchTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Send events to endpoint
  const sendEvents = useCallback(async (events: TrackingEvent[]) => {
    if (!config.endpoint || events.length === 0) return;

    try {
      await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify({ events, sessionId }),
      });
    } catch (error) {
      console.error('Failed to send tracking events:', error);
    }
  }, [config.endpoint, config.headers, sessionId]);

  // Flush event queue
  const flush = useCallback(async () => {
    if (eventQueue.current.length === 0) return;
    const events = [...eventQueue.current];
    eventQueue.current = [];
    await sendEvents(events);
  }, [sendEvents]);

  // Track an event
  const track = useCallback((event: TrackingEvent) => {
    if (!enabled) return;

    // Check if this event type is enabled
    const eventTypeKey = event.type.replace(/_([a-z])/g, (_, letter) =>
      letter.toUpperCase()
    ) as keyof typeof config.events;

    if (config.events && !config.events[eventTypeKey]) return;

    // Transform event if transformer provided
    let processedEvent = event;
    if (config.transformEvent) {
      const transformed = config.transformEvent(event);
      if (!transformed) return; // Event was filtered out
      processedEvent = transformed;
    }

    // Call onTrack callback if provided
    config.onTrack?.(processedEvent);

    // Handle batching
    if (config.batchEvents) {
      eventQueue.current.push(processedEvent);

      if (eventQueue.current.length >= (config.batchSize || 10)) {
        flush();
      }
    } else {
      // Send immediately
      sendEvents([processedEvent]);
    }
  }, [enabled, config, flush, sendEvents]);

  // Set up batch interval
  useMemo(() => {
    if (config.batchEvents && config.batchInterval) {
      batchTimer.current = setInterval(() => {
        flush();
      }, config.batchInterval);

      return () => {
        if (batchTimer.current) {
          clearInterval(batchTimer.current);
        }
      };
    }
  }, [config.batchEvents, config.batchInterval, flush]);

  const contextValue = useMemo<TrackingContextValue>(() => ({
    config: { ...config, enabled },
    track,
    setEnabled,
    setSessionId,
    flush,
  }), [config, enabled, track, flush]);

  return (
    <TrackingContext.Provider value={contextValue}>
      {children}
    </TrackingContext.Provider>
  );
}

export function useTracking(): TrackingContextValue {
  const context = useContext(TrackingContext);

  if (!context) {
    throw new Error('useTracking must be used within a TrackingProvider');
  }

  return context;
}
