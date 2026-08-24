/**
 * The subtitle settings panel.
 *
 * Presentational, so the tests are about what a viewer can reach: whether the
 * panel opens and closes the way the other popovers do, whether the controls
 * are labelled, and whether every change reaches the caller.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubtitleSettings } from './SubtitleSettings';
import {
  DEFAULT_SUBTITLE_STYLE,
  SUBTITLE_PRESETS,
  type SubtitleStyle,
} from '@/core/subtitleStyle';

let onStyleChange: Mock<(updates: Partial<SubtitleStyle>) => void>;
let onPresetSelect: Mock<(presetName: string) => void>;
let onReset: Mock<() => void>;

beforeEach(() => {
  onStyleChange = vi.fn();
  onPresetSelect = vi.fn();
  onReset = vi.fn();
});

function mount(style = DEFAULT_SUBTITLE_STYLE, disabled = false) {
  return render(
    <SubtitleSettings
      style={style}
      onStyleChange={onStyleChange}
      onPresetSelect={onPresetSelect}
      onReset={onReset}
      presets={SUBTITLE_PRESETS}
      disabled={disabled}
    />
  );
}

const toggle = () => screen.getByRole('button', { name: 'Subtitle style' });
const open = () => fireEvent.click(toggle());
const panel = () => screen.queryByRole('dialog');

describe('SubtitleSettings', () => {
  describe('the panel', () => {
    it('starts closed', () => {
      mount();

      expect(panel()).not.toBeInTheDocument();
      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens on the button', () => {
      mount();
      open();

      expect(panel()).toBeInTheDocument();
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes on a click outside', () => {
      mount();
      open();

      fireEvent.mouseDown(document.body);

      expect(panel()).not.toBeInTheDocument();
    });

    it('closes on Escape', () => {
      mount();
      open();

      fireEvent.keyDown(document, { key: 'Escape' });

      // Matching the other popovers in the bar — a panel that traps the viewer
      // over the video is worse than one that closes too eagerly.
      expect(panel()).not.toBeInTheDocument();
    });

    it('stays shut while disabled', () => {
      mount(DEFAULT_SUBTITLE_STYLE, true);
      open();

      expect(panel()).not.toBeInTheDocument();
    });
  });

  describe('the controls', () => {
    it('labels both sliders', () => {
      mount();
      open();

      // Associated by htmlFor, so a screen reader announces which is which.
      expect(screen.getByLabelText('Font size')).toBeInTheDocument();
      expect(screen.getByLabelText('Background')).toBeInTheDocument();
    });

    it('reports a font size change', () => {
      mount();
      open();

      fireEvent.change(screen.getByLabelText('Font size'), { target: { value: '24' } });

      expect(onStyleChange).toHaveBeenCalledWith({ fontSize: 24 });
    });

    it('reports background opacity as a fraction', () => {
      mount();
      open();

      fireEvent.change(screen.getByLabelText('Background'), { target: { value: '40' } });

      // The slider is in percent because that is what a person reads.
      expect(onStyleChange).toHaveBeenCalledWith({ backgroundOpacity: 0.4 });
    });

    it('reports a position change', () => {
      mount();
      open();

      fireEvent.click(screen.getByRole('button', { name: 'Top' }));

      expect(onStyleChange).toHaveBeenCalledWith({ position: 'top' });
    });

    it('marks the position in use', () => {
      mount({ ...DEFAULT_SUBTITLE_STYLE, position: 'top' });
      open();

      expect(screen.getByRole('button', { name: 'Top' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Bottom' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    it('reports a preset', () => {
      mount();
      open();

      fireEvent.click(screen.getByRole('button', { name: 'High contrast' }));

      expect(onPresetSelect).toHaveBeenCalledWith('high-contrast');
    });

    it('marks the preset in use by value, not by name', () => {
      const contrast = SUBTITLE_PRESETS.find((p) => p.name === 'high-contrast')!;
      mount(contrast.style);
      open();

      expect(screen.getByRole('button', { name: 'High contrast' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    it('stops claiming a preset once a slider moves', () => {
      const contrast = SUBTITLE_PRESETS.find((p) => p.name === 'high-contrast')!;
      mount({ ...contrast.style, fontSize: 31 });
      open();

      // Otherwise the panel says "high contrast" about a style that is not it.
      expect(screen.getByRole('button', { name: 'High contrast' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    it('resets', () => {
      mount();
      open();

      fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }));

      expect(onReset).toHaveBeenCalled();
    });
  });
});
