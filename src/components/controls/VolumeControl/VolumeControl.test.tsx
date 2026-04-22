import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VolumeControl } from './VolumeControl';
import { LabelsProvider } from '@/context/LabelsContext';
import type { ReactNode } from 'react';

// ─── Helpers ────────────────────────────────────────────────────────

function Wrapper({ children }: { children: ReactNode }) {
  return <LabelsProvider>{children}</LabelsProvider>;
}

function renderVolumeControl(
  props: Partial<Parameters<typeof VolumeControl>[0]> = {}
) {
  const defaults = {
    volume: 0.75,
    muted: false,
    onVolumeChange: vi.fn(),
    onMuteToggle: vi.fn(),
  };
  return render(<VolumeControl {...defaults} {...props} />, { wrapper: Wrapper });
}

function mockSliderRect(el: Element) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 96,
    top: 0,
    bottom: 24,
    width: 96,
    height: 24,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
}

function mockVerticalSliderRect(el: Element) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 24,
    top: 0,
    bottom: 96,
    width: 24,
    height: 96,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
}

describe('VolumeControl', () => {
  // ── Mute button ───────────────────────────────────────────────────

  it('renders mute button with correct label when not muted', () => {
    renderVolumeControl({ muted: false });
    expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument();
  });

  it('renders unmute button with correct label when muted', () => {
    renderVolumeControl({ muted: true });
    expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
  });

  it('calls onMuteToggle when mute button is clicked', () => {
    const onMuteToggle = vi.fn();
    renderVolumeControl({ onMuteToggle });
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(onMuteToggle).toHaveBeenCalledTimes(1);
  });

  it('disables mute button when disabled', () => {
    renderVolumeControl({ disabled: true });
    expect(screen.getByRole('button', { name: 'Mute' })).toBeDisabled();
  });

  it('applies disabled styling to mute button', () => {
    renderVolumeControl({ disabled: true });
    expect(screen.getByRole('button', { name: 'Mute' }).className).toContain('opacity-50');
  });

  // ── Volume icon states ────────────────────────────────────────────

  it('shows muted icon (X lines) when volume is 0', () => {
    renderVolumeControl({ volume: 0, muted: false });
    const btn = screen.getByRole('button', { name: 'Mute' });
    const svg = btn.querySelector('svg')!;
    // Muted icon has line elements
    const lines = svg.querySelectorAll('line');
    expect(lines.length).toBe(2);
  });

  it('shows muted icon when muted is true regardless of volume', () => {
    renderVolumeControl({ volume: 0.8, muted: true });
    const btn = screen.getByRole('button', { name: 'Unmute' });
    const svg = btn.querySelector('svg')!;
    // effectiveVolume = 0 when muted
    const lines = svg.querySelectorAll('line');
    expect(lines.length).toBe(2);
  });

  it('shows low volume icon (one wave) for volume < 0.5', () => {
    renderVolumeControl({ volume: 0.3, muted: false });
    const btn = screen.getByRole('button', { name: 'Mute' });
    const svg = btn.querySelector('svg')!;
    const paths = svg.querySelectorAll('g[fill="currentColor"] > path');
    // First wave visible (opacity 1), second hidden (opacity 0)
    expect(paths[0]?.getAttribute('style')).toContain('opacity: 1');
    expect(paths[1]?.getAttribute('style')).toContain('opacity: 0');
  });

  it('shows full volume icon (two waves) for volume >= 0.5', () => {
    renderVolumeControl({ volume: 0.75, muted: false });
    const btn = screen.getByRole('button', { name: 'Mute' });
    const svg = btn.querySelector('svg')!;
    const paths = svg.querySelectorAll('g[fill="currentColor"] > path');
    // Both waves visible
    expect(paths[0]?.getAttribute('style')).toContain('opacity: 1');
    expect(paths[1]?.getAttribute('style')).toContain('opacity: 1');
  });

  // ── Horizontal layout ─────────────────────────────────────────────

  it('renders inline slider in horizontal mode', () => {
    renderVolumeControl({ orientation: 'horizontal' });
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('shows correct volume percentage as aria value (horizontal)', () => {
    renderVolumeControl({ orientation: 'horizontal', volume: 0.75 });
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuenow')).toBe('75');
    expect(slider.getAttribute('aria-valuetext')).toBe('75%');
  });

  it('shows 0% when muted (horizontal)', () => {
    renderVolumeControl({ orientation: 'horizontal', volume: 0.75, muted: true });
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuenow')).toBe('0');
  });

  it('has correct aria-valuemin and aria-valuemax (horizontal)', () => {
    renderVolumeControl({ orientation: 'horizontal' });
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuemin')).toBe('0');
    expect(slider.getAttribute('aria-valuemax')).toBe('100');
  });

  it('has correct aria-label (horizontal)', () => {
    renderVolumeControl({ orientation: 'horizontal' });
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
  });

  it('calls onVolumeChange on slider click (horizontal)', () => {
    const onVolumeChange = vi.fn();
    renderVolumeControl({ orientation: 'horizontal', onVolumeChange });
    const slider = screen.getByRole('slider');
    mockSliderRect(slider);
    fireEvent.mouseDown(slider, { clientX: 48, clientY: 12 });
    // 48/96 = 0.5
    expect(onVolumeChange).toHaveBeenCalledWith(0.5);
  });

  it('does not change volume on slider click when disabled (horizontal)', () => {
    const onVolumeChange = vi.fn();
    renderVolumeControl({ orientation: 'horizontal', onVolumeChange, disabled: true });
    const slider = screen.getByRole('slider');
    mockSliderRect(slider);
    fireEvent.mouseDown(slider, { clientX: 48, clientY: 12 });
    expect(onVolumeChange).not.toHaveBeenCalled();
  });

  it('calls onVolumeChange on drag (horizontal)', () => {
    const onVolumeChange = vi.fn();
    renderVolumeControl({ orientation: 'horizontal', onVolumeChange });
    const slider = screen.getByRole('slider');
    mockSliderRect(slider);

    fireEvent.mouseDown(slider, { clientX: 48, clientY: 12 });
    onVolumeChange.mockClear();

    // Global mousemove
    fireEvent.mouseMove(document, { clientX: 72, clientY: 12 });
    expect(onVolumeChange).toHaveBeenCalled();
  });

  it('stops dragging on global mouseup (horizontal)', () => {
    const onVolumeChange = vi.fn();
    renderVolumeControl({ orientation: 'horizontal', onVolumeChange });
    const slider = screen.getByRole('slider');
    mockSliderRect(slider);

    fireEvent.mouseDown(slider, { clientX: 48, clientY: 12 });
    fireEvent.mouseUp(document);
    onVolumeChange.mockClear();

    // After mouseup, mousemove should not call onVolumeChange
    fireEvent.mouseMove(document, { clientX: 72, clientY: 12 });
    expect(onVolumeChange).not.toHaveBeenCalled();
  });

  it('clamps volume to 0-1 range on slider click (horizontal)', () => {
    const onVolumeChange = vi.fn();
    renderVolumeControl({ orientation: 'horizontal', onVolumeChange });
    const slider = screen.getByRole('slider');
    mockSliderRect(slider);

    // Click beyond right edge
    fireEvent.mouseDown(slider, { clientX: 200, clientY: 12 });
    expect(onVolumeChange).toHaveBeenCalledWith(1);

    onVolumeChange.mockClear();
    // Click before left edge
    fireEvent.mouseDown(slider, { clientX: -50, clientY: 12 });
    expect(onVolumeChange).toHaveBeenCalledWith(0);
  });

  // ── Vertical layout ───────────────────────────────────────────────

  it('renders vertical slider overlay on hover (vertical)', () => {
    renderVolumeControl({ orientation: 'vertical' });
    const container = screen.getByRole('button', { name: 'Mute' }).parentElement!;
    fireEvent.mouseEnter(container);
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('shows volume percentage text in vertical overlay', () => {
    renderVolumeControl({ orientation: 'vertical', volume: 0.75 });
    const container = screen.getByRole('button', { name: 'Mute' }).parentElement!;
    fireEvent.mouseEnter(container);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('shows 0% when muted in vertical overlay', () => {
    renderVolumeControl({ orientation: 'vertical', volume: 0.75, muted: true });
    const container = screen.getByRole('button', { name: 'Unmute' }).parentElement!;
    fireEvent.mouseEnter(container);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('calls onVolumeChange on slider click (vertical)', () => {
    const onVolumeChange = vi.fn();
    renderVolumeControl({ orientation: 'vertical', onVolumeChange });
    const container = screen.getByRole('button', { name: 'Mute' }).parentElement!;
    fireEvent.mouseEnter(container);

    const slider = screen.getByRole('slider');
    mockVerticalSliderRect(slider);
    // Click at vertical position: 1 - (48/96) = 0.5
    fireEvent.mouseDown(slider, { clientX: 12, clientY: 48 });
    expect(onVolumeChange).toHaveBeenCalledWith(0.5);
  });

  it('hides vertical slider on mouse leave (when not dragging)', () => {
    renderVolumeControl({ orientation: 'vertical' });
    const container = screen.getByRole('button', { name: 'Mute' }).parentElement!;
    fireEvent.mouseEnter(container);
    // Slider should be visible (opacity-100)
    const overlay = container.querySelector('.absolute.bottom-full');
    expect(overlay?.className).toContain('opacity-100');

    fireEvent.mouseLeave(container);
    expect(overlay?.className).toContain('opacity-0');
  });

  // ── Keyboard interaction ──────────────────────────────────────────

  it('increases volume on ArrowUp key (horizontal)', () => {
    const onVolumeChange = vi.fn();
    renderVolumeControl({ orientation: 'horizontal', volume: 0.5, onVolumeChange });
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    // step = 0.05, so 0.5 + 0.05 = 0.55
    expect(onVolumeChange).toHaveBeenCalledWith(0.55);
  });

  it('increases volume on ArrowRight key', () => {
    const onVolumeChange = vi.fn();
    renderVolumeControl({ orientation: 'horizontal', volume: 0.5, onVolumeChange });
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onVolumeChange).toHaveBeenCalledWith(0.55);
  });

  it('decreases volume on ArrowDown key', () => {
    const onVolumeChange = vi.fn();
    renderVolumeControl({ orientation: 'horizontal', volume: 0.5, onVolumeChange });
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(onVolumeChange).toHaveBeenCalledWith(0.45);
  });

  it('decreases volume on ArrowLeft key', () => {
    const onVolumeChange = vi.fn();
    renderVolumeControl({ orientation: 'horizontal', volume: 0.5, onVolumeChange });
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(onVolumeChange).toHaveBeenCalledWith(0.45);
  });

  it('uses large step (0.1) with Shift key', () => {
    const onVolumeChange = vi.fn();
    renderVolumeControl({ orientation: 'horizontal', volume: 0.5, onVolumeChange });
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowUp', shiftKey: true });
    expect(onVolumeChange).toHaveBeenCalledWith(0.6);
  });

  it('clamps volume to max 1 on keyboard', () => {
    const onVolumeChange = vi.fn();
    renderVolumeControl({ orientation: 'horizontal', volume: 0.98, onVolumeChange });
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(onVolumeChange).toHaveBeenCalledWith(1);
  });

  it('clamps volume to min 0 on keyboard', () => {
    const onVolumeChange = vi.fn();
    renderVolumeControl({ orientation: 'horizontal', volume: 0.02, onVolumeChange });
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(onVolumeChange).toHaveBeenCalledWith(0);
  });

  it('ignores keyboard when disabled', () => {
    const onVolumeChange = vi.fn();
    renderVolumeControl({ orientation: 'horizontal', volume: 0.5, onVolumeChange, disabled: true });
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(onVolumeChange).not.toHaveBeenCalled();
  });

  it('ignores unrelated keys', () => {
    const onVolumeChange = vi.fn();
    renderVolumeControl({ orientation: 'horizontal', volume: 0.5, onVolumeChange });
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'a' });
    expect(onVolumeChange).not.toHaveBeenCalled();
  });

  // ── className passthrough ─────────────────────────────────────────

  it('applies custom className (horizontal)', () => {
    const { container } = renderVolumeControl({ orientation: 'horizontal', className: 'my-volume' });
    expect(container.firstChild).toHaveClass('my-volume');
  });

  it('applies custom className (vertical)', () => {
    const { container } = renderVolumeControl({ orientation: 'vertical', className: 'my-volume' });
    expect(container.firstChild).toHaveClass('my-volume');
  });

  // ── Custom labels ─────────────────────────────────────────────────

  it('uses custom mute label', () => {
    renderVolumeControl({
      muted: false,
      labels: { mute: 'Stummschalten', unmute: 'Laut', volume: 'Lautst\u00e4rke' },
    });
    expect(screen.getByRole('button', { name: 'Stummschalten' })).toBeInTheDocument();
  });

  it('uses custom unmute label', () => {
    renderVolumeControl({
      muted: true,
      labels: { mute: 'Stummschalten', unmute: 'Laut', volume: 'Lautst\u00e4rke' },
    });
    expect(screen.getByRole('button', { name: 'Laut' })).toBeInTheDocument();
  });

  it('uses custom volume aria-label on slider', () => {
    renderVolumeControl({
      orientation: 'horizontal',
      labels: { mute: 'Stummschalten', unmute: 'Laut', volume: 'Lautst\u00e4rke' },
    });
    expect(screen.getByRole('slider', { name: 'Lautst\u00e4rke' })).toBeInTheDocument();
  });

  // ── Close on outside click ────────────────────────────────────────

  it('closes vertical slider on outside click', () => {
    renderVolumeControl({ orientation: 'vertical' });
    const container = screen.getByRole('button', { name: 'Mute' }).parentElement!;
    fireEvent.mouseEnter(container);
    const overlay = container.querySelector('.absolute.bottom-full');
    expect(overlay?.className).toContain('opacity-100');

    // Click outside
    fireEvent.mouseDown(document.body);
    expect(overlay?.className).toContain('opacity-0');
  });

  // ── Slider not focusable when disabled ────────────────────────────

  it('slider has tabIndex -1 when disabled (horizontal)', () => {
    renderVolumeControl({ orientation: 'horizontal', disabled: true });
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('tabindex')).toBe('-1');
  });

  it('slider has tabIndex 0 when enabled (horizontal)', () => {
    renderVolumeControl({ orientation: 'horizontal', disabled: false });
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('tabindex')).toBe('0');
  });

  // ── Volume fill width ─────────────────────────────────────────────

  it('shows correct volume fill width (horizontal)', () => {
    renderVolumeControl({ orientation: 'horizontal', volume: 0.6, muted: false });
    const slider = screen.getByRole('slider');
    // Volume fill is inside the slider
    const fill = slider.querySelector('.absolute.left-0.top-0.bottom-0');
    expect((fill as HTMLElement)?.style.width).toBe('60%');
  });

  it('shows 0% fill when muted (horizontal)', () => {
    renderVolumeControl({ orientation: 'horizontal', volume: 0.6, muted: true });
    const slider = screen.getByRole('slider');
    const fill = slider.querySelector('.absolute.left-0.top-0.bottom-0');
    expect((fill as HTMLElement)?.style.width).toBe('0%');
  });
});
