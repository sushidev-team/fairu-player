import { cn, formatTime } from '@/utils';
import type { Chapter } from '@/types/player';

export interface ChapterListProps {
  chapters: Chapter[];
  currentChapterIndex: number;
  currentTime: number;
  duration: number;
  onChapterClick?: (chapter: Chapter, index: number) => void;
  showDuration?: boolean;
  showImage?: boolean;
  className?: string;
}

export function ChapterList({
  chapters,
  currentChapterIndex,
  currentTime: _currentTime,
  duration,
  onChapterClick,
  showDuration = true,
  showImage = true,
  className,
}: ChapterListProps) {
  if (chapters.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <h3 className="text-sm font-semibold mb-2 text-[var(--fp-color-text)]">
        Chapters
      </h3>
      <ul className="flex flex-col gap-1" role="list" aria-label="Chapter list">
        {chapters.map((chapter, index) => {
          const isActive = index === currentChapterIndex;
          const chapterDuration = getChapterDuration(chapter, index, chapters, duration);

          return (
            <li key={chapter.id}>
              <button
                type="button"
                onClick={() => onChapterClick?.(chapter, index)}
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded-lg',
                  'text-left transition-colors',
                  'hover:bg-[var(--fp-color-surface)]',
                  isActive && 'bg-[var(--fp-color-surface)]'
                )}
                aria-current={isActive ? 'true' : undefined}
              >
                {showImage && chapter.image && (
                  <img
                    src={chapter.image}
                    alt=""
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-[var(--fp-color-primary)] flex-shrink-0" />
                    )}
                    <span
                      className={cn(
                        'text-sm truncate',
                        isActive
                          ? 'font-medium text-[var(--fp-color-primary)]'
                          : 'text-[var(--fp-color-text)]'
                      )}
                    >
                      {chapter.title}
                    </span>
                  </div>

                  {showDuration && (
                    <div className="flex items-center gap-2 text-xs text-[var(--fp-color-text-muted)]">
                      <span>{formatTime(chapter.startTime)}</span>
                      {chapterDuration > 0 && (
                        <>
                          <span>·</span>
                          <span>{formatTime(chapterDuration)}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function getChapterDuration(
  chapter: Chapter,
  index: number,
  chapters: Chapter[],
  totalDuration: number
): number {
  if (chapter.endTime) {
    return chapter.endTime - chapter.startTime;
  }

  const nextChapter = chapters[index + 1];
  if (nextChapter) {
    return nextChapter.startTime - chapter.startTime;
  }

  return totalDuration - chapter.startTime;
}
