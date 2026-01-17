import { cn, formatTime } from '@/utils';
import { NowPlayingIndicator } from '@/components/controls/NowPlayingIndicator';
import { PlayButton } from '@/components/controls/PlayButton';
import type { EpisodeItemProps } from '@/types/podcast';
import { formatEpisodeDate, formatEpisodeNumber } from '@/types/podcast';

/**
 * Single episode item in the episode list
 * Enhanced version of TrackItem with description and publication date
 */
export function EpisodeItem({
  episode,
  index,
  isActive = false,
  isPlaying = false,
  onClick,
  showNumber = true,
  className,
}: EpisodeItemProps) {
  const episodeLabel = formatEpisodeNumber(episode);
  const dateLabel = formatEpisodeDate(episode.publishedAt);

  return (
    <button
      type="button"
      onClick={() => onClick?.(episode, index)}
      className={cn(
        'w-full flex items-start gap-4 p-4 rounded-lg',
        'text-left transition-all group',
        'hover:bg-[var(--fp-color-surface)]',
        isActive && 'bg-[var(--fp-color-surface)]',
        className
      )}
      aria-current={isActive ? 'true' : undefined}
    >
      {/* Artwork */}
      {episode.artwork && (
        <div className="relative flex-shrink-0">
          <img
            src={episode.artwork}
            alt=""
            className="w-16 h-16 rounded-lg object-cover"
          />
          {/* Play button overlay on hover */}
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              'bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity',
              isActive && isPlaying && 'opacity-100'
            )}
          >
            {isActive && isPlaying ? (
              <NowPlayingIndicator isPlaying={isPlaying} size="md" bars={3} />
            ) : (
              <PlayButton
                isPlaying={false}
                onClick={() => onClick?.(episode, index)}
                size="sm"
                className="bg-white/20 hover:bg-white/30"
              />
            )}
          </div>
        </div>
      )}

      {/* Episode info */}
      <div className="flex-1 min-w-0">
        {/* Episode number and date */}
        <div className="flex items-center gap-2 text-xs text-[var(--fp-color-text-muted)] mb-1">
          {showNumber && episodeLabel && <span>{episodeLabel}</span>}
          {showNumber && episodeLabel && dateLabel && <span>-</span>}
          {dateLabel && <span>{dateLabel}</span>}
        </div>

        {/* Title */}
        <h4
          className={cn(
            'text-sm font-medium truncate mb-1',
            isActive
              ? 'text-[var(--fp-color-primary)]'
              : 'text-[var(--fp-color-text)]'
          )}
        >
          {episode.title || 'Untitled Episode'}
        </h4>

        {/* Description */}
        {episode.description && (
          <p className="text-xs text-[var(--fp-color-text-muted)] line-clamp-2">
            {episode.description}
          </p>
        )}
      </div>

      {/* Duration */}
      {episode.duration && (
        <div className="flex-shrink-0 text-right">
          <span className="text-sm text-[var(--fp-color-text-muted)]">
            {formatTime(episode.duration)}
          </span>
        </div>
      )}
    </button>
  );
}

export default EpisodeItem;
