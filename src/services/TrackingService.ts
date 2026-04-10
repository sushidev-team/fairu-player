import type { TrackingConfig, TrackingEvent, TrackingEventType, TrackingEventData } from '@/types/tracking';

const OFFLINE_QUEUE_KEY = 'fairu_tracking_queue';
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_REQUEST_TIMEOUT = 5000;
const DEFAULT_HEARTBEAT_INTERVAL = 30000;
const DEFAULT_OFFLINE_QUEUE_MAX_SIZE = 100;

export class TrackingService {
  private config: TrackingConfig;
  private sessionId: string;
  private eventQueue: TrackingEvent[] = [];
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private progressMilestones: Set<number> = new Set();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastKnownPosition: number = 0;
  private lastKnownDuration: number = 0;
  private isOnline: boolean = true;

  private readonly boundBeforeUnload: () => void;
  private readonly boundPageHide: (e: PageTransitionEvent) => void;
  private readonly boundOnline: () => void;
  private readonly boundOffline: () => void;

  constructor(config: TrackingConfig) {
    this.config = config;
    this.sessionId = this.generateSessionId();

    // Bind event handlers
    this.boundBeforeUnload = this.handleUnload.bind(this);
    this.boundPageHide = this.handlePageHide.bind(this);
    this.boundOnline = this.handleOnline.bind(this);
    this.boundOffline = this.handleOffline.bind(this);

    // Set up batch timer
    if (config.batchEvents && config.batchInterval) {
      this.startBatchTimer();
    }

    // Set up page unload listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.boundBeforeUnload);
      window.addEventListener('pagehide', this.boundPageHide);
    }

    // Set up online/offline detection
    if (config.offlineQueue && typeof navigator !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', this.boundOnline);
      window.addEventListener('offline', this.boundOffline);
    }

    // Emit session_start
    this.track('session_start', {
      currentTime: 0,
      duration: 0,
    });

    // Flush any events stored offline from a previous session
    if (config.offlineQueue && this.isOnline) {
      this.flushOfflineQueue();
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private startBatchTimer() {
    this.batchTimer = setInterval(() => {
      this.flush();
    }, this.config.batchInterval);
  }

  /**
   * Handle beforeunload: flush remaining events via sendBeacon
   */
  private handleUnload(): void {
    this.flushWithBeacon();
  }

  /**
   * Handle pagehide: flush remaining events via sendBeacon
   */
  private handlePageHide(e: PageTransitionEvent): void {
    if (e.persisted) return; // Page is being cached (bfcache), not truly unloading
    this.flushWithBeacon();
  }

  /**
   * Flush events using navigator.sendBeacon (for page unload scenarios)
   */
  private flushWithBeacon(): void {
    const events = [...this.eventQueue];
    this.eventQueue = [];

    if (events.length === 0 && !this.config.endpoint) return;

    // Add session_end event
    events.push({
      type: 'session_end',
      timestamp: Date.now(),
      data: {
        currentTime: this.lastKnownPosition,
        duration: this.lastKnownDuration,
        sessionId: this.sessionId,
      },
    });

    if (!this.config.endpoint) return;

    const payload = JSON.stringify({
      events,
      sessionId: this.sessionId,
    });

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(this.config.endpoint, blob);
    }
  }

  /**
   * Handle coming back online
   */
  private handleOnline(): void {
    this.isOnline = true;
    this.flushOfflineQueue();
  }

  /**
   * Handle going offline
   */
  private handleOffline(): void {
    this.isOnline = false;
  }

  /**
   * Store events in localStorage for offline persistence
   */
  private storeOffline(events: TrackingEvent[]): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const maxSize = this.config.offlineQueueMaxSize ?? DEFAULT_OFFLINE_QUEUE_MAX_SIZE;
      const existing = this.getOfflineQueue();
      const combined = [...existing, ...events];

      // Trim to max size, keeping the newest events
      const trimmed = combined.slice(-maxSize);

      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(trimmed));
    } catch {
      console.warn('Failed to store tracking events offline');
    }
  }

  /**
   * Retrieve events from localStorage
   */
  private getOfflineQueue(): TrackingEvent[] {
    if (typeof localStorage === 'undefined') return [];

    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!stored) return [];
      return JSON.parse(stored) as TrackingEvent[];
    } catch {
      return [];
    }
  }

  /**
   * Clear the offline queue
   */
  private clearOfflineQueue(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    } catch {
      // Silently ignore
    }
  }

  /**
   * Flush events stored in localStorage
   */
  private async flushOfflineQueue(): Promise<void> {
    const offlineEvents = this.getOfflineQueue();
    if (offlineEvents.length === 0) return;

    this.clearOfflineQueue();
    await this.send(offlineEvents);
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) return; // Already running

    const interval = this.config.heartbeat ?? DEFAULT_HEARTBEAT_INTERVAL;

    this.heartbeatTimer = setInterval(() => {
      this.track('heartbeat', {
        currentTime: this.lastKnownPosition,
        duration: this.lastKnownDuration,
      });
    }, interval);
  }

  /**
   * Stop heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Track an event
   */
  track(type: TrackingEventType, data: Omit<TrackingEventData, 'sessionId'>) {
    if (!this.config.enabled) return;

    // Check if event type is enabled
    const eventKey = type.replace(/_([a-z])/g, (_, l) => l.toUpperCase()) as keyof NonNullable<TrackingConfig['events']>;
    if (this.config.events && this.config.events[eventKey] === false) return;

    const event: TrackingEvent = {
      type,
      timestamp: Date.now(),
      data: {
        ...data,
        sessionId: this.sessionId,
      },
    };

    // Update last known position for heartbeat/unload events
    if (data.currentTime !== undefined) {
      this.lastKnownPosition = data.currentTime;
    }
    if (data.duration !== undefined) {
      this.lastKnownDuration = data.duration;
    }

    // Transform event if transformer provided
    if (this.config.transformEvent) {
      const transformed = this.config.transformEvent(event);
      if (!transformed) return;
      Object.assign(event, transformed);
    }

    // Call onTrack callback
    this.config.onTrack?.(event);

    // Manage heartbeat lifecycle based on play/pause events
    if (this.config.heartbeat) {
      if (type === 'play') {
        this.startHeartbeat();
      } else if (type === 'pause') {
        this.stopHeartbeat();
      }
    }

    if (this.config.batchEvents) {
      this.eventQueue.push(event);
      if (this.eventQueue.length >= (this.config.batchSize || 10)) {
        this.flush();
      }
    } else {
      this.send([event]);
    }
  }

  /**
   * Track progress milestone
   */
  trackProgress(currentTime: number, duration: number) {
    if (!this.config.enabled || !duration) return;

    const percentage = Math.floor((currentTime / duration) * 100);
    const intervals = this.config.progressIntervals || [25, 50, 75, 100];

    for (const interval of intervals) {
      if (percentage >= interval && !this.progressMilestones.has(interval)) {
        this.progressMilestones.add(interval);
        this.track('progress', {
          currentTime,
          duration,
          percentage: interval,
        });
      }
    }
  }

  /**
   * Reset progress milestones (e.g., when track changes)
   */
  resetProgress() {
    this.progressMilestones.clear();
  }

  /**
   * Flush pending events
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];
    await this.send(events);
  }

  /**
   * Send events to endpoint with retry logic, timeout, and offline support
   */
  private async send(events: TrackingEvent[]): Promise<void> {
    if (!this.config.endpoint || events.length === 0) return;

    // If offline and offline queue is enabled, store for later
    if (this.config.offlineQueue && !this.isOnline) {
      this.storeOffline(events);
      return;
    }

    const maxRetries = this.config.maxRetries ?? DEFAULT_MAX_RETRIES;
    const timeout = this.config.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          await fetch(this.config.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...this.config.headers,
            },
            body: JSON.stringify({
              events,
              sessionId: this.sessionId,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          return; // Success, exit retry loop
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      } catch (error) {
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          await this.sleep(delay);
        } else {
          // Final failure
          console.error('Failed to send tracking events after retries:', error);

          if (this.config.batchEvents) {
            // Store failed events back into the queue
            this.eventQueue.push(...events);
          } else if (this.config.offlineQueue) {
            // Store in offline queue as fallback
            this.storeOffline(events);
          } else {
            console.warn('Tracking events dropped after all retry attempts');
          }
        }
      }
    }
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Set tracking enabled state
   */
  setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
  }

  /**
   * Update session ID
   */
  setSessionId(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Destroy service
   */
  destroy() {
    // Stop heartbeat
    this.stopHeartbeat();

    // Clear batch timer
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Emit session_end event
    if (this.config.enabled) {
      const sessionEndEvent: TrackingEvent = {
        type: 'session_end',
        timestamp: Date.now(),
        data: {
          currentTime: this.lastKnownPosition,
          duration: this.lastKnownDuration,
          sessionId: this.sessionId,
        },
      };

      // Try to send via beacon if available, otherwise add to queue and flush
      if (this.config.endpoint && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const allEvents = [...this.eventQueue, sessionEndEvent];
        this.eventQueue = [];

        const payload = JSON.stringify({
          events: allEvents,
          sessionId: this.sessionId,
        });
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(this.config.endpoint, blob);
      } else {
        this.eventQueue.push(sessionEndEvent);
        this.flush();
      }
    } else {
      this.flush();
    }

    // Remove event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.boundBeforeUnload);
      window.removeEventListener('pagehide', this.boundPageHide);
    }

    if (this.config.offlineQueue && typeof window !== 'undefined') {
      window.removeEventListener('online', this.boundOnline);
      window.removeEventListener('offline', this.boundOffline);
    }
  }
}
