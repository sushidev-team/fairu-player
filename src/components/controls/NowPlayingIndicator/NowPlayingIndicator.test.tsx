import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NowPlayingIndicator } from './NowPlayingIndicator';
import { LabelsProvider } from '@/context/LabelsContext';
import type { ReactNode } from 'react';

function Wrapper({ children }: { children: ReactNode }) {
  return <LabelsProvider>{children}</LabelsProvider>;
}

function renderIndicator(props: Partial<Parameters<typeof NowPlayingIndicator>[0]> = {}) {
  const defaults = {
    isPlaying: false,
  };
  return render(<NowPlayingIndicator {...defaults} {...props} />, { wrapper: Wrapper });
}

describe('NowPlayingIndicator', () => {
  // ── Playing state ───────────────────────────────────────────────────

  it('renders with "Now playing" aria-label when playing', () => {
    renderIndicator({ isPlaying: true });
    expect(screen.getByLabelText('Now playing')).toBeInTheDocument();
  });

  it('renders bars without paused class when playing', () => {
    renderIndicator({ isPlaying: true });
    const bars = screen.getByRole('img').querySelectorAll('span');
    bars.forEach((bar) => {
      expect(bar.className).toContain('fp-equalizer-bar');
      expect(bar.className).not.toContain('fp-equalizer-paused');
    });
  });

  // ── Paused state ───────────────────────────────────────────────────

  it('renders with "Paused" aria-label when paused', () => {
    renderIndicator({ isPlaying: false });
    expect(screen.getByLabelText('Paused')).toBeInTheDocument();
  });

  it('renders bars with paused class when not playing', () => {
    renderIndicator({ isPlaying: false });
    const bars = screen.getByRole('img').querySelectorAll('span');
    bars.forEach((bar) => {
      expect(bar.className).toContain('fp-equalizer-paused');
    });
  });

  // ── Default bars count ──────────────────────────────────────────────

  it('renders 4 bars by default', () => {
    renderIndicator();
    const bars = screen.getByRole('img').querySelectorAll('span');
    expect(bars.length).toBe(4);
  });

  // ── Custom bars count ──────────────────────────────────────────────

  it('renders custom number of bars', () => {
    renderIndicator({ bars: 6 });
    const barElements = screen.getByRole('img').querySelectorAll('span');
    expect(barElements.length).toBe(6);
  });

  it('renders 3 bars when specified', () => {
    renderIndicator({ bars: 3 });
    const barElements = screen.getByRole('img').querySelectorAll('span');
    expect(barElements.length).toBe(3);
  });

  // ── Size variants ──────────────────────────────────────────────────

  it('applies small size class', () => {
    renderIndicator({ size: 'sm' });
    const container = screen.getByRole('img');
    expect(container.className).toContain('h-3');
  });

  it('applies medium size class by default', () => {
    renderIndicator();
    const container = screen.getByRole('img');
    expect(container.className).toContain('h-4');
  });

  it('applies large size class', () => {
    renderIndicator({ size: 'lg' });
    const container = screen.getByRole('img');
    expect(container.className).toContain('h-5');
  });

  it('applies correct bar width for small size', () => {
    renderIndicator({ size: 'sm' });
    const bars = screen.getByRole('img').querySelectorAll('span');
    bars.forEach((bar) => expect(bar.className).toContain('w-0.5'));
  });

  it('applies correct bar width for medium size', () => {
    renderIndicator({ size: 'md' });
    const bars = screen.getByRole('img').querySelectorAll('span');
    bars.forEach((bar) => expect(bar.className).toContain('w-1'));
  });

  it('applies correct bar width for large size', () => {
    renderIndicator({ size: 'lg' });
    const bars = screen.getByRole('img').querySelectorAll('span');
    bars.forEach((bar) => expect(bar.className).toContain('w-1.5'));
  });

  // ── className ──────────────────────────────────────────────────────

  it('passes custom className to the container', () => {
    renderIndicator({ className: 'my-indicator' });
    expect(screen.getByRole('img').className).toContain('my-indicator');
  });

  // ── Role ───────────────────────────────────────────────────────────

  it('has role="img"', () => {
    renderIndicator();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  // ── Custom labels ──────────────────────────────────────────────────

  it('uses custom nowPlaying label', () => {
    renderIndicator({
      isPlaying: true,
      labels: { nowPlaying: 'Wird abgespielt', paused: 'Pausiert' },
    });
    expect(screen.getByLabelText('Wird abgespielt')).toBeInTheDocument();
  });

  it('uses custom paused label', () => {
    renderIndicator({
      isPlaying: false,
      labels: { nowPlaying: 'Wird abgespielt', paused: 'Pausiert' },
    });
    expect(screen.getByLabelText('Pausiert')).toBeInTheDocument();
  });

  // ── All bars have accent color ─────────────────────────────────────

  it('applies accent color class to all bars', () => {
    renderIndicator({ isPlaying: true });
    const bars = screen.getByRole('img').querySelectorAll('span');
    bars.forEach((bar) => {
      expect(bar.className).toContain('bg-[var(--fp-color-accent)]');
    });
  });
});
