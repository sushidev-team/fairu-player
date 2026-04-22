import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TrackingService } from './TrackingService';
import { createMockTrackingConfig } from '@/test/helpers';
import type { TrackingEvent, TrackingEventData } from '@/types/tracking';

function defaultEventData(
  overrides: Partial<Omit<TrackingEventData, 'sessionId'>> = {},
): Omit<TrackingEventData, 'sessionId'> {
  return {
    currentTime: 10,
    duration: 100,
    ...overrides,
  };
}

describe('TrackingService', () => {
  let service: TrackingService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
  });

  afterEach(() => {
    vi.useRealTimers();
    fetchSpy.mockRestore();
  });

  // ─── Construction ───────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates an instance with the provided config', () => {
      service = new TrackingService(createMockTrackingConfig());
      expect(service).toBeInstanceOf(TrackingService);
    });

    it('creates an instance with minimal config', () => {
      service = new TrackingService({ enabled: false });
      expect(service).toBeInstanceOf(TrackingService);
    });

    it('starts a batch timer when batchEvents and batchInterval are set', () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      service = new TrackingService(
        createMockTrackingConfig({ batchEvents: true, batchInterval: 5000 }),
      );

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
      setIntervalSpy.mockRestore();

      // Clean up to avoid leaking timer
      service.destroy();
    });

    it('does not start a batch timer when batchEvents is false', () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      service = new TrackingService(createMockTrackingConfig({ batchEvents: false }));

      expect(setIntervalSpy).not.toHaveBeenCalled();
      setIntervalSpy.mockRestore();
    });
  });

  // ─── track ─────────────────────────────────────────────────────────

  describe('track', () => {
    it('sends an event immediately when batch mode is off', () => {
      service = new TrackingService(createMockTrackingConfig());
      service.track('play', defaultEventData());

      // session_start + play = 2 fetch calls
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const body = JSON.parse(fetchSpy.mock.calls[1][1]!.body as string);
      expect(body.events).toHaveLength(1);
      expect(body.events[0].type).toBe('play');
    });

    it('includes timestamp in the event', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));
      service = new TrackingService(createMockTrackingConfig());
      service.track('play', defaultEventData());

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.events[0].timestamp).toBe(Date.now());
    });

    it('includes sessionId in event data', () => {
      service = new TrackingService(createMockTrackingConfig());
      service.track('play', defaultEventData());

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.events[0].data.sessionId).toBeDefined();
      expect(typeof body.events[0].data.sessionId).toBe('string');
    });

    it('includes sessionId at the top level of the request body', () => {
      service = new TrackingService(createMockTrackingConfig());
      service.track('play', defaultEventData());

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.sessionId).toBeDefined();
    });

    it('includes event data fields in the tracked event', () => {
      service = new TrackingService(createMockTrackingConfig());
      service.track('play', defaultEventData({ currentTime: 42, duration: 200 }));

      const body = JSON.parse(fetchSpy.mock.calls[1][1]!.body as string);
      expect(body.events[0].data.currentTime).toBe(42);
      expect(body.events[0].data.duration).toBe(200);
    });

    it('sends POST request with correct headers', () => {
      service = new TrackingService(createMockTrackingConfig());
      service.track('play', defaultEventData());

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://example.com/track',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('includes custom headers from config', () => {
      service = new TrackingService(
        createMockTrackingConfig({ headers: { Authorization: 'Bearer test-token' } }),
      );
      service.track('play', defaultEventData());

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('does not send events when tracking is disabled', () => {
      service = new TrackingService(createMockTrackingConfig({ enabled: false }));
      service.track('play', defaultEventData());

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('does not send events when no endpoint is configured', () => {
      service = new TrackingService(createMockTrackingConfig({ endpoint: undefined }));
      service.track('play', defaultEventData());

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('logs an error when fetch fails', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      service = new TrackingService(createMockTrackingConfig());

      service.track('play', defaultEventData());
      await vi.runAllTimersAsync();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send tracking events after retries:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  // ─── Event Type Filtering ──────────────────────────────────────────

  describe('event type filtering', () => {
    it('filters out disabled event types', () => {
      service = new TrackingService(
        createMockTrackingConfig({
          events: { play: true, pause: false, seek: true, complete: true, progress: true },
        }),
      );

      // session_start was sent at construction = 1 fetch call
      const callsAfterConstruct = fetchSpy.mock.calls.length;

      service.track('pause', defaultEventData());
      expect(fetchSpy).toHaveBeenCalledTimes(callsAfterConstruct); // no new call

      service.track('play', defaultEventData());
      expect(fetchSpy).toHaveBeenCalledTimes(callsAfterConstruct + 1);
    });

    it('sends events when events config is not provided (no filtering)', () => {
      service = new TrackingService(
        createMockTrackingConfig({ events: undefined }),
      );

      // session_start + play = 2
      service.track('play', defaultEventData());
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('converts snake_case event types to camelCase for config lookup', () => {
      // chapter_change -> chapterChange
      service = new TrackingService(
        createMockTrackingConfig({
          events: { chapterChange: false, play: true, pause: true, seek: true, complete: true, progress: true },
        }),
      );

      const callsAfterConstruct = fetchSpy.mock.calls.length;

      service.track('chapter_change', defaultEventData());
      // chapter_change is disabled, so no new fetch call
      expect(fetchSpy).toHaveBeenCalledTimes(callsAfterConstruct);
    });

    it('allows track_change events when trackChange is enabled', () => {
      service = new TrackingService(
        createMockTrackingConfig({
          events: { trackChange: true, play: true, pause: true, seek: true, complete: true, progress: true },
        }),
      );

      // session_start + track_change = 2
      service.track('track_change', defaultEventData());
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('blocks ad_start when adStart is disabled', () => {
      service = new TrackingService(
        createMockTrackingConfig({
          events: { adStart: false, play: true, pause: true, seek: true, complete: true, progress: true },
        }),
      );

      const callsAfterConstruct = fetchSpy.mock.calls.length;

      service.track('ad_start', defaultEventData());
      // ad_start is disabled, so no new fetch call
      expect(fetchSpy).toHaveBeenCalledTimes(callsAfterConstruct);
    });
  });

  // ─── Disabled State ────────────────────────────────────────────────

  describe('disabled state', () => {
    it('does not track when initially disabled', () => {
      service = new TrackingService(createMockTrackingConfig({ enabled: false }));
      service.track('play', defaultEventData());

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('stops tracking after setEnabled(false)', () => {
      service = new TrackingService(createMockTrackingConfig());
      // session_start was already sent at construction
      const callsAfterConstruct = fetchSpy.mock.calls.length;

      service.setEnabled(false);
      service.track('play', defaultEventData());

      // No new fetch calls after disabling
      expect(fetchSpy).toHaveBeenCalledTimes(callsAfterConstruct);
    });

    it('resumes tracking after setEnabled(true)', () => {
      service = new TrackingService(createMockTrackingConfig({ enabled: false }));
      service.setEnabled(true);
      service.track('play', defaultEventData());

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Batch Mode ────────────────────────────────────────────────────

  describe('batch mode', () => {
    it('queues events instead of sending immediately', () => {
      service = new TrackingService(
        createMockTrackingConfig({ batchEvents: true, batchInterval: 5000, batchSize: 10 }),
      );

      service.track('play', defaultEventData());
      service.track('pause', defaultEventData());

      expect(fetchSpy).not.toHaveBeenCalled();

      service.destroy();
    });

    it('flushes the queue when batchSize is reached', () => {
      // batchSize=4 to account for session_start being queued at construction
      service = new TrackingService(
        createMockTrackingConfig({ batchEvents: true, batchInterval: 60000, batchSize: 4 }),
      );

      // Queue: [session_start, play, pause] = 3, not yet at batchSize 4
      service.track('play', defaultEventData());
      service.track('pause', defaultEventData());
      expect(fetchSpy).not.toHaveBeenCalled();

      // Queue: [session_start, play, pause, seek] = 4, reaches batchSize -> flush
      service.track('seek', defaultEventData());
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.events).toHaveLength(4);

      service.destroy();
    });

    it('defaults batchSize to 10 when not specified', () => {
      service = new TrackingService(
        createMockTrackingConfig({ batchEvents: true, batchInterval: 60000 }),
      );

      // session_start is already queued (1 event), so 8 more to reach 9
      for (let i = 0; i < 8; i++) {
        service.track('play', defaultEventData());
      }
      expect(fetchSpy).not.toHaveBeenCalled();

      // 10th event triggers flush
      service.track('play', defaultEventData());
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      service.destroy();
    });

    it('flushes on batch timer interval', () => {
      service = new TrackingService(
        createMockTrackingConfig({ batchEvents: true, batchInterval: 5000, batchSize: 100 }),
      );

      service.track('play', defaultEventData());
      service.track('pause', defaultEventData());

      vi.advanceTimersByTime(5000);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      // session_start + play + pause = 3 events
      expect(body.events).toHaveLength(3);

      service.destroy();
    });

    it('does not send when queue is empty on timer flush', () => {
      service = new TrackingService(
        createMockTrackingConfig({ batchEvents: true, batchInterval: 5000 }),
      );

      // First timer flush sends the queued session_start
      vi.advanceTimersByTime(5000);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second timer flush: queue is now truly empty
      vi.advanceTimersByTime(5000);
      expect(fetchSpy).toHaveBeenCalledTimes(1); // no additional call

      service.destroy();
    });
  });

  // ─── flush ─────────────────────────────────────────────────────────

  describe('flush', () => {
    it('sends all queued events to the endpoint', async () => {
      service = new TrackingService(
        createMockTrackingConfig({ batchEvents: true, batchInterval: 60000, batchSize: 100 }),
      );

      service.track('play', defaultEventData());
      service.track('pause', defaultEventData());

      await service.flush();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      // session_start + play + pause = 3 events
      expect(body.events).toHaveLength(3);
      expect(body.events[0].type).toBe('session_start');
      expect(body.events[1].type).toBe('play');
      expect(body.events[2].type).toBe('pause');

      service.destroy();
    });

    it('clears the queue after flushing', async () => {
      service = new TrackingService(
        createMockTrackingConfig({ batchEvents: true, batchInterval: 60000, batchSize: 100 }),
      );

      service.track('play', defaultEventData());
      await service.flush();

      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second flush should not send anything
      await service.flush();
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      service.destroy();
    });

    it('does nothing when queue is empty', async () => {
      service = new TrackingService(
        createMockTrackingConfig({ batchEvents: true, batchInterval: 60000 }),
      );

      // First flush sends the queued session_start
      await service.flush();
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second flush: queue is now truly empty
      await service.flush();
      expect(fetchSpy).toHaveBeenCalledTimes(1); // no additional call

      service.destroy();
    });
  });

  // ─── trackProgress ────────────────────────────────────────────────

  describe('trackProgress', () => {
    it('fires milestone at 25%', () => {
      service = new TrackingService(createMockTrackingConfig());

      service.trackProgress(25, 100);

      // session_start + progress = 2
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const body = JSON.parse(fetchSpy.mock.calls[1][1]!.body as string);
      expect(body.events[0].type).toBe('progress');
      expect(body.events[0].data.percentage).toBe(25);
    });

    it('fires milestone at 50%', () => {
      service = new TrackingService(createMockTrackingConfig());

      service.trackProgress(50, 100);

      const calls = fetchSpy.mock.calls;
      // session_start + 25% + 50% milestones = 3
      expect(calls.length).toBe(3);
    });

    it('fires milestone at 75%', () => {
      service = new TrackingService(createMockTrackingConfig());

      service.trackProgress(75, 100);

      // session_start + 25% + 50% + 75% = 4
      expect(fetchSpy).toHaveBeenCalledTimes(4);
    });

    it('fires each milestone only once', () => {
      service = new TrackingService(createMockTrackingConfig());

      // session_start + 25% progress = 2
      service.trackProgress(25, 100);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      service.trackProgress(26, 100);
      expect(fetchSpy).toHaveBeenCalledTimes(2); // No new call

      service.trackProgress(30, 100);
      expect(fetchSpy).toHaveBeenCalledTimes(2); // Still no new call
    });

    it('fires next milestone when progress advances', () => {
      service = new TrackingService(createMockTrackingConfig());

      // session_start + 25% = 2
      service.trackProgress(25, 100);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // + 50% = 3
      service.trackProgress(50, 100);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('does not fire when percentage is below the first interval', () => {
      service = new TrackingService(createMockTrackingConfig());

      // session_start was sent at construction
      const callsAfterConstruct = fetchSpy.mock.calls.length;

      service.trackProgress(10, 100);
      // No progress milestone fired
      expect(fetchSpy).toHaveBeenCalledTimes(callsAfterConstruct);
    });

    it('uses custom progressIntervals from config', () => {
      service = new TrackingService(
        createMockTrackingConfig({ progressIntervals: [10, 50, 90] }),
      );

      // session_start + 10% = 2
      service.trackProgress(10, 100);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      service.trackProgress(25, 100);
      expect(fetchSpy).toHaveBeenCalledTimes(2); // 25 is not a milestone

      // + 50% = 3
      service.trackProgress(50, 100);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('does not track progress when disabled', () => {
      service = new TrackingService(createMockTrackingConfig({ enabled: false }));

      service.trackProgress(50, 100);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('does not track progress when duration is 0', () => {
      service = new TrackingService(createMockTrackingConfig());

      // session_start was sent at construction
      const callsAfterConstruct = fetchSpy.mock.calls.length;

      service.trackProgress(10, 0);
      // No progress event tracked
      expect(fetchSpy).toHaveBeenCalledTimes(callsAfterConstruct);
    });

    it('includes currentTime and duration in progress event data', () => {
      service = new TrackingService(createMockTrackingConfig());

      service.trackProgress(75, 300);

      // Index 1 is the first progress event (index 0 is session_start)
      const body = JSON.parse(fetchSpy.mock.calls[1][1]!.body as string);
      expect(body.events[0].data.currentTime).toBe(75);
      expect(body.events[0].data.duration).toBe(300);
    });

    it('resets milestones so they can fire again', () => {
      service = new TrackingService(createMockTrackingConfig());

      // session_start + 25% = 2
      service.trackProgress(25, 100);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      service.resetProgress();

      // + 25% again = 3
      service.trackProgress(25, 100);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
  });

  // ─── setSessionId ──────────────────────────────────────────────────

  describe('setSessionId', () => {
    it('updates the session ID used in subsequent events', () => {
      service = new TrackingService(createMockTrackingConfig());
      service.setSessionId('custom-session-123');

      service.track('play', defaultEventData());

      // Index 1 is the play event (index 0 is session_start with the old ID)
      const body = JSON.parse(fetchSpy.mock.calls[1][1]!.body as string);
      expect(body.events[0].data.sessionId).toBe('custom-session-123');
      expect(body.sessionId).toBe('custom-session-123');
    });

    it('uses auto-generated session ID before setSessionId is called', () => {
      service = new TrackingService(createMockTrackingConfig());
      service.track('play', defaultEventData());

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.sessionId).toBeDefined();
      expect(body.sessionId).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });

  // ─── transformEvent ────────────────────────────────────────────────

  describe('transformEvent', () => {
    it('applies transformEvent callback to events before sending', () => {
      const transformEvent = vi.fn((event: TrackingEvent) => ({
        ...event,
        data: { ...event.data, metadata: { custom: true } },
      }));

      service = new TrackingService(createMockTrackingConfig({ transformEvent }));
      service.track('play', defaultEventData());

      // Called for session_start + play = 2
      expect(transformEvent).toHaveBeenCalledTimes(2);
      const body = JSON.parse(fetchSpy.mock.calls[1][1]!.body as string);
      expect(body.events[0].data.metadata).toEqual({ custom: true });
    });

    it('drops the event when transformEvent returns null', () => {
      const transformEvent = vi.fn(() => null);

      service = new TrackingService(createMockTrackingConfig({ transformEvent }));
      service.track('play', defaultEventData());

      // Called for session_start + play = 2 (both dropped)
      expect(transformEvent).toHaveBeenCalledTimes(2);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('receives the fully constructed event with type and timestamp', () => {
      const transformEvent = vi.fn((event: TrackingEvent) => event);

      service = new TrackingService(createMockTrackingConfig({ transformEvent }));
      service.track('play', defaultEventData());

      // calls[0] is session_start, calls[1] is play
      const receivedEvent = transformEvent.mock.calls[1][0];
      expect(receivedEvent.type).toBe('play');
      expect(receivedEvent.timestamp).toBeDefined();
      expect(receivedEvent.data.sessionId).toBeDefined();
    });
  });

  // ─── onTrack callback ─────────────────────────────────────────────

  describe('onTrack callback', () => {
    it('calls onTrack for each tracked event', () => {
      const onTrack = vi.fn();
      service = new TrackingService(createMockTrackingConfig({ onTrack }));

      service.track('play', defaultEventData());

      // session_start + play = 2
      expect(onTrack).toHaveBeenCalledTimes(2);
      expect(onTrack).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'play' }),
      );
    });

    it('does not call onTrack when tracking is disabled', () => {
      const onTrack = vi.fn();
      service = new TrackingService(createMockTrackingConfig({ enabled: false, onTrack }));

      service.track('play', defaultEventData());
      expect(onTrack).not.toHaveBeenCalled();
    });

    it('does not call onTrack when event type is filtered out', () => {
      const onTrack = vi.fn();
      service = new TrackingService(
        createMockTrackingConfig({
          onTrack,
          events: { play: false, pause: true, seek: true, complete: true, progress: true },
        }),
      );

      // session_start triggers onTrack once at construction
      const callsAfterConstruct = onTrack.mock.calls.length;

      service.track('play', defaultEventData());
      // play is filtered out, so no additional call
      expect(onTrack).toHaveBeenCalledTimes(callsAfterConstruct);
    });

    it('calls onTrack even when transformEvent modifies the event', () => {
      const onTrack = vi.fn();
      const transformEvent = (event: TrackingEvent) => ({
        ...event,
        data: { ...event.data, metadata: { transformed: true } },
      });

      service = new TrackingService(createMockTrackingConfig({ onTrack, transformEvent }));
      service.track('play', defaultEventData());

      // session_start + play = 2
      expect(onTrack).toHaveBeenCalledTimes(2);
    });

    it('does not call onTrack when transformEvent returns null', () => {
      const onTrack = vi.fn();
      const transformEvent = () => null;

      service = new TrackingService(createMockTrackingConfig({ onTrack, transformEvent }));
      service.track('play', defaultEventData());

      expect(onTrack).not.toHaveBeenCalled();
    });
  });

  // ─── destroy ───────────────────────────────────────────────────────

  describe('destroy', () => {
    it('clears the batch timer', () => {
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
      service = new TrackingService(
        createMockTrackingConfig({ batchEvents: true, batchInterval: 5000 }),
      );

      service.destroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('flushes remaining events on destroy', () => {
      service = new TrackingService(
        createMockTrackingConfig({ batchEvents: true, batchInterval: 60000, batchSize: 100 }),
      );

      service.track('play', defaultEventData());
      service.track('pause', defaultEventData());

      service.destroy();

      // destroy sends session_end via sendBeacon or flush
      // Queue contains: session_start + play + pause + session_end = 4
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.events).toHaveLength(4);
    });

    it('does not error when destroying a service without batch timer', () => {
      service = new TrackingService(createMockTrackingConfig({ batchEvents: false }));
      expect(() => service.destroy()).not.toThrow();
    });

    it('sends session events on destroy even without explicit tracking', () => {
      service = new TrackingService(
        createMockTrackingConfig({ batchEvents: true, batchInterval: 5000 }),
      );

      // destroy flushes session_start (queued at construction) + session_end
      service.destroy();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.events).toHaveLength(2);
      expect(body.events[0].type).toBe('session_start');
      expect(body.events[1].type).toBe('session_end');
    });
  });
});
