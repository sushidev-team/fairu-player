import { useState, useCallback } from 'react';
import { cn } from '@/utils';
import { useLabels } from '@/context/LabelsContext';
import type { PlayerLabels } from '@/types/labels';

export interface PlayButtonProps {
  isPlaying: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
  labels?: Pick<PlayerLabels, 'play' | 'pause'>;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

const iconSizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

// SVG paths for morphing animation
const PLAY_PATH = 'M8 5.14v14l11-7-11-7z';
const PAUSE_PATH = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';

export function PlayButton({
  isPlaying,
  isLoading = false,
  disabled = false,
  size = 'md',
  onClick,
  className,
  labels: labelsProp,
}: PlayButtonProps) {
  const contextLabels = useLabels();
  const labels = labelsProp ?? contextLabels;
  const [isPressed, setIsPressed] = useState(false);
  const [showRing, setShowRing] = useState(false);

  const handleClick = useCallback(() => {
    if (disabled || isLoading) return;

    // Trigger press animation
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 200);

    // Trigger ring animation
    setShowRing(true);
    setTimeout(() => setShowRing(false), 400);

    onClick?.();
  }, [disabled, isLoading, onClick]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-label={isPlaying ? labels.pause : labels.play}
      className={cn(
        'relative group',
        'flex items-center justify-center',
        'rounded-full',
        'bg-[var(--fp-color-accent)] text-black',
        'transition-all duration-[var(--fp-transition-morph)]',
        'hover:bg-[var(--fp-color-accent-hover)] hover:scale-105',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fp-color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fp-color-background)]',
        sizeClasses[size],
        isPressed && 'scale-92',
        disabled && 'opacity-50 cursor-not-allowed hover:scale-100',
        className
      )}
    >
      {/* Glow effect on hover */}
      <span
        className={cn(
          'absolute inset-0 rounded-full',
          'opacity-0 group-hover:opacity-100',
          'transition-opacity duration-300',
          'blur-lg bg-[var(--fp-color-accent)]',
          '-z-10'
        )}
        style={{ transform: 'scale(1.2)' }}
      />

      {/* Expanding ring animation on click */}
      {showRing && (
        <span
          className="absolute inset-0 rounded-full border-2 border-[var(--fp-color-accent)]"
          style={{
            animation: 'fp-ring-expand 400ms ease-out forwards',
          }}
        />
      )}

      {isLoading ? (
        <LoadingIcon className={cn(iconSizeClasses[size], 'fp-animate-spin')} />
      ) : (
        <MorphingPlayPauseIcon
          isPlaying={isPlaying}
          className={iconSizeClasses[size]}
        />
      )}
    </button>
  );
}

function MorphingPlayPauseIcon({
  isPlaying,
  className,
}: {
  isPlaying: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn(className, 'relative')}
      aria-hidden="true"
    >
      {/* Play icon - fades out when playing */}
      <path
        d={PLAY_PATH}
        className={cn(
          'origin-center',
          'transition-all duration-300 ease-out',
          isPlaying
            ? 'opacity-0 scale-75'
            : 'opacity-100 scale-100'
        )}
        style={{
          transformOrigin: 'center',
          transform: isPlaying ? 'scale(0.75)' : 'scale(1)',
        }}
      />
      {/* Pause icon - fades in when playing */}
      <path
        d={PAUSE_PATH}
        className={cn(
          'origin-center',
          'transition-all duration-300 ease-out',
          isPlaying
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-75'
        )}
        style={{
          transformOrigin: 'center',
          transform: isPlaying ? 'scale(1)' : 'scale(0.75)',
        }}
      />
    </svg>
  );
}

function LoadingIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}
