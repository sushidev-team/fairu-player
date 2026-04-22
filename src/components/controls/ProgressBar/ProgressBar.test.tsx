import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';
import type { TimelineMarker } from '@/types/markers';

const markers: TimelineMarker[] = [
  { id: 'm1', time: 10, title: 'Intro', color: '#f59e0b' },
  { id: 'm2', time: 42, title: 'Highlight' },
  { id: 'm3', time: 75 },
];

describe('ProgressBar interactive markers', () => {
  it('renders marker dots as non-interactive divs when no onMarkerClick', () => {
    const { container } = render(
      <ProgressBar
        currentTime={0}
        duration={100}
        markers={markers}
        onSeek={vi.fn()}
      />
    );

    // No buttons for markers (only chapter buttons are interactive)
    expect(container.querySelectorAll('button[aria-label^="Marker at"]')).toHaveLength(0);
    expect(container.querySelectorAll('button[aria-label^="Intro"]')).toHaveLength(0);
  });

  it('renders marker dots as interactive buttons when onMarkerClick is provided', () => {
    const onMarkerClick = vi.fn();

    render(
      <ProgressBar
        currentTime={0}
        duration={100}
        markers={markers}
        onMarkerClick={onMarkerClick}
        onSeek={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Intro/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Highlight/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Marker at/ })).toBeInTheDocument();
  });

  it('invokes onMarkerClick with marker and index when clicked', () => {
    const onMarkerClick = vi.fn();

    render(
      <ProgressBar
        currentTime={0}
        duration={100}
        markers={markers}
        onMarkerClick={onMarkerClick}
        onSeek={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Highlight/ }));

    expect(onMarkerClick).toHaveBeenCalledTimes(1);
    expect(onMarkerClick).toHaveBeenCalledWith(markers[1], 1);
  });

  it('does not trigger seek when clicking a marker (stop propagation)', () => {
    const onSeek = vi.fn();
    const onMarkerClick = vi.fn();

    render(
      <ProgressBar
        currentTime={0}
        duration={100}
        markers={markers}
        onMarkerClick={onMarkerClick}
        onSeek={onSeek}
      />
    );

    fireEvent.mouseDown(screen.getByRole('button', { name: /Intro/ }));
    fireEvent.click(screen.getByRole('button', { name: /Intro/ }));

    expect(onMarkerClick).toHaveBeenCalled();
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('does not invoke onMarkerClick when disabled', () => {
    const onMarkerClick = vi.fn();

    render(
      <ProgressBar
        currentTime={0}
        duration={100}
        markers={markers}
        onMarkerClick={onMarkerClick}
        disabled
        onSeek={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Intro/ }));

    expect(onMarkerClick).not.toHaveBeenCalled();
  });

  it('handles Enter/Space keys on marker button', () => {
    const onMarkerClick = vi.fn();

    render(
      <ProgressBar
        currentTime={0}
        duration={100}
        markers={markers}
        onMarkerClick={onMarkerClick}
        onSeek={vi.fn()}
      />
    );

    const btn = screen.getByRole('button', { name: /Intro/ });
    fireEvent.keyDown(btn, { key: 'Enter' });
    expect(onMarkerClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(btn, { key: ' ' });
    expect(onMarkerClick).toHaveBeenCalledTimes(2);
  });
});
