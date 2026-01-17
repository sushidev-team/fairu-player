import type { TrackingConfig, TrackingEvent, TrackingEventType, TrackingEventData } from '@/types/tracking';

export class TrackingService {
  private config: TrackingConfig;
  private sessionId: string;
  private eventQueue: TrackingEvent[] = [];
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private progressMilestones: Set<number> = new Set();

  constructor(config: TrackingConfig) {
    this.config = config;
    this.sessionId = this.generateSessionId();

    if (config.batchEvents && config.batchInterval) {
      this.startBatchTimer();
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
   * Track an event
   */
  track(type: TrackingEventType, data: Omit<TrackingEventData, 'sessionId'>) {
    if (!this.config.enabled) return;

    // Check if event type is enabled
    const eventKey = type.replace(/_([a-z])/g, (_, l) => l.toUpperCase()) as keyof NonNullable<TrackingConfig['events']>;
    if (this.config.events && !this.config.events[eventKey]) return;

    const event: TrackingEvent = {
      type,
      timestamp: Date.now(),
      data: {
        ...data,
        sessionId: this.sessionId,
      },
    };

    // Transform event if transformer provided
    if (this.config.transformEvent) {
      const transformed = this.config.transformEvent(event);
      if (!transformed) return;
      Object.assign(event, transformed);
    }

    // Call onTrack callback
    this.config.onTrack?.(event);

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
   * Send events to endpoint
   */
  private async send(events: TrackingEvent[]): Promise<void> {
    if (!this.config.endpoint || events.length === 0) return;

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
      });
    } catch (error) {
      console.error('Failed to send tracking events:', error);
    }
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
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    this.flush();
  }
}
