import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlaylistView } from './PlaylistView';
import { createMockPlaylist } from '@/test/helpers';
import { LabelsProvider } from '@/context/LabelsContext';
import type { ReactNode } from 'react';
import type { Track } from '@/types/player';

function Wrapper({ children }: { children: ReactNode }) {
  return <LabelsProvider>{children}</LabelsProvider>;
}

const tracks = createMockPlaylist(3);

function renderPlaylistView(props: Partial<Parameters<typeof PlaylistView>[0]> = {}) {
  const defaults = {
    tracks,
    currentIndex: 0,
    onTrackClick: vi.fn(),
  };
  return render(<PlaylistView {...defaults} {...props} />, { wrapper: Wrapper });
}

describe('PlaylistView', () => {
  // ── Rendering ──────────────────────────────────────────────────────

  it('renders the "Playlist" heading', () => {
    renderPlaylistView();
    expect(screen.getByText('Playlist')).toBeInTheDocument();
  });

  it('renders the track count', () => {
    renderPlaylistView();
    expect(screen.getByText('3 tracks')).toBeInTheDocument();
  });

  it('renders singular "track" for single track', () => {
    renderPlaylistView({ tracks: [tracks[0]] });
    expect(screen.getByText('1 track')).toBeInTheDocument();
  });

  it('renders all track titles', () => {
    renderPlaylistView();
    expect(screen.getByText('Track 1')).toBeInTheDocument();
    expect(screen.getByText('Track 2')).toBeInTheDocument();
    expect(screen.getByText('Track 3')).toBeInTheDocument();
  });

  it('renders a list with role and label', () => {
    renderPlaylistView();
    expect(screen.getByRole('list', { name: 'Playlist' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });

  it('does not render when tracks array is empty', () => {
    const { container } = renderPlaylistView({ tracks: [] });
    expect(container.innerHTML).toBe('');
  });

  // ── Current track highlighting ─────────────────────────────────────

  it('marks the current track as active', () => {
    renderPlaylistView({ currentIndex: 1 });
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).not.toHaveAttribute('aria-current');
    expect(buttons[1]).toHaveAttribute('aria-current', 'true');
    expect(buttons[2]).not.toHaveAttribute('aria-current');
  });

  it('highlights the first track by default', () => {
    renderPlaylistView({ currentIndex: 0 });
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAttribute('aria-current', 'true');
  });

  // ── Click handler ──────────────────────────────────────────────────

  it('calls onTrackClick with track and index when clicked', () => {
    const onTrackClick = vi.fn();
    renderPlaylistView({ onTrackClick });
    fireEvent.click(screen.getByText('Track 2'));
    expect(onTrackClick).toHaveBeenCalledWith(tracks[1], 1);
  });

  it('calls onTrackClick for the first track', () => {
    const onTrackClick = vi.fn();
    renderPlaylistView({ onTrackClick });
    fireEvent.click(screen.getByText('Track 1'));
    expect(onTrackClick).toHaveBeenCalledWith(tracks[0], 0);
  });

  it('calls onTrackClick for the last track', () => {
    const onTrackClick = vi.fn();
    renderPlaylistView({ onTrackClick });
    fireEvent.click(screen.getByText('Track 3'));
    expect(onTrackClick).toHaveBeenCalledWith(tracks[2], 2);
  });

  // ── className ──────────────────────────────────────────────────────

  it('passes custom className to the container', () => {
    const { container } = renderPlaylistView({ className: 'my-playlist' });
    expect(container.firstElementChild?.className).toContain('my-playlist');
  });

  // ── maxHeight ──────────────────────────────────────────────────────

  it('applies default maxHeight of 300px to the list', () => {
    renderPlaylistView();
    const list = screen.getByRole('list');
    expect(list.style.maxHeight).toBe('300px');
  });

  it('applies custom maxHeight', () => {
    renderPlaylistView({ maxHeight: '500px' });
    const list = screen.getByRole('list');
    expect(list.style.maxHeight).toBe('500px');
  });

  // ── Track info ─────────────────────────────────────────────────────

  it('renders track artist names', () => {
    renderPlaylistView();
    expect(screen.getByText('Artist 1')).toBeInTheDocument();
    expect(screen.getByText('Artist 2')).toBeInTheDocument();
    expect(screen.getByText('Artist 3')).toBeInTheDocument();
  });

  // ── isPlaying ──────────────────────────────────────────────────────

  it('renders with isPlaying false by default', () => {
    renderPlaylistView({ currentIndex: 0 });
    // When not playing, should show track number instead of NowPlayingIndicator
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
