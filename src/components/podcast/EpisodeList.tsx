import { cn } from '@/utils';
import { EpisodeItem } from './EpisodeItem';
import type { EpisodeListProps, EpisodeSortOrder } from '@/types/podcast';

/**
 * Sort order options
 */
const sortOptions: { value: EpisodeSortOrder; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'popular', label: 'Popular' },
];

/**
 * Episode list component with sorting
 */
export function EpisodeList({
  episodes,
  currentIndex = -1,
  isPlaying = false,
  sortOrder = 'newest',
  onEpisodeClick,
  onSortChange,
  maxHeight = '600px',
  className,
}: EpisodeListProps) {
  if (episodes.length === 0) {
    return (
      <div className={cn('text-center py-8 text-[var(--fp-color-text-muted)]', className)}>
        No episodes available
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--fp-color-text)]">
          Episodes ({episodes.length})
        </h3>

        {/* Sort dropdown */}
        {onSortChange && (
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(e) => onSortChange(e.target.value as EpisodeSortOrder)}
              className={cn(
                'appearance-none bg-[var(--fp-color-surface)] text-[var(--fp-color-text)]',
                'text-sm px-3 py-1.5 pr-8 rounded-lg border border-[var(--fp-glass-border)]',
                'cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--fp-color-primary)]'
              )}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {/* Dropdown arrow */}
            <svg
              className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fp-color-text-muted)] pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}
      </div>

      {/* Episode list */}
      <div
        className="flex flex-col gap-1 overflow-y-auto"
        style={{ maxHeight }}
        role="list"
        aria-label="Episodes"
      >
        {episodes.map((episode, index) => (
          <EpisodeItem
            key={episode.id}
            episode={episode}
            index={index}
            isActive={index === currentIndex}
            isPlaying={index === currentIndex && isPlaying}
            onClick={onEpisodeClick}
          />
        ))}
      </div>
    </div>
  );
}

export default EpisodeList;
