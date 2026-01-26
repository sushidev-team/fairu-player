import { cn, formatTime } from '@/utils';
import type { TimelineMarker } from '@/types/markers';

export interface MarkerListProps {
  markers: TimelineMarker[];
  currentTime: number;
  duration: number;
  activeMarkerIndex?: number;
  onMarkerClick?: (marker: TimelineMarker, index: number) => void;
  showPreviewImage?: boolean;
  className?: string;
}

export function MarkerList({
  markers,
  currentTime: _currentTime,
  duration: _duration,
  activeMarkerIndex = -1,
  onMarkerClick,
  showPreviewImage = true,
  className,
}: MarkerListProps) {
  if (markers.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <h3 className="text-sm font-semibold mb-2 text-[var(--fp-color-text)]">
        Markers
      </h3>
      <ul className="flex flex-col gap-1" role="list" aria-label="Marker list">
        {markers.map((marker, index) => {
          const isActive = index === activeMarkerIndex;

          return (
            <li key={marker.id}>
              <button
                type="button"
                onClick={() => onMarkerClick?.(marker, index)}
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded-lg',
                  'text-left transition-colors',
                  'hover:bg-[var(--fp-color-surface)]',
                  isActive && 'bg-[var(--fp-color-surface)]'
                )}
                aria-current={isActive ? 'true' : undefined}
              >
                {showPreviewImage && marker.previewImage && (
                  <img
                    src={marker.previewImage}
                    alt=""
                    className="rounded object-cover flex-shrink-0"
                    style={{ width: 64, height: 36 }}
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: marker.color || 'var(--fp-color-accent)' }}
                      />
                    )}
                    {marker.title && (
                      <span
                        className={cn(
                          'text-sm truncate',
                          isActive
                            ? 'font-medium text-[var(--fp-color-accent)]'
                            : 'text-[var(--fp-color-text)]'
                        )}
                      >
                        {marker.title}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-[var(--fp-color-text-muted)]">
                    {formatTime(marker.time)}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
