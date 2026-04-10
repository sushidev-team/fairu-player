import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PictureInPictureButton } from './PictureInPictureButton';
import { LabelsProvider } from '@/context/LabelsContext';
import type { ReactNode } from 'react';

function Wrapper({ children }: { children: ReactNode }) {
  return <LabelsProvider>{children}</LabelsProvider>;
}

function renderPiPButton(props: Partial<Parameters<typeof PictureInPictureButton>[0]> = {}) {
  const defaults = {
    isPictureInPicture: false,
    onClick: vi.fn(),
  };
  return render(<PictureInPictureButton {...defaults} {...props} />, { wrapper: Wrapper });
}

describe('PictureInPictureButton', () => {
  // ── Enter PiP state ─────────────────────────────────────────────────

  it('renders enter PiP label when not in PiP', () => {
    renderPiPButton({ isPictureInPicture: false });
    expect(screen.getByRole('button', { name: 'Enter picture-in-picture' })).toBeInTheDocument();
  });

  it('shows enter PiP title when not in PiP', () => {
    renderPiPButton({ isPictureInPicture: false });
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Enter picture-in-picture');
  });

  it('renders the enter PiP icon with two rects', () => {
    renderPiPButton({ isPictureInPicture: false });
    const svg = screen.getByRole('button').querySelector('svg');
    const rects = svg?.querySelectorAll('rect');
    expect(rects?.length).toBe(2);
  });

  // ── Exit PiP state ─────────────────────────────────────────────────

  it('renders exit PiP label when in PiP', () => {
    renderPiPButton({ isPictureInPicture: true });
    expect(screen.getByRole('button', { name: 'Exit picture-in-picture' })).toBeInTheDocument();
  });

  it('shows exit PiP title when in PiP', () => {
    renderPiPButton({ isPictureInPicture: true });
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Exit picture-in-picture');
  });

  it('renders exit PiP icon with one rect and a path', () => {
    renderPiPButton({ isPictureInPicture: true });
    const svg = screen.getByRole('button').querySelector('svg');
    const rects = svg?.querySelectorAll('rect');
    const paths = svg?.querySelectorAll('path');
    expect(rects?.length).toBe(1);
    expect(paths?.length).toBe(1);
  });

  // ── Click handler ──────────────────────────────────────────────────

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    renderPiPButton({ onClick });
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    renderPiPButton({ disabled: true, onClick });
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  // ── Disabled state ─────────────────────────────────────────────────

  it('disables the button when disabled prop is true', () => {
    renderPiPButton({ disabled: true });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies disabled opacity styling', () => {
    renderPiPButton({ disabled: true });
    expect(screen.getByRole('button').className).toContain('opacity-50');
  });

  // ── className ──────────────────────────────────────────────────────

  it('passes custom className', () => {
    renderPiPButton({ className: 'my-pip-class' });
    expect(screen.getByRole('button').className).toContain('my-pip-class');
  });

  // ── Aria labels toggle ──────────────────────────────────────────────

  it('toggles aria-label on state change via rerender', () => {
    const { rerender } = render(
      <PictureInPictureButton isPictureInPicture={false} onClick={vi.fn()} />,
      { wrapper: Wrapper }
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Enter picture-in-picture');

    rerender(<PictureInPictureButton isPictureInPicture={true} onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Exit picture-in-picture');
  });

  // ── Custom labels ──────────────────────────────────────────────────

  it('uses custom enter PiP label', () => {
    renderPiPButton({
      isPictureInPicture: false,
      labels: { enterPictureInPicture: 'Bild-in-Bild starten', exitPictureInPicture: 'Bild-in-Bild beenden' },
    });
    expect(screen.getByRole('button', { name: 'Bild-in-Bild starten' })).toBeInTheDocument();
  });

  it('uses custom exit PiP label', () => {
    renderPiPButton({
      isPictureInPicture: true,
      labels: { enterPictureInPicture: 'Bild-in-Bild starten', exitPictureInPicture: 'Bild-in-Bild beenden' },
    });
    expect(screen.getByRole('button', { name: 'Bild-in-Bild beenden' })).toBeInTheDocument();
  });

  // ── CSS class ──────────────────────────────────────────────────────

  it('has the fp-pip-button class', () => {
    renderPiPButton();
    expect(screen.getByRole('button').className).toContain('fp-pip-button');
  });

  // ── Always renders (no isSupported hide logic in this component) ───

  it('always renders the button', () => {
    renderPiPButton();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
