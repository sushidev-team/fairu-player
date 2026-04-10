import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayButton } from './PlayButton';
import { LabelsProvider } from '@/context/LabelsContext';
import type { ReactNode } from 'react';

function Wrapper({ children }: { children: ReactNode }) {
  return <LabelsProvider>{children}</LabelsProvider>;
}

function renderPlayButton(props: Partial<Parameters<typeof PlayButton>[0]> = {}) {
  const defaults = {
    isPlaying: false,
    onClick: vi.fn(),
  };
  return render(<PlayButton {...defaults} {...props} />, { wrapper: Wrapper });
}

describe('PlayButton', () => {
  // ── Play state ──────────────────────────────────────────────────────

  it('renders with play aria-label when not playing', () => {
    renderPlayButton({ isPlaying: false });
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('renders play icon paths when not playing', () => {
    renderPlayButton({ isPlaying: false });
    const svgs = screen.getByRole('button').querySelectorAll('svg');
    // The morphing SVG should be present (not the loading one)
    expect(svgs.length).toBe(1);
    const paths = svgs[0].querySelectorAll('path');
    expect(paths.length).toBe(2);
  });

  // ── Pause state ─────────────────────────────────────────────────────

  it('renders with pause aria-label when playing', () => {
    renderPlayButton({ isPlaying: true });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('shows pause SVG path with full opacity when playing', () => {
    renderPlayButton({ isPlaying: true });
    const btn = screen.getByRole('button');
    const paths = btn.querySelectorAll('svg path');
    // Second path is the pause icon; when playing it should have opacity-100
    const pausePath = paths[1];
    expect(pausePath.getAttribute('class')).toContain('opacity-100');
  });

  it('shows play SVG path with zero opacity when playing', () => {
    renderPlayButton({ isPlaying: true });
    const btn = screen.getByRole('button');
    const paths = btn.querySelectorAll('svg path');
    const playPath = paths[0];
    expect(playPath.getAttribute('class')).toContain('opacity-0');
  });

  // ── Loading state ───────────────────────────────────────────────────

  it('shows loading spinner when isLoading is true', () => {
    renderPlayButton({ isLoading: true });
    const btn = screen.getByRole('button');
    const svg = btn.querySelector('svg');
    // Loading spinner has a circle and path, not the morphing play/pause paths
    expect(svg?.querySelector('circle')).toBeTruthy();
    expect(svg?.querySelector('path')).toBeTruthy();
  });

  it('disables the button when isLoading is true', () => {
    renderPlayButton({ isLoading: true });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not call onClick when loading', () => {
    const onClick = vi.fn();
    renderPlayButton({ isLoading: true, onClick });
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  // ── Click handler ───────────────────────────────────────────────────

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    renderPlayButton({ onClick });
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    renderPlayButton({ disabled: true, onClick });
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  // ── Disabled state ──────────────────────────────────────────────────

  it('disables the button when disabled prop is true', () => {
    renderPlayButton({ disabled: true });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies disabled styling', () => {
    renderPlayButton({ disabled: true });
    expect(screen.getByRole('button').className).toContain('opacity-50');
  });

  // ── Custom labels ──────────────────────────────────────────────────

  it('uses custom play label', () => {
    renderPlayButton({
      isPlaying: false,
      labels: { play: 'Abspielen', pause: 'Stopp' },
    });
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeInTheDocument();
  });

  it('uses custom pause label', () => {
    renderPlayButton({
      isPlaying: true,
      labels: { play: 'Abspielen', pause: 'Stopp' },
    });
    expect(screen.getByRole('button', { name: 'Stopp' })).toBeInTheDocument();
  });

  // ── Size variants ──────────────────────────────────────────────────

  it('applies small size class', () => {
    renderPlayButton({ size: 'sm' });
    expect(screen.getByRole('button').className).toContain('w-8');
    expect(screen.getByRole('button').className).toContain('h-8');
  });

  it('applies medium size class by default', () => {
    renderPlayButton();
    expect(screen.getByRole('button').className).toContain('w-12');
    expect(screen.getByRole('button').className).toContain('h-12');
  });

  it('applies large size class', () => {
    renderPlayButton({ size: 'lg' });
    expect(screen.getByRole('button').className).toContain('w-16');
    expect(screen.getByRole('button').className).toContain('h-16');
  });

  // ── className passthrough ──────────────────────────────────────────

  it('passes custom className to the button', () => {
    renderPlayButton({ className: 'my-custom-class' });
    expect(screen.getByRole('button').className).toContain('my-custom-class');
  });

  // ── Button type ────────────────────────────────────────────────────

  it('renders as a button element with type="button"', () => {
    renderPlayButton();
    const btn = screen.getByRole('button');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('type')).toBe('button');
  });

  // ── Glow effect ────────────────────────────────────────────────────

  it('has a glow effect span element', () => {
    renderPlayButton();
    const btn = screen.getByRole('button');
    const glowSpan = btn.querySelector('span');
    expect(glowSpan).toBeTruthy();
  });

  // ── Icon sizing with button size ───────────────────────────────────

  it('applies correct icon size for small button', () => {
    renderPlayButton({ size: 'sm' });
    const svg = screen.getByRole('button').querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('w-4');
    expect(svg?.getAttribute('class')).toContain('h-4');
  });

  it('applies correct icon size for large button', () => {
    renderPlayButton({ size: 'lg' });
    const svg = screen.getByRole('button').querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('w-8');
    expect(svg?.getAttribute('class')).toContain('h-8');
  });
});
