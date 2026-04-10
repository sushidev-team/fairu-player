import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChapters } from './useChapters';
import { createMockChapters } from '@/test/helpers';
import type { Chapter } from '@/types/player';

describe('useChapters', () => {
  const chapters = createMockChapters();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Initial State ──────────────────────────────────────────────────

  describe('initial state', () => {
    it('returns chapters as provided', () => {
      const { result } = renderHook(() =>
        useChapters({ chapters, currentTime: 0 })
      );

      expect(result.current.chapters).toEqual(chapters);
    });

    it('sets currentChapter to first chapter when time is 0', () => {
      const { result } = renderHook(() =>
        useChapters({ chapters, currentTime: 0 })
      );

      expect(result.current.currentChapter).toEqual(chapters[0]);
      expect(result.current.currentChapterIndex).toBe(0);
    });

    it('returns null currentChapter when chapters array is empty', () => {
      const { result } = renderHook(() =>
        useChapters({ chapters: [], currentTime: 0 })
      );

      expect(result.current.currentChapter).toBeNull();
      expect(result.current.currentChapterIndex).toBe(-1);
    });
  });

  // ─── Current Chapter Detection ─────────────────────────────────────

  describe('current chapter detection', () => {
    it('detects first chapter at time 0', () => {
      const { result } = renderHook(() =>
        useChapters({ chapters, currentTime: 0 })
      );

      expect(result.current.currentChapter?.id).toBe('ch-1');
      expect(result.current.currentChapterIndex).toBe(0);
    });

    it('detects first chapter within its range', () => {
      const { result } = renderHook(() =>
        useChapters({ chapters, currentTime: 15 })
      );

      expect(result.current.currentChapter?.id).toBe('ch-1');
    });

    it('detects second chapter at its start time', () => {
      const { result } = renderHook(() =>
        useChapters({ chapters, currentTime: 30 })
      );

      expect(result.current.currentChapter?.id).toBe('ch-2');
      expect(result.current.currentChapterIndex).toBe(1);
    });

    it('detects second chapter in the middle of its range', () => {
      const { result } = renderHook(() =>
        useChapters({ chapters, currentTime: 75 })
      );

      expect(result.current.currentChapter?.id).toBe('ch-2');
    });

    it('detects third chapter at its start time', () => {
      const { result } = renderHook(() =>
        useChapters({ chapters, currentTime: 120 })
      );

      expect(result.current.currentChapter?.id).toBe('ch-3');
      expect(result.current.currentChapterIndex).toBe(2);
    });

    it('detects last chapter near the end', () => {
      const { result } = renderHook(() =>
        useChapters({ chapters, currentTime: 175 })
      );

      expect(result.current.currentChapter?.id).toBe('ch-3');
    });

    it('updates currentChapter when time changes across chapters', () => {
      const onChapterChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ currentTime }) =>
          useChapters({ chapters, currentTime, onChapterChange }),
        { initialProps: { currentTime: 10 } }
      );

      expect(result.current.currentChapter?.id).toBe('ch-1');

      rerender({ currentTime: 50 });

      expect(result.current.currentChapter?.id).toBe('ch-2');
      expect(onChapterChange).toHaveBeenCalledWith(chapters[1], 1);
    });

    it('does not call onChapterChange when staying in same chapter', () => {
      const onChapterChange = vi.fn();
      const { rerender } = renderHook(
        ({ currentTime }) =>
          useChapters({ chapters, currentTime, onChapterChange }),
        { initialProps: { currentTime: 10 } }
      );

      // Initial chapter detection triggers once
      const initialCalls = onChapterChange.mock.calls.length;

      rerender({ currentTime: 20 });

      // Should not have been called again (still in chapter 1)
      expect(onChapterChange.mock.calls.length).toBe(initialCalls);
    });

    it('returns null when currentTime is before all chapters', () => {
      const laterChapters: Chapter[] = [
        { id: 'ch-1', title: 'Chapter 1', startTime: 10, endTime: 30 },
        { id: 'ch-2', title: 'Chapter 2', startTime: 30, endTime: 60 },
      ];

      const { result } = renderHook(() =>
        useChapters({ chapters: laterChapters, currentTime: 5 })
      );

      expect(result.current.currentChapter).toBeNull();
      expect(result.current.currentChapterIndex).toBe(-1);
    });
  });

  // ─── Navigation Controls ───────────────────────────────────────────

  describe('navigation controls', () => {
    it('goToChapter() calls onChapterChange with the chapter and index', () => {
      const onChapterChange = vi.fn();
      const { result } = renderHook(() =>
        useChapters({ chapters, currentTime: 0, onChapterChange })
      );

      result.current.goToChapter(2);

      expect(onChapterChange).toHaveBeenCalledWith(chapters[2], 2);
    });

    it('goToChapter() does nothing for negative index', () => {
      const onChapterChange = vi.fn();
      const { result } = renderHook(() =>
        useChapters({ chapters, currentTime: 0, onChapterChange })
      );

      // Clear any initial calls
      onChapterChange.mockClear();

      result.current.goToChapter(-1);

      expect(onChapterChange).not.toHaveBeenCalled();
    });

    it('goToChapter() does nothing for out-of-range index', () => {
      const onChapterChange = vi.fn();
      const { result } = renderHook(() =>
        useChapters({ chapters, currentTime: 0, onChapterChange })
      );

      onChapterChange.mockClear();

      result.current.goToChapter(10);

      expect(onChapterChange).not.toHaveBeenCalled();
    });

    it('nextChapter() goes to the next chapter', () => {
      const onChapterChange = vi.fn();
      const { result } = renderHook(() =>
        useChapters({ chapters, currentTime: 10, onChapterChange })
      );

      // Currently in chapter 0
      onChapterChange.mockClear();

      result.current.nextChapter();

      expect(onChapterChange).toHaveBeenCalledWith(chapters[1], 1);
    });

    it('nextChapter() does nothing when at the last chapter', () => {
      const onChapterChange = vi.fn();
      const { result } = renderHook(() =>
        useChapters({ chapters, currentTime: 150, onChapterChange })
      );

      // Currently in last chapter (index 2)
      onChapterChange.mockClear();

      result.current.nextChapter();

      expect(onChapterChange).not.toHaveBeenCalled();
    });

    it('previousChapter() goes to the previous chapter', () => {
      const onChapterChange = vi.fn();
      const { result } = renderHook(() =>
        useChapters({ chapters, currentTime: 50, onChapterChange })
      );

      // Currently in chapter 1
      onChapterChange.mockClear();

      result.current.previousChapter();

      expect(onChapterChange).toHaveBeenCalledWith(chapters[0], 0);
    });

    it('previousChapter() does nothing when at the first chapter', () => {
      const onChapterChange = vi.fn();
      const { result } = renderHook(() =>
        useChapters({ chapters, currentTime: 10, onChapterChange })
      );

      // Currently in chapter 0
      onChapterChange.mockClear();

      result.current.previousChapter();

      expect(onChapterChange).not.toHaveBeenCalled();
    });
  });

  // ─── Chapter Change Callback ───────────────────────────────────────

  describe('chapter change callback', () => {
    it('calls onChapterChange on initial render for the first chapter', () => {
      const onChapterChange = vi.fn();
      renderHook(() =>
        useChapters({ chapters, currentTime: 0, onChapterChange })
      );

      expect(onChapterChange).toHaveBeenCalledWith(chapters[0], 0);
    });

    it('calls onChapterChange each time chapter transitions', () => {
      const onChapterChange = vi.fn();
      const { rerender } = renderHook(
        ({ currentTime }) =>
          useChapters({ chapters, currentTime, onChapterChange }),
        { initialProps: { currentTime: 0 } }
      );

      onChapterChange.mockClear();

      // Move to chapter 2
      rerender({ currentTime: 31 });
      expect(onChapterChange).toHaveBeenCalledWith(chapters[1], 1);

      onChapterChange.mockClear();

      // Move to chapter 3
      rerender({ currentTime: 121 });
      expect(onChapterChange).toHaveBeenCalledWith(chapters[2], 2);
    });

    it('works without onChapterChange callback', () => {
      const { result, rerender } = renderHook(
        ({ currentTime }) =>
          useChapters({ chapters, currentTime }),
        { initialProps: { currentTime: 0 } }
      );

      // Should not throw
      rerender({ currentTime: 50 });

      expect(result.current.currentChapter?.id).toBe('ch-2');
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles chapters with no endTime', () => {
      const openChapters: Chapter[] = [
        { id: 'ch-1', title: 'First', startTime: 0 },
        { id: 'ch-2', title: 'Second', startTime: 60 },
      ];

      const { result } = renderHook(() =>
        useChapters({ chapters: openChapters, currentTime: 30 })
      );

      expect(result.current.currentChapter?.id).toBe('ch-1');
    });

    it('handles single chapter', () => {
      const singleChapter: Chapter[] = [
        { id: 'ch-1', title: 'Only Chapter', startTime: 0, endTime: 300 },
      ];

      const { result } = renderHook(() =>
        useChapters({ chapters: singleChapter, currentTime: 150 })
      );

      expect(result.current.currentChapter?.id).toBe('ch-1');
      expect(result.current.currentChapterIndex).toBe(0);
    });

    it('handles time exactly at chapter boundary', () => {
      const { result } = renderHook(() =>
        useChapters({ chapters, currentTime: 30 })
      );

      // At startTime 30, chapter 2 should be active
      expect(result.current.currentChapter?.id).toBe('ch-2');
    });

    it('handles chapters with images', () => {
      const chaptersWithImages: Chapter[] = [
        { id: 'ch-1', title: 'Intro', startTime: 0, endTime: 30, image: 'intro.jpg' },
        { id: 'ch-2', title: 'Main', startTime: 30, endTime: 120, image: 'main.jpg' },
      ];

      const { result } = renderHook(() =>
        useChapters({ chapters: chaptersWithImages, currentTime: 40 })
      );

      expect(result.current.currentChapter?.image).toBe('main.jpg');
    });
  });
});
