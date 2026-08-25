import { useId } from 'react';
import { cn } from '@/utils/cn';
import { useLabels } from '@/context/LabelsContext';
import { interpolateLabel, resolveLabels, type PlayerLabels } from '@/types/labels';
import { GAIN_RANGE, type EqualizerBand, type EqualizerPreset } from '@/core/equalizer';

export interface EqualizerProps {
  bands: EqualizerBand[];
  presets: readonly EqualizerPreset[];
  /** Which preset the bands currently match, or `null` for a custom setting. */
  currentPreset: string | null;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onBandChange: (index: number, gain: number) => void;
  onPresetSelect: (name: string) => void;
  onReset: () => void;
  /** The source cannot be filtered — see `useEqualizer().blockedByCors`. */
  blockedByCors?: boolean;
  labels?: PlayerLabels;
  className?: string;
}

/** `60`, `910`, `4k`, `14k` — what fits under a slider. */
function formatFrequency(hz: number): string {
  return hz >= 1000 ? `${hz / 1000}k` : String(hz);
}

/**
 * The equaliser panel: a switch, presets, and one slider per band.
 *
 * Presentational — the audio graph belongs to {@link useEqualizer}.
 */
export function Equalizer({
  bands,
  presets,
  currentPreset,
  enabled,
  onToggle,
  onBandChange,
  onPresetSelect,
  onReset,
  blockedByCors = false,
  labels: labelsProp,
  className,
}: EqualizerProps) {
  const contextLabels = useLabels();
  const labels = resolveLabels(labelsProp ?? contextLabels);
  const groupId = useId();

  // Nothing here can do anything for a source Web Audio will only hand back as
  // silence, so the whole panel goes inert rather than misleading.
  const inert = blockedByCors;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg p-3',
        'border border-[var(--fp-glass-border)] bg-[var(--fp-color-surface)]',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{labels.equalizer}</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? labels.equalizerDisable : labels.equalizerEnable}
          disabled={inert}
          onClick={() => onToggle(!enabled)}
          className={cn(
            'relative h-5 w-9 rounded-full transition-colors',
            'duration-[var(--fp-transition-fast)]',
            enabled ? 'bg-[var(--fp-color-accent)]' : 'bg-[var(--fp-progress-bg)]',
            inert && 'cursor-not-allowed opacity-50'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
              'duration-[var(--fp-transition-fast)]',
              enabled ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>

      {inert && (
        <p className="text-xs text-[var(--fp-color-text-muted)]">
          {labels.equalizerCorsBlocked}
        </p>
      )}

      <div>
        <div className="mb-1.5 text-xs text-[var(--fp-color-text-muted)]">
          {labels.equalizerPresets}
        </div>
        <div className="flex flex-wrap gap-1">
          {presets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              aria-pressed={currentPreset === preset.name}
              disabled={inert}
              onClick={() => onPresetSelect(preset.name)}
              className={cn(
                'rounded border px-2 py-1 text-xs',
                'transition-colors duration-[var(--fp-transition-fast)]',
                currentPreset === preset.name
                  ? 'border-[var(--fp-color-accent)] text-[var(--fp-color-accent)]'
                  : 'border-[var(--fp-glass-border)] hover:border-[var(--fp-color-accent)]',
                inert && 'cursor-not-allowed opacity-50'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end justify-between gap-2" role="group" aria-label={labels.equalizer}>
        {bands.map((band, index) => {
          const id = `${groupId}-band-${index}`;
          const name = interpolateLabel(labels.equalizerBand, {
            frequency: formatFrequency(band.frequency),
          });

          return (
            <div key={band.frequency} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-[var(--fp-color-text-secondary)]">
                {band.gain > 0 ? `+${band.gain}` : band.gain}
              </span>
              {/*
                A vertical slider is what an equaliser looks like, and rotating a
                horizontal one keeps the native keyboard behaviour that a
                hand-rolled control would have to reimplement.
              */}
              <input
                id={id}
                type="range"
                min={GAIN_RANGE.min}
                max={GAIN_RANGE.max}
                step={1}
                value={band.gain}
                disabled={inert}
                aria-label={name}
                onChange={(event) => onBandChange(index, Number(event.target.value))}
                className={cn(
                  'h-24 w-4 appearance-none bg-transparent accent-[var(--fp-color-accent)]',
                  inert && 'cursor-not-allowed opacity-50'
                )}
                style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
              />
              <label htmlFor={id} className="text-[10px] text-[var(--fp-color-text-muted)]">
                {formatFrequency(band.frequency)}
              </label>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onReset}
        disabled={inert}
        className={cn(
          'w-full rounded px-2 py-1.5 text-xs',
          'text-[var(--fp-color-text-secondary)]',
          'transition-colors duration-[var(--fp-transition-fast)]',
          'hover:bg-[var(--fp-glass-bg)] hover:text-[var(--fp-color-text)]',
          inert && 'cursor-not-allowed opacity-50'
        )}
      >
        {labels.equalizerReset}
      </button>
    </div>
  );
}
