import { cn, formatTime } from '@/utils';
import { PlayButton } from '@/components/controls/PlayButton';
import { ProgressBar } from '@/components/controls/ProgressBar';
import type { StickyPlayerProps } from '@/types/podcast';

/**
 * Compact sticky player that sits at the bottom of the page
 */
export function StickyPlayer({
  episode,
  isPlaying,
  isLoading = false,
  currentTime,
  duration,
  onTogglePlay,
  onSeek,
  onClose,
  className,
}: StickyPlayerProps) {
  if (!episode) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-[var(--fp-glass-bg)] backdrop-blur-xl',
        'border-t border-[var(--fp-glass-border)]',
        'shadow-[0_-4px_20px_rgba(0,0,0,0.3)]',
        className
      )}
    >
      {/* Progress bar at top of sticky player */}
      <div className="h-1">
        <ProgressBar
          currentTime={currentTime}
          duration={duration}
          onSeek={onSeek}
          className="h-full rounded-none"
        />
      </div>

      <div className="flex items-center gap-4 px-4 py-3 max-w-7xl mx-auto">
        {/* Episode artwork */}
        {episode.artwork && (
          <img
            src={episode.artwork}
            alt=""
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
          />
        )}

        {/* Episode info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-[var(--fp-color-text)] truncate">
            {episode.title || 'Untitled'}
          </h4>
          {episode.artist && (
            <p className="text-xs text-[var(--fp-color-text-muted)] truncate">
              {episode.artist}
            </p>
          )}
        </div>

        {/* Time display */}
        <div className="hidden sm:flex items-center gap-1 text-xs text-[var(--fp-color-text-muted)]">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Play button */}
        <PlayButton
          isPlaying={isPlaying}
          isLoading={isLoading}
          onClick={onTogglePlay}
          size="sm"
        />

        {/* Close button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'p-2 rounded-full text-[var(--fp-color-text-muted)]',
              'hover:text-[var(--fp-color-text)] hover:bg-[var(--fp-color-surface)]',
              'transition-colors'
            )}
            aria-label="Close player"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default StickyPlayer;
