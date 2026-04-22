import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlaylist } from './usePlaylist';
import { createMockTrack, createMockPlaylist } from '@/test/helpers';

describe('usePlaylist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Initial State ──────────────────────────────────────────────────

  describe('initial state', () => {
    it('returns empty state when no tracks provided', () => {
      const { result } = renderHook(() => usePlaylist());

      expect(result.current.state.tracks).toEqual([]);
      expect(result.current.state.currentIndex).toBe(0);
      expect(result.current.state.currentTrack).toBeNull();
      expect(result.current.state.shuffle).toBe(false);
      expect(result.current.state.repeat).toBe('none');
      expect(result.current.state.queue).toEqual([]);
      expect(result.current.state.history).toEqual([]);
    });

    it('initializes with provided tracks', () => {
      const tracks = createMockPlaylist(3);
      const { result } = renderHook(() => usePlaylist({ tracks }));

      expect(result.current.state.tracks).toEqual(tracks);
      expect(result.current.state.currentTrack).toEqual(tracks[0]);
      expect(result.current.state.currentIndex).toBe(0);
    });

    it('initializes with custom initial index', () => {
      const tracks = createMockPlaylist(3);
      const { result } = renderHook(() => usePlaylist({ tracks, initialIndex: 2 }));

      expect(result.current.state.currentIndex).toBe(2);
      expect(result.current.state.currentTrack).toEqual(tracks[2]);
    });

    it('initializes with shuffle enabled', () => {
      const tracks = createMockPlaylist(3);
      const { result } = renderHook(() => usePlaylist({ tracks, shuffle: true }));

      expect(result.current.state.shuffle).toBe(true);
    });

    it('initializes with repeat mode', () => {
      const tracks = createMockPlaylist(3);
      const { result } = renderHook(() => usePlaylist({ tracks, repeat: 'all' }));

      expect(result.current.state.repeat).toBe('all');
    });
  });

  // ─── Track Navigation ──────────────────────────────────────────────

  describe('track navigation', () => {
    it('next() advances to the next track', () => {
      const tracks = createMockPlaylist(3);
      const onTrackChange = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks, onTrackChange })
      );

      act(() => {
        result.current.controls.next();
      });

      expect(result.current.state.currentIndex).toBe(1);
      expect(result.current.state.currentTrack).toEqual(tracks[1]);
      expect(onTrackChange).toHaveBeenCalledWith(tracks[1], 1);
    });

    it('next() calls onQueueEnd at end of playlist with repeat none', () => {
      const tracks = createMockPlaylist(3);
      const onQueueEnd = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks, initialIndex: 2, onQueueEnd })
      );

      act(() => {
        result.current.controls.next();
      });

      expect(onQueueEnd).toHaveBeenCalledTimes(1);
      expect(result.current.state.currentIndex).toBe(2);
    });

    it('previous() goes to the previous track in order when no history', () => {
      const tracks = createMockPlaylist(3);
      const onTrackChange = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks, initialIndex: 2, onTrackChange })
      );

      act(() => {
        result.current.controls.previous();
      });

      expect(result.current.state.currentIndex).toBe(1);
      expect(onTrackChange).toHaveBeenCalledWith(tracks[1], 1);
    });

    it('previous() does nothing at start of playlist with repeat none', () => {
      const tracks = createMockPlaylist(3);
      const onTrackChange = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks, onTrackChange })
      );

      act(() => {
        result.current.controls.previous();
      });

      expect(result.current.state.currentIndex).toBe(0);
      expect(onTrackChange).not.toHaveBeenCalled();
    });

    it('goToTrack() navigates to a specific track', () => {
      const tracks = createMockPlaylist(5);
      const onTrackChange = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks, onTrackChange })
      );

      act(() => {
        result.current.controls.goToTrack(3);
      });

      expect(result.current.state.currentIndex).toBe(3);
      expect(result.current.state.currentTrack).toEqual(tracks[3]);
      expect(onTrackChange).toHaveBeenCalledWith(tracks[3], 3);
    });

    it('goToTrack() ignores invalid indices (negative)', () => {
      const tracks = createMockPlaylist(3);
      const onTrackChange = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks, onTrackChange })
      );

      act(() => {
        result.current.controls.goToTrack(-1);
      });

      expect(result.current.state.currentIndex).toBe(0);
      expect(onTrackChange).not.toHaveBeenCalled();
    });

    it('goToTrack() ignores invalid indices (out of range)', () => {
      const tracks = createMockPlaylist(3);
      const onTrackChange = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks, onTrackChange })
      );

      act(() => {
        result.current.controls.goToTrack(10);
      });

      expect(result.current.state.currentIndex).toBe(0);
      expect(onTrackChange).not.toHaveBeenCalled();
    });
  });

  // ─── Repeat Modes ──────────────────────────────────────────────────

  describe('repeat modes', () => {
    it('repeat "one" re-triggers onTrackChange with the same track', () => {
      const tracks = createMockPlaylist(3);
      const onTrackChange = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks, repeat: 'one', onTrackChange })
      );

      act(() => {
        result.current.controls.next();
      });

      expect(result.current.state.currentIndex).toBe(0);
      expect(onTrackChange).toHaveBeenCalledWith(tracks[0], 0);
    });

    it('repeat "all" wraps to first track at end of playlist', () => {
      const tracks = createMockPlaylist(3);
      const onTrackChange = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks, initialIndex: 2, repeat: 'all', onTrackChange })
      );

      act(() => {
        result.current.controls.next();
      });

      expect(result.current.state.currentIndex).toBe(0);
      expect(onTrackChange).toHaveBeenCalledWith(tracks[0], 0);
    });

    it('repeat "all" wraps to last track when going previous at start', () => {
      const tracks = createMockPlaylist(3);
      const onTrackChange = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks, initialIndex: 0, repeat: 'all', onTrackChange })
      );

      act(() => {
        result.current.controls.previous();
      });

      expect(result.current.state.currentIndex).toBe(2);
      expect(onTrackChange).toHaveBeenCalledWith(tracks[2], 2);
    });

    it('setRepeat() changes the repeat mode', () => {
      const tracks = createMockPlaylist(3);
      const { result } = renderHook(() => usePlaylist({ tracks }));

      act(() => {
        result.current.controls.setRepeat('all');
      });

      expect(result.current.state.repeat).toBe('all');

      act(() => {
        result.current.controls.setRepeat('one');
      });

      expect(result.current.state.repeat).toBe('one');

      act(() => {
        result.current.controls.setRepeat('none');
      });

      expect(result.current.state.repeat).toBe('none');
    });
  });

  // ─── Shuffle Mode ─────────────────────────────────────────────────

  describe('shuffle mode', () => {
    it('toggleShuffle() enables and disables shuffle', () => {
      const tracks = createMockPlaylist(3);
      const { result } = renderHook(() => usePlaylist({ tracks }));

      expect(result.current.state.shuffle).toBe(false);

      act(() => {
        result.current.controls.toggleShuffle();
      });

      expect(result.current.state.shuffle).toBe(true);

      act(() => {
        result.current.controls.toggleShuffle();
      });

      expect(result.current.state.shuffle).toBe(false);
    });

    it('next() picks a different index when shuffle is enabled', () => {
      const tracks = createMockPlaylist(10);
      const { result } = renderHook(() =>
        usePlaylist({ tracks, shuffle: true })
      );

      // With 10 tracks and shuffle, at least one next() call should
      // not just go to index 1. We run several and check diversity.
      const visitedIndices = new Set<number>();
      visitedIndices.add(result.current.state.currentIndex);

      for (let i = 0; i < 9; i++) {
        act(() => {
          result.current.controls.next();
        });
        visitedIndices.add(result.current.state.currentIndex);
      }

      // Shuffled order should visit multiple different indices
      expect(visitedIndices.size).toBeGreaterThan(1);
    });
  });

  // ─── Queue ─────────────────────────────────────────────────────────

  describe('queue', () => {
    it('addToQueue() adds a track to the queue', () => {
      const tracks = createMockPlaylist(3);
      const extraTrack = createMockTrack({ id: 'extra-1', title: 'Extra Track' });
      const { result } = renderHook(() => usePlaylist({ tracks }));

      act(() => {
        result.current.controls.addToQueue(extraTrack);
      });

      expect(result.current.state.queue).toHaveLength(1);
      expect(result.current.state.queue[0]).toEqual(extraTrack);
    });

    it('addToQueue() appends multiple tracks', () => {
      const tracks = createMockPlaylist(3);
      const extra1 = createMockTrack({ id: 'extra-1' });
      const extra2 = createMockTrack({ id: 'extra-2' });
      const { result } = renderHook(() => usePlaylist({ tracks }));

      act(() => {
        result.current.controls.addToQueue(extra1);
      });
      act(() => {
        result.current.controls.addToQueue(extra2);
      });

      expect(result.current.state.queue).toHaveLength(2);
      expect(result.current.state.queue[0].id).toBe('extra-1');
      expect(result.current.state.queue[1].id).toBe('extra-2');
    });

    it('next() plays from queue before advancing playlist', () => {
      const tracks = createMockPlaylist(3);
      const queuedTrack = createMockTrack({ id: 'track-2', title: 'Queued' });
      const onTrackChange = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks, onTrackChange })
      );

      act(() => {
        result.current.controls.addToQueue(queuedTrack);
      });

      act(() => {
        result.current.controls.next();
      });

      // Should play the queued track (which is track-2 in the tracks array)
      expect(onTrackChange).toHaveBeenCalledWith(queuedTrack, 1);
      expect(result.current.state.queue).toHaveLength(0);
    });

    it('removeFromQueue() removes track at index', () => {
      const tracks = createMockPlaylist(3);
      const q1 = createMockTrack({ id: 'q-1' });
      const q2 = createMockTrack({ id: 'q-2' });
      const q3 = createMockTrack({ id: 'q-3' });
      const { result } = renderHook(() => usePlaylist({ tracks }));

      act(() => {
        result.current.controls.addToQueue(q1);
        result.current.controls.addToQueue(q2);
        result.current.controls.addToQueue(q3);
      });

      act(() => {
        result.current.controls.removeFromQueue(1);
      });

      expect(result.current.state.queue).toHaveLength(2);
      expect(result.current.state.queue[0].id).toBe('q-1');
      expect(result.current.state.queue[1].id).toBe('q-3');
    });

    it('clearQueue() empties the queue', () => {
      const tracks = createMockPlaylist(3);
      const { result } = renderHook(() => usePlaylist({ tracks }));

      act(() => {
        result.current.controls.addToQueue(createMockTrack({ id: 'q-1' }));
        result.current.controls.addToQueue(createMockTrack({ id: 'q-2' }));
      });

      act(() => {
        result.current.controls.clearQueue();
      });

      expect(result.current.state.queue).toEqual([]);
    });
  });

  // ─── History ───────────────────────────────────────────────────────

  describe('history', () => {
    it('next() adds current track to history', () => {
      const tracks = createMockPlaylist(3);
      const { result } = renderHook(() => usePlaylist({ tracks }));

      act(() => {
        result.current.controls.next();
      });

      expect(result.current.state.history).toHaveLength(1);
      expect(result.current.state.history[0]).toEqual(tracks[0]);
    });

    it('goToTrack() adds current track to history', () => {
      const tracks = createMockPlaylist(5);
      const { result } = renderHook(() => usePlaylist({ tracks }));

      act(() => {
        result.current.controls.goToTrack(3);
      });

      expect(result.current.state.history).toHaveLength(1);
      expect(result.current.state.history[0]).toEqual(tracks[0]);
    });

    it('previous() navigates back through history', () => {
      const tracks = createMockPlaylist(5);
      const onTrackChange = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks, onTrackChange })
      );

      // Navigate forward: 0 -> 1 -> 2
      act(() => {
        result.current.controls.next();
      });
      act(() => {
        result.current.controls.next();
      });

      expect(result.current.state.currentIndex).toBe(2);
      expect(result.current.state.history).toHaveLength(2);

      // Navigate back: 2 -> 1
      act(() => {
        result.current.controls.previous();
      });

      expect(result.current.state.currentIndex).toBe(1);
      expect(result.current.state.history).toHaveLength(1);
    });

    it('previous() pops from history before sequential navigation', () => {
      const tracks = createMockPlaylist(5);
      const onTrackChange = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks, onTrackChange })
      );

      // Navigate: 0 -> 3 (skip ahead via goToTrack)
      act(() => {
        result.current.controls.goToTrack(3);
      });

      // previous() should go back to 0 (from history), not to 2
      act(() => {
        result.current.controls.previous();
      });

      expect(result.current.state.currentIndex).toBe(0);
    });

    it('multiple forward and back navigations build correct history', () => {
      const tracks = createMockPlaylist(5);
      const { result } = renderHook(() => usePlaylist({ tracks }));

      // 0 -> 1 -> 2 -> 3
      act(() => result.current.controls.next());
      act(() => result.current.controls.next());
      act(() => result.current.controls.next());

      expect(result.current.state.history).toHaveLength(3);
      expect(result.current.state.currentIndex).toBe(3);

      // Back: 3 -> 2
      act(() => result.current.controls.previous());
      expect(result.current.state.currentIndex).toBe(2);
      expect(result.current.state.history).toHaveLength(2);

      // Back: 2 -> 1
      act(() => result.current.controls.previous());
      expect(result.current.state.currentIndex).toBe(1);
      expect(result.current.state.history).toHaveLength(1);

      // Back: 1 -> 0
      act(() => result.current.controls.previous());
      expect(result.current.state.currentIndex).toBe(0);
      expect(result.current.state.history).toHaveLength(0);
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty playlist gracefully', () => {
      const onTrackChange = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks: [], onTrackChange })
      );

      expect(result.current.state.currentTrack).toBeNull();

      act(() => {
        result.current.controls.next();
      });

      expect(result.current.state.currentTrack).toBeNull();
    });

    it('handles single track playlist', () => {
      const tracks = [createMockTrack({ id: 'only-track' })];
      const onQueueEnd = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks, onQueueEnd })
      );

      expect(result.current.state.currentTrack?.id).toBe('only-track');

      act(() => {
        result.current.controls.next();
      });

      expect(onQueueEnd).toHaveBeenCalledTimes(1);
    });

    it('single track with repeat one keeps playing same track', () => {
      const tracks = [createMockTrack({ id: 'only-track' })];
      const onTrackChange = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks, repeat: 'one', onTrackChange })
      );

      act(() => {
        result.current.controls.next();
      });

      expect(result.current.state.currentTrack?.id).toBe('only-track');
      expect(onTrackChange).toHaveBeenCalledWith(tracks[0], 0);
    });

    it('single track with repeat all wraps to same track', () => {
      const tracks = [createMockTrack({ id: 'only-track' })];
      const onTrackChange = vi.fn();
      const { result } = renderHook(() =>
        usePlaylist({ tracks, repeat: 'all', onTrackChange })
      );

      act(() => {
        result.current.controls.next();
      });

      expect(result.current.state.currentIndex).toBe(0);
      expect(onTrackChange).toHaveBeenCalledWith(tracks[0], 0);
    });

    it('queue track not found in tracks array does not crash', () => {
      const tracks = createMockPlaylist(3);
      const unknownTrack = createMockTrack({ id: 'unknown-id' });
      const { result } = renderHook(() => usePlaylist({ tracks }));

      act(() => {
        result.current.controls.addToQueue(unknownTrack);
      });

      // next() consumes from queue but findIndex returns -1
      act(() => {
        result.current.controls.next();
      });

      // Should not throw; queue is consumed
      expect(result.current.state.queue).toHaveLength(0);
    });
  });
});
