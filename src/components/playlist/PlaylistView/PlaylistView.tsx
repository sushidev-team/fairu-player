import { cn } from '@/utils';
import { TrackItem } from '../TrackItem';
import type { Track } from '@/types/player';

export interface PlaylistViewProps {
  tracks: Track[];
  currentIndex: number;
  isPlaying?: boolean;
  onTrackClick?: (track: Track, index: number) => void;
  maxHeight?: string;
  className?: string;
}

export function PlaylistView({
  tracks,
  currentIndex,
  isPlaying = false,
  onTrackClick,
  maxHeight = '300px',
  className,
}: PlaylistViewProps) {
  if (tracks.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-[var(--fp-color-text)]">
          Playlist
        </h3>
        <span className="text-xs text-[var(--fp-color-text-muted)]">
          {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
        </span>
      </div>

      <ul
        className="flex flex-col gap-0.5 overflow-y-auto"
        style={{ maxHeight }}
        role="list"
        aria-label="Playlist"
      >
        {tracks.map((track, index) => (
          <li key={track.id}>
            <TrackItem
              track={track}
              index={index}
              isActive={index === currentIndex}
              isPlaying={index === currentIndex && isPlaying}
              onClick={onTrackClick}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
