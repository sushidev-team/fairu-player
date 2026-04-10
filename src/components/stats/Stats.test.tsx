import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Stats, StatIcons } from './Stats';
import type { StatItem } from '@/types/stats';

const items: StatItem[] = [
  { id: 'plays', label: 'Plays', value: 1234 },
  { id: 'likes', label: 'Likes', value: 567 },
  { id: 'comments', label: 'Comments', value: 89 },
];

function renderStats(props: Partial<Parameters<typeof Stats>[0]> = {}) {
  const defaults = {
    items,
  };
  return render(<Stats {...defaults} {...props} />);
}

describe('Stats', () => {
  // ── Rendering items ────────────────────────────────────────────────

  it('renders all stat labels', () => {
    renderStats();
    expect(screen.getByText('Plays:')).toBeInTheDocument();
    expect(screen.getByText('Likes:')).toBeInTheDocument();
    expect(screen.getByText('Comments:')).toBeInTheDocument();
  });

  it('renders all stat values', () => {
    renderStats();
    expect(screen.getByText('1234')).toBeInTheDocument();
    expect(screen.getByText('567')).toBeInTheDocument();
    expect(screen.getByText('89')).toBeInTheDocument();
  });

  it('renders string values', () => {
    const stringItems: StatItem[] = [
      { id: 'date', label: 'Published', value: 'Jan 1, 2024' },
    ];
    renderStats({ items: stringItems });
    expect(screen.getByText('Jan 1, 2024')).toBeInTheDocument();
  });

  it('does not render when all items are empty', () => {
    const { container } = renderStats({ items: [] });
    expect(container.innerHTML).toBe('');
  });

  // ── Hidden items ───────────────────────────────────────────────────

  it('does not render hidden items', () => {
    const itemsWithHidden: StatItem[] = [
      { id: 'visible', label: 'Visible', value: 100 },
      { id: 'hidden', label: 'Hidden', value: 200, hidden: true },
    ];
    renderStats({ items: itemsWithHidden });
    expect(screen.getByText('Visible:')).toBeInTheDocument();
    expect(screen.queryByText('Hidden:')).not.toBeInTheDocument();
  });

  it('renders nothing when all items are hidden', () => {
    const allHidden: StatItem[] = [
      { id: 'a', label: 'A', value: 1, hidden: true },
      { id: 'b', label: 'B', value: 2, hidden: true },
    ];
    const { container } = renderStats({ items: allHidden });
    expect(container.innerHTML).toBe('');
  });

  // ── Ordering ───────────────────────────────────────────────────────

  it('sorts items by order property', () => {
    const ordered: StatItem[] = [
      { id: 'c', label: 'Third', value: 3, order: 3 },
      { id: 'a', label: 'First', value: 1, order: 1 },
      { id: 'b', label: 'Second', value: 2, order: 2 },
    ];
    const { container } = renderStats({ items: ordered });
    const texts = container.querySelectorAll('.text-gray-400');
    expect(texts[0]).toHaveTextContent('First:');
    expect(texts[1]).toHaveTextContent('Second:');
    expect(texts[2]).toHaveTextContent('Third:');
  });

  // ── Layout options ─────────────────────────────────────────────────

  it('applies horizontal layout by default', () => {
    const { container } = renderStats();
    expect(container.firstElementChild?.className).toContain('flex');
    expect(container.firstElementChild?.className).toContain('flex-wrap');
  });

  it('applies vertical layout', () => {
    const { container } = renderStats({ layout: 'vertical' });
    expect(container.firstElementChild?.className).toContain('flex-col');
  });

  it('applies grid layout', () => {
    const { container } = renderStats({ layout: 'grid' });
    expect(container.firstElementChild?.className).toContain('grid');
  });

  it('applies grid template columns based on columns prop', () => {
    const { container } = renderStats({ layout: 'grid', columns: 3 });
    expect(container.firstElementChild?.getAttribute('style')).toContain('repeat(3');
  });

  // ── Dividers ───────────────────────────────────────────────────────

  it('shows dividers when showDividers is true and layout is horizontal', () => {
    const { container } = renderStats({ showDividers: true, layout: 'horizontal' });
    const dividerElements = container.querySelectorAll('.border-l');
    // First item has no divider, subsequent items do
    expect(dividerElements.length).toBe(2);
  });

  it('does not show dividers when showDividers is false', () => {
    const { container } = renderStats({ showDividers: false });
    const dividerElements = container.querySelectorAll('.border-l');
    expect(dividerElements.length).toBe(0);
  });

  // ── Compact mode ───────────────────────────────────────────────────

  it('applies compact text size', () => {
    const { container } = renderStats({ compact: true });
    const statItems = container.querySelectorAll('.text-xs');
    expect(statItems.length).toBeGreaterThan(0);
  });

  it('applies normal text size when not compact', () => {
    const { container } = renderStats({ compact: false });
    const statItems = container.querySelectorAll('.text-sm');
    expect(statItems.length).toBeGreaterThan(0);
  });

  // ── Icons ──────────────────────────────────────────────────────────

  it('renders icons when provided', () => {
    const itemsWithIcons: StatItem[] = [
      { id: 'plays', label: 'Plays', value: 100, icon: StatIcons.plays },
    ];
    renderStats({ items: itemsWithIcons });
    const svg = screen.getByText('Plays:').parentElement?.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('does not render icon container when no icon provided', () => {
    const noIconItems: StatItem[] = [
      { id: 'plays', label: 'Plays', value: 100 },
    ];
    renderStats({ items: noIconItems });
    const itemEl = screen.getByText('Plays:').parentElement;
    expect(itemEl?.querySelector('svg')).toBeNull();
  });

  // ── Predefined icons exist ─────────────────────────────────────────

  it('exports plays icon', () => {
    expect(StatIcons.plays).toBeTruthy();
  });

  it('exports views icon', () => {
    expect(StatIcons.views).toBeTruthy();
  });

  it('exports likes icon', () => {
    expect(StatIcons.likes).toBeTruthy();
  });

  it('exports comments icon', () => {
    expect(StatIcons.comments).toBeTruthy();
  });

  it('exports shares icon', () => {
    expect(StatIcons.shares).toBeTruthy();
  });

  it('exports downloads icon', () => {
    expect(StatIcons.downloads).toBeTruthy();
  });

  it('exports duration icon', () => {
    expect(StatIcons.duration).toBeTruthy();
  });

  it('exports calendar icon', () => {
    expect(StatIcons.calendar).toBeTruthy();
  });

  it('exports episodes icon', () => {
    expect(StatIcons.episodes).toBeTruthy();
  });

  it('exports subscribers icon', () => {
    expect(StatIcons.subscribers).toBeTruthy();
  });

  // ── Clickable items ────────────────────────────────────────────────

  it('calls onClick when a clickable item is clicked', () => {
    const onClick = vi.fn();
    const clickableItems: StatItem[] = [
      { id: 'stat', label: 'Stat', value: 42, onClick },
    ];
    renderStats({ items: clickableItems });
    fireEvent.click(screen.getByText('42'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // ── Links ──────────────────────────────────────────────────────────

  it('renders item as a link when href is provided', () => {
    const linkItems: StatItem[] = [
      { id: 'link', label: 'Link', value: 'Click me', href: 'https://example.com' },
    ];
    renderStats({ items: linkItems });
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  // ── Tooltip ────────────────────────────────────────────────────────

  it('renders tooltip as title attribute', () => {
    const tooltipItems: StatItem[] = [
      { id: 'tip', label: 'Tip', value: 99, tooltip: 'Total plays' },
    ];
    renderStats({ items: tooltipItems });
    const itemEl = screen.getByText('99').closest('[title]');
    expect(itemEl).toHaveAttribute('title', 'Total plays');
  });

  // ── className ──────────────────────────────────────────────────────

  it('passes custom className to the container', () => {
    const { container } = renderStats({ className: 'my-stats' });
    expect(container.firstElementChild?.className).toContain('my-stats');
  });
});
