/**
 * Keeping two players on the same frame, without a transport.
 *
 * The whole difficulty is that a message describes where the sender *was*. Most
 * of what follows is about projecting that forward and then not over-reacting
 * to what is left.
 */

import { describe, it, expect } from 'vitest';
import * as core from './playbackSync';

const T0 = 1_700_000_000_000;

function snapshot(over: Partial<core.PlaybackSnapshot> = {}): core.PlaybackSnapshot {
  return { currentTime: 100, isPlaying: true, playbackRate: 1, ...over };
}

describe('playbackSync core', () => {
  describe('projecting the sender forward', () => {
    it('advances a playing sender by the time in flight', () => {
      expect(core.projectedTime(snapshot({ currentTime: 100 }), T0, T0 + 2000)).toBe(102);
    });

    it('leaves a paused sender where they were', () => {
      expect(
        core.projectedTime(snapshot({ currentTime: 100, isPlaying: false }), T0, T0 + 5000)
      ).toBe(100);
    });

    it('accounts for the playback rate', () => {
      // A leader at 1.5× covers more ground per second; ignoring it makes every
      // correction land short.
      expect(
        core.projectedTime(snapshot({ currentTime: 100, playbackRate: 1.5 }), T0, T0 + 2000)
      ).toBe(103);
    });

    it('never runs backwards on a clock that disagrees', () => {
      expect(core.projectedTime(snapshot({ currentTime: 100 }), T0, T0 - 5000)).toBe(100);
    });
  });

  describe('deciding whether to correct', () => {
    it('does nothing for drift inside the tolerance', () => {
      const correction = core.decideCorrection(
        snapshot({ currentTime: 100.2 }),
        snapshot({ currentTime: 100 }),
        T0,
        T0
      );

      // A seek is audible. Correcting for jitter is worse than the jitter.
      expect(correction).toBe(core.NO_CORRECTION);
    });

    it('seeks once the drift is worth it', () => {
      const correction = core.decideCorrection(
        snapshot({ currentTime: 95 }),
        snapshot({ currentTime: 100 }),
        T0,
        T0
      );

      expect(correction.seekTo).toBe(100);
    });

    it('seeks to where the leader is now, not where they were', () => {
      const correction = core.decideCorrection(
        snapshot({ currentTime: 100 }),
        snapshot({ currentTime: 100 }),
        T0,
        T0 + 3000
      );

      expect(correction.seekTo).toBe(103);
    });

    it('never seeks before the start', () => {
      const correction = core.decideCorrection(
        snapshot({ currentTime: 50 }),
        snapshot({ currentTime: -20, isPlaying: false }),
        T0,
        T0
      );

      expect(correction.seekTo).toBe(0);
    });

    it('follows the leader into pause and back', () => {
      expect(
        core.decideCorrection(snapshot(), snapshot({ isPlaying: false }), T0, T0).setPlaying
      ).toBe(false);
      expect(
        core.decideCorrection(snapshot({ isPlaying: false }), snapshot(), T0, T0).setPlaying
      ).toBe(true);
    });

    it('follows the leader to another rate', () => {
      expect(
        core.decideCorrection(snapshot(), snapshot({ playbackRate: 1.5 }), T0, T0).setRate
      ).toBe(1.5);
    });

    it('ignores a message that spent too long in flight', () => {
      const correction = core.decideCorrection(
        snapshot({ currentTime: 0 }),
        snapshot({ currentTime: 100 }),
        T0,
        T0 + 60_000
      );

      // It describes a moment that has passed; acting on it would seek to the
      // wrong place with confidence.
      expect(correction).toBe(core.NO_CORRECTION);
    });

    it('reports nothing to do as one recognisable value', () => {
      const correction = core.decideCorrection(snapshot(), snapshot(), T0, T0);

      expect(correction).toBe(core.NO_CORRECTION);
      expect(core.hasWork(correction)).toBe(false);
    });
  });

  describe('the room', () => {
    const peer = (id: string, joinedAt: number, isLeader = false): core.SyncPeer => ({
      id,
      joinedAt,
      isLeader,
    });

    it('adds someone who joined', () => {
      const peers = core.applyMembership([], {
        type: 'join',
        timestamp: T0,
        peerId: 'a',
        isLeader: true,
      }, T0);

      expect(peers).toEqual([{ id: 'a', isLeader: true, joinedAt: T0 }]);
    });

    it('adds nobody twice', () => {
      const existing = [peer('a', T0)];
      const peers = core.applyMembership(existing, {
        type: 'join',
        timestamp: T0,
        peerId: 'a',
      }, T0 + 100);

      expect(peers).toBe(existing);
    });

    it('removes someone who left', () => {
      const peers = core.applyMembership([peer('a', T0), peer('b', T0)], {
        type: 'leave',
        timestamp: T0,
        peerId: 'a',
      }, T0);

      expect(peers.map((p) => p.id)).toEqual(['b']);
    });

    it('leaves the list alone for anything else', () => {
      const existing = [peer('a', T0)];

      expect(core.applyMembership(existing, { type: 'play', timestamp: T0, peerId: 'a' }, T0))
        .toBe(existing);
    });
  });

  describe('choosing a new leader', () => {
    it('takes the one who has been there longest', () => {
      const peers = [
        { id: 'late', isLeader: false, joinedAt: T0 + 500 },
        { id: 'early', isLeader: false, joinedAt: T0 },
      ];

      expect(core.successorLeader(peers)).toBe('early');
    });

    it('breaks a tie the same way everywhere', () => {
      const peers = [
        { id: 'b', isLeader: false, joinedAt: T0 },
        { id: 'a', isLeader: false, joinedAt: T0 },
      ];

      // Every client has to reach the same answer without negotiating — there
      // is no channel for that.
      expect(core.successorLeader(peers)).toBe('a');
    });

    it('reports nobody for an empty room', () => {
      expect(core.successorLeader([])).toBeNull();
    });
  });
});
