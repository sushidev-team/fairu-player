import type { Chapter } from './player';

export interface ChapterState {
  chapters: Chapter[];
  currentChapter: Chapter | null;
  currentChapterIndex: number;
}

export interface ChapterControls {
  goToChapter: (index: number) => void;
  nextChapter: () => void;
  previousChapter: () => void;
}

export interface ChapterMarkerProps {
  chapter: Chapter;
  duration: number;
  isActive?: boolean;
  onClick?: (chapter: Chapter) => void;
}

export interface ChapterListProps {
  chapters: Chapter[];
  currentChapterIndex: number;
  currentTime: number;
  onChapterClick?: (chapter: Chapter, index: number) => void;
  showDuration?: boolean;
  showImage?: boolean;
}

export interface UseChaptersOptions {
  chapters: Chapter[];
  currentTime: number;
  onChapterChange?: (chapter: Chapter, index: number) => void;
}

export interface UseChaptersReturn extends ChapterState, ChapterControls {}
