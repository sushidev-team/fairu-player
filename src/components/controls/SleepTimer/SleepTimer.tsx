import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/utils';
import { useLabels } from '@/context/LabelsContext';
import { interpolateLabel } from '@/types/labels';
import { resolveLabels, type PlayerLabels } from '@/types/labels';
import {
  DEFAULT_SLEEP_TIMER_PRESETS,
  formatRemaining,
  type SleepTimerMode,
  type SleepTimerPreset,
} from '@/core/sleepTimer';

export interface SleepTimerProps {
  isActive: boolean;
  /** Seconds left. Shown on the button while the timer runs. */
  remainingTime: number;
  /** Which preset is running, so the menu can mark it. */
  selectedDuration?: SleepTimerMode | null;
  presets?: readonly SleepTimerPreset[];
  disabled?: boolean;
  onStart?: (mode: SleepTimerMode) => void;
  onCancel?: () => void;
  labels?: PlayerLabels;
  className?: string;
}

/**
 * The sleep-timer button and its menu.
 *
 * Presentational: the countdown and the pausing belong to
 * {@link useSleepTimer}. This shows what it reports and forwards what the
 * viewer picks.
 */
export function SleepTimer({
  isActive,
  remainingTime,
  selectedDuration = null,
  presets = DEFAULT_SLEEP_TIMER_PRESETS,
  disabled = false,
  onStart,
  onCancel,
  labels: labelsProp,
  className,
}: SleepTimerProps) {
  const contextLabels = useLabels();
  const labels = resolveLabels(labelsProp ?? contextLabels);

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !isOpen) return;
      triggerRef.current?.focus();
      setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const pick = useCallback(
    (mode: SleepTimerMode) => {
      onStart?.(mode);
      setIsOpen(false);
    },
    [onStart]
  );

  const cancel = useCallback(() => {
    onCancel?.();
    setIsOpen(false);
  }, [onCancel]);

  const countdown = formatRemaining(remainingTime);
  const buttonLabel = isActive
    ? `${labels.sleepTimer}: ${interpolateLabel(labels.sleepTimerRemaining, { time: countdown })}`
    : labels.sleepTimer;

  const presetLabel = (preset: SleepTimerPreset) =>
    preset.value === 'endOfTrack'
      ? labels.sleepTimerEndOfTrack
      : interpolateLabel(labels.sleepTimerMinutes, { minutes: preset.value });

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen((open) => !open)}
        disabled={disabled}
        aria-label={buttonLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'fp-button flex items-center gap-1 px-2 py-1 text-sm font-medium',
          'transition-colors duration-[var(--fp-transition-fast)]',
          isActive && 'text-[var(--fp-color-accent)]',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <ClockIcon />
        {/* The countdown doubles as the "it is running" signal, so a viewer
            never has to open the menu to find out. */}
        {isActive && <span className="tabular-nums">{countdown}</span>}
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={labels.sleepTimerOptions}
          className={cn(
            'absolute bottom-full left-1/2 z-50 mb-2 min-w-[9rem] -translate-x-1/2',
            'rounded-lg border border-[var(--fp-glass-border)]',
            'bg-[var(--fp-color-surface)] py-1 shadow-lg'
          )}
        >
          {presets.map((preset) => (
            <button
              key={String(preset.value)}
              type="button"
              role="option"
              aria-selected={isActive && selectedDuration === preset.value}
              onClick={() => pick(preset.value)}
              className={cn(
                'w-full px-3 py-1.5 text-left text-sm',
                'transition-colors duration-[var(--fp-transition-fast)]',
                'hover:bg-[var(--fp-color-surface-hover)]',
                isActive && selectedDuration === preset.value
                  ? 'text-[var(--fp-color-accent)]'
                  : 'text-[var(--fp-color-text)]'
              )}
            >
              {presetLabel(preset)}
            </button>
          ))}

          {isActive && (
            // Outside the listbox: cancelling is an action, not one of the
            // options, and announcing it as one misreports the list.
            <button
              type="button"
              onClick={cancel}
              className={cn(
                'mt-1 w-full border-t border-[var(--fp-glass-border)] px-3 pb-1 pt-2',
                'text-left text-sm text-[var(--fp-color-text-secondary)]',
                'transition-colors duration-[var(--fp-transition-fast)]',
                'hover:bg-[var(--fp-color-surface-hover)] hover:text-[var(--fp-color-text)]'
              )}
            >
              {labels.sleepTimerCancel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
