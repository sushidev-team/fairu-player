import { cn } from '@/utils';
import type { RepeatMode } from '@/types/player';

export interface PlaylistControlsProps {
  hasPrevious?: boolean;
  hasNext?: boolean;
  shuffle?: boolean;
  repeat?: RepeatMode;
  disabled?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onShuffleToggle?: () => void;
  onRepeatChange?: (mode: RepeatMode) => void;
  className?: string;
}

export function PlaylistControls({
  hasPrevious = true,
  hasNext = true,
  shuffle = false,
  repeat = 'none',
  disabled = false,
  onPrevious,
  onNext,
  onShuffleToggle,
  onRepeatChange,
  className,
}: PlaylistControlsProps) {
  const handleRepeatClick = () => {
    const modes: RepeatMode[] = ['none', 'all', 'one'];
    const currentIndex = modes.indexOf(repeat);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    onRepeatChange?.(nextMode);
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Shuffle */}
      <button
        type="button"
        onClick={onShuffleToggle}
        disabled={disabled}
        aria-label={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
        aria-pressed={shuffle}
        className={cn(
          'fp-button fp-icon-button fp-icon-button--sm',
          shuffle && 'text-[var(--fp-color-primary)]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <ShuffleIcon />
      </button>

      {/* Previous */}
      <button
        type="button"
        onClick={onPrevious}
        disabled={disabled || !hasPrevious}
        aria-label="Previous track"
        className={cn(
          'fp-button fp-icon-button fp-icon-button--sm',
          (disabled || !hasPrevious) && 'opacity-50 cursor-not-allowed'
        )}
      >
        <PreviousIcon />
      </button>

      {/* Next */}
      <button
        type="button"
        onClick={onNext}
        disabled={disabled || !hasNext}
        aria-label="Next track"
        className={cn(
          'fp-button fp-icon-button fp-icon-button--sm',
          (disabled || !hasNext) && 'opacity-50 cursor-not-allowed'
        )}
      >
        <NextIcon />
      </button>

      {/* Repeat */}
      <button
        type="button"
        onClick={handleRepeatClick}
        disabled={disabled}
        aria-label={getRepeatLabel(repeat)}
        className={cn(
          'fp-button fp-icon-button fp-icon-button--sm relative',
          repeat !== 'none' && 'text-[var(--fp-color-primary)]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <RepeatIcon />
        {repeat === 'one' && (
          <span className="absolute -top-0.5 -right-0.5 text-[8px] font-bold">
            1
          </span>
        )}
      </button>
    </div>
  );
}

function getRepeatLabel(mode: RepeatMode): string {
  switch (mode) {
    case 'one':
      return 'Repeat one';
    case 'all':
      return 'Repeat all';
    default:
      return 'Repeat off';
  }
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
    </svg>
  );
}

function PreviousIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
    </svg>
  );
}
