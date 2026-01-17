import { useState, useCallback } from 'react';
import { cn } from '@/utils';

export interface SkipButtonProps {
  direction: 'forward' | 'backward';
  seconds?: number;
  size?: 'sm' | 'md';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

const sizeConfig = {
  sm: {
    button: 'min-w-[32px] h-9 px-1',
    icon: 'w-4 h-4',
    text: 'text-[9px]',
  },
  md: {
    button: 'min-w-[40px] h-12 px-1',
    icon: 'w-5 h-5',
    text: 'text-[10px]',
  },
};

export function SkipButton({
  direction,
  seconds = direction === 'forward' ? 30 : 10,
  size = 'md',
  disabled = false,
  onClick,
  className,
}: SkipButtonProps) {
  const isForward = direction === 'forward';
  const [isAnimating, setIsAnimating] = useState(false);
  const config = sizeConfig[size];

  const handleClick = useCallback(() => {
    if (disabled) return;

    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    onClick?.();
  }, [disabled, onClick]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={`Skip ${isForward ? 'forward' : 'backward'} ${seconds} seconds`}
      className={cn(
        'group relative flex flex-col items-center justify-center gap-0.5',
        config.button,
        'rounded-lg',
        'text-[var(--fp-color-text-secondary)]',
        'hover:text-[var(--fp-color-text)]',
        'hover:bg-[var(--fp-color-surface-hover)]',
        'active:scale-95',
        'transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fp-color-accent)]',
        disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent',
        className
      )}
    >
      {/* Arrow icon */}
      <div
        className={cn(
          'flex items-center justify-center',
          config.icon,
          'transition-transform duration-300 ease-out',
          isAnimating && (isForward ? 'rotate-[30deg]' : 'rotate-[-30deg]'),
          'group-hover:scale-105'
        )}
      >
        {isForward ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full" aria-hidden="true">
            <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full" aria-hidden="true">
            <path d="M5.6 10.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8c-2.65 0-5.05.99-6.9 2.6z" />
          </svg>
        )}
      </div>

      {/* Seconds number - below icon */}
      <span
        className={cn(
          config.text,
          'font-semibold leading-none tabular-nums',
          'transition-colors duration-200'
        )}
      >
        {seconds}
      </span>
    </button>
  );
}

export interface SkipButtonsProps {
  forwardSeconds?: number;
  backwardSeconds?: number;
  size?: 'sm' | 'md';
  disabled?: boolean;
  onSkipForward?: () => void;
  onSkipBackward?: () => void;
  className?: string;
}

export function SkipButtons({
  forwardSeconds = 30,
  backwardSeconds = 10,
  size = 'md',
  disabled = false,
  onSkipForward,
  onSkipBackward,
  className,
}: SkipButtonsProps) {
  return (
    <div className={cn('flex items-center', className)}>
      <SkipButton
        direction="backward"
        seconds={backwardSeconds}
        size={size}
        disabled={disabled}
        onClick={onSkipBackward}
      />
      <SkipButton
        direction="forward"
        seconds={forwardSeconds}
        size={size}
        disabled={disabled}
        onClick={onSkipForward}
      />
    </div>
  );
}
