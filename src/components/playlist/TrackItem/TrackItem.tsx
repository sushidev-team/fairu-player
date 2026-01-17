import { cn, formatTime } from '@/utils';
import type { Track } from '@/types/player';

export interface TrackItemProps {
  track: Track;
  index: number;
  isActive?: boolean;
  isPlaying?: boolean;
  onClick?: (track: Track, index: number) => void;
  className?: string;
}

export function TrackItem({
  track,
  index,
  isActive = false,
  isPlaying = false,
  onClick,
  className,
}: TrackItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(track, index)}
      className={cn(
        'w-full flex items-center gap-3 p-2 rounded-lg',
        'text-left transition-colors',
        'hover:bg-[var(--fp-color-surface)]',
        isActive && 'bg-[var(--fp-color-surface)]',
        className
      )}
      aria-current={isActive ? 'true' : undefined}
    >
      {/* Track number or playing indicator */}
      <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
        {isActive && isPlaying ? (
          <PlayingIndicator />
        ) : (
          <span className="text-sm text-[var(--fp-color-text-muted)]">
            {index + 1}
          </span>
        )}
      </div>

      {/* Artwork */}
      {track.artwork && (
        <img
          src={track.artwork}
          alt=""
          className="w-10 h-10 rounded object-cover flex-shrink-0"
        />
      )}

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-sm truncate',
            isActive
              ? 'font-medium text-[var(--fp-color-primary)]'
              : 'text-[var(--fp-color-text)]'
          )}
        >
          {track.title || 'Untitled'}
        </div>
        {track.artist && (
          <div className="text-xs text-[var(--fp-color-text-muted)] truncate">
            {track.artist}
          </div>
        )}
      </div>

      {/* Duration */}
      {track.duration && (
        <span className="text-xs text-[var(--fp-color-text-muted)] flex-shrink-0">
          {formatTime(track.duration)}
        </span>
      )}
    </button>
  );
}

function PlayingIndicator() {
  return (
    <div className="flex items-end gap-0.5 h-4" aria-label="Now playing">
      <span className="w-1 bg-[var(--fp-color-primary)] animate-pulse" style={{ height: '60%', animationDelay: '0ms' }} />
      <span className="w-1 bg-[var(--fp-color-primary)] animate-pulse" style={{ height: '100%', animationDelay: '150ms' }} />
      <span className="w-1 bg-[var(--fp-color-primary)] animate-pulse" style={{ height: '40%', animationDelay: '300ms' }} />
    </div>
  );
}
