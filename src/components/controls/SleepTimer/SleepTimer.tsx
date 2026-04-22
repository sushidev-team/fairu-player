import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/utils';
import type { SleepTimerPreset } from '@/types/sleepTimer';
import { DEFAULT_SLEEP_TIMER_PRESETS } from '@/types/sleepTimer';

export interface SleepTimerProps {
  /** Whether the timer is currently active */
  isActive: boolean;
  /** Remaining time in seconds (displayed as MM:SS when active) */
  remainingTime: number;
  /** Preset options to show in the dropdown */
  presets?: SleepTimerPreset[];
  /** Whether the control is disabled */
  disabled?: boolean;
  /** Called when a preset duration is selected */
  onStart?: (duration: number | 'endOfTrack') => void;
  /** Called when the timer is cancelled */
  onCancel?: () => void;
  /** Additional CSS class names */
  className?: string;
  /** Label for the button (used in aria-label) */
  label?: string;
}

/**
 * Formats seconds into MM:SS display format
 */
function formatRemainingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function SleepTimer({
  isActive,
  remainingTime,
  presets = DEFAULT_SLEEP_TIMER_PRESETS,
  disabled = false,
  onStart,
  onCancel,
  className,
  label = 'Sleep timer',
}: SleepTimerProps) {
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

  const handlePresetSelect = useCallback(
    (value: number | 'endOfTrack') => {
      onStart?.(value);
      setIsOpen(false);
    },
    [onStart]
  );

  const handleCancel = useCallback(() => {
    onCancel?.();
    setIsOpen(false);
  }, [onCancel]);

  const buttonLabel = isActive
    ? `${label}: ${formatRemainingTime(remainingTime)} remaining`
    : label;

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label={buttonLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'fp-button px-2 py-1 text-sm font-medium',
          'min-w-[3rem]',
          isActive && 'text-[var(--fp-color-primary)]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isActive ? (
          <span className="flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
                clipRule="evenodd"
              />
            </svg>
            <span>{formatRemainingTime(remainingTime)}</span>
          </span>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="listbox"
          aria-label={`${label} options`}
          className={cn(
            'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
            'rounded-lg bg-[var(--fp-color-surface)] py-1',
            'shadow-lg ring-1 ring-black ring-opacity-5',
            'min-w-[8rem]'
          )}
        >
          {isActive && (
            <button
              role="option"
              aria-selected={false}
              onClick={handleCancel}
              className={cn(
                'w-full px-3 py-1.5 text-sm text-left',
                'hover:bg-[var(--fp-color-surface-hover)]',
                'transition-colors',
                'text-[var(--fp-color-primary)] font-medium',
                'border-b border-[var(--fp-color-surface-hover)]'
              )}
            >
              Cancel timer
            </button>
          )}
          {presets.map((preset) => (
            <button
              key={String(preset.value)}
              role="option"
              aria-selected={isActive && preset.value === undefined}
              onClick={() => handlePresetSelect(preset.value)}
              className={cn(
                'w-full px-3 py-1.5 text-sm text-left',
                'hover:bg-[var(--fp-color-surface-hover)]',
                'transition-colors'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
