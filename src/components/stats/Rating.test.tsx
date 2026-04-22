import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Rating } from './Rating';
import { LabelsProvider } from '@/context/LabelsContext';
import type { ReactNode } from 'react';

function Wrapper({ children }: { children: ReactNode }) {
  return <LabelsProvider>{children}</LabelsProvider>;
}

function renderRating(props: Partial<Parameters<typeof Rating>[0]> = {}) {
  return render(<Rating {...props} />, { wrapper: Wrapper });
}

describe('Rating', () => {
  // ── Default rendering ──────────────────────────────────────────────

  it('renders thumbs up and thumbs down buttons', () => {
    renderRating();
    expect(screen.getByRole('button', { name: 'Like' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dislike' })).toBeInTheDocument();
  });

  it('renders with no user rating by default', () => {
    renderRating();
    // Both buttons should show unfilled state (stroke only)
    const upBtn = screen.getByRole('button', { name: 'Like' });
    const downBtn = screen.getByRole('button', { name: 'Dislike' });
    expect(upBtn.className).toContain('text-gray-400');
    expect(downBtn.className).toContain('text-gray-400');
  });

  it('shows count of 0 by default', () => {
    renderRating();
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBe(2); // up count and down count
  });

  // ── Click up ───────────────────────────────────────────────────────

  it('calls onRateUp when thumbs up is clicked', () => {
    const onRateUp = vi.fn();
    renderRating({ onRateUp });
    fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    expect(onRateUp).toHaveBeenCalledTimes(1);
  });

  it('calls onRatingChange with "up" when thumbs up is clicked', () => {
    const onRatingChange = vi.fn();
    renderRating({ onRatingChange });
    fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    expect(onRatingChange).toHaveBeenCalledWith('up');
  });

  it('increments up count when thumbs up is clicked', () => {
    renderRating({ initialState: { upCount: 10, downCount: 5 } });
    fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    expect(screen.getByText('11')).toBeInTheDocument();
  });

  // ── Click down ─────────────────────────────────────────────────────

  it('calls onRateDown when thumbs down is clicked', () => {
    const onRateDown = vi.fn();
    renderRating({ onRateDown });
    fireEvent.click(screen.getByRole('button', { name: 'Dislike' }));
    expect(onRateDown).toHaveBeenCalledTimes(1);
  });

  it('calls onRatingChange with "down" when thumbs down is clicked', () => {
    const onRatingChange = vi.fn();
    renderRating({ onRatingChange });
    fireEvent.click(screen.getByRole('button', { name: 'Dislike' }));
    expect(onRatingChange).toHaveBeenCalledWith('down');
  });

  it('increments down count when thumbs down is clicked', () => {
    renderRating({ initialState: { upCount: 10, downCount: 5 } });
    fireEvent.click(screen.getByRole('button', { name: 'Dislike' }));
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  // ── Toggle rating ──────────────────────────────────────────────────

  it('removes rating when same button is clicked twice', () => {
    const onRatingChange = vi.fn();
    renderRating({ onRatingChange });
    fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    expect(onRatingChange).toHaveBeenCalledWith('up');
    fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    expect(onRatingChange).toHaveBeenCalledWith(null);
  });

  it('calls onRateRemove when removing a rating', () => {
    const onRateRemove = vi.fn();
    renderRating({ onRateRemove, initialState: { userRating: 'up', upCount: 1 } });
    fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    expect(onRateRemove).toHaveBeenCalledTimes(1);
  });

  it('switches from up to down correctly', () => {
    const onRatingChange = vi.fn();
    renderRating({ onRatingChange, initialState: { upCount: 5, downCount: 3 } });
    // Click up
    fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    expect(onRatingChange).toHaveBeenLastCalledWith('up');
    // Click down (switches from up to down)
    fireEvent.click(screen.getByRole('button', { name: 'Dislike' }));
    expect(onRatingChange).toHaveBeenLastCalledWith('down');
  });

  // ── Initial state ──────────────────────────────────────────────────

  it('renders with initial upCount and downCount', () => {
    renderRating({ initialState: { upCount: 42, downCount: 8 } });
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders with initial userRating of up', () => {
    renderRating({ initialState: { userRating: 'up', upCount: 10 } });
    const upBtn = screen.getByRole('button', { name: 'Like' });
    expect(upBtn.className).toContain('text-green-500');
  });

  it('renders with initial userRating of down', () => {
    renderRating({ initialState: { userRating: 'down', downCount: 5 } });
    const downBtn = screen.getByRole('button', { name: 'Dislike' });
    expect(downBtn.className).toContain('text-red-500');
  });

  // ── Disabled state ─────────────────────────────────────────────────

  it('disables both buttons when disabled', () => {
    renderRating({ disabled: true });
    expect(screen.getByRole('button', { name: 'Like' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dislike' })).toBeDisabled();
  });

  it('applies disabled styling', () => {
    renderRating({ disabled: true });
    const upBtn = screen.getByRole('button', { name: 'Like' });
    expect(upBtn.className).toContain('opacity-50');
  });

  it('does not call callbacks when disabled', () => {
    const onRateUp = vi.fn();
    const onRateDown = vi.fn();
    renderRating({ disabled: true, onRateUp, onRateDown });
    fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dislike' }));
    expect(onRateUp).not.toHaveBeenCalled();
    expect(onRateDown).not.toHaveBeenCalled();
  });

  // ── showCounts ─────────────────────────────────────────────────────

  it('hides counts when showCounts is false', () => {
    renderRating({
      showCounts: false,
      initialState: { upCount: 42, downCount: 8 },
    });
    expect(screen.queryByText('42')).not.toBeInTheDocument();
    expect(screen.queryByText('8')).not.toBeInTheDocument();
  });

  it('shows counts when showCounts is true (default)', () => {
    renderRating({ initialState: { upCount: 42, downCount: 8 } });
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  // ── showPercentage ─────────────────────────────────────────────────

  it('shows percentage instead of count when showPercentage is true', () => {
    renderRating({
      showPercentage: true,
      initialState: { upCount: 75, downCount: 25 },
    });
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('shows raw count when total is 0 and showPercentage is true (no percentage when no votes)', () => {
    renderRating({
      showPercentage: true,
      initialState: { upCount: 0, downCount: 0 },
    });
    // When total is 0, falls back to showing raw upCount
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('does not show down count when showPercentage is true', () => {
    renderRating({
      showPercentage: true,
      initialState: { upCount: 75, downCount: 25 },
    });
    // Down count should not display as a number
    expect(screen.queryByText('25')).not.toBeInTheDocument();
  });

  // ── Size variants ──────────────────────────────────────────────────

  it('applies small size class', () => {
    const { container } = renderRating({ size: 'sm' });
    expect(container.firstElementChild?.className).toContain('text-xs');
  });

  it('applies medium size class by default', () => {
    const { container } = renderRating();
    expect(container.firstElementChild?.className).toContain('text-sm');
  });

  it('applies large size class', () => {
    const { container } = renderRating({ size: 'lg' });
    expect(container.firstElementChild?.className).toContain('text-base');
  });

  it('applies correct icon size for small', () => {
    renderRating({ size: 'sm' });
    const svgs = screen.getByRole('button', { name: 'Like' }).querySelectorAll('svg');
    expect(svgs[0].getAttribute('class')).toContain('w-4');
  });

  it('applies correct icon size for large', () => {
    renderRating({ size: 'lg' });
    const svgs = screen.getByRole('button', { name: 'Like' }).querySelectorAll('svg');
    expect(svgs[0].getAttribute('class')).toContain('w-6');
  });

  // ── Custom labels ──────────────────────────────────────────────────

  it('uses custom rateUp label', () => {
    renderRating({ labels: { rateUp: 'Daumen hoch' } });
    expect(screen.getByRole('button', { name: 'Daumen hoch' })).toBeInTheDocument();
  });

  it('uses custom rateDown label', () => {
    renderRating({ labels: { rateDown: 'Daumen runter' } });
    expect(screen.getByRole('button', { name: 'Daumen runter' })).toBeInTheDocument();
  });

  // ── className ──────────────────────────────────────────────────────

  it('passes custom className', () => {
    const { container } = renderRating({ className: 'my-rating' });
    expect(container.firstElementChild?.className).toContain('my-rating');
  });

  // ── Controlled state ───────────────────────────────────────────────

  it('uses controlled state when provided', () => {
    renderRating({
      state: { userRating: 'up', upCount: 100, downCount: 50 },
    });
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    const upBtn = screen.getByRole('button', { name: 'Like' });
    expect(upBtn.className).toContain('text-green-500');
  });

  // ── canRate ────────────────────────────────────────────────────────

  it('does not allow rating when canRate is false', () => {
    const onRateUp = vi.fn();
    renderRating({ initialState: { canRate: false }, onRateUp });
    fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    expect(onRateUp).not.toHaveBeenCalled();
  });

  // ── enabled ────────────────────────────────────────────────────────

  it('does not allow rating when enabled is false', () => {
    const onRateUp = vi.fn();
    renderRating({ initialState: { enabled: false }, onRateUp });
    fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    expect(onRateUp).not.toHaveBeenCalled();
  });
});
