/**
 * Tracking is the part of the player that talks to a server, so its rules are
 * not only about correctness — an event sent while consent is off is a
 * compliance problem, and a timer that outlives its provider keeps sending
 * after the page has moved on.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { TrackingProvider, useTracking } from './TrackingContext';
import type { TrackingConfig, TrackingEvent } from '@/types/tracking';

const EVENT: TrackingEvent = {
  type: 'play',
  timestamp: 1_000,
  data: { sessionId: 's-1', currentTime: 0, duration: 600 },
};

function wrapper(config?: Partial<TrackingConfig>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <TrackingProvider config={config}>{children}</TrackingProvider>;
  };
}

function setup(config?: Partial<TrackingConfig>) {
  return renderHook(() => useTracking(), { wrapper: wrapper(config) });
}

describe('TrackingContext', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('consent', () => {
    it('is off by default', () => {
      const { result } = setup();
      expect(result.current.config.enabled).toBe(false);
    });

    it('sends nothing while disabled', () => {
      const onTrack = vi.fn();
      const { result } = setup({ endpoint: '/t', onTrack });

      act(() => result.current.track(EVENT));

      expect(fetchMock).not.toHaveBeenCalled();
      expect(onTrack).not.toHaveBeenCalled();
    });

    it('starts sending once consent is given at runtime', () => {
      // The opt-in path: the player mounts before the banner is answered.
      const { result } = setup({ endpoint: '/t' });

      act(() => result.current.setEnabled(true));
      act(() => result.current.track(EVENT));

      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('stops again when consent is withdrawn', () => {
      const { result } = setup({ endpoint: '/t', enabled: true });

      act(() => result.current.setEnabled(false));
      act(() => result.current.track(EVENT));

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('event filtering', () => {
    it('drops an event type that is switched off', () => {
      const onTrack = vi.fn();
      const { result } = setup({ enabled: true, onTrack, events: { play: false } });

      act(() => result.current.track(EVENT));

      expect(onTrack).not.toHaveBeenCalled();
    });

    it('keeps event types that are left on', () => {
      const onTrack = vi.fn();
      const { result } = setup({ enabled: true, onTrack, events: { play: false } });

      act(() => result.current.track({ ...EVENT, type: 'pause' }));

      expect(onTrack).toHaveBeenCalledOnce();
    });

    it('maps a snake_case type onto its camelCase switch', () => {
      // `ad_start` is configured as `adStart`, so the conversion is what decides
      // whether an ad event is honoured at all.
      const onTrack = vi.fn();
      const { result } = setup({ enabled: true, onTrack, events: { adStart: false } });

      act(() => result.current.track({ ...EVENT, type: 'ad_start' }));

      expect(onTrack).not.toHaveBeenCalled();
    });
  });

  describe('transformEvent', () => {
    it('sends the transformed event rather than the original', () => {
      const onTrack = vi.fn();
      const { result } = setup({
        enabled: true,
        onTrack,
        transformEvent: (event) => ({ ...event, type: 'complete' }),
      });

      act(() => result.current.track(EVENT));

      expect(onTrack).toHaveBeenCalledWith(expect.objectContaining({ type: 'complete' }));
    });

    it('drops the event when the transformer returns nothing', () => {
      // The documented way to redact or suppress an event before it leaves.
      const onTrack = vi.fn();
      const { result } = setup({
        enabled: true,
        endpoint: '/t',
        onTrack,
        transformEvent: () => null,
      });

      act(() => result.current.track(EVENT));

      expect(onTrack).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('delivery', () => {
    it('posts to the endpoint', () => {
      const { result } = setup({ enabled: true, endpoint: 'https://example.test/t' });

      act(() => result.current.track(EVENT));

      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.test/t',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('merges configured headers over the content type', () => {
      const { result } = setup({
        enabled: true,
        endpoint: '/t',
        headers: { Authorization: 'Bearer x' },
      });

      act(() => result.current.track(EVENT));

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer x',
      });
    });

    it('includes the session id once one is set', () => {
      const { result } = setup({ enabled: true, endpoint: '/t' });

      act(() => result.current.setSessionId('sess-42'));
      act(() => result.current.track(EVENT));

      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(body.sessionId).toBe('sess-42');
    });

    it('does not call fetch without an endpoint', () => {
      const onTrack = vi.fn();
      const { result } = setup({ enabled: true, onTrack });

      act(() => result.current.track(EVENT));

      // The callback still fires — a host page can collect events itself.
      expect(onTrack).toHaveBeenCalledOnce();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('survives a rejected request', async () => {
      // The endpoint being down must never surface to a viewer or break
      // playback, so the failure is logged and swallowed.
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchMock.mockRejectedValue(new Error('network down'));
      const { result } = setup({ enabled: true, endpoint: '/t' });

      await act(async () => {
        result.current.track(EVENT);
      });

      expect(consoleError).toHaveBeenCalled();
    });
  });

  describe('batching', () => {
    it('holds events back instead of sending each one', () => {
      const { result } = setup({
        enabled: true,
        endpoint: '/t',
        batchEvents: true,
        batchSize: 3,
      });

      act(() => result.current.track(EVENT));
      act(() => result.current.track(EVENT));

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends once the batch is full', () => {
      const { result } = setup({
        enabled: true,
        endpoint: '/t',
        batchEvents: true,
        batchSize: 3,
      });

      act(() => result.current.track(EVENT));
      act(() => result.current.track(EVENT));
      act(() => result.current.track(EVENT));

      expect(fetchMock).toHaveBeenCalledOnce();
      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(body.events).toHaveLength(3);
    });

    it('flush sends what is queued and empties the queue', async () => {
      const { result } = setup({
        enabled: true,
        endpoint: '/t',
        batchEvents: true,
        batchSize: 10,
      });

      act(() => result.current.track(EVENT));
      await act(async () => result.current.flush());

      expect(fetchMock).toHaveBeenCalledOnce();

      // Nothing left, so a second flush is a no-op rather than a resend.
      await act(async () => result.current.flush());
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('flush on an empty queue does nothing', async () => {
      const { result } = setup({ enabled: true, endpoint: '/t', batchEvents: true });

      await act(async () => result.current.flush());

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('the batch timer', () => {
    it('flushes on the interval', () => {
      vi.useFakeTimers();
      const { result } = setup({
        enabled: true,
        endpoint: '/t',
        batchEvents: true,
        batchSize: 100,
        batchInterval: 1000,
      });

      act(() => result.current.track(EVENT));
      expect(fetchMock).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('stops when the provider unmounts', () => {
      // The timer used to be created inside a useMemo, which returned a cleanup
      // function React never calls — so the interval outlived the player and
      // kept firing for the life of the page.
      vi.useFakeTimers();
      const clearInterval = vi.spyOn(globalThis, 'clearInterval');

      const { unmount } = render(
        <TrackingProvider
          config={{ enabled: true, endpoint: '/t', batchEvents: true, batchInterval: 1000 }}
        >
          <span />
        </TrackingProvider>
      );

      unmount();

      expect(clearInterval).toHaveBeenCalled();
    });

    it('runs no timer when batching is off', () => {
      vi.useFakeTimers();
      const setInterval = vi.spyOn(globalThis, 'setInterval');

      render(
        <TrackingProvider config={{ enabled: true, endpoint: '/t', batchEvents: false }}>
          <span />
        </TrackingProvider>
      );

      expect(setInterval).not.toHaveBeenCalled();
    });
  });

  describe('useTracking', () => {
    it('throws outside a provider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => renderHook(() => useTracking())).toThrow(/within a TrackingProvider/);
      consoleError.mockRestore();
    });

    it('reports the merged config', () => {
      const { result } = setup({ enabled: true, batchSize: 42 });

      expect(result.current.config.batchSize).toBe(42);
      // Defaults survive alongside the override.
      expect(result.current.config.progressIntervals).toEqual([25, 50, 75, 100]);
    });
  });
});
