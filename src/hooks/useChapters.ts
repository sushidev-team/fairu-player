import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChapterState, ChapterControls, UseChaptersOptions, UseChaptersReturn } from '@/types/chapters';

export function useChapters(options: UseChaptersOptions): UseChaptersReturn {
  const { chapters, currentTime, onChapterChange } = options;

  const [currentChapterIndex, setCurrentChapterIndex] = useState(-1);

  // Find current chapter based on time
  const currentChapter = useMemo(() => {
    if (chapters.length === 0) return null;

    for (let i = chapters.length - 1; i >= 0; i--) {
      const chapter = chapters[i];
      if (currentTime >= chapter.startTime) {
        return chapter;
      }
    }

    return null;
  }, [chapters, currentTime]);

  // Update current chapter index when chapter changes
  useEffect(() => {
    if (!currentChapter) {
      if (currentChapterIndex !== -1) {
        setCurrentChapterIndex(-1);
      }
      return;
    }

    const newIndex = chapters.findIndex((c) => c.id === currentChapter.id);
    if (newIndex !== currentChapterIndex) {
      setCurrentChapterIndex(newIndex);
      onChapterChange?.(currentChapter, newIndex);
    }
  }, [currentChapter, chapters, currentChapterIndex, onChapterChange]);

  // Go to specific chapter
  const goToChapter = useCallback((index: number) => {
    if (index < 0 || index >= chapters.length) return;
    const chapter = chapters[index];
    // The actual seeking will be handled by the parent component
    // This just triggers the change
    onChapterChange?.(chapter, index);
  }, [chapters, onChapterChange]);

  // Next chapter
  const nextChapter = useCallback(() => {
    const nextIndex = currentChapterIndex + 1;
    if (nextIndex < chapters.length) {
      goToChapter(nextIndex);
    }
  }, [currentChapterIndex, chapters.length, goToChapter]);

  // Previous chapter
  const previousChapter = useCallback(() => {
    const prevIndex = currentChapterIndex - 1;
    if (prevIndex >= 0) {
      goToChapter(prevIndex);
    }
  }, [currentChapterIndex, goToChapter]);

  const state: ChapterState = {
    chapters,
    currentChapter,
    currentChapterIndex,
  };

  const controls: ChapterControls = {
    goToChapter,
    nextChapter,
    previousChapter,
  };

  return {
    ...state,
    ...controls,
  };
}
