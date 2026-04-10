import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SkipButtons, SkipButton } from './SkipButtons';
import { LabelsProvider } from '@/context/LabelsContext';
import type { ReactNode } from 'react';

function Wrapper({ children }: { children: ReactNode }) {
  return <LabelsProvider>{children}</LabelsProvider>;
}

function renderSkipButtons(props: Partial<Parameters<typeof SkipButtons>[0]> = {}) {
  const defaults = {
    onSkipForward: vi.fn(),
    onSkipBackward: vi.fn(),
  };
  return render(<SkipButtons {...defaults} {...props} />, { wrapper: Wrapper });
}

describe('SkipButtons', () => {
  // ── Rendering both buttons ──────────────────────────────────────────

  it('renders both skip forward and skip backward buttons', () => {
    renderSkipButtons();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });

  it('displays default seconds labels (10 and 30)', () => {
    renderSkipButtons();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('has correct aria-labels for default seconds', () => {
    renderSkipButtons();
    expect(screen.getByRole('button', { name: /skip backward 10 seconds/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip forward 30 seconds/i })).toBeInTheDocument();
  });

  // ── Click handlers ─────────────────────────────────────────────────

  it('calls onSkipBackward when backward button is clicked', () => {
    const onSkipBackward = vi.fn();
    renderSkipButtons({ onSkipBackward });
    fireEvent.click(screen.getByRole('button', { name: /skip backward/i }));
    expect(onSkipBackward).toHaveBeenCalledTimes(1);
  });

  it('calls onSkipForward when forward button is clicked', () => {
    const onSkipForward = vi.fn();
    renderSkipButtons({ onSkipForward });
    fireEvent.click(screen.getByRole('button', { name: /skip forward/i }));
    expect(onSkipForward).toHaveBeenCalledTimes(1);
  });

  // ── Custom seconds ─────────────────────────────────────────────────

  it('displays custom forward seconds', () => {
    renderSkipButtons({ forwardSeconds: 15 });
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('displays custom backward seconds', () => {
    renderSkipButtons({ backwardSeconds: 5 });
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('updates aria-labels with custom seconds', () => {
    renderSkipButtons({ forwardSeconds: 15, backwardSeconds: 5 });
    expect(screen.getByRole('button', { name: /skip backward 5 seconds/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip forward 15 seconds/i })).toBeInTheDocument();
  });

  // ── Disabled state ─────────────────────────────────────────────────

  it('disables both buttons when disabled', () => {
    renderSkipButtons({ disabled: true });
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it('does not call handlers when disabled', () => {
    const onSkipForward = vi.fn();
    const onSkipBackward = vi.fn();
    renderSkipButtons({ disabled: true, onSkipForward, onSkipBackward });
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => fireEvent.click(btn));
    expect(onSkipForward).not.toHaveBeenCalled();
    expect(onSkipBackward).not.toHaveBeenCalled();
  });

  it('applies disabled opacity styling', () => {
    renderSkipButtons({ disabled: true });
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => expect(btn.className).toContain('opacity-50'));
  });

  // ── className ──────────────────────────────────────────────────────

  it('passes className to the container div', () => {
    const { container } = renderSkipButtons({ className: 'skip-custom' });
    expect(container.firstElementChild?.className).toContain('skip-custom');
  });

  // ── Button type ────────────────────────────────────────────────────

  it('renders buttons with type="button"', () => {
    renderSkipButtons();
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => expect(btn.getAttribute('type')).toBe('button'));
  });
});

describe('SkipButton (individual)', () => {
  function renderSingle(props: Partial<Parameters<typeof SkipButton>[0]> = {}) {
    const defaults = {
      direction: 'forward' as const,
      onClick: vi.fn(),
    };
    return render(<SkipButton {...defaults} {...props} />, { wrapper: Wrapper });
  }

  it('renders forward button with default 30 seconds', () => {
    renderSingle({ direction: 'forward' });
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('renders backward button with default 10 seconds', () => {
    renderSingle({ direction: 'backward' });
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('renders forward button with custom seconds', () => {
    renderSingle({ direction: 'forward', seconds: 15 });
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('renders backward button with custom seconds', () => {
    renderSingle({ direction: 'backward', seconds: 5 });
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('applies small size classes', () => {
    renderSingle({ size: 'sm' });
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('h-9');
  });

  it('applies medium size classes by default', () => {
    renderSingle();
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('h-12');
  });

  it('renders SVG icon', () => {
    renderSingle({ direction: 'forward' });
    const svg = screen.getByRole('button').querySelector('svg');
    expect(svg).toBeTruthy();
  });
});
