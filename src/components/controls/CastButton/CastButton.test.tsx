import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CastButton } from './CastButton';
import { LabelsProvider } from '@/context/LabelsContext';
import type { ReactNode } from 'react';

function Wrapper({ children }: { children: ReactNode }) {
  return <LabelsProvider>{children}</LabelsProvider>;
}

function renderCastButton(props: Partial<Parameters<typeof CastButton>[0]> = {}) {
  const defaults = {
    isCasting: false,
    onClick: vi.fn(),
  };
  return render(<CastButton {...defaults} {...props} />, { wrapper: Wrapper });
}

describe('CastButton', () => {
  // ── Not casting state ───────────────────────────────────────────────

  it('renders cast label when not casting', () => {
    renderCastButton({ isCasting: false });
    expect(screen.getByRole('button', { name: 'Cast' })).toBeInTheDocument();
  });

  it('shows cast title when not casting', () => {
    renderCastButton({ isCasting: false });
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Cast');
  });

  it('renders the inactive cast SVG icon', () => {
    renderCastButton({ isCasting: false });
    const svg = screen.getByRole('button').querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('fill')).toBe('currentColor');
  });

  // ── Casting state ──────────────────────────────────────────────────

  it('renders stop casting label when casting', () => {
    renderCastButton({ isCasting: true });
    expect(screen.getByRole('button', { name: 'Stop casting' })).toBeInTheDocument();
  });

  it('shows stop casting title when casting', () => {
    renderCastButton({ isCasting: true });
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Stop casting');
  });

  it('renders the active cast SVG icon when casting', () => {
    renderCastButton({ isCasting: true });
    const svg = screen.getByRole('button').querySelector('svg');
    expect(svg).toBeTruthy();
  });

  // ── Icon differences between states ────────────────────────────────

  it('renders different SVG path data for casting vs not casting', () => {
    const { rerender } = render(
      <CastButton isCasting={false} onClick={vi.fn()} />,
      { wrapper: Wrapper }
    );
    const notCastingPath = screen.getByRole('button').querySelector('svg path')?.getAttribute('d');

    rerender(<CastButton isCasting={true} onClick={vi.fn()} />);
    const castingPath = screen.getByRole('button').querySelector('svg path')?.getAttribute('d');

    expect(notCastingPath).toBeTruthy();
    expect(castingPath).toBeTruthy();
    expect(notCastingPath).not.toBe(castingPath);
  });

  // ── Click handler ──────────────────────────────────────────────────

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    renderCastButton({ onClick });
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    renderCastButton({ disabled: true, onClick });
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  // ── Disabled state ─────────────────────────────────────────────────

  it('disables the button when disabled prop is true', () => {
    renderCastButton({ disabled: true });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies disabled opacity styling', () => {
    renderCastButton({ disabled: true });
    expect(screen.getByRole('button').className).toContain('opacity-50');
  });

  // ── className ──────────────────────────────────────────────────────

  it('passes custom className', () => {
    renderCastButton({ className: 'my-cast-class' });
    expect(screen.getByRole('button').className).toContain('my-cast-class');
  });

  // ── Aria labels toggle ──────────────────────────────────────────────

  it('toggles aria-label on state change via rerender', () => {
    const { rerender } = render(
      <CastButton isCasting={false} onClick={vi.fn()} />,
      { wrapper: Wrapper }
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Cast');

    rerender(<CastButton isCasting={true} onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Stop casting');
  });

  // ── Custom labels ──────────────────────────────────────────────────

  it('uses custom start cast label', () => {
    renderCastButton({
      isCasting: false,
      labels: { startCast: 'Streamen', stopCast: 'Streaming beenden' },
    });
    expect(screen.getByRole('button', { name: 'Streamen' })).toBeInTheDocument();
  });

  it('uses custom stop cast label', () => {
    renderCastButton({
      isCasting: true,
      labels: { startCast: 'Streamen', stopCast: 'Streaming beenden' },
    });
    expect(screen.getByRole('button', { name: 'Streaming beenden' })).toBeInTheDocument();
  });

  // ── CSS class ──────────────────────────────────────────────────────

  it('has the fp-cast-button class', () => {
    renderCastButton();
    expect(screen.getByRole('button').className).toContain('fp-cast-button');
  });
});
