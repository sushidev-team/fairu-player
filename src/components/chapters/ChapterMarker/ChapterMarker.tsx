import { cn } from '@/utils';
import type { Chapter } from '@/types/player';

export interface ChapterMarkerProps {
  chapter: Chapter;
  duration: number;
  isActive?: boolean;
  onClick?: (chapter: Chapter) => void;
  className?: string;
}

export function ChapterMarker({
  chapter,
  duration,
  isActive = false,
  onClick,
  className,
}: ChapterMarkerProps) {
  const position = duration > 0 ? (chapter.startTime / duration) * 100 : 0;

  return (
    <button
      type="button"
      onClick={() => onClick?.(chapter)}
      aria-label={`Chapter: ${chapter.title}`}
      className={cn(
        'absolute top-0 h-full w-1',
        'transform -translate-x-1/2',
        'cursor-pointer transition-all',
        isActive
          ? 'bg-[var(--fp-color-primary)] z-10'
          : 'bg-[var(--fp-color-text)] opacity-40 hover:opacity-70',
        className
      )}
      style={{ left: `${position}%` }}
      title={chapter.title}
    />
  );
}
