import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrackItem } from './TrackItem';
import { createMockTrack } from '@/test/helpers';
import { LabelsProvider } from '@/context/LabelsContext';
import type { ReactNode } from 'react';

function Wrapper({ children }: { children: ReactNode }) {
  return <LabelsProvider>{children}</LabelsProvider>;
}

const track = createMockTrack();

function renderTrackItem(props: Partial<Parameters<typeof TrackItem>[0]> = {}) {
  const defaults = {
    track,
    index: 0,
    onClick: vi.fn(),
  };
  return render(<TrackItem {...defaults} {...props} />, { wrapper: Wrapper });
}

describe('TrackItem', () => {
  // ── Rendering track info ───────────────────────────────────────────

  it('renders the track title', () => {
    renderTrackItem();
    expect(screen.getByText('Test Track')).toBeInTheDocument();
  });

  it('renders the track artist', () => {
    renderTrackItem();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
  });

  it('renders "Untitled" when track has no title', () => {
    renderTrackItem({ track: createMockTrack({ title: undefined }) });
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('does not render artist when not provided', () => {
    renderTrackItem({ track: createMockTrack({ artist: undefined }) });
    expect(screen.queryByText('Test Artist')).not.toBeInTheDocument();
  });

  // ── Track number ───────────────────────────────────────────────────

  it('shows 1-based track number when not active', () => {
    renderTrackItem({ index: 0 });
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows correct track number for different indices', () => {
    renderTrackItem({ index: 4 });
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows track number when active but not playing', () => {
    renderTrackItem({ isActive: true, isPlaying: false, index: 2 });
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  // ── Now playing indicator ──────────────────────────────────────────

  it('shows NowPlayingIndicator when active and playing', () => {
    renderTrackItem({ isActive: true, isPlaying: true });
    // The NowPlayingIndicator renders with role="img"
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('does not show NowPlayingIndicator when not active', () => {
    renderTrackItem({ isActive: false, isPlaying: false });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  // ── Artwork ────────────────────────────────────────────────────────

  it('renders artwork image when provided', () => {
    const { container } = renderTrackItem();
    const img = container.querySelector('img') as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img?.src).toBe('https://example.com/cover.jpg');
  });

  it('does not render artwork when not provided', () => {
    const { container } = renderTrackItem({ track: createMockTrack({ artwork: undefined }) });
    expect(container.querySelector('img')).toBeNull();
  });

  // ── Duration ───────────────────────────────────────────────────────

  it('renders formatted duration', () => {
    renderTrackItem({ track: createMockTrack({ duration: 180 }) });
    expect(screen.getByText('3:00')).toBeInTheDocument();
  });

  it('does not render duration when not provided', () => {
    renderTrackItem({ track: createMockTrack({ duration: undefined }) });
    expect(screen.queryByText('3:00')).not.toBeInTheDocument();
  });

  // ── Active state ───────────────────────────────────────────────────

  it('marks active track with aria-current', () => {
    renderTrackItem({ isActive: true });
    expect(screen.getByRole('button')).toHaveAttribute('aria-current', 'true');
  });

  it('does not mark inactive track with aria-current', () => {
    renderTrackItem({ isActive: false });
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-current');
  });

  it('applies active background styling', () => {
    renderTrackItem({ isActive: true });
    expect(screen.getByRole('button').className).toContain('bg-[var(--fp-color-surface)]');
  });

  it('applies active text color to title', () => {
    renderTrackItem({ isActive: true });
    const title = screen.getByText('Test Track');
    expect(title.className).toContain('text-[var(--fp-color-primary)]');
    expect(title.className).toContain('font-medium');
  });

  // ── Click handler ──────────────────────────────────────────────────

  it('calls onClick with track and index when clicked', () => {
    const onClick = vi.fn();
    renderTrackItem({ onClick, index: 2 });
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(track, 2);
  });

  it('calls onClick with a different track', () => {
    const onClick = vi.fn();
    const otherTrack = createMockTrack({ id: 'other', title: 'Other Track' });
    renderTrackItem({ track: otherTrack, onClick, index: 0 });
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(otherTrack, 0);
  });

  // ── className ──────────────────────────────────────────────────────

  it('passes custom className to the button', () => {
    renderTrackItem({ className: 'my-track-item' });
    expect(screen.getByRole('button').className).toContain('my-track-item');
  });

  // ── Button type ────────────────────────────────────────────────────

  it('renders as a button with type="button"', () => {
    renderTrackItem();
    const btn = screen.getByRole('button');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('type')).toBe('button');
  });
});
