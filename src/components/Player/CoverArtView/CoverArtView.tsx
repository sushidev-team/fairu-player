import { useState } from 'react';
import { cn } from '@/utils';
import { NowPlayingIndicator } from '@/components/controls/NowPlayingIndicator';

export interface CoverArtViewProps {
  artwork?: string;
  title?: string;
  artist?: string;
  album?: string;
  isPlaying?: boolean;
  showInfo?: boolean;
  showFlip?: boolean;
  size?: 'md' | 'lg' | 'full';
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  md: 'max-w-[280px]',
  lg: 'max-w-[400px]',
  full: 'max-w-full',
};

export function CoverArtView({
  artwork,
  title,
  artist,
  album,
  isPlaying = false,
  showInfo = true,
  showFlip = true,
  size = 'lg',
  className,
  onClick,
}: CoverArtViewProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleClick = () => {
    if (showFlip) {
      setIsFlipped(!isFlipped);
    }
    onClick?.();
  };

  return (
    <div className={cn('w-full', sizeClasses[size], className)}>
      {/* Cover Container */}
      <div
        className={cn(
          'relative w-full aspect-square',
          showFlip && 'cursor-pointer'
        )}
        style={{ perspective: '1000px' }}
        onClick={handleClick}
      >
        <div
          className={cn(
            'relative w-full h-full transition-transform duration-500',
            'transform-gpu'
          )}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
          }}
        >
          {/* Front - Cover Art */}
          <div
            className="absolute inset-0 w-full h-full"
            style={{ backfaceVisibility: 'hidden' }}
          >
            {artwork ? (
              <div className="relative w-full h-full group">
                {/* Glow effect */}
                <div
                  className={cn(
                    'absolute inset-0 blur-2xl opacity-40 scale-90 translate-y-4 rounded-xl',
                    isPlaying && 'animate-pulse'
                  )}
                  style={{
                    backgroundImage: `url(${artwork})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                {/* Main artwork */}
                <img
                  src={artwork}
                  alt={title || 'Album artwork'}
                  className="relative w-full h-full object-cover rounded-xl shadow-2xl"
                />
                {/* Playing indicator overlay */}
                {isPlaying && (
                  <div className="absolute bottom-4 left-4">
                    <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-2">
                      <NowPlayingIndicator isPlaying={isPlaying} size="sm" bars={3} />
                      <span className="text-xs text-white font-medium">Playing</span>
                    </div>
                  </div>
                )}
                {/* Flip hint */}
                {showFlip && (
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white/70">
                        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                      </svg>
                      <span className="text-[10px] text-white/70 font-medium">Info</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full rounded-xl bg-[var(--fp-color-surface)] flex items-center justify-center shadow-xl">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-24 h-24 text-[var(--fp-color-text-muted)]">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}
          </div>

          {/* Back - Track Info */}
          {showFlip && (
            <div
              className={cn(
                'absolute inset-0 w-full h-full',
                'bg-[var(--fp-color-surface)] rounded-xl',
                'border border-[var(--fp-glass-border)]',
                'shadow-2xl',
                'p-6 flex flex-col'
              )}
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)'
              }}
            >
              {/* Mini artwork */}
              {artwork && (
                <div className="w-16 h-16 rounded-lg overflow-hidden mb-4 shadow-lg flex-shrink-0">
                  <img src={artwork} alt="" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Track info */}
              <div className="flex-1 min-h-0">
                <h2 className="text-xl font-bold text-[var(--fp-color-text)] mb-1 line-clamp-2">
                  {title || 'Unknown Title'}
                </h2>
                <p className="text-base text-[var(--fp-color-text-secondary)] mb-4">
                  {artist || 'Unknown Artist'}
                </p>

                {album && (
                  <div className="mb-4">
                    <span className="text-xs text-[var(--fp-color-text-muted)] uppercase tracking-wider block mb-1">
                      Album
                    </span>
                    <p className="text-sm text-[var(--fp-color-text)]">{album}</p>
                  </div>
                )}
              </div>

              {/* Flip back hint */}
              <div className="flex justify-center pt-4 border-t border-[var(--fp-glass-border)]">
                <div className="bg-[var(--fp-color-accent)]/20 rounded-full px-3 py-1">
                  <span className="text-xs text-[var(--fp-color-accent)] font-medium">
                    Tap to flip back
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info below cover (optional) */}
      {showInfo && !isFlipped && (
        <div className="mt-4 text-center">
          <div className="flex items-center justify-center gap-2">
            {isPlaying && <NowPlayingIndicator isPlaying={isPlaying} size="sm" bars={3} />}
            <h3 className="text-lg font-bold text-[var(--fp-color-text)] truncate">
              {title || 'Unknown Title'}
            </h3>
          </div>
          {artist && (
            <p className="text-sm text-[var(--fp-color-text-secondary)] truncate mt-0.5">
              {artist}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
