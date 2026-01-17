import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/utils';
import { useLabels } from '@/context/LabelsContext';
import type { PlayerLabels } from '@/types/labels';

export interface PlaybackSpeedProps {
  speed: number;
  speeds?: number[];
  disabled?: boolean;
  onSpeedChange?: (speed: number) => void;
  className?: string;
  labels?: Pick<PlayerLabels, 'playbackSpeed' | 'playbackSpeedOptions'>;
}

const DEFAULT_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function PlaybackSpeed({
  speed,
  speeds = DEFAULT_SPEEDS,
  disabled = false,
  onSpeedChange,
  className,
  labels: labelsProp,
}: PlaybackSpeedProps) {
  const contextLabels = useLabels();
  const labels = labelsProp ?? contextLabels;
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSpeedSelect = useCallback((newSpeed: number) => {
    onSpeedChange?.(newSpeed);
    setIsOpen(false);
  }, [onSpeedChange]);

  const formatSpeed = (s: number): string => {
    return s === 1 ? '1x' : `${s}x`;
  };

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label={`${labels.playbackSpeed}: ${formatSpeed(speed)}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'fp-button px-2 py-1 text-sm font-medium',
          'min-w-[3rem]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {formatSpeed(speed)}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="listbox"
          aria-label={labels.playbackSpeedOptions}
          className={cn(
            'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
            'rounded-lg bg-[var(--fp-color-surface)] py-1',
            'shadow-lg ring-1 ring-black ring-opacity-5',
            'min-w-[4rem]'
          )}
        >
          {speeds.map((s) => (
            <button
              key={s}
              role="option"
              aria-selected={s === speed}
              onClick={() => handleSpeedSelect(s)}
              className={cn(
                'w-full px-3 py-1.5 text-sm text-left',
                'hover:bg-[var(--fp-color-surface-hover)]',
                'transition-colors',
                s === speed && 'text-[var(--fp-color-primary)] font-medium'
              )}
            >
              {formatSpeed(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
