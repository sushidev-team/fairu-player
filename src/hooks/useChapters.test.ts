import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useChapters } from './useChapters';
import type { Chapter } from '@/types/player';

const CHAPTERS: Chapter[] = [
  { id: 'c1', title: 'Intro', startTime: 0, endTime: 60 },
  { id: 'c2', title: 'Hauptteil', startTime: 60, endTime: 180 },
  { id: 'c3', title: 'Outro', startTime: 180, endTime: 240 },
];

describe('useChapters', () => {
  describe('resolving the current chapter', () => {
    it.each([
      [0, 'c1'],
      [30, 'c1'],
      [59.9, 'c1'],
      [60, 'c2'],
      [120, 'c2'],
      [180, 'c3'],
      [300, 'c3'],
    ])('at %ss the chapter is %s', (currentTime, expected) => {
      const { result } = renderHook(() => useChapters({ chapters: CHAPTERS, currentTime }));
      expect(result.current.currentChapter?.id).toBe(expected);
    });

    it('claims a chapter exactly at its start time', () => {
      // The boundary belongs to the chapter that begins there, not the one
      // that ended.
      const { result } = renderHook(() => useChapters({ chapters: CHAPTERS, currentTime: 60 }));
      expect(result.current.currentChapter?.id).toBe('c2');
    });

    it('holds the last chapter past the final endTime', () => {
      // Media routinely runs a beat past the last chapter's end; falling back
      // to "no chapter" there would blank the label at the very end.
      const { result } = renderHook(() => useChapters({ chapters: CHAPTERS, currentTime: 9999 }));
      expect(result.current.currentChapter?.id).toBe('c3');
    });

    it('has no chapter before the first one starts', () => {
      const late: Chapter[] = [{ id: 'x', title: 'Later', startTime: 30 }];
      const { result } = renderHook(() => useChapters({ chapters: late, currentTime: 10 }));

      expect(result.current.currentChapter).toBeNull();
      expect(result.current.currentChapterIndex).toBe(-1);
    });

    it('has no chapter for an empty list', () => {
      const { result } = renderHook(() => useChapters({ chapters: [], currentTime: 50 }));
      expect(result.current.currentChapter).toBeNull();
    });

    it('exposes the chapters it was given', () => {
      const { result } = renderHook(() => useChapters({ chapters: CHAPTERS, currentTime: 0 }));
      expect(result.current.chapters).toEqual(CHAPTERS);
    });

    it('tracks the index alongside the chapter', () => {
      const { result } = renderHook(() => useChapters({ chapters: CHAPTERS, currentTime: 120 }));
      expect(result.current.currentChapterIndex).toBe(1);
    });
  });

  describe('onChapterChange', () => {
    it('fires when playback crosses into a new chapter', () => {
      const onChapterChange = vi.fn();
      const { rerender } = renderHook(
        ({ currentTime }) => useChapters({ chapters: CHAPTERS, currentTime, onChapterChange }),
        { initialProps: { currentTime: 10 } }
      );

      onChapterChange.mockClear();
      rerender({ currentTime: 70 });

      expect(onChapterChange).toHaveBeenCalledWith(CHAPTERS[1], 1);
    });

    it('does not fire while time advances inside one chapter', () => {
      const onChapterChange = vi.fn();
      const { rerender } = renderHook(
        ({ currentTime }) => useChapters({ chapters: CHAPTERS, currentTime, onChapterChange }),
        { initialProps: { currentTime: 10 } }
      );

      onChapterChange.mockClear();
      rerender({ currentTime: 20 });
      rerender({ currentTime: 30 });
      rerender({ currentTime: 59 });

      expect(onChapterChange).not.toHaveBeenCalled();
    });

    it('fires when seeking backwards into an earlier chapter', () => {
      const onChapterChange = vi.fn();
      const { rerender } = renderHook(
        ({ currentTime }) => useChapters({ chapters: CHAPTERS, currentTime, onChapterChange }),
        { initialProps: { currentTime: 200 } }
      );

      onChapterChange.mockClear();
      rerender({ currentTime: 10 });

      expect(onChapterChange).toHaveBeenCalledWith(CHAPTERS[0], 0);
    });

    it('is optional', () => {
      expect(() => {
        const { rerender } = renderHook(
          ({ currentTime }) => useChapters({ chapters: CHAPTERS, currentTime }),
          { initialProps: { currentTime: 10 } }
        );
        rerender({ currentTime: 100 });
      }).not.toThrow();
    });
  });

  describe('goToChapter', () => {
    it('reports the requested chapter', () => {
      const onChapterChange = vi.fn();
      const { result } = renderHook(() =>
        useChapters({ chapters: CHAPTERS, currentTime: 0, onChapterChange })
      );

      onChapterChange.mockClear();
      act(() => result.current.goToChapter(2));

      expect(onChapterChange).toHaveBeenCalledWith(CHAPTERS[2], 2);
    });

    it('ignores a negative index', () => {
      const onChapterChange = vi.fn();
      const { result } = renderHook(() =>
        useChapters({ chapters: CHAPTERS, currentTime: 0, onChapterChange })
      );

      onChapterChange.mockClear();
      act(() => result.current.goToChapter(-1));

      expect(onChapterChange).not.toHaveBeenCalled();
    });

    it('ignores an index past the end', () => {
      const onChapterChange = vi.fn();
      const { result } = renderHook(() =>
        useChapters({ chapters: CHAPTERS, currentTime: 0, onChapterChange })
      );

      onChapterChange.mockClear();
      act(() => result.current.goToChapter(99));

      expect(onChapterChange).not.toHaveBeenCalled();
    });

    it('does not itself seek — the caller owns the playhead', () => {
      // The hook only announces the target; the player component performs the
      // seek, which is why currentTime is an input and never an output.
      const { result, rerender } = renderHook(
        ({ currentTime }) => useChapters({ chapters: CHAPTERS, currentTime }),
        { initialProps: { currentTime: 0 } }
      );

      act(() => result.current.goToChapter(2));
      rerender({ currentTime: 0 });

      expect(result.current.currentChapter?.id).toBe('c1');
    });
  });

  describe('nextChapter', () => {
    it('advances one chapter', () => {
      const onChapterChange = vi.fn();
      const { result } = renderHook(() =>
        useChapters({ chapters: CHAPTERS, currentTime: 0, onChapterChange })
      );

      onChapterChange.mockClear();
      act(() => result.current.nextChapter());

      expect(onChapterChange).toHaveBeenCalledWith(CHAPTERS[1], 1);
    });

    it('does nothing at the last chapter', () => {
      const onChapterChange = vi.fn();
      const { result } = renderHook(() =>
        useChapters({ chapters: CHAPTERS, currentTime: 200, onChapterChange })
      );

      onChapterChange.mockClear();
      act(() => result.current.nextChapter());

      expect(onChapterChange).not.toHaveBeenCalled();
    });

    it('moves to the first chapter when none is current yet', () => {
      // Index is -1 before the first chapter starts, so next lands on 0.
      const late: Chapter[] = [
        { id: 'x', title: 'Later', startTime: 30 },
        { id: 'y', title: 'Even later', startTime: 60 },
      ];
      const onChapterChange = vi.fn();
      const { result } = renderHook(() =>
        useChapters({ chapters: late, currentTime: 0, onChapterChange })
      );

      onChapterChange.mockClear();
      act(() => result.current.nextChapter());

      expect(onChapterChange).toHaveBeenCalledWith(late[0], 0);
    });
  });

  describe('previousChapter', () => {
    it('steps back one chapter', () => {
      const onChapterChange = vi.fn();
      const { result } = renderHook(() =>
        useChapters({ chapters: CHAPTERS, currentTime: 200, onChapterChange })
      );

      onChapterChange.mockClear();
      act(() => result.current.previousChapter());

      expect(onChapterChange).toHaveBeenCalledWith(CHAPTERS[1], 1);
    });

    it('does nothing at the first chapter', () => {
      const onChapterChange = vi.fn();
      const { result } = renderHook(() =>
        useChapters({ chapters: CHAPTERS, currentTime: 10, onChapterChange })
      );

      onChapterChange.mockClear();
      act(() => result.current.previousChapter());

      expect(onChapterChange).not.toHaveBeenCalled();
    });
  });

  describe('changing the chapter list', () => {
    it('re-resolves against a new list', () => {
      const { result, rerender } = renderHook(
        ({ chapters }) => useChapters({ chapters, currentTime: 100 }),
        { initialProps: { chapters: CHAPTERS } }
      );

      expect(result.current.currentChapter?.id).toBe('c2');

      rerender({ chapters: [{ id: 'only', title: 'Only', startTime: 0 }] });

      expect(result.current.currentChapter?.id).toBe('only');
    });

    it('clears the current chapter when the list empties', () => {
      const { result, rerender } = renderHook(
        ({ chapters }) => useChapters({ chapters, currentTime: 100 }),
        { initialProps: { chapters: CHAPTERS } }
      );

      rerender({ chapters: [] });

      expect(result.current.currentChapter).toBeNull();
      expect(result.current.currentChapterIndex).toBe(-1);
    });
  });

  describe('unordered input', () => {
    it('resolves against the last matching entry in array order', () => {
      // Documents the actual contract: the scan runs from the end of the array,
      // so callers are expected to supply chapters sorted by startTime.
      const unsorted: Chapter[] = [
        { id: 'late', title: 'Late', startTime: 100 },
        { id: 'early', title: 'Early', startTime: 0 },
      ];
      const { result } = renderHook(() => useChapters({ chapters: unsorted, currentTime: 150 }));

      expect(result.current.currentChapter?.id).toBe('early');
    });
  });
});
