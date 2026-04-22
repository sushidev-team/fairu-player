import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlaybackSpeed } from './PlaybackSpeed';
import { LabelsProvider } from '@/context/LabelsContext';
import type { ReactNode } from 'react';

function Wrapper({ children }: { children: ReactNode }) {
  return <LabelsProvider>{children}</LabelsProvider>;
}

function renderPlaybackSpeed(props: Partial<Parameters<typeof PlaybackSpeed>[0]> = {}) {
  const defaults = {
    speed: 1,
    onSpeedChange: vi.fn(),
  };
  return render(<PlaybackSpeed {...defaults} {...props} />, { wrapper: Wrapper });
}

describe('PlaybackSpeed', () => {
  // ── Current speed display ───────────────────────────────────────────

  it('renders the current speed as 1x', () => {
    renderPlaybackSpeed({ speed: 1 });
    expect(screen.getByText('1x')).toBeInTheDocument();
  });

  it('renders speed 0.5 as 0.5x', () => {
    renderPlaybackSpeed({ speed: 0.5 });
    expect(screen.getByText('0.5x')).toBeInTheDocument();
  });

  it('renders speed 2 as 2x', () => {
    renderPlaybackSpeed({ speed: 2 });
    expect(screen.getByText('2x')).toBeInTheDocument();
  });

  it('renders speed 1.5 as 1.5x', () => {
    renderPlaybackSpeed({ speed: 1.5 });
    expect(screen.getByText('1.5x')).toBeInTheDocument();
  });

  // ── Dropdown menu ───────────────────────────────────────────────────

  it('does not show dropdown menu initially', () => {
    renderPlaybackSpeed();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens dropdown menu on click', () => {
    renderPlaybackSpeed();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('shows all default speed options in the menu', () => {
    renderPlaybackSpeed();
    fireEvent.click(screen.getByRole('button'));
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(6); // [0.5, 0.75, 1, 1.25, 1.5, 2]
  });

  it('marks the current speed as selected', () => {
    renderPlaybackSpeed({ speed: 1.5 });
    fireEvent.click(screen.getByRole('button'));
    const selectedOption = screen.getByRole('option', { selected: true });
    expect(selectedOption).toHaveTextContent('1.5x');
  });

  it('closes the dropdown after selecting a speed', () => {
    const onSpeedChange = vi.fn();
    renderPlaybackSpeed({ speed: 1, onSpeedChange });
    fireEvent.click(screen.getByRole('button'));
    const options = screen.getAllByRole('option');
    // Click the 2x option (last one)
    fireEvent.click(options[options.length - 1]);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  // ── Speed change callback ───────────────────────────────────────────

  it('calls onSpeedChange when a speed is selected', () => {
    const onSpeedChange = vi.fn();
    renderPlaybackSpeed({ speed: 1, onSpeedChange });
    fireEvent.click(screen.getByRole('button'));
    const options = screen.getAllByRole('option');
    // Click 0.5x (first option)
    fireEvent.click(options[0]);
    expect(onSpeedChange).toHaveBeenCalledWith(0.5);
  });

  it('calls onSpeedChange with 2 when 2x is selected', () => {
    const onSpeedChange = vi.fn();
    renderPlaybackSpeed({ speed: 1, onSpeedChange });
    fireEvent.click(screen.getByRole('button'));
    const options = screen.getAllByRole('option');
    fireEvent.click(options[options.length - 1]);
    expect(onSpeedChange).toHaveBeenCalledWith(2);
  });

  // ── Custom speeds ──────────────────────────────────────────────────

  it('renders custom speed options', () => {
    renderPlaybackSpeed({ speeds: [0.25, 0.5, 1, 3] });
    fireEvent.click(screen.getByRole('button'));
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveTextContent('0.25x');
    expect(options[3]).toHaveTextContent('3x');
  });

  // ── Disabled state ─────────────────────────────────────────────────

  it('disables the button when disabled is true', () => {
    renderPlaybackSpeed({ disabled: true });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies disabled styling', () => {
    renderPlaybackSpeed({ disabled: true });
    expect(screen.getByRole('button').className).toContain('opacity-50');
  });

  // ── className ──────────────────────────────────────────────────────

  it('passes className to the container', () => {
    const { container } = renderPlaybackSpeed({ className: 'custom-speed' });
    expect(container.firstElementChild?.className).toContain('custom-speed');
  });

  // ── Accessibility ──────────────────────────────────────────────────

  it('has aria-label with speed info', () => {
    renderPlaybackSpeed({ speed: 1.5 });
    expect(screen.getByRole('button', { name: /playback speed.*1\.5x/i })).toBeInTheDocument();
  });

  it('has aria-haspopup on the trigger button', () => {
    renderPlaybackSpeed();
    expect(screen.getByRole('button')).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('has aria-expanded false when menu is closed', () => {
    renderPlaybackSpeed();
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('has aria-expanded true when menu is open', () => {
    renderPlaybackSpeed();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument();
  });

  // ── Toggle behavior ────────────────────────────────────────────────

  it('toggles dropdown open and closed on repeated clicks', () => {
    renderPlaybackSpeed();
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
