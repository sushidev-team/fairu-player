import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimeDisplay } from './TimeDisplay';
import { LabelsProvider } from '@/context/LabelsContext';
import type { ReactNode } from 'react';

function Wrapper({ children }: { children: ReactNode }) {
  return <LabelsProvider>{children}</LabelsProvider>;
}

function renderTimeDisplay(props: Partial<Parameters<typeof TimeDisplay>[0]> = {}) {
  const defaults = {
    currentTime: 0,
    duration: 0,
  };
  return render(<TimeDisplay {...defaults} {...props} />, { wrapper: Wrapper });
}

describe('TimeDisplay', () => {
  // ── Basic rendering ─────────────────────────────────────────────────

  it('renders current time and duration', () => {
    renderTimeDisplay({ currentTime: 65, duration: 180 });
    expect(screen.getByText('1:05')).toBeInTheDocument();
    expect(screen.getByText('3:00')).toBeInTheDocument();
  });

  it('renders the time separator', () => {
    renderTimeDisplay({ currentTime: 10, duration: 60 });
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('displays formatted time in MM:SS format', () => {
    renderTimeDisplay({ currentTime: 125, duration: 300 });
    expect(screen.getByText('2:05')).toBeInTheDocument();
    expect(screen.getByText('5:00')).toBeInTheDocument();
  });

  it('displays HH:MM:SS format for long durations', () => {
    renderTimeDisplay({ currentTime: 3661, duration: 7200 });
    expect(screen.getByText('1:01:01')).toBeInTheDocument();
    expect(screen.getByText('2:00:00')).toBeInTheDocument();
  });

  // ── Remaining mode ──────────────────────────────────────────────────

  it('shows remaining time when showRemaining is true', () => {
    renderTimeDisplay({ currentTime: 60, duration: 180, showRemaining: true });
    expect(screen.getByText('1:00')).toBeInTheDocument();
    // Remaining: 180 - 60 = 120 -> -2:00
    expect(screen.getByText('-2:00')).toBeInTheDocument();
  });

  it('shows total duration when showRemaining is false', () => {
    renderTimeDisplay({ currentTime: 60, duration: 180, showRemaining: false });
    expect(screen.getByText('3:00')).toBeInTheDocument();
    expect(screen.queryByText('-2:00')).not.toBeInTheDocument();
  });

  it('shows zero remaining at the end of playback', () => {
    renderTimeDisplay({ currentTime: 180, duration: 180, showRemaining: true });
    expect(screen.getByText('-0:00')).toBeInTheDocument();
  });

  // ── Zero times ──────────────────────────────────────────────────────

  it('renders 0:00 for zero currentTime and duration', () => {
    renderTimeDisplay({ currentTime: 0, duration: 0 });
    const zeros = screen.getAllByText('0:00');
    expect(zeros.length).toBe(2);
  });

  it('renders 0:00 for zero currentTime', () => {
    renderTimeDisplay({ currentTime: 0, duration: 120 });
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('2:00')).toBeInTheDocument();
  });

  // ── className ───────────────────────────────────────────────────────

  it('applies custom className', () => {
    const { container } = renderTimeDisplay({ className: 'my-time-class' });
    expect(container.firstElementChild?.className).toContain('my-time-class');
  });

  // ── Accessibility ───────────────────────────────────────────────────

  it('has an aria-label with time information', () => {
    renderTimeDisplay({ currentTime: 65, duration: 180 });
    const el = screen.getByLabelText('1:05 of 3:00');
    expect(el).toBeInTheDocument();
  });

  it('updates aria-label when time changes', () => {
    const { rerender } = render(
      <TimeDisplay currentTime={10} duration={60} />,
      { wrapper: Wrapper }
    );
    expect(screen.getByLabelText('0:10 of 1:00')).toBeInTheDocument();

    rerender(<TimeDisplay currentTime={30} duration={60} />);
    expect(screen.getByLabelText('0:30 of 1:00')).toBeInTheDocument();
  });

  // ── Custom labels ──────────────────────────────────────────────────

  it('uses custom separator label', () => {
    renderTimeDisplay({
      currentTime: 10,
      duration: 60,
      labels: { timeSeparator: '|' },
    });
    expect(screen.getByText('|')).toBeInTheDocument();
    expect(screen.queryByText('/')).not.toBeInTheDocument();
  });

  // ── Tabular nums ───────────────────────────────────────────────────

  it('applies tabular-nums class for monospaced digits', () => {
    const { container } = renderTimeDisplay({ currentTime: 10, duration: 60 });
    expect(container.firstElementChild?.className).toContain('tabular-nums');
  });
});
