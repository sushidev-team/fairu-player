import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdSkipButton } from './AdSkipButton';

describe('AdSkipButton', () => {
  // ── Countdown display ──────────────────────────────────────────────

  it('shows countdown text when cannot skip', () => {
    render(<AdSkipButton canSkip={false} countdown={5} />);
    expect(screen.getByText('Skip in 5s')).toBeInTheDocument();
  });

  it('shows updated countdown value', () => {
    render(<AdSkipButton canSkip={false} countdown={3} />);
    expect(screen.getByText('Skip in 3s')).toBeInTheDocument();
  });

  it('shows countdown of 1', () => {
    render(<AdSkipButton canSkip={false} countdown={1} />);
    expect(screen.getByText('Skip in 1s')).toBeInTheDocument();
  });

  it('renders countdown as a non-interactive div (not a button)', () => {
    render(<AdSkipButton canSkip={false} countdown={5} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  // ── Skip enabled ───────────────────────────────────────────────────

  it('shows "Skip Ad" button when canSkip is true', () => {
    render(<AdSkipButton canSkip={true} countdown={0} />);
    expect(screen.getByText('Skip Ad')).toBeInTheDocument();
  });

  it('renders as a button when canSkip is true', () => {
    render(<AdSkipButton canSkip={true} countdown={0} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders a skip icon SVG when canSkip is true', () => {
    render(<AdSkipButton canSkip={true} countdown={0} />);
    const btn = screen.getByRole('button');
    const svg = btn.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  // ── Click handler ──────────────────────────────────────────────────

  it('calls onClick when skip button is clicked', () => {
    const onClick = vi.fn();
    render(<AdSkipButton canSkip={true} countdown={0} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not crash when onClick is undefined', () => {
    render(<AdSkipButton canSkip={true} countdown={0} />);
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow();
  });

  // ── Nothing rendered ───────────────────────────────────────────────

  it('renders nothing when canSkip is false and countdown is 0', () => {
    const { container } = render(<AdSkipButton canSkip={false} countdown={0} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when canSkip is false and countdown is negative', () => {
    const { container } = render(<AdSkipButton canSkip={false} countdown={-1} />);
    expect(container.innerHTML).toBe('');
  });

  // ── className ──────────────────────────────────────────────────────

  it('passes className to skip button', () => {
    render(<AdSkipButton canSkip={true} countdown={0} className="my-skip" />);
    expect(screen.getByRole('button').className).toContain('my-skip');
  });

  it('passes className to countdown div', () => {
    const { container } = render(
      <AdSkipButton canSkip={false} countdown={5} className="my-countdown" />
    );
    const div = container.firstElementChild;
    expect(div?.className).toContain('my-countdown');
  });

  // ── Button type ────────────────────────────────────────────────────

  it('has type="button" on the skip button', () => {
    render(<AdSkipButton canSkip={true} countdown={0} />);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });

  // ── Styling ────────────────────────────────────────────────────────

  it('applies shadow class to skip button', () => {
    render(<AdSkipButton canSkip={true} countdown={0} />);
    expect(screen.getByRole('button').className).toContain('shadow-lg');
  });

  it('applies backdrop-blur to countdown', () => {
    const { container } = render(<AdSkipButton canSkip={false} countdown={3} />);
    expect(container.firstElementChild?.className).toContain('backdrop-blur-sm');
  });
});
