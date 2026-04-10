import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TrackingProvider, useTracking } from './TrackingContext';
import { createMockTrackingConfig } from '@/test/helpers';
import type { TrackingConfig, TrackingEvent } from '@/types/tracking';

// Mock fetch
const mockFetch = vi.fn(() => Promise.resolve(new Response()));

beforeEach(() => {
  vi.useFakeTimers();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const createWrapper = (config: Partial<TrackingConfig> = {}) => {
  return ({ children }: { children: React.ReactNode }) => (
    <TrackingProvider config={config}>{children}</TrackingProvider>
  );
};

const createEvent = (overrides: Partial<TrackingEvent> = {}): TrackingEvent => ({
  type: 'play',
  timestamp: Date.now(),
  data: {
    currentTime: 10,
    duration: 300,
  },
  ...overrides,
});

describe('TrackingContext', () => {
  describe('useTracking hook', () => {
    it('throws error when used outside provider', () => {
      expect(() => {
        renderHook(() => useTracking());
      }).toThrow('useTracking must be used within a TrackingProvider');
    });

    it('returns context when used inside provider', () => {
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(result.current.config).toBeDefined();
      expect(result.current.track).toBeDefined();
      expect(result.current.setEnabled).toBeDefined();
      expect(result.current.setSessionId).toBeDefined();
      expect(result.current.flush).toBeDefined();
    });
  });

  describe('Default state', () => {
    it('defaults to disabled', () => {
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.enabled).toBe(false);
    });

    it('has default event types enabled', () => {
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.events?.play).toBe(true);
      expect(result.current.config.events?.pause).toBe(true);
      expect(result.current.config.events?.seek).toBe(true);
      expect(result.current.config.events?.complete).toBe(true);
      expect(result.current.config.events?.progress).toBe(true);
      expect(result.current.config.events?.error).toBe(true);
    });

    it('has default progress intervals', () => {
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.progressIntervals).toEqual([25, 50, 75, 100]);
    });

    it('defaults batchEvents to false', () => {
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.batchEvents).toBe(false);
    });
  });

  describe('setEnabled', () => {
    it('enables tracking', () => {
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config.enabled).toBe(false);

      act(() => {
        result.current.setEnabled(true);
      });

      expect(result.current.config.enabled).toBe(true);
    });

    it('disables tracking', () => {
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({ enabled: true }),
      });

      expect(result.current.config.enabled).toBe(true);

      act(() => {
        result.current.setEnabled(false);
      });

      expect(result.current.config.enabled).toBe(false);
    });

    it('does not track events when disabled', () => {
      const onTrack = vi.fn();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({ enabled: false, onTrack }),
      });

      act(() => {
        result.current.track(createEvent());
      });

      expect(onTrack).not.toHaveBeenCalled();
    });

    it('tracks events after being enabled', () => {
      const onTrack = vi.fn();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({ onTrack }),
      });

      act(() => {
        result.current.setEnabled(true);
      });

      // Enabling creates a new TrackingService which sends session_start via onTrack
      const callsAfterEnable = onTrack.mock.calls.length;

      act(() => {
        result.current.track(createEvent());
      });

      expect(onTrack).toHaveBeenCalledTimes(callsAfterEnable + 1);
    });
  });

  describe('track()', () => {
    it('calls onTrack callback when enabled', () => {
      const onTrack = vi.fn();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({ enabled: true, onTrack }),
      });

      const event = createEvent();
      act(() => {
        result.current.track(event);
      });

      // onTrack is called for session_start and then for the play event
      expect(onTrack).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'play' }),
      );
    });

    it('sends event to endpoint immediately when batchEvents is false', () => {
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          endpoint: 'https://example.com/track',
        }),
      });

      const event = createEvent();
      act(() => {
        result.current.track(event);
      });

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/track', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }));
    });

    it('does not send when disabled', () => {
      mockFetch.mockClear();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: false,
          endpoint: 'https://example.com/track',
        }),
      });

      act(() => {
        result.current.track(createEvent());
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not send when no endpoint configured', () => {
      mockFetch.mockClear();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({ enabled: true }),
      });

      act(() => {
        result.current.track(createEvent());
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends custom headers with request', () => {
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          endpoint: 'https://example.com/track',
          headers: { 'X-API-Key': 'test-key' },
        }),
      });

      act(() => {
        result.current.track(createEvent());
      });

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/track', expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-API-Key': 'test-key',
        }),
      }));
    });
  });

  describe('Event type filtering', () => {
    it('filters out disabled event types', () => {
      const onTrack = vi.fn();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          onTrack,
          events: { play: false },
        }),
      });

      // session_start fires onTrack at construction
      const callsAfterConstruct = onTrack.mock.calls.length;

      act(() => {
        result.current.track(createEvent({ type: 'play' }));
      });

      // play is filtered out, so no additional call
      expect(onTrack).toHaveBeenCalledTimes(callsAfterConstruct);
    });

    it('allows enabled event types', () => {
      const onTrack = vi.fn();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          onTrack,
          events: { play: true },
        }),
      });

      const callsAfterConstruct = onTrack.mock.calls.length;

      act(() => {
        result.current.track(createEvent({ type: 'play' }));
      });

      expect(onTrack).toHaveBeenCalledTimes(callsAfterConstruct + 1);
    });

    it('filters pause events when pause is disabled', () => {
      const onTrack = vi.fn();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          onTrack,
          events: { pause: false, play: true },
        }),
      });

      // session_start fires onTrack at construction
      const callsAfterConstruct = onTrack.mock.calls.length;

      act(() => {
        result.current.track(createEvent({ type: 'pause' }));
      });

      // pause is filtered, no additional call
      expect(onTrack).toHaveBeenCalledTimes(callsAfterConstruct);

      act(() => {
        result.current.track(createEvent({ type: 'play' }));
      });

      expect(onTrack).toHaveBeenCalledTimes(callsAfterConstruct + 1);
    });

    it('allows seek events when seek is enabled', () => {
      const onTrack = vi.fn();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          onTrack,
          events: { seek: true },
        }),
      });

      const callsAfterConstruct = onTrack.mock.calls.length;

      act(() => {
        result.current.track(createEvent({ type: 'seek' }));
      });

      expect(onTrack).toHaveBeenCalledTimes(callsAfterConstruct + 1);
    });

    it('filters error events when error is disabled', () => {
      const onTrack = vi.fn();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          onTrack,
          events: { error: false },
        }),
      });

      // session_start fires onTrack at construction
      const callsAfterConstruct = onTrack.mock.calls.length;

      act(() => {
        result.current.track(createEvent({ type: 'error' }));
      });

      // error is filtered, no additional call
      expect(onTrack).toHaveBeenCalledTimes(callsAfterConstruct);
    });
  });

  describe('transformEvent', () => {
    it('transforms event before tracking', () => {
      const onTrack = vi.fn();
      const transformEvent = vi.fn((event: TrackingEvent) => ({
        ...event,
        data: { ...event.data, metadata: { transformed: true } },
      }));

      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          onTrack,
          transformEvent,
        }),
      });

      const event = createEvent();
      act(() => {
        result.current.track(event);
      });

      // transformEvent is called for both session_start and play
      expect(transformEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'play' }),
      );
      expect(onTrack).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          metadata: { transformed: true },
        }),
      }));
    });

    it('filters out event when transformEvent returns null', () => {
      const onTrack = vi.fn();
      const transformEvent = vi.fn(() => null);

      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          onTrack,
          transformEvent,
        }),
      });

      act(() => {
        result.current.track(createEvent());
      });

      expect(transformEvent).toHaveBeenCalled();
      expect(onTrack).not.toHaveBeenCalled();
    });

    it('calls transformEvent with the original event', () => {
      const transformEvent = vi.fn((event: TrackingEvent) => event);
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          transformEvent,
        }),
      });

      const event = createEvent({ type: 'pause' });
      act(() => {
        result.current.track(event);
      });

      // transformEvent is called for session_start and then for the pause event
      expect(transformEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pause' }),
      );
    });
  });

  describe('Batch mode', () => {
    it('queues events when batchEvents is true', () => {
      mockFetch.mockClear();
      const onTrack = vi.fn();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          batchEvents: true,
          batchSize: 10,
          batchInterval: 60000, // long interval so it does not auto-flush
          endpoint: 'https://example.com/track',
          onTrack,
        }),
      });

      // session_start fires onTrack at construction
      const callsAfterConstruct = onTrack.mock.calls.length;

      act(() => {
        result.current.track(createEvent());
      });

      // onTrack is still called immediately per event
      expect(onTrack).toHaveBeenCalledTimes(callsAfterConstruct + 1);

      // But fetch is not called yet (batched)
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('flushes when batch size is reached', () => {
      mockFetch.mockClear();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          batchEvents: true,
          batchSize: 3,
          batchInterval: 60000,
          endpoint: 'https://example.com/track',
        }),
      });

      act(() => {
        result.current.track(createEvent({ type: 'play' }));
        result.current.track(createEvent({ type: 'pause' }));
        result.current.track(createEvent({ type: 'seek' }));
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('flushes at batch interval', async () => {
      mockFetch.mockClear();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          batchEvents: true,
          batchInterval: 5000,
          endpoint: 'https://example.com/track',
        }),
      });

      act(() => {
        result.current.track(createEvent());
      });

      expect(mockFetch).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('does not flush when queue is empty', async () => {
      mockFetch.mockClear();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          batchEvents: true,
          batchInterval: 60000,
          endpoint: 'https://example.com/track',
        }),
      });

      // First flush sends the queued session_start
      await act(async () => {
        await result.current.flush();
      });

      mockFetch.mockClear();

      // Second flush: queue is now truly empty
      await act(async () => {
        await result.current.flush();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('flush()', () => {
    it('sends all queued events', async () => {
      mockFetch.mockClear();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          batchEvents: true,
          batchSize: 100,
          batchInterval: 60000,
          endpoint: 'https://example.com/track',
        }),
      });

      act(() => {
        result.current.track(createEvent({ type: 'play' }));
        result.current.track(createEvent({ type: 'pause' }));
      });

      expect(mockFetch).not.toHaveBeenCalled();

      await act(async () => {
        await result.current.flush();
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      // session_start + play + pause = 3
      expect(body.events).toHaveLength(3);
    });

    it('clears the queue after flush', async () => {
      mockFetch.mockClear();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          batchEvents: true,
          batchSize: 100,
          batchInterval: 60000,
          endpoint: 'https://example.com/track',
        }),
      });

      act(() => {
        result.current.track(createEvent());
      });

      await act(async () => {
        await result.current.flush();
      });

      mockFetch.mockClear();

      await act(async () => {
        await result.current.flush();
      });

      // No more events to send
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('setSessionId', () => {
    it('sets session ID', () => {
      mockFetch.mockClear();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          endpoint: 'https://example.com/track',
        }),
      });

      act(() => {
        result.current.setSessionId('session-123');
      });

      act(() => {
        result.current.track(createEvent());
      });

      // session_start is at index 0 (with old ID), play event is at index 1
      const lastCallIndex = mockFetch.mock.calls.length - 1;
      const body = JSON.parse(mockFetch.mock.calls[lastCallIndex][1]?.body as string);
      expect(body.sessionId).toBe('session-123');
    });

    it('includes updated session ID in subsequent requests', () => {
      mockFetch.mockClear();
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          endpoint: 'https://example.com/track',
        }),
      });

      act(() => {
        result.current.setSessionId('session-abc');
      });

      // Clear after session_start to track only explicit events
      mockFetch.mockClear();

      act(() => {
        result.current.track(createEvent());
      });

      const firstCallBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(firstCallBody.sessionId).toBe('session-abc');

      act(() => {
        result.current.setSessionId('session-xyz');
      });

      act(() => {
        result.current.track(createEvent());
      });

      const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1]?.body as string);
      expect(secondCallBody.sessionId).toBe('session-xyz');
    });
  });

  describe('Config merging', () => {
    it('merges user config with defaults', () => {
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          enabled: true,
          endpoint: 'https://custom.com/events',
        }),
      });

      expect(result.current.config.enabled).toBe(true);
      expect(result.current.config.endpoint).toBe('https://custom.com/events');
      // Defaults preserved
      expect(result.current.config.events?.play).toBe(true);
      expect(result.current.config.batchEvents).toBe(false);
    });

    it('overrides specific event types while keeping defaults', () => {
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          events: { play: false, seek: false },
        }),
      });

      expect(result.current.config.events?.play).toBe(false);
      expect(result.current.config.events?.seek).toBe(false);
      expect(result.current.config.events?.pause).toBe(true);
      expect(result.current.config.events?.complete).toBe(true);
    });

    it('accepts custom progress intervals', () => {
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper({
          progressIntervals: [10, 20, 30, 40, 50],
        }),
      });

      expect(result.current.config.progressIntervals).toEqual([10, 20, 30, 40, 50]);
    });

    it('uses createMockTrackingConfig helper correctly', () => {
      const config = createMockTrackingConfig({ enabled: true });
      const { result } = renderHook(() => useTracking(), {
        wrapper: createWrapper(config),
      });

      expect(result.current.config.enabled).toBe(true);
      expect(result.current.config.endpoint).toBe('https://example.com/track');
    });
  });
});
