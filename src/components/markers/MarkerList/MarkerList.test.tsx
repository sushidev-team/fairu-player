import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkerList } from './MarkerList';
import type { TimelineMarker } from '@/types/markers';

const markers: TimelineMarker[] = [
  { id: 'm-1', time: 15, title: 'Highlight 1' },
  { id: 'm-2', time: 60, title: 'Highlight 2' },
  { id: 'm-3', time: 120, title: 'Highlight 3' },
];

function renderMarkerList(props: Partial<Parameters<typeof MarkerList>[0]> = {}) {
  const defaults = {
    markers,
    currentTime: 0,
    duration: 180,
    onMarkerClick: vi.fn(),
  };
  return render(<MarkerList {...defaults} {...props} />);
}

describe('MarkerList', () => {
  // ── Rendering ──────────────────────────────────────────────────────

  it('renders the "Markers" heading', () => {
    renderMarkerList();
    expect(screen.getByText('Markers')).toBeInTheDocument();
  });

  it('renders all marker titles', () => {
    renderMarkerList();
    expect(screen.getByText('Highlight 1')).toBeInTheDocument();
    expect(screen.getByText('Highlight 2')).toBeInTheDocument();
    expect(screen.getByText('Highlight 3')).toBeInTheDocument();
  });

  it('renders a list with marker items', () => {
    renderMarkerList();
    expect(screen.getByRole('list', { name: 'Marker list' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });

  it('does not render when markers array is empty', () => {
    const { container } = renderMarkerList({ markers: [] });
    expect(container.innerHTML).toBe('');
  });

  // ── Marker times ───────────────────────────────────────────────────

  it('shows formatted time for each marker', () => {
    renderMarkerList();
    expect(screen.getByText('0:15')).toBeInTheDocument();
    expect(screen.getByText('1:00')).toBeInTheDocument();
    expect(screen.getByText('2:00')).toBeInTheDocument();
  });

  // ── Active marker ──────────────────────────────────────────────────

  it('marks the active marker with aria-current', () => {
    renderMarkerList({ activeMarkerIndex: 1 });
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).not.toHaveAttribute('aria-current');
    expect(buttons[1]).toHaveAttribute('aria-current', 'true');
    expect(buttons[2]).not.toHaveAttribute('aria-current');
  });

  it('applies active background to current marker', () => {
    renderMarkerList({ activeMarkerIndex: 0 });
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].className).toContain('bg-[var(--fp-color-surface)]');
  });

  it('shows active indicator dot for active marker', () => {
    renderMarkerList({ activeMarkerIndex: 1 });
    const activeButton = screen.getAllByRole('button')[1];
    const dot = activeButton.querySelector('.rounded-full');
    expect(dot).toBeTruthy();
  });

  it('applies accent text color to active marker title', () => {
    renderMarkerList({ activeMarkerIndex: 0 });
    const title = screen.getByText('Highlight 1');
    expect(title.className).toContain('text-[var(--fp-color-accent)]');
    expect(title.className).toContain('font-medium');
  });

  it('does not highlight any marker when activeMarkerIndex is -1', () => {
    renderMarkerList({ activeMarkerIndex: -1 });
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).not.toHaveAttribute('aria-current');
    });
  });

  // ── Click handler ──────────────────────────────────────────────────

  it('calls onMarkerClick with marker and index when clicked', () => {
    const onMarkerClick = vi.fn();
    renderMarkerList({ onMarkerClick });
    fireEvent.click(screen.getByText('Highlight 2'));
    expect(onMarkerClick).toHaveBeenCalledWith(markers[1], 1);
  });

  it('calls onMarkerClick for first marker', () => {
    const onMarkerClick = vi.fn();
    renderMarkerList({ onMarkerClick });
    fireEvent.click(screen.getByText('Highlight 1'));
    expect(onMarkerClick).toHaveBeenCalledWith(markers[0], 0);
  });

  it('calls onMarkerClick for last marker', () => {
    const onMarkerClick = vi.fn();
    renderMarkerList({ onMarkerClick });
    fireEvent.click(screen.getByText('Highlight 3'));
    expect(onMarkerClick).toHaveBeenCalledWith(markers[2], 2);
  });

  // ── Preview images ─────────────────────────────────────────────────

  it('shows preview images when showPreviewImage is true and images exist', () => {
    const markersWithImages: TimelineMarker[] = markers.map((m) => ({
      ...m,
      previewImage: `https://example.com/${m.id}.jpg`,
    }));
    const { container } = renderMarkerList({ markers: markersWithImages, showPreviewImage: true });
    const images = container.querySelectorAll('img');
    expect(images.length).toBe(3);
  });

  it('hides preview images when showPreviewImage is false', () => {
    const markersWithImages: TimelineMarker[] = markers.map((m) => ({
      ...m,
      previewImage: `https://example.com/${m.id}.jpg`,
    }));
    const { container } = renderMarkerList({ markers: markersWithImages, showPreviewImage: false });
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('does not show images when markers have no previewImage', () => {
    const { container } = renderMarkerList({ showPreviewImage: true });
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  // ── Markers without titles ─────────────────────────────────────────

  it('handles markers without title', () => {
    const noTitleMarkers: TimelineMarker[] = [
      { id: 'm-1', time: 10 },
      { id: 'm-2', time: 50, title: 'Has Title' },
    ];
    renderMarkerList({ markers: noTitleMarkers });
    expect(screen.getByText('Has Title')).toBeInTheDocument();
    expect(screen.getByText('0:10')).toBeInTheDocument();
  });

  // ── className ──────────────────────────────────────────────────────

  it('passes custom className to the container', () => {
    const { container } = renderMarkerList({ className: 'my-markers' });
    expect(container.firstElementChild?.className).toContain('my-markers');
  });

  // ── Marker with custom color ───────────────────────────────────────

  it('applies custom color to active marker dot', () => {
    const colorMarkers: TimelineMarker[] = [
      { id: 'm-1', time: 10, title: 'Red', color: '#ff0000' },
    ];
    renderMarkerList({ markers: colorMarkers, activeMarkerIndex: 0 });
    const dot = screen.getByRole('button').querySelector('.rounded-full');
    expect(dot).toBeTruthy();
    expect((dot as HTMLElement).style.backgroundColor).toBe('rgb(255, 0, 0)');
  });
});
