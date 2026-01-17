import { cn } from '@/utils';

export interface NowPlayingIndicatorProps {
  isPlaying: boolean;
  bars?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-3 gap-0.5',
  md: 'h-4 gap-0.5',
  lg: 'h-5 gap-1',
};

const barWidthClasses = {
  sm: 'w-0.5',
  md: 'w-1',
  lg: 'w-1.5',
};

export function NowPlayingIndicator({
  isPlaying,
  bars = 4,
  size = 'md',
  className,
}: NowPlayingIndicatorProps) {
  return (
    <div
      className={cn(
        'flex items-end',
        sizeClasses[size],
        className
      )}
      aria-label={isPlaying ? 'Now playing' : 'Paused'}
      role="img"
    >
      {Array.from({ length: bars }).map((_, index) => (
        <span
          key={index}
          className={cn(
            barWidthClasses[size],
            'rounded-full',
            'bg-[var(--fp-color-accent)]',
            'fp-equalizer-bar',
            !isPlaying && 'fp-equalizer-paused'
          )}
          style={{
            height: '100%',
          }}
        />
      ))}
    </div>
  );
}
