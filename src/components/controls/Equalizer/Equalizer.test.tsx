/**
 * The equaliser panel.
 *
 * Presentational, so this is about what a listener can reach — including the
 * case where nothing can work at all, because the source is one Web Audio would
 * only hand back as silence.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Equalizer } from './Equalizer';
import { EQUALIZER_PRESETS, bandsForPreset } from '@/core/equalizer';

let onToggle: Mock<(enabled: boolean) => void>;
let onBandChange: Mock<(index: number, gain: number) => void>;
let onPresetSelect: Mock<(name: string) => void>;
let onReset: Mock<() => void>;

beforeEach(() => {
  onToggle = vi.fn();
  onBandChange = vi.fn();
  onPresetSelect = vi.fn();
  onReset = vi.fn();
});

function mount(props: Partial<React.ComponentProps<typeof Equalizer>> = {}) {
  return render(
    <Equalizer
      bands={bandsForPreset('flat')}
      presets={EQUALIZER_PRESETS}
      currentPreset="flat"
      enabled
      onToggle={onToggle}
      onBandChange={onBandChange}
      onPresetSelect={onPresetSelect}
      onReset={onReset}
      {...props}
    />
  );
}

const toggle = () => screen.getByRole('switch');

describe('Equalizer', () => {
  describe('the switch', () => {
    it('reports its state', () => {
      mount({ enabled: true });
      expect(toggle()).toBeChecked();

      mount({ enabled: false });
      expect(screen.getAllByRole('switch')[1]).not.toBeChecked();
    });

    it('reports a change', () => {
      mount({ enabled: false });

      fireEvent.click(toggle());

      expect(onToggle).toHaveBeenCalledWith(true);
    });
  });

  describe('the bands', () => {
    it('gives every slider a name', () => {
      mount();

      // Five unlabelled sliders in a row are unusable without sight.
      expect(screen.getByLabelText('60Hz')).toBeInTheDocument();
      expect(screen.getByLabelText('4kHz')).toBeInTheDocument();
      expect(screen.getByLabelText('14kHz')).toBeInTheDocument();
    });

    it('reports a gain change with its index', () => {
      mount();

      fireEvent.change(screen.getByLabelText('910Hz'), { target: { value: '5' } });

      expect(onBandChange).toHaveBeenCalledWith(2, 5);
    });

    it('shows the gain, signed', () => {
      mount({ bands: bandsForPreset('bass-boost') });

      expect(screen.getByText('+6')).toBeInTheDocument();
      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    });

    it('bounds the sliders to what the filters accept', () => {
      mount();
      const slider = screen.getByLabelText('60Hz');

      expect(slider).toHaveAttribute('min', '-12');
      expect(slider).toHaveAttribute('max', '12');
    });
  });

  describe('presets', () => {
    it('marks the one in use', () => {
      mount({ currentPreset: 'podcast' });

      expect(screen.getByRole('button', { name: 'Podcast' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    it('marks none for a custom setting', () => {
      mount({ currentPreset: null });

      for (const preset of EQUALIZER_PRESETS) {
        expect(screen.getByRole('button', { name: preset.label })).toHaveAttribute(
          'aria-pressed',
          'false'
        );
      }
    });

    it('reports a selection', () => {
      mount();

      fireEvent.click(screen.getByRole('button', { name: 'Voice boost' }));

      expect(onPresetSelect).toHaveBeenCalledWith('voice-boost');
    });

    it('resets', () => {
      mount();

      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

      expect(onReset).toHaveBeenCalled();
    });
  });

  describe('when the source cannot be filtered', () => {
    it('says so and disables everything', () => {
      mount({ blockedByCors: true });

      // Web Audio would hand back silence for this element. A panel that still
      // looked usable would let a listener mute themselves and wonder why.
      expect(screen.getByText('Unavailable for this source')).toBeInTheDocument();
      expect(toggle()).toBeDisabled();
      expect(screen.getByLabelText('60Hz')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Podcast' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    });
  });
});
