import React, { createContext, useContext, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import type { TrackingConfig, TrackingContextValue, TrackingEvent } from '@/types/tracking';
import { TrackingService } from '@/services/TrackingService';

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

  const [enabled, setEnabledState] = useState(config.enabled);
  const serviceRef = useRef<TrackingService | null>(null);

  // Initialize / recreate the tracking service when config changes
  useEffect(() => {
    const service = new TrackingService({ ...config, enabled });
    serviceRef.current = service;

    return () => {
      service.destroy();
      serviceRef.current = null;
    };
  }, [config, enabled]);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    serviceRef.current?.setEnabled(value);
  }, []);

  const setSessionId = useCallback((sessionId: string) => {
    serviceRef.current?.setSessionId(sessionId);
  }, []);

  // Track an event by delegating to the service
  const track = useCallback((event: TrackingEvent) => {
    serviceRef.current?.track(event.type, event.data);
  }, []);

  // Flush event queue
  const flush = useCallback(async () => {
    await serviceRef.current?.flush();
  }, []);

  const contextValue = useMemo<TrackingContextValue>(() => ({
    config: { ...config, enabled },
    track,
    setEnabled,
    setSessionId,
    flush,
  }), [config, enabled, track, setEnabled, setSessionId, flush]);

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
