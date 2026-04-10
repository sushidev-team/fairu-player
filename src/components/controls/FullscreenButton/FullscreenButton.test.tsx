import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FullscreenButton } from './FullscreenButton';
import { LabelsProvider } from '@/context/LabelsContext';
import type { ReactNode } from 'react';

function Wrapper({ children }: { children: ReactNode }) {
  return <LabelsProvider>{children}</LabelsProvider>;
}

function renderFullscreenButton(props: Partial<Parameters<typeof FullscreenButton>[0]> = {}) {
  const defaults = {
    isFullscreen: false,
    onClick: vi.fn(),
  };
  return render(<FullscreenButton {...defaults} {...props} />, { wrapper: Wrapper });
}

describe('FullscreenButton', () => {
  // ── Enter fullscreen state ──────────────────────────────────────────

  it('renders enter fullscreen label when not fullscreen', () => {
    renderFullscreenButton({ isFullscreen: false });
    expect(screen.getByRole('button', { name: 'Enter fullscreen' })).toBeInTheDocument();
  });

  it('shows enter fullscreen title when not fullscreen', () => {
    renderFullscreenButton({ isFullscreen: false });
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Enter fullscreen');
  });

  it('renders enter fullscreen SVG icon', () => {
    renderFullscreenButton({ isFullscreen: false });
    const svg = screen.getByRole('button').querySelector('svg');
    expect(svg).toBeTruthy();
    const path = svg?.querySelector('path');
    expect(path?.getAttribute('d')).toContain('H5');
  });

  // ── Exit fullscreen state ──────────────────────────────────────────

  it('renders exit fullscreen label when fullscreen', () => {
    renderFullscreenButton({ isFullscreen: true });
    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeInTheDocument();
  });

  it('shows exit fullscreen title when fullscreen', () => {
    renderFullscreenButton({ isFullscreen: true });
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Exit fullscreen');
  });

  it('renders exit fullscreen SVG icon', () => {
    renderFullscreenButton({ isFullscreen: true });
    const svg = screen.getByRole('button').querySelector('svg');
    expect(svg).toBeTruthy();
    const path = svg?.querySelector('path');
    expect(path?.getAttribute('d')).toContain('v3');
  });

  // ── Click handler ──────────────────────────────────────────────────

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    renderFullscreenButton({ onClick });
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    renderFullscreenButton({ disabled: true, onClick });
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  // ── Disabled state ─────────────────────────────────────────────────

  it('disables the button when disabled prop is true', () => {
    renderFullscreenButton({ disabled: true });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies disabled styling', () => {
    renderFullscreenButton({ disabled: true });
    expect(screen.getByRole('button').className).toContain('opacity-50');
  });

  // ── className ──────────────────────────────────────────────────────

  it('passes custom className to the button', () => {
    renderFullscreenButton({ className: 'my-fullscreen' });
    expect(screen.getByRole('button').className).toContain('my-fullscreen');
  });

  // ── Aria labels toggle ──────────────────────────────────────────────

  it('toggles aria-label on state change via rerender', () => {
    const { rerender } = render(
      <FullscreenButton isFullscreen={false} onClick={vi.fn()} />,
      { wrapper: Wrapper }
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Enter fullscreen');

    rerender(<FullscreenButton isFullscreen={true} onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Exit fullscreen');
  });

  // ── Custom labels ──────────────────────────────────────────────────

  it('uses custom enter fullscreen label', () => {
    renderFullscreenButton({
      isFullscreen: false,
      labels: { enterFullscreen: 'Vollbild', exitFullscreen: 'Vollbild beenden' },
    });
    expect(screen.getByRole('button', { name: 'Vollbild' })).toBeInTheDocument();
  });

  it('uses custom exit fullscreen label', () => {
    renderFullscreenButton({
      isFullscreen: true,
      labels: { enterFullscreen: 'Vollbild', exitFullscreen: 'Vollbild beenden' },
    });
    expect(screen.getByRole('button', { name: 'Vollbild beenden' })).toBeInTheDocument();
  });

  // ── CSS class ──────────────────────────────────────────────────────

  it('has the fp-fullscreen-button class', () => {
    renderFullscreenButton();
    expect(screen.getByRole('button').className).toContain('fp-fullscreen-button');
  });
});
