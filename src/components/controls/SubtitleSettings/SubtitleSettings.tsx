import { useState, useCallback } from 'react';
import { cn } from '@/utils/cn';
import type { SubtitleStyle, SubtitleStylePreset } from '@/types/subtitleStyling';

export interface SubtitleSettingsProps {
  /** Current subtitle style */
  style: SubtitleStyle;
  /** Update style callback */
  onStyleChange: (updates: Partial<SubtitleStyle>) => void;
  /** Apply a preset callback */
  onPresetSelect: (presetName: string) => void;
  /** Reset callback */
  onReset: () => void;
  /** Available presets */
  presets: SubtitleStylePreset[];
  /** Additional CSS classes */
  className?: string;
  /** Whether the settings panel is disabled */
  disabled?: boolean;
}

export function SubtitleSettings({
  style,
  onStyleChange,
  onPresetSelect,
  onReset,
  presets,
  className,
  disabled = false,
}: SubtitleSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = useCallback(() => {
    if (!disabled) setIsOpen((prev) => !prev);
  }, [disabled]);

  return (
    <div className={cn('relative', className)}>
      {/* Toggle button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          'flex items-center justify-center',
          'w-8 h-8 rounded-full',
          'text-[var(--fp-color-text-secondary)]',
          'hover:text-[var(--fp-color-text)] hover:bg-[var(--fp-color-surface)]',
          'transition-colors duration-[var(--fp-transition-fast)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--fp-color-accent)]',
          disabled && 'opacity-50 cursor-not-allowed',
          isOpen && 'text-[var(--fp-color-accent)]'
        )}
        aria-label="Subtitle settings"
        title="Subtitle settings"
      >
        {/* CC icon with gear */}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M7 12h2" />
          <path d="M15 12h2" />
        </svg>
      </button>

      {/* Settings panel */}
      {isOpen && (
        <div
          className={cn(
            'absolute bottom-full mb-2 right-0',
            'w-64 p-3 rounded-lg',
            'bg-[var(--fp-color-surface)] border border-[var(--fp-glass-border)]',
            'shadow-lg z-50',
            'text-sm text-[var(--fp-color-text)]'
          )}
        >
          <div className="font-medium mb-3">Subtitle Style</div>

          {/* Presets */}
          <div className="mb-3">
            <div className="text-xs text-[var(--fp-color-text-muted)] mb-1.5">Presets</div>
            <div className="flex flex-wrap gap-1">
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => onPresetSelect(preset.name)}
                  className={cn(
                    'px-2 py-1 rounded text-xs',
                    'border border-[var(--fp-glass-border)]',
                    'hover:border-[var(--fp-color-accent)] hover:text-[var(--fp-color-accent)]',
                    'transition-colors duration-[var(--fp-transition-fast)]'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font size */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-[var(--fp-color-text-muted)]">Font Size</label>
              <span className="text-xs text-[var(--fp-color-text-secondary)]">{style.fontSize}px</span>
            </div>
            <input
              type="range"
              min={12}
              max={32}
              value={style.fontSize}
              onChange={(e) => onStyleChange({ fontSize: Number(e.target.value) })}
              className="w-full h-1 rounded-full appearance-none bg-[var(--fp-progress-bg)] accent-[var(--fp-color-accent)]"
            />
          </div>

          {/* Background opacity */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-[var(--fp-color-text-muted)]">Background</label>
              <span className="text-xs text-[var(--fp-color-text-secondary)]">{Math.round(style.backgroundOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(style.backgroundOpacity * 100)}
              onChange={(e) => onStyleChange({ backgroundOpacity: Number(e.target.value) / 100 })}
              className="w-full h-1 rounded-full appearance-none bg-[var(--fp-progress-bg)] accent-[var(--fp-color-accent)]"
            />
          </div>

          {/* Position toggle */}
          <div className="mb-3">
            <div className="text-xs text-[var(--fp-color-text-muted)] mb-1">Position</div>
            <div className="flex gap-1">
              {(['bottom', 'top'] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => onStyleChange({ position: pos })}
                  className={cn(
                    'flex-1 px-2 py-1 rounded text-xs capitalize',
                    'border transition-colors duration-[var(--fp-transition-fast)]',
                    style.position === pos
                      ? 'border-[var(--fp-color-accent)] text-[var(--fp-color-accent)]'
                      : 'border-[var(--fp-glass-border)] text-[var(--fp-color-text-secondary)]',
                    'hover:border-[var(--fp-color-accent)]'
                  )}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* Reset button */}
          <button
            type="button"
            onClick={onReset}
            className={cn(
              'w-full px-2 py-1.5 rounded text-xs',
              'text-[var(--fp-color-text-secondary)]',
              'hover:text-[var(--fp-color-text)] hover:bg-[var(--fp-glass-bg)]',
              'transition-colors duration-[var(--fp-transition-fast)]'
            )}
          >
            Reset to Default
          </button>
        </div>
      )}
    </div>
  );
}
