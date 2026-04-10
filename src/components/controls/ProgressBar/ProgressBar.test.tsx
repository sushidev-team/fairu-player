import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';
import { LabelsProvider } from '@/context/LabelsContext';
import { createMockChapters, createMockMarkers } from '@/test/helpers';
import type { ReactNode } from 'react';
import type { Chapter } from '@/types/player';
import type { TimelineMarker } from '@/types/markers';

// ─── Helpers ────────────────────────────────────────────────────────

function Wrapper({ children }: { children: ReactNode }) {
  return <LabelsProvider>{children}</LabelsProvider>;
}

function renderProgressBar(
  props: Partial<Parameters<typeof ProgressBar>[0]> = {}
) {
  const defaults = {
    currentTime: 60,
    duration: 300,
  };
  return render(<ProgressBar {...defaults} {...props} />, { wrapper: Wrapper });
}

// Mock getBoundingClientRect for position calculations
function mockSliderRect(el: Element) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 500,
    top: 0,
    bottom: 20,
    width: 500,
    height: 20,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
}

describe('ProgressBar', () => {
  // ── Basic rendering ───────────────────────────────────────────────

  it('renders the slider element', () => {
    renderProgressBar();
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('has correct aria attributes', () => {
    renderProgressBar({ currentTime: 60, duration: 300 });
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuemin')).toBe('0');
    expect(slider.getAttribute('aria-valuemax')).toBe('300');
    expect(slider.getAttribute('aria-valuenow')).toBe('60');
  });

  it('has correct aria-valuetext', () => {
    renderProgressBar({ currentTime: 65, duration: 300 });
    const slider = screen.getByRole('slider');
    // 65 seconds = 1:05, 300 seconds = 5:00
    expect(slider.getAttribute('aria-valuetext')).toBe('1:05 of 5:00');
  });

  it('has aria-label from labels', () => {
    renderProgressBar();
    expect(screen.getByRole('slider')).toHaveAttribute('aria-label', 'Seek slider');
  });

  it('is focusable by default', () => {
    renderProgressBar();
    expect(screen.getByRole('slider').getAttribute('tabindex')).toBe('0');
  });

  it('is not focusable when disabled', () => {
    renderProgressBar({ disabled: true });
    expect(screen.getByRole('slider').getAttribute('tabindex')).toBe('-1');
  });

  // ── Progress display ──────────────────────────────────────────────

  it('shows current progress as percentage width', () => {
    const { container } = renderProgressBar({ currentTime: 150, duration: 300 });
    // 150/300 = 50%
    const progressBar = container.querySelectorAll('.rounded-full')[2]; // current progress div
    expect((progressBar as HTMLElement).style.width).toBe('50%');
  });

  it('shows 0% progress when duration is 0', () => {
    const { container } = renderProgressBar({ currentTime: 0, duration: 0 });
    // Should not crash and show 0%
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  // ── Buffered indicator ────────────────────────────────────────────

  it('shows buffered progress', () => {
    const { container } = renderProgressBar({ buffered: 200, duration: 300 });
    // 200/300 = ~66.67%
    const bufferedBar = container.querySelector('.bg-\\[var\\(--fp-progress-buffer\\)\\]');
    expect(bufferedBar).toBeInTheDocument();
    expect((bufferedBar as HTMLElement).style.width).toBe('66.66666666666666%');
  });

  it('shows 0% buffered by default', () => {
    const { container } = renderProgressBar();
    const bufferedBar = container.querySelector('.bg-\\[var\\(--fp-progress-buffer\\)\\]');
    expect((bufferedBar as HTMLElement).style.width).toBe('0%');
  });

  // ── Seeking via click ─────────────────────────────────────────────

  it('calls onSeek when clicked', () => {
    const onSeek = vi.fn();
    renderProgressBar({ onSeek });
    const slider = screen.getByRole('slider');
    mockSliderRect(slider);
    // Click at position 250/500 = 50% of 300 = 150
    fireEvent.mouseDown(slider, { clientX: 250 });
    expect(onSeek).toHaveBeenCalledWith(150);
  });

  it('calls onSeekStart when mouse down', () => {
    const onSeekStart = vi.fn();
    renderProgressBar({ onSeekStart });
    const slider = screen.getByRole('slider');
    mockSliderRect(slider);
    fireEvent.mouseDown(slider, { clientX: 100 });
    expect(onSeekStart).toHaveBeenCalledTimes(1);
  });

  it('does not seek when disabled', () => {
    const onSeek = vi.fn();
    const onSeekStart = vi.fn();
    renderProgressBar({ onSeek, onSeekStart, disabled: true });
    const slider = screen.getByRole('slider');
    mockSliderRect(slider);
    fireEvent.mouseDown(slider, { clientX: 250 });
    expect(onSeek).not.toHaveBeenCalled();
    expect(onSeekStart).not.toHaveBeenCalled();
  });

  // ── Dragging ──────────────────────────────────────────────────────

  it('calls onSeek during drag (mouseMove while dragging)', () => {
    const onSeek = vi.fn();
    renderProgressBar({ onSeek });
    const slider = screen.getByRole('slider');
    mockSliderRect(slider);

    // Start drag
    fireEvent.mouseDown(slider, { clientX: 100 });
    onSeek.mockClear();

    // Move while hovering the slider element
    fireEvent.mouseMove(slider, { clientX: 200 });
    expect(onSeek).toHaveBeenCalled();
  });

  it('calls onSeekEnd on global mouseup after drag', () => {
    const onSeekEnd = vi.fn();
    renderProgressBar({ onSeekEnd });
    const slider = screen.getByRole('slider');
    mockSliderRect(slider);

    // Start drag
    fireEvent.mouseDown(slider, { clientX: 100 });
    // End drag (global mouseup)
    fireEvent.mouseUp(document);
    expect(onSeekEnd).toHaveBeenCalledTimes(1);
  });

  // ── Touch events ──────────────────────────────────────────────────

  it('calls onSeek on touch start', () => {
    const onSeek = vi.fn();
    renderProgressBar({ onSeek });
    const slider = screen.getByRole('slider');
    mockSliderRect(slider);
    fireEvent.touchStart(slider, { touches: [{ clientX: 250 }] });
    expect(onSeek).toHaveBeenCalled();
  });

  it('does not seek on touch when disabled', () => {
    const onSeek = vi.fn();
    renderProgressBar({ onSeek, disabled: true });
    const slider = screen.getByRole('slider');
    fireEvent.touchStart(slider, { touches: [{ clientX: 250 }] });
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('calls onSeekEnd on touch end', () => {
    const onSeekEnd = vi.fn();
    renderProgressBar({ onSeekEnd });
    const slider = screen.getByRole('slider');
    mockSliderRect(slider);
    fireEvent.touchStart(slider, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(slider);
    expect(onSeekEnd).toHaveBeenCalledTimes(1);
  });

  // ── Keyboard accessibility ────────────────────────────────────────

  it('seeks backward 5 seconds on ArrowLeft', () => {
    const onSeek = vi.fn();
    renderProgressBar({ currentTime: 60, duration: 300, onSeek });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowLeft' });
    expect(onSeek).toHaveBeenCalledWith(55);
  });

  it('seeks forward 5 seconds on ArrowRight', () => {
    const onSeek = vi.fn();
    renderProgressBar({ currentTime: 60, duration: 300, onSeek });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenCalledWith(65);
  });

  it('seeks backward 10 seconds on Shift+ArrowLeft', () => {
    const onSeek = vi.fn();
    renderProgressBar({ currentTime: 60, duration: 300, onSeek });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowLeft', shiftKey: true });
    expect(onSeek).toHaveBeenCalledWith(50);
  });

  it('seeks forward 10 seconds on Shift+ArrowRight', () => {
    const onSeek = vi.fn();
    renderProgressBar({ currentTime: 60, duration: 300, onSeek });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight', shiftKey: true });
    expect(onSeek).toHaveBeenCalledWith(70);
  });

  it('seeks to start on Home key', () => {
    const onSeek = vi.fn();
    renderProgressBar({ currentTime: 60, duration: 300, onSeek });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'Home' });
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('seeks to end on End key', () => {
    const onSeek = vi.fn();
    renderProgressBar({ currentTime: 60, duration: 300, onSeek });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(onSeek).toHaveBeenCalledWith(300);
  });

  it('does not go below 0 on ArrowLeft', () => {
    const onSeek = vi.fn();
    renderProgressBar({ currentTime: 2, duration: 300, onSeek });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowLeft' });
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('does not go above duration on ArrowRight', () => {
    const onSeek = vi.fn();
    renderProgressBar({ currentTime: 298, duration: 300, onSeek });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenCalledWith(300);
  });

  it('ignores keyboard events when disabled', () => {
    const onSeek = vi.fn();
    renderProgressBar({ onSeek, disabled: true });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowLeft' });
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('ignores unrelated keys', () => {
    const onSeek = vi.fn();
    renderProgressBar({ onSeek });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'a' });
    expect(onSeek).not.toHaveBeenCalled();
  });

  // ── Chapter markers ───────────────────────────────────────────────

  it('renders chapter markers', () => {
    const chapters = createMockChapters();
    const { container } = renderProgressBar({ chapters, duration: 180 });
    // Chapter markers at startTime 0, 30, 120 => 3 markers
    const markers = container.querySelectorAll('button[aria-label^="Go to chapter"]');
    expect(markers.length).toBe(3);
  });

  it('positions chapter markers correctly', () => {
    const chapters: Chapter[] = [
      { id: 'ch-1', title: 'Intro', startTime: 0, endTime: 60 },
      { id: 'ch-2', title: 'Middle', startTime: 60, endTime: 120 },
    ];
    const { container } = renderProgressBar({ chapters, duration: 120 });
    const markerElements = container.querySelectorAll('button[aria-label^="Go to chapter"]');
    expect((markerElements[0] as HTMLElement).style.left).toBe('0%');
    expect((markerElements[1] as HTMLElement).style.left).toBe('50%');
  });

  // ── Timeline markers ──────────────────────────────────────────────

  it('renders timeline markers', () => {
    const markers = createMockMarkers();
    const { container } = renderProgressBar({ markers, duration: 180 });
    // 3 marker dots
    const markerDots = container.querySelectorAll('.rounded-full.-translate-y-1\\/2');
    expect(markerDots.length).toBeGreaterThanOrEqual(3);
  });

  it('applies custom marker color', () => {
    const markers: TimelineMarker[] = [
      { id: 'm-1', time: 60, title: 'Marker', color: '#ff0000' },
    ];
    const { container } = renderProgressBar({ markers, duration: 300 });
    const markerDot = container.querySelector('.-translate-x-1\\/2.-translate-y-1\\/2');
    expect((markerDot as HTMLElement)?.style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  // ── Hover / Tooltip ───────────────────────────────────────────────

  it('shows tooltip on hover when showTooltip is true', () => {
    const { container } = renderProgressBar({ showTooltip: true });
    const slider = screen.getByRole('slider');
    mockSliderRect(slider);
    fireEvent.mouseEnter(slider);
    fireEvent.mouseMove(slider, { clientX: 250 });
    // Tooltip should appear with time
    const tooltip = container.querySelector('.pointer-events-none');
    expect(tooltip).toBeInTheDocument();
  });

  it('does not show tooltip when showTooltip is false', () => {
    const { container } = renderProgressBar({ showTooltip: false });
    const slider = screen.getByRole('slider');
    mockSliderRect(slider);
    fireEvent.mouseEnter(slider);
    fireEvent.mouseMove(slider, { clientX: 250 });
    const tooltip = container.querySelector('.pointer-events-none.whitespace-nowrap');
    expect(tooltip).toBeNull();
  });

  it('does not show tooltip when disabled', () => {
    const { container } = renderProgressBar({ disabled: true, showTooltip: true });
    const slider = screen.getByRole('slider');
    fireEvent.mouseEnter(slider);
    fireEvent.mouseMove(slider, { clientX: 250 });
    const tooltip = container.querySelector('.pointer-events-none.whitespace-nowrap');
    expect(tooltip).toBeNull();
  });

  it('hides tooltip on mouse leave', () => {
    renderProgressBar({ showTooltip: true });
    const slider = screen.getByRole('slider');
    mockSliderRect(slider);
    fireEvent.mouseEnter(slider);
    fireEvent.mouseMove(slider, { clientX: 250 });
    fireEvent.mouseLeave(slider);
    // hoverPosition becomes null
    const tooltip = screen.getByRole('slider').parentElement?.querySelector('.pointer-events-none.whitespace-nowrap');
    expect(tooltip).toBeNull();
  });

  // ── Disabled state ────────────────────────────────────────────────

  it('applies disabled styling', () => {
    renderProgressBar({ disabled: true });
    expect(screen.getByRole('slider').className).toContain('cursor-not-allowed');
    expect(screen.getByRole('slider').className).toContain('opacity-50');
  });

  it('hides drag handle when disabled', () => {
    const { container } = renderProgressBar({ disabled: true });
    const handle = container.querySelector('.shadow-md');
    expect(handle?.className).toContain('hidden');
  });

  // ── className passthrough ─────────────────────────────────────────

  it('applies custom className', () => {
    renderProgressBar({ className: 'my-progress' });
    expect(screen.getByRole('slider').className).toContain('my-progress');
  });

  // ── Custom labels ─────────────────────────────────────────────────

  it('uses custom seek slider label', () => {
    renderProgressBar({ labels: { seekSlider: 'Zeitleiste' } });
    expect(screen.getByRole('slider', { name: 'Zeitleiste' })).toBeInTheDocument();
  });
});
