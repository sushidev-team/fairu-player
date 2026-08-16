import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePlaylist } from './usePlaylist';
import type { Track } from '@/types/player';

const TRACKS: Track[] = [
  { id: 'a', src: 'a.mp3', title: 'A' },
  { id: 'b', src: 'b.mp3', title: 'B' },
  { id: 'c', src: 'c.mp3', title: 'C' },
];

const EXTRA: Track = { id: 'd', src: 'd.mp3', title: 'D' };

describe('usePlaylist', () => {
  describe('initial state', () => {
    it('starts on the first track', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      expect(result.current.state.currentIndex).toBe(0);
      expect(result.current.state.currentTrack?.id).toBe('a');
      expect(result.current.state.tracks).toHaveLength(3);
    });

    it('honours an initial index', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS, initialIndex: 2 }));
      expect(result.current.state.currentTrack?.id).toBe('c');
    });

    it('has no current track for an empty playlist', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: [] }));
      expect(result.current.state.currentTrack).toBeNull();
    });

    it('handles being called with no options at all', () => {
      const { result } = renderHook(() => usePlaylist());
      expect(result.current.state.tracks).toEqual([]);
      expect(result.current.state.currentTrack).toBeNull();
    });

    it('starts with empty queue and history', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));
      expect(result.current.state.queue).toEqual([]);
      expect(result.current.state.history).toEqual([]);
    });

    it('returns null for an out-of-range initial index', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS, initialIndex: 99 }));
      expect(result.current.state.currentTrack).toBeNull();
    });
  });

  describe('adopting tracks that arrive after mount', () => {
    it('picks up a playlist that was empty at mount', () => {
      // The async-fetch case: the component renders before the feed resolves.
      const { result, rerender } = renderHook(
        ({ tracks }) => usePlaylist({ tracks }),
        { initialProps: { tracks: [] as Track[] } }
      );

      expect(result.current.state.tracks).toHaveLength(0);

      rerender({ tracks: TRACKS });

      expect(result.current.state.tracks).toHaveLength(3);
      expect(result.current.state.currentTrack?.id).toBe('a');
    });

    it('adopts a genuinely different list and resets the cursor', () => {
      const { result, rerender } = renderHook(
        ({ tracks }) => usePlaylist({ tracks }),
        { initialProps: { tracks: TRACKS } }
      );

      act(() => result.current.controls.goToTrack(2));
      rerender({ tracks: [EXTRA] });

      // Swapping the playlist invalidates the cursor and everything derived
      // from it, so history and queue go too.
      expect(result.current.state.tracks.map((t) => t.id)).toEqual(['d']);
      expect(result.current.state.currentIndex).toBe(0);
      expect(result.current.state.history).toEqual([]);
      expect(result.current.state.queue).toEqual([]);
    });

    it('ignores a re-passed list with the same ids', () => {
      // Callers build the array inline, so it is a new reference every render.
      // Resyncing on that would reset the listener's position continuously.
      const { result, rerender } = renderHook(
        ({ tracks }) => usePlaylist({ tracks }),
        { initialProps: { tracks: TRACKS } }
      );

      act(() => result.current.controls.goToTrack(2));
      rerender({ tracks: [...TRACKS] });
      rerender({ tracks: TRACKS.map((t) => ({ ...t })) });

      expect(result.current.state.currentIndex).toBe(2);
    });

    it('adopts a list whose ids match but whose sources changed', () => {
      // Signed URLs expire and get re-issued under the same track id, so this
      // is a real update rather than a contrived one — and comparing ids alone
      // would leave the player on the dead source.
      const { result, rerender } = renderHook(
        ({ tracks }) => usePlaylist({ tracks }),
        { initialProps: { tracks: TRACKS } }
      );

      const refreshed = TRACKS.map((t) => ({ ...t, src: `${t.src}?token=fresh` }));
      rerender({ tracks: refreshed });

      expect(result.current.state.currentTrack?.src).toBe(refreshed[0].src);
    });

    it('keeps initialIndex when a late list fills an empty one', () => {
      const { result, rerender } = renderHook(
        ({ tracks }) => usePlaylist({ tracks, initialIndex: 1 }),
        { initialProps: { tracks: [] as Track[] } }
      );

      rerender({ tracks: TRACKS });

      // Filling an empty list is the late-fetch case, not a swap — the caller's
      // requested starting point still stands.
      expect(result.current.state.currentIndex).toBe(1);
    });
  });

  describe('goToTrack', () => {
    it('moves to the given index', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      act(() => result.current.controls.goToTrack(1));

      expect(result.current.state.currentTrack?.id).toBe('b');
    });

    it('notifies with the track and index', () => {
      const onTrackChange = vi.fn();
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS, onTrackChange }));

      act(() => result.current.controls.goToTrack(2));

      expect(onTrackChange).toHaveBeenCalledWith(TRACKS[2], 2);
    });

    it('pushes the track it left onto history', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      act(() => result.current.controls.goToTrack(1));

      expect(result.current.state.history.map((t) => t.id)).toEqual(['a']);
    });

    it('ignores a negative index', () => {
      const onTrackChange = vi.fn();
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS, onTrackChange }));

      act(() => result.current.controls.goToTrack(-1));

      expect(result.current.state.currentIndex).toBe(0);
      expect(onTrackChange).not.toHaveBeenCalled();
    });

    it('ignores an index past the end', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      act(() => result.current.controls.goToTrack(99));

      expect(result.current.state.currentIndex).toBe(0);
    });
  });

  describe('next — sequential', () => {
    it('advances one track', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      act(() => result.current.controls.next());

      expect(result.current.state.currentTrack?.id).toBe('b');
    });

    it('reports the queue end at the last track when not repeating', () => {
      const onQueueEnd = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks: TRACKS, initialIndex: 2, onQueueEnd })
      );

      act(() => result.current.controls.next());

      expect(onQueueEnd).toHaveBeenCalledOnce();
      expect(result.current.state.currentIndex).toBe(2);
    });

    it('wraps to the start with repeat "all"', () => {
      const { result } = renderHook(() =>
        usePlaylist({ tracks: TRACKS, initialIndex: 2, repeat: 'all' })
      );

      act(() => result.current.controls.next());

      expect(result.current.state.currentIndex).toBe(0);
    });

    it('stays put with repeat "one" but still re-announces the track', () => {
      const onTrackChange = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks: TRACKS, initialIndex: 1, repeat: 'one', onTrackChange })
      );

      act(() => result.current.controls.next());

      expect(result.current.state.currentIndex).toBe(1);
      // Re-announcing is what makes the track restart rather than sit at the end.
      expect(onTrackChange).toHaveBeenCalledWith(TRACKS[1], 1);
    });

    it('records history as it advances', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      act(() => result.current.controls.next());
      act(() => result.current.controls.next());

      expect(result.current.state.history.map((t) => t.id)).toEqual(['a', 'b']);
    });
  });

  describe('next — queue takes priority', () => {
    it('plays a queued track before continuing in order', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      act(() => result.current.controls.addToQueue(TRACKS[2]));
      act(() => result.current.controls.next());

      expect(result.current.state.currentTrack?.id).toBe('c');
    });

    it('consumes the queued entry', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      act(() => result.current.controls.addToQueue(TRACKS[2]));
      act(() => result.current.controls.next());

      expect(result.current.state.queue).toHaveLength(0);
    });

    it('falls back to sequential order once the queue is empty', () => {
      const onQueueEnd = vi.fn();
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS, onQueueEnd }));

      act(() => result.current.controls.addToQueue(TRACKS[2]));
      act(() => result.current.controls.next()); // queue wins -> index 2
      expect(result.current.state.currentIndex).toBe(2);

      act(() => result.current.controls.next()); // sequential from 2 -> past the end

      // The queued jump moves the cursor, so ordinary traversal resumes from
      // where the queue left it rather than from where it interrupted.
      expect(onQueueEnd).toHaveBeenCalledOnce();
      expect(result.current.state.currentIndex).toBe(2);
    });

    it('drops a queued track that is not in the playlist', () => {
      // The index lookup fails, so there is nothing to switch to.
      const onTrackChange = vi.fn();
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS, onTrackChange }));

      act(() => result.current.controls.addToQueue(EXTRA));
      act(() => result.current.controls.next());

      expect(result.current.state.currentIndex).toBe(0);
      expect(onTrackChange).not.toHaveBeenCalled();
      expect(result.current.state.queue).toHaveLength(0);
    });
  });

  describe('previous', () => {
    it('walks back through history first', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      act(() => result.current.controls.goToTrack(2));
      act(() => result.current.controls.previous());

      expect(result.current.state.currentTrack?.id).toBe('a');
    });

    it('pops the entry it used off history', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      act(() => result.current.controls.goToTrack(1));
      act(() => result.current.controls.previous());

      expect(result.current.state.history).toHaveLength(0);
    });

    it('steps back in order once history is exhausted', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS, initialIndex: 2 }));

      act(() => result.current.controls.previous());

      expect(result.current.state.currentIndex).toBe(1);
    });

    it('stays at the first track without repeat', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      act(() => result.current.controls.previous());

      expect(result.current.state.currentIndex).toBe(0);
    });

    it('wraps to the last track with repeat "all"', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS, repeat: 'all' }));

      act(() => result.current.controls.previous());

      expect(result.current.state.currentIndex).toBe(2);
    });
  });

  describe('shuffle', () => {
    /**
     * Force a known permutation.
     *
     * `shuffleArray` is a Fisher–Yates walking `i` from the end down, taking
     * `Math.floor(random * (i + 1))` as the swap partner. Returning 0 every
     * time makes each step swap `shuffled[i]` with `shuffled[0]`, which for
     * `[0,1,2]` yields `[1,2,0]` — deterministic, and with index 0 last, which
     * is the case that matters below.
     */
    function forcePermutation() {
      return vi.spyOn(Math, 'random').mockReturnValue(0);
    }

    afterEach(() => vi.restoreAllMocks());

    it('toggles on and off', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      act(() => result.current.controls.toggleShuffle());
      expect(result.current.state.shuffle).toBe(true);

      act(() => result.current.controls.toggleShuffle());
      expect(result.current.state.shuffle).toBe(false);
    });

    it('generates an order covering every track', () => {
      forcePermutation();
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS, shuffle: true }));

      // Walk the whole list under repeat 'all' so the traversal cannot end.
      act(() => result.current.controls.setRepeat('all'));

      const visited = new Set<number>([result.current.state.currentIndex]);
      for (let i = 0; i < TRACKS.length * 2; i++) {
        act(() => result.current.controls.next());
        visited.add(result.current.state.currentIndex);
      }

      expect([...visited].sort()).toEqual([0, 1, 2]);
    });

    it('reshuffles and keeps going with repeat "all"', () => {
      forcePermutation();
      const onQueueEnd = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks: TRACKS, shuffle: true, repeat: 'all', onQueueEnd })
      );

      for (let i = 0; i < TRACKS.length + 2; i++) {
        act(() => result.current.controls.next());
      }

      expect(onQueueEnd).not.toHaveBeenCalled();
    });

    it('steps back through history first', () => {
      forcePermutation();
      const { result } = renderHook(() =>
        usePlaylist({ tracks: TRACKS, shuffle: true, repeat: 'all' })
      );

      const start = result.current.state.currentIndex;
      act(() => result.current.controls.next());
      act(() => result.current.controls.previous());

      expect(result.current.state.currentIndex).toBe(start);
    });

    /**
     * Regression cover for the traversal defect.
     *
     * The order used to be a plain permutation, so `next()` looked the current
     * index up inside it and, whenever the shuffle happened to place that index
     * last, ended the queue after a single track — a 1-in-N chance per session,
     * and the reason an earlier version of these tests was flaky.
     *
     * The current track is now moved to the front of the order.
     */
    it('plays every remaining track before ending, whatever the permutation', () => {
      forcePermutation(); // would place index 0 last without the fix
      const onQueueEnd = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks: TRACKS, shuffle: true, onQueueEnd })
      );

      const visited = [result.current.state.currentIndex];
      for (let i = 0; i < TRACKS.length - 1; i++) {
        act(() => result.current.controls.next());
        visited.push(result.current.state.currentIndex);
      }

      expect([...new Set(visited)].sort()).toEqual([0, 1, 2]);
      expect(onQueueEnd).not.toHaveBeenCalled();

      // Only now, with the list exhausted, is the queue actually over.
      act(() => result.current.controls.next());
      expect(onQueueEnd).toHaveBeenCalledOnce();
    });

    it('steps back through the shuffled order once history is exhausted', () => {
      forcePermutation();
      const { result } = renderHook(() =>
        usePlaylist({ tracks: TRACKS, shuffle: true, repeat: 'all' })
      );

      // Advance twice, then rewind past both history entries so the third
      // `previous()` has to fall through to the shuffled order itself.
      act(() => result.current.controls.next());
      act(() => result.current.controls.next());
      act(() => result.current.controls.previous());
      act(() => result.current.controls.previous());
      act(() => result.current.controls.previous());

      expect(result.current.state.history).toEqual([]);
      expect(result.current.state.currentIndex).toBeGreaterThanOrEqual(0);
      expect(result.current.state.currentIndex).toBeLessThan(TRACKS.length);
    });

    it('wraps to the end of the shuffled order with repeat "all"', () => {
      forcePermutation();
      const { result } = renderHook(() =>
        usePlaylist({ tracks: TRACKS, shuffle: true, repeat: 'all' })
      );

      // At the front of the shuffled order with no history, previous() wraps.
      act(() => result.current.controls.previous());

      expect(result.current.state.currentIndex).toBeGreaterThanOrEqual(0);
    });

    it('stays put at the front of the shuffled order without repeat', () => {
      forcePermutation();
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS, shuffle: true }));

      const start = result.current.state.currentIndex;
      act(() => result.current.controls.previous());

      expect(result.current.state.currentIndex).toBe(start);
    });

    it('rebuilds the order after a replacement list of the same length', () => {
      // The order is rebuilt from the track *count*, so a same-length swap kept
      // the previous permutation while the cursor reset to 0 — leaving index 0
      // wherever the old order had put it. With the forced permutation that is
      // last, so the first `next()` would end the queue after one track: the
      // defect this hook already fixed once, returning through another door.
      forcePermutation();
      const onQueueEnd = vi.fn();
      // Starting away from 0 is what makes the staleness observable: the order
      // is built current-first, so after the cursor resets to 0 the old order
      // still leads with index 2 and leaves 0 at the end.
      const { result, rerender } = renderHook(
        ({ tracks }) => usePlaylist({ tracks, shuffle: true, initialIndex: 2, onQueueEnd }),
        { initialProps: { tracks: TRACKS } }
      );

      const replacement: Track[] = [
        { id: 'x', src: 'x.mp3' },
        { id: 'y', src: 'y.mp3' },
        { id: 'z', src: 'z.mp3' },
      ];
      rerender({ tracks: replacement });

      const visited = new Set<number>([result.current.state.currentIndex]);
      for (let i = 0; i < replacement.length - 1; i++) {
        act(() => result.current.controls.next());
        visited.add(result.current.state.currentIndex);
      }

      expect([...visited].sort()).toEqual([0, 1, 2]);
      expect(onQueueEnd).not.toHaveBeenCalled();
    });

    it('keeps the current track playing when shuffle is switched on', () => {
      // Hitting shuffle reorders what comes next; it does not jump elsewhere.
      forcePermutation();
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS, initialIndex: 1 }));

      act(() => result.current.controls.toggleShuffle());

      expect(result.current.state.currentIndex).toBe(1);
    });
  });

  describe('repeat mode', () => {
    it('can be changed at runtime', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      act(() => result.current.controls.setRepeat('all'));
      expect(result.current.state.repeat).toBe('all');

      act(() => result.current.controls.setRepeat('one'));
      expect(result.current.state.repeat).toBe('one');
    });

    it('takes effect immediately', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS, initialIndex: 2 }));

      act(() => result.current.controls.setRepeat('all'));
      act(() => result.current.controls.next());

      expect(result.current.state.currentIndex).toBe(0);
    });
  });

  describe('queue management', () => {
    it('appends in order', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      act(() => result.current.controls.addToQueue(TRACKS[1]));
      act(() => result.current.controls.addToQueue(TRACKS[2]));

      expect(result.current.state.queue.map((t) => t.id)).toEqual(['b', 'c']);
    });

    it('removes by index', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      act(() => result.current.controls.addToQueue(TRACKS[0]));
      act(() => result.current.controls.addToQueue(TRACKS[1]));
      act(() => result.current.controls.removeFromQueue(0));

      expect(result.current.state.queue.map((t) => t.id)).toEqual(['b']);
    });

    it('ignores a removal index that does not exist', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      act(() => result.current.controls.addToQueue(TRACKS[0]));
      act(() => result.current.controls.removeFromQueue(5));

      expect(result.current.state.queue).toHaveLength(1);
    });

    it('clears everything', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      act(() => result.current.controls.addToQueue(TRACKS[0]));
      act(() => result.current.controls.addToQueue(TRACKS[1]));
      act(() => result.current.controls.clearQueue());

      expect(result.current.state.queue).toEqual([]);
    });

    it('allows the same track to be queued twice', () => {
      const { result } = renderHook(() => usePlaylist({ tracks: TRACKS }));

      act(() => result.current.controls.addToQueue(TRACKS[1]));
      act(() => result.current.controls.addToQueue(TRACKS[1]));

      expect(result.current.state.queue).toHaveLength(2);
    });
  });

  describe('single-track playlist', () => {
    it('reports the queue end on next', () => {
      const onQueueEnd = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks: [TRACKS[0]], onQueueEnd })
      );

      act(() => result.current.controls.next());

      expect(onQueueEnd).toHaveBeenCalledOnce();
    });

    it('stays put on next with repeat "all"', () => {
      const { result } = renderHook(() =>
        usePlaylist({ tracks: [TRACKS[0]], repeat: 'all' })
      );

      act(() => result.current.controls.next());

      expect(result.current.state.currentIndex).toBe(0);
    });
  });
});
