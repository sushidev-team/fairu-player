import { cn } from '@/utils/cn';
import type { EqualizerBand, EqualizerPreset } from '@/types/equalizer';

export interface EqualizerProps {
  /** Current band settings */
  bands: EqualizerBand[];
  /** Set gain for a specific band */
  onBandChange: (index: number, gain: number) => void;
  /** Apply a preset */
  onPresetSelect: (presetName: string) => void;
  /** Reset to flat */
  onReset: () => void;
  /** Available presets */
  presets: EqualizerPreset[];
  /** Current preset name */
  currentPreset: string | null;
  /** Whether the EQ is enabled */
  enabled: boolean;
  /** Toggle enabled */
  onEnabledChange: (enabled: boolean) => void;
  /** Additional CSS classes */
  className?: string;
}

function formatFrequency(hz: number): string {
  if (hz >= 1000) return `${hz / 1000}k`;
  return `${hz}`;
}

export function Equalizer({
  bands,
  onBandChange,
  onPresetSelect,
  onReset,
  presets,
  currentPreset,
  enabled,
  onEnabledChange,
  className,
}: EqualizerProps) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg',
        'bg-[var(--fp-color-surface)] border border-[var(--fp-glass-border)]',
        'text-sm text-[var(--fp-color-text)]',
        !enabled && 'opacity-60',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium">Equalizer</span>
        <button
          type="button"
          onClick={() => onEnabledChange(!enabled)}
          className={cn(
            'relative w-9 h-5 rounded-full transition-colors duration-200',
            enabled ? 'bg-[var(--fp-color-accent)]' : 'bg-[var(--fp-progress-bg)]'
          )}
          aria-label={enabled ? 'Disable equalizer' : 'Enable equalizer'}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200',
              enabled && 'translate-x-4'
            )}
          />
        </button>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1 mb-3">
        {presets.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => onPresetSelect(preset.name)}
            disabled={!enabled}
            className={cn(
              'px-2 py-1 rounded text-xs',
              'border transition-colors duration-[var(--fp-transition-fast)]',
              currentPreset === preset.name
                ? 'border-[var(--fp-color-accent)] text-[var(--fp-color-accent)]'
                : 'border-[var(--fp-glass-border)] text-[var(--fp-color-text-secondary)]',
              enabled && 'hover:border-[var(--fp-color-accent)]',
              !enabled && 'cursor-not-allowed'
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Band sliders */}
      <div className="flex gap-2 items-end mb-2">
        {bands.map((band, index) => (
          <div key={band.frequency} className="flex flex-col items-center flex-1">
            <span className="text-[10px] text-[var(--fp-color-text-muted)] mb-1">
              {band.gain > 0 ? '+' : ''}{band.gain}
            </span>
            <input
              type="range"
              min={-12}
              max={12}
              value={band.gain}
              onChange={(e) => onBandChange(index, Number(e.target.value))}
              disabled={!enabled}
              className={cn(
                'h-20 appearance-none cursor-pointer',
                'accent-[var(--fp-color-accent)]',
                !enabled && 'cursor-not-allowed'
              )}
              style={{
                writingMode: 'vertical-lr',
                direction: 'rtl',
                width: '20px',
              }}
              aria-label={`${formatFrequency(band.frequency)}Hz`}
            />
            <span className="text-[10px] text-[var(--fp-color-text-muted)] mt-1">
              {formatFrequency(band.frequency)}
            </span>
          </div>
        ))}
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={onReset}
        disabled={!enabled}
        className={cn(
          'w-full px-2 py-1 rounded text-xs',
          'text-[var(--fp-color-text-secondary)]',
          'hover:text-[var(--fp-color-text)] hover:bg-[var(--fp-glass-bg)]',
          'transition-colors duration-[var(--fp-transition-fast)]',
          !enabled && 'cursor-not-allowed'
        )}
      >
        Reset
      </button>
    </div>
  );
}
