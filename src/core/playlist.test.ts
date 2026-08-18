/**
 * The playlist rules, with no renderer anywhere.
 *
 * This is what the extraction buys. `usePlaylist.test.ts` still exercises the
 * same rules through React — that suite is the proof the binding is faithful —
 * but the rules themselves are now assertable as input and output, which means
 * the awkward cases can be stated directly instead of staged through renders.
 *
 * Determinism comes free here: `random` is a parameter, so a shuffle is an
 * ordinary assertion rather than a probability.
 */

import { describe, it, expect } from 'vitest';
import * as core from './playlist';
import type { Track } from '@/types/player';

const TRACKS: Track[] = [
  { id: 'a', src: 'a.mp3' },
  { id: 'b', src: 'b.mp3' },
  { id: 'c', src: 'c.mp3' },
];

/** A `random` that always returns 0 — Fisher–Yates then swaps every i with 0. */
const fixed = () => 0;

function make(overrides: Partial<core.CreatePlaylistOptions> = {}) {
  return core.reshuffle(core.createPlaylistState({ tracks: TRACKS, ...overrides }), fixed);
}

describe('playlist core', () => {
  describe('purity', () => {
    it('never mutates the state it is given', () => {
      const state = make();
      const snapshot = JSON.stringify(state);

      core.next(state, fixed);
      core.previous(state);
      core.goToTrack(state, 2);
      core.addToQueue(state, TRACKS[1]);
      core.toggleShuffle(state, fixed);

      expect(JSON.stringify(state)).toBe(snapshot);
    });

    it('never mutates the track array it is given', () => {
      const tracks = [...TRACKS];
      const state = core.createPlaylistState({ tracks });

      core.adoptTracks(state, [{ id: 'z', src: 'z.mp3' }]);

      expect(tracks).toEqual(TRACKS);
    });
  });

  describe('createPlaylistState', () => {
    it('starts on the requested index', () => {
      const state = core.createPlaylistState({ tracks: TRACKS, initialIndex: 2 });
      expect(state.currentTrack?.id).toBe('c');
    });

    it('has no current track for an empty list', () => {
      expect(core.createPlaylistState().currentTrack).toBeNull();
    });

    it('has no current track for an out-of-range index', () => {
      const state = core.createPlaylistState({ tracks: TRACKS, initialIndex: 9 });
      expect(state.currentTrack).toBeNull();
    });
  });

  describe('shuffleWithCurrentFirst', () => {
    it('puts the current index first', () => {
      expect(core.shuffleWithCurrentFirst([0, 1, 2], 2, fixed)[0]).toBe(2);
    });

    it('keeps every index exactly once', () => {
      const order = core.shuffleWithCurrentFirst([0, 1, 2, 3, 4], 3, fixed);
      expect([...order].sort()).toEqual([0, 1, 2, 3, 4]);
    });

    it('leaves an order that already leads with the current index alone', () => {
      // `fixed` produces [1, 2, 0] from [0, 1, 2]; asking for 1 needs no move.
      const order = core.shuffleWithCurrentFirst([0, 1, 2], 1, fixed);
      expect(order[0]).toBe(1);
    });
  });

  describe('trackListSignature', () => {
    it('differs when an id differs', () => {
      const a = core.trackListSignature([{ id: 'a', src: 's' }]);
      const b = core.trackListSignature([{ id: 'b', src: 's' }]);
      expect(a).not.toBe(b);
    });

    it('differs when only the source differs', () => {
      // A re-issued signed URL under the same id is a real change.
      const a = core.trackListSignature([{ id: 'a', src: 's?token=1' }]);
      const b = core.trackListSignature([{ id: 'a', src: 's?token=2' }]);
      expect(a).not.toBe(b);
    });

    it('matches for an equal list built separately', () => {
      const a = core.trackListSignature(TRACKS);
      const b = core.trackListSignature(TRACKS.map((t) => ({ ...t })));
      expect(a).toBe(b);
    });

    it('cannot collapse two lists into one signature', () => {
      // The separator has to be a character that cannot appear in a field.
      const two = core.trackListSignature([
        { id: 'a', src: 'x' },
        { id: 'b', src: 'y' },
      ]);
      const one = core.trackListSignature([{ id: 'a', src: 'xb' }]);
      expect(two).not.toBe(one);
    });
  });

  describe('next', () => {
    it('advances and announces', () => {
      const { state, effect } = core.next(make());

      expect(state.currentIndex).toBe(1);
      expect(effect.trackChanged).toEqual({ track: TRACKS[1], index: 1 });
    });

    it('ends the queue at the last track', () => {
      const { effect } = core.next(make({ initialIndex: 2 }));

      expect(effect.queueEnded).toBe(true);
      expect(effect.trackChanged).toBeUndefined();
    });

    it('wraps with repeat all', () => {
      const { state } = core.next(make({ initialIndex: 2, repeat: 'all' }));
      expect(state.currentIndex).toBe(0);
    });

    it('re-announces without moving under repeat one', () => {
      const { state, effect } = core.next(make({ initialIndex: 1, repeat: 'one' }));

      expect(state.currentIndex).toBe(1);
      expect(effect.trackChanged).toEqual({ track: TRACKS[1], index: 1 });
    });

    it('plays a queued track before continuing in order', () => {
      const queued = core.addToQueue(make(), TRACKS[2]);
      const { state, effect } = core.next(queued);

      expect(state.currentIndex).toBe(2);
      expect(state.queue).toEqual([]);
      expect(effect.trackChanged?.track.id).toBe('c');
    });

    it('drops a queued track that is not in the list', () => {
      const queued = core.addToQueue(make(), { id: 'ghost', src: 'g.mp3' });
      const { state, effect } = core.next(queued);

      expect(state.queue).toEqual([]);
      expect(state.currentIndex).toBe(0);
      expect(effect.trackChanged).toBeUndefined();
    });

    it('records history as it advances', () => {
      const first = core.next(make()).state;
      const second = core.next(first).state;

      expect(second.history.map((t) => t.id)).toEqual(['a', 'b']);
    });
  });

  describe('next while shuffling', () => {
    it('visits every track before ending', () => {
      // With the current index front-loaded this holds for any permutation —
      // the defect it guards against was an order that put it last.
      let state = make({ shuffle: true, initialIndex: 2 });
      const visited = new Set([state.currentIndex]);

      for (let i = 0; i < TRACKS.length - 1; i++) {
        const step = core.next(state, fixed);
        state = step.state;
        visited.add(state.currentIndex);
        expect(step.effect.queueEnded).toBeUndefined();
      }

      expect([...visited].sort()).toEqual([0, 1, 2]);
      expect(core.next(state, fixed).effect.queueEnded).toBe(true);
    });

    it('reshuffles and continues under repeat all', () => {
      let state = make({ shuffle: true, repeat: 'all' });

      for (let i = 0; i < TRACKS.length * 2; i++) {
        const step = core.next(state, fixed);
        expect(step.effect.queueEnded).toBeUndefined();
        state = step.state;
      }
    });
  });

  describe('previous', () => {
    it('walks back through history first', () => {
      const advanced = core.goToTrack(make(), 2).state;
      const { state } = core.previous(advanced);

      expect(state.currentIndex).toBe(0);
      expect(state.history).toEqual([]);
    });

    it('steps back in order once history is empty', () => {
      const { state } = core.previous(make({ initialIndex: 2 }));
      expect(state.currentIndex).toBe(1);
    });

    it('stays at the first track without repeat', () => {
      const { state, effect } = core.previous(make());

      expect(state.currentIndex).toBe(0);
      expect(effect.trackChanged).toBeUndefined();
    });

    it('wraps to the last track with repeat all', () => {
      const { state } = core.previous(make({ repeat: 'all' }));
      expect(state.currentIndex).toBe(2);
    });

    it('drops a history entry whose track has left the list', () => {
      // The list can be replaced while history still refers to the old one.
      const withHistory = core.goToTrack(make(), 1).state;
      const replaced: core.PlaylistCoreState = {
        ...withHistory,
        tracks: [{ id: 'z', src: 'z.mp3' }],
      };

      const { state, effect } = core.previous(replaced);

      expect(state.history).toEqual([]);
      expect(effect.trackChanged).toBeUndefined();
    });
  });

  describe('adoptTracks', () => {
    it('fills an empty list without moving the cursor', () => {
      const empty = core.createPlaylistState({ tracks: [], initialIndex: 1 });
      const filled = core.adoptTracks(empty, TRACKS);

      expect(filled.currentIndex).toBe(1);
      expect(filled.currentTrack?.id).toBe('b');
    });

    it('resets everything derived when replacing a playing list', () => {
      const playing = core.addToQueue(core.goToTrack(make(), 2).state, TRACKS[0]);
      const replaced = core.adoptTracks(playing, [{ id: 'z', src: 'z.mp3' }]);

      expect(replaced.currentIndex).toBe(0);
      expect(replaced.currentTrack?.id).toBe('z');
      expect(replaced.history).toEqual([]);
      expect(replaced.queue).toEqual([]);
    });

    it('rebuilds the shuffled order for the new list', () => {
      // A stale order indexes into a list that no longer exists.
      const playing = make({ shuffle: true, initialIndex: 2 });
      const replaced = core.adoptTracks(playing, [
        { id: 'x', src: 'x.mp3' },
        { id: 'y', src: 'y.mp3' },
      ]);

      expect([...replaced.shuffledOrder].sort()).toEqual([0, 1]);
    });
  });

  describe('queue management', () => {
    it('appends in order', () => {
      let state = core.addToQueue(make(), TRACKS[1]);
      state = core.addToQueue(state, TRACKS[2]);

      expect(state.queue.map((t) => t.id)).toEqual(['b', 'c']);
    });

    it('removes by index', () => {
      let state = core.addToQueue(make(), TRACKS[0]);
      state = core.addToQueue(state, TRACKS[1]);
      state = core.removeFromQueue(state, 0);

      expect(state.queue.map((t) => t.id)).toEqual(['b']);
    });

    it('ignores an index that is not there', () => {
      const state = core.removeFromQueue(core.addToQueue(make(), TRACKS[0]), 9);
      expect(state.queue).toHaveLength(1);
    });

    it('clears', () => {
      const state = core.clearQueue(core.addToQueue(make(), TRACKS[0]));
      expect(state.queue).toEqual([]);
    });
  });

  describe('modes', () => {
    it('sets repeat', () => {
      expect(core.setRepeat(make(), 'all').repeat).toBe('all');
    });

    it('builds an order when shuffle goes on and clears it when it goes off', () => {
      const on = core.toggleShuffle(make(), fixed);
      expect(on.shuffle).toBe(true);
      expect(on.shuffledOrder).toHaveLength(3);

      const off = core.toggleShuffle(on, fixed);
      expect(off.shuffle).toBe(false);
      expect(off.shuffledOrder).toEqual([]);
    });

    it('keeps the current track when shuffle goes on', () => {
      const on = core.toggleShuffle(make({ initialIndex: 1 }), fixed);

      expect(on.currentIndex).toBe(1);
      expect(on.shuffledOrder[0]).toBe(1);
    });
  });
});
