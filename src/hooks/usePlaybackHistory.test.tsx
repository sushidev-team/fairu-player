/**
 * "Continue watching", on the React side.
 *
 * `src/core/playbackHistory.test.ts` covers the rules. What matters here is the
 * thing the ported version got wrong: two components sharing one history. A
 * resume row and the player writing to it are never the same component, and a
 * per-instance copy leaves them disagreeing.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  usePlaybackHistory,
  resetPlaybackHistoryStores,
} from './usePlaybackHistory';
import { clearStored, resetStorageAvailability } from '@/utils/storage';
import type { PlaybackRecord } from '@/core/playbackHistory';

function played(over: Partial<PlaybackRecord> = {}): PlaybackRecord {
  return {
    trackId: 't1',
    title: 'Folge 1',
    lastPosition: 30,
    duration: 300,
    progress: 10,
    completed: false,
    ...over,
  };
}

beforeEach(() => {
  clearStored();
  resetStorageAvailability();
  resetPlaybackHistoryStores();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePlaybackHistory', () => {
  describe('recording', () => {
    it('starts empty', () => {
      const { result } = renderHook(() => usePlaybackHistory());

      expect(result.current.entries).toEqual([]);
      expect(result.current.count).toBe(0);
    });

    it('remembers a play', () => {
      const { result } = renderHook(() => usePlaybackHistory());

      act(() => result.current.recordPlay(played()));

      expect(result.current.count).toBe(1);
      expect(result.current.entries[0]).toMatchObject({ trackId: 't1', playCount: 1 });
    });

    it('bumps a repeat rather than adding a row', () => {
      const { result } = renderHook(() => usePlaybackHistory());

      act(() => result.current.recordPlay(played()));
      act(() => result.current.recordPlay(played({ lastPosition: 120 })));

      expect(result.current.count).toBe(1);
      expect(result.current.entries[0]).toMatchObject({ playCount: 2, lastPosition: 120 });
    });

    it('answers whether something was played', () => {
      const { result } = renderHook(() => usePlaybackHistory());

      act(() => result.current.recordPlay(played()));

      expect(result.current.isPlayed('t1')).toBe(true);
      expect(result.current.isPlayed('t2')).toBe(false);
      expect(result.current.getEntry('t1')?.title).toBe('Folge 1');
    });

    it('offers what was started and not finished', () => {
      const { result } = renderHook(() => usePlaybackHistory());

      act(() => result.current.recordPlay(played({ trackId: 'a', progress: 40 })));
      act(() =>
        result.current.recordPlay(
          played({ trackId: 'b', progress: 100, completed: true })
        )
      );

      expect(result.current.resumable.map((e) => e.trackId)).toEqual(['a']);
    });
  });

  describe('two components, one history', () => {
    it('shows a play recorded elsewhere', () => {
      const player = renderHook(() => usePlaybackHistory());
      const resumeRow = renderHook(() => usePlaybackHistory());

      act(() => player.result.current.recordPlay(played({ progress: 40 })));

      // The row and the player are never the same component. A per-instance
      // copy would leave this one showing an empty list.
      expect(resumeRow.result.current.count).toBe(1);
      expect(resumeRow.result.current.resumable).toHaveLength(1);
    });

    it('shows a removal made elsewhere', () => {
      const a = renderHook(() => usePlaybackHistory());
      const b = renderHook(() => usePlaybackHistory());

      act(() => a.result.current.recordPlay(played()));
      act(() => b.result.current.remove('t1'));

      expect(a.result.current.count).toBe(0);
    });

    it('picks up a write from another tab', () => {
      const { result } = renderHook(() => usePlaybackHistory());
      act(() => result.current.recordPlay(played()));

      // Another tab replaced the stored list.
      localStorage.setItem(
        'fairu-player:playback-history',
        JSON.stringify({
          v: 1,
          t: Date.now(),
          d: [{ trackId: 'from-other-tab', lastPlayedAt: Date.now(), duration: 10, progress: 5 }],
        })
      );
      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', { key: 'fairu-player:playback-history' })
        );
      });

      // Otherwise two open tabs keep separate histories and the last write wins
      // without anybody noticing.
      expect(result.current.entries.map((e) => e.trackId)).toEqual(['from-other-tab']);
    });
  });

  describe('persistence', () => {
    it('survives a reload', () => {
      const first = renderHook(() => usePlaybackHistory());
      act(() => first.result.current.recordPlay(played()));
      first.unmount();
      resetPlaybackHistoryStores();

      const second = renderHook(() => usePlaybackHistory());

      expect(second.result.current.entries[0]?.trackId).toBe('t1');
    });

    it('ignores a stored list from an older schema', () => {
      localStorage.setItem(
        'fairu-player:playback-history',
        JSON.stringify({ v: 1, t: Date.now(), d: [{ id: 't1', watched: true }] })
      );

      const { result } = renderHook(() => usePlaybackHistory());

      // No id and no timestamp — it would render as a row that resumes nothing.
      expect(result.current.entries).toEqual([]);
    });

    it('forgets everything on request', () => {
      const { result } = renderHook(() => usePlaybackHistory());
      act(() => result.current.recordPlay(played()));

      act(() => result.current.clear());

      expect(result.current.count).toBe(0);
      expect(localStorage.getItem('fairu-player:playback-history')).toBeNull();
    });
  });

  describe('switched off', () => {
    it('reports nothing and records nothing', () => {
      const { result } = renderHook(() => usePlaybackHistory({ enabled: false }));

      act(() => result.current.recordPlay(played()));

      expect(result.current.count).toBe(0);
      expect(localStorage.getItem('fairu-player:playback-history')).toBeNull();
    });

    it('still lets the viewer forget', () => {
      const on = renderHook(() => usePlaybackHistory());
      act(() => on.result.current.recordPlay(played()));

      const off = renderHook(() => usePlaybackHistory({ enabled: false }));
      act(() => off.result.current.clear());

      // Forgetting is the one thing that must work whatever the host switched
      // off.
      expect(on.result.current.count).toBe(0);
    });
  });
});
