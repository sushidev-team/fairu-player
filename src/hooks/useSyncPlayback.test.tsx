/**
 * Watch-together, on the React side.
 *
 * `src/core/playbackSync.test.ts` covers the decisions. What is left is the
 * wiring, and one thing that is easy to get wrong: applying a correction moves
 * the local player, which is what would normally be broadcast. Without a guard
 * two clients bounce a seek between them for as long as they are connected.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSyncPlayback, type SyncTransport } from './useSyncPlayback';
import type { Correction, PlaybackSnapshot, SyncEvent } from '@/core/playbackSync';

/** A transport that keeps what was sent and can deliver what "arrives". */
function fakeTransport() {
  const sent: SyncEvent[] = [];
  const listeners = new Set<(event: SyncEvent) => void>();

  const transport: SyncTransport = {
    connect: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(),
    send: vi.fn((event) => sent.push(event)),
    onMessage(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onConnectionChange() {
      return () => {};
    },
  };

  return {
    transport,
    sent,
    /** Deliver an event as if it came from the room. */
    receive(event: SyncEvent) {
      act(() => listeners.forEach((listener) => listener(event)));
    },
  };
}

let snapshot: PlaybackSnapshot;
let applied: Correction[];

beforeEach(() => {
  snapshot = { currentTime: 100, isPlaying: true, playbackRate: 1 };
  applied = [];
});

function mount(transport: SyncTransport, isLeader = false) {
  return renderHook(() =>
    useSyncPlayback({
      transport,
      isLeader,
      getSnapshot: () => snapshot,
      applyCorrection: (correction) => applied.push(correction),
    })
  );
}

describe('useSyncPlayback', () => {
  describe('the room', () => {
    it('starts outside one', () => {
      const { transport } = fakeTransport();
      const { result } = mount(transport);

      expect(result.current.roomId).toBeNull();
      expect(result.current.peers).toEqual([]);
    });

    it('creates a room and leads it', async () => {
      const { transport, sent } = fakeTransport();
      const { result } = mount(transport);

      await act(async () => {
        await result.current.createRoom('room-1');
      });

      expect(result.current.roomId).toBe('room-1');
      expect(result.current.isLeader).toBe(true);
      expect(sent[0]).toMatchObject({ type: 'join', isLeader: true });
    });

    it('joins a room as a follower', async () => {
      const { transport } = fakeTransport();
      const { result } = mount(transport);

      await act(async () => {
        await result.current.joinRoom('room-1');
      });

      expect(result.current.isLeader).toBe(false);
    });

    it('reports a connection that failed', async () => {
      const { transport } = fakeTransport();
      (transport.connect as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('refused'));
      const { result } = mount(transport);

      await act(async () => {
        await expect(result.current.createRoom()).rejects.toThrow('refused');
      });

      expect(result.current.connectionState).toBe('error');
    });

    it('tracks who joins and leaves', async () => {
      const { transport, receive } = fakeTransport();
      const { result } = mount(transport);
      await act(async () => {
        await result.current.createRoom('room-1');
      });

      receive({ type: 'join', timestamp: Date.now(), peerId: 'other' });
      expect(result.current.peers.map((p) => p.id)).toContain('other');

      receive({ type: 'leave', timestamp: Date.now(), peerId: 'other' });
      expect(result.current.peers.map((p) => p.id)).not.toContain('other');
    });

    it('ignores its own events coming back', async () => {
      const { transport, receive } = fakeTransport();
      const { result } = mount(transport);
      await act(async () => {
        await result.current.joinRoom('room-1');
      });

      receive({
        type: 'seek',
        timestamp: Date.now(),
        peerId: result.current.peerId,
        isLeader: true,
        snapshot: { currentTime: 999, isPlaying: true, playbackRate: 1 },
      });

      // A relay that echoes is common, and following your own seek is a loop.
      expect(applied).toHaveLength(0);
    });
  });

  describe('following the leader', () => {
    it('corrects when the leader has moved on', async () => {
      const { transport, receive } = fakeTransport();
      const { result } = mount(transport);
      await act(async () => {
        await result.current.joinRoom('room-1');
      });

      receive({
        type: 'seek',
        timestamp: Date.now(),
        peerId: 'leader',
        isLeader: true,
        snapshot: { currentTime: 300, isPlaying: true, playbackRate: 1 },
      });

      expect(applied[0]?.seekTo).toBeCloseTo(300, 0);
    });

    it('ignores another follower', async () => {
      const { transport, receive } = fakeTransport();
      const { result } = mount(transport);
      await act(async () => {
        await result.current.joinRoom('room-1');
      });

      receive({
        type: 'seek',
        timestamp: Date.now(),
        peerId: 'other-follower',
        isLeader: false,
        snapshot: { currentTime: 300, isPlaying: true, playbackRate: 1 },
      });

      // Every follower announces its own moves, so checking only "am I the
      // leader" made each of them obey all the others — two followers pulling
      // the playhead against each other, which no echo guard can help with.
      expect(applied).toHaveLength(0);
    });

    it('leaves small drift alone', async () => {
      const { transport, receive } = fakeTransport();
      const { result } = mount(transport);
      await act(async () => {
        await result.current.joinRoom('room-1');
      });

      receive({
        type: 'state',
        timestamp: Date.now(),
        peerId: 'leader',
        isLeader: true,
        snapshot: { currentTime: 100.1, isPlaying: true, playbackRate: 1 },
      });

      expect(applied).toHaveLength(0);
    });

    it('does not follow anyone while leading', async () => {
      const { transport, receive } = fakeTransport();
      const { result } = mount(transport, true);
      await act(async () => {
        await result.current.createRoom('room-1');
      });

      receive({
        type: 'seek',
        timestamp: Date.now(),
        peerId: 'other',
        isLeader: true,
        snapshot: { currentTime: 999, isPlaying: true, playbackRate: 1 },
      });

      // Two clients each correcting to the other is a feedback loop.
      expect(applied).toHaveLength(0);
    });

    it('does not broadcast the move a correction just made', async () => {
      const { transport, receive, sent } = fakeTransport();
      const { result } = renderHook(() =>
        useSyncPlayback({
          transport,
          getSnapshot: () => snapshot,
          // What a real caller does: apply, which moves the player, which is
          // exactly what a `seeked` handler would then announce.
          applyCorrection: (correction) => {
            applied.push(correction);
            result.current.broadcast('seek');
          },
        })
      );

      await act(async () => {
        await result.current.joinRoom('room-1');
      });
      sent.length = 0;

      receive({
        type: 'seek',
        timestamp: Date.now(),
        peerId: 'leader',
        isLeader: true,
        snapshot: { currentTime: 300, isPlaying: true, playbackRate: 1 },
      });

      expect(applied).toHaveLength(1);
      expect(sent).toHaveLength(0);
    });
  });

  describe('broadcasting', () => {
    it('sends the local state', async () => {
      const { transport, sent } = fakeTransport();
      const { result } = mount(transport, true);
      await act(async () => {
        await result.current.createRoom('room-1');
      });
      sent.length = 0;

      act(() => result.current.broadcast('play'));

      expect(sent[0]).toMatchObject({ type: 'play', snapshot: { currentTime: 100 } });
    });

    it('sends nothing outside a room', () => {
      const { transport, sent } = fakeTransport();
      const { result } = mount(transport);

      act(() => result.current.broadcast('play'));

      expect(sent).toHaveLength(0);
    });
  });

  describe('leaving', () => {
    it('announces it and disconnects', async () => {
      const { transport, sent } = fakeTransport();
      const { result } = mount(transport, true);
      await act(async () => {
        await result.current.createRoom('room-1');
      });

      act(() => result.current.leaveRoom());

      expect(sent.at(-1)).toMatchObject({ type: 'leave' });
      expect(transport.disconnect).toHaveBeenCalled();
      expect(result.current.roomId).toBeNull();
    });
  });

  describe('when the leader goes', () => {
    it('the longest-standing peer takes over', async () => {
      const { transport, receive } = fakeTransport();
      const { result } = mount(transport);
      await act(async () => {
        await result.current.joinRoom('room-1');
      });

      // A leader was there, then left.
      receive({ type: 'join', timestamp: Date.now(), peerId: 'leader', isLeader: true });
      expect(result.current.isLeader).toBe(false);

      receive({ type: 'leave', timestamp: Date.now(), peerId: 'leader' });

      // Derived from the same peer list everyone has, so every client reaches
      // the same answer without a negotiation the room cannot hold.
      expect(result.current.isLeader).toBe(true);
    });
  });
});
