import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/utils/cn';
import { useLabels } from '@/context/LabelsContext';
import { resolveLabels, type PlayerLabels } from '@/types/labels';
import type { SubtitleStyle, SubtitleStylePreset } from '@/core/subtitleStyle';

export interface SubtitleSettingsProps {
  style: SubtitleStyle;
  onStyleChange: (updates: Partial<SubtitleStyle>) => void;
  onPresetSelect: (presetName: string) => void;
  onReset: () => void;
  presets: readonly SubtitleStylePreset[];
  /** Override the labels from context — useful in isolation and in stories. */
  labels?: PlayerLabels;
  className?: string;
  disabled?: boolean;
}

/**
 * The panel behind the subtitle-settings button.
 *
 * Presentational: it owns nothing but whether it is open. The style and the
 * callbacks come from {@link useSubtitleStyling}, which is what writes the
 * `::cue` rule the viewer actually sees.
 */
export function SubtitleSettings({
  style,
  onStyleChange,
  onPresetSelect,
  onReset,
  presets,
  labels: labelsProp,
  className,
  disabled = false,
}: SubtitleSettingsProps) {
  const contextLabels = useLabels();
  // The subtitle keys are optional on `PlayerLabels`, so a hand-built table is
  // allowed to omit them.
  const labels = resolveLabels(labelsProp ?? contextLabels);

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fontSizeId = useId();
  const backgroundId = useId();

  // Same dismissal behaviour as the other popovers in the controls bar.
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
      // Outside the updater: React may run one of those more than once, and
      // moving focus twice is not the same as moving it once.
      //
      // Escape unmounts whatever was focused inside the panel, so without this
      // the keyboard user is dropped on the document body.
      triggerRef.current?.focus();
      setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const positions: Array<{ value: SubtitleStyle['position']; label: string }> = [
    { value: 'bottom', label: labels.subtitlePositionBottom },
    { value: 'top', label: labels.subtitlePositionTop },
  ];

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen((open) => !open)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={labels.subtitleStyle}
        title={labels.subtitleStyle}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full',
          'text-[var(--fp-color-text-secondary)]',
          'transition-colors duration-[var(--fp-transition-fast)]',
          'hover:bg-[var(--fp-color-surface)] hover:text-[var(--fp-color-text)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--fp-color-accent)]',
          disabled && 'cursor-not-allowed opacity-50',
          isOpen && 'text-[var(--fp-color-accent)]'
        )}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M7 12h2M13 12h4M7 16h10" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={labels.subtitleStyle}
          className={cn(
            'absolute bottom-full right-0 z-50 mb-2 w-64 rounded-lg p-3',
            'border border-[var(--fp-glass-border)] bg-[var(--fp-color-surface)]',
            'text-sm text-[var(--fp-color-text)] shadow-lg'
          )}
        >
          <div className="mb-3 font-medium">{labels.subtitleStyle}</div>

          <div className="mb-3">
            <div className="mb-1.5 text-xs text-[var(--fp-color-text-muted)]">
              {labels.subtitlePresets}
            </div>
            <div className="flex flex-wrap gap-1">
              {presets.map((preset) => {
                // Marked by value rather than by name: applying a preset and
                // then nudging one slider should stop claiming the preset.
                const active = isSameStyle(style, preset.style);
                return (
                  <button
                    key={preset.name}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onPresetSelect(preset.name)}
                    className={cn(
                      'rounded border px-2 py-1 text-xs',
                      'transition-colors duration-[var(--fp-transition-fast)]',
                      active
                        ? 'border-[var(--fp-color-accent)] text-[var(--fp-color-accent)]'
                        : 'border-[var(--fp-glass-border)] hover:border-[var(--fp-color-accent)]'
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-2">
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor={fontSizeId} className="text-xs text-[var(--fp-color-text-muted)]">
                {labels.subtitleFontSize}
              </label>
              <span className="text-xs text-[var(--fp-color-text-secondary)]">
                {style.fontSize}px
              </span>
            </div>
            <input
              id={fontSizeId}
              type="range"
              min={12}
              max={32}
              value={style.fontSize}
              onChange={(event) => onStyleChange({ fontSize: Number(event.target.value) })}
              className="h-1 w-full appearance-none rounded-full bg-[var(--fp-progress-bg)] accent-[var(--fp-color-accent)]"
            />
          </div>

          <div className="mb-2">
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor={backgroundId} className="text-xs text-[var(--fp-color-text-muted)]">
                {labels.subtitleBackground}
              </label>
              <span className="text-xs text-[var(--fp-color-text-secondary)]">
                {Math.round(style.backgroundOpacity * 100)}%
              </span>
            </div>
            <input
              id={backgroundId}
              type="range"
              min={0}
              max={100}
              value={Math.round(style.backgroundOpacity * 100)}
              onChange={(event) =>
                onStyleChange({ backgroundOpacity: Number(event.target.value) / 100 })
              }
              className="h-1 w-full appearance-none rounded-full bg-[var(--fp-progress-bg)] accent-[var(--fp-color-accent)]"
            />
          </div>

          <div className="mb-3">
            <div className="mb-1 text-xs text-[var(--fp-color-text-muted)]">
              {labels.subtitlePosition}
            </div>
            <div className="flex gap-1" role="group" aria-label={labels.subtitlePosition}>
              {positions.map((position) => (
                <button
                  key={position.value}
                  type="button"
                  aria-pressed={style.position === position.value}
                  onClick={() => onStyleChange({ position: position.value })}
                  className={cn(
                    'flex-1 rounded border px-2 py-1 text-xs',
                    'transition-colors duration-[var(--fp-transition-fast)]',
                    style.position === position.value
                      ? 'border-[var(--fp-color-accent)] text-[var(--fp-color-accent)]'
                      : 'border-[var(--fp-glass-border)] text-[var(--fp-color-text-secondary)]',
                    'hover:border-[var(--fp-color-accent)]'
                  )}
                >
                  {position.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onReset}
            className={cn(
              'w-full rounded px-2 py-1.5 text-xs',
              'text-[var(--fp-color-text-secondary)]',
              'transition-colors duration-[var(--fp-transition-fast)]',
              'hover:bg-[var(--fp-glass-bg)] hover:text-[var(--fp-color-text)]'
            )}
          >
            {labels.subtitleReset}
          </button>
        </div>
      )}
    </div>
  );
}

function isSameStyle(a: SubtitleStyle, b: SubtitleStyle): boolean {
  return (
    a.fontSize === b.fontSize &&
    a.fontFamily === b.fontFamily &&
    a.textColor === b.textColor &&
    a.backgroundColor === b.backgroundColor &&
    a.backgroundOpacity === b.backgroundOpacity &&
    a.position === b.position &&
    a.textShadow === b.textShadow
  );
}
