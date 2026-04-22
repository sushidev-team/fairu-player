import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChapterList } from './ChapterList';
import { createMockChapters } from '@/test/helpers';
import type { Chapter } from '@/types/player';

const chapters = createMockChapters() as Chapter[];

function renderChapterList(props: Partial<Parameters<typeof ChapterList>[0]> = {}) {
  const defaults = {
    chapters,
    currentChapterIndex: 0,
    currentTime: 0,
    duration: 180,
    onChapterClick: vi.fn(),
  };
  return render(<ChapterList {...defaults} {...props} />);
}

describe('ChapterList', () => {
  // ── Rendering ──────────────────────────────────────────────────────

  it('renders the "Chapters" heading', () => {
    renderChapterList();
    expect(screen.getByText('Chapters')).toBeInTheDocument();
  });

  it('renders all chapter titles', () => {
    renderChapterList();
    expect(screen.getByText('Intro')).toBeInTheDocument();
    expect(screen.getByText('Main Content')).toBeInTheDocument();
    expect(screen.getByText('Outro')).toBeInTheDocument();
  });

  it('renders a list with chapter items', () => {
    renderChapterList();
    expect(screen.getByRole('list', { name: 'Chapter list' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });

  it('does not render when chapters array is empty', () => {
    const { container } = renderChapterList({ chapters: [] });
    expect(container.innerHTML).toBe('');
  });

  // ── Active chapter highlighting ────────────────────────────────────

  it('marks the active chapter with aria-current', () => {
    renderChapterList({ currentChapterIndex: 1 });
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).not.toHaveAttribute('aria-current');
    expect(buttons[1]).toHaveAttribute('aria-current', 'true');
    expect(buttons[2]).not.toHaveAttribute('aria-current');
  });

  it('applies active background styling to current chapter', () => {
    renderChapterList({ currentChapterIndex: 0 });
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].className).toContain('bg-[var(--fp-color-surface)]');
  });

  it('shows active indicator dot for current chapter', () => {
    renderChapterList({ currentChapterIndex: 1 });
    const activeButton = screen.getAllByRole('button')[1];
    const dot = activeButton.querySelector('.rounded-full.bg-\\[var\\(--fp-color-primary\\)\\]');
    expect(dot).toBeTruthy();
  });

  it('applies active text color to current chapter title', () => {
    renderChapterList({ currentChapterIndex: 0 });
    const introText = screen.getByText('Intro');
    expect(introText.className).toContain('text-[var(--fp-color-primary)]');
    expect(introText.className).toContain('font-medium');
  });

  // ── Click handler ──────────────────────────────────────────────────

  it('calls onChapterClick with chapter and index when clicked', () => {
    const onChapterClick = vi.fn();
    renderChapterList({ onChapterClick });
    fireEvent.click(screen.getByText('Main Content'));
    expect(onChapterClick).toHaveBeenCalledWith(chapters[1], 1);
  });

  it('calls onChapterClick for first chapter', () => {
    const onChapterClick = vi.fn();
    renderChapterList({ onChapterClick });
    fireEvent.click(screen.getByText('Intro'));
    expect(onChapterClick).toHaveBeenCalledWith(chapters[0], 0);
  });

  it('calls onChapterClick for last chapter', () => {
    const onChapterClick = vi.fn();
    renderChapterList({ onChapterClick });
    fireEvent.click(screen.getByText('Outro'));
    expect(onChapterClick).toHaveBeenCalledWith(chapters[2], 2);
  });

  // ── showDuration ───────────────────────────────────────────────────

  it('shows start times when showDuration is true (default)', () => {
    renderChapterList();
    expect(screen.getByText('0:00')).toBeInTheDocument();
    // 0:30 appears for both chapter 1 startTime (30s) and chapter 1 duration (30s)
    expect(screen.getAllByText('0:30').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2:00')).toBeInTheDocument();
  });

  it('shows chapter durations when showDuration is true', () => {
    renderChapterList();
    // Chapter 1: 0-30 = 30s, Chapter 2: 30-120 = 90s, Chapter 3: 120-180 = 60s
    // formatTime(30) = '0:30', formatTime(90) = '1:30', formatTime(60) = '1:00'
    expect(screen.getAllByText('0:30').length).toBeGreaterThanOrEqual(1); // start time and/or duration
    expect(screen.getByText('1:30')).toBeInTheDocument();
    expect(screen.getByText('1:00')).toBeInTheDocument();
  });

  it('hides durations when showDuration is false', () => {
    renderChapterList({ showDuration: false });
    // The formatted times should not be present
    expect(screen.queryByText('0:00')).not.toBeInTheDocument();
    expect(screen.queryByText('1:30')).not.toBeInTheDocument();
  });

  // ── showImage ──────────────────────────────────────────────────────

  it('shows chapter images when showImage is true and images exist', () => {
    const chaptersWithImages = chapters.map((ch) => ({
      ...ch,
      image: `https://example.com/${ch.id}.jpg`,
    }));
    const { container } = renderChapterList({ chapters: chaptersWithImages, showImage: true });
    const images = container.querySelectorAll('img');
    expect(images.length).toBe(3);
  });

  it('does not show images when showImage is false', () => {
    const chaptersWithImages = chapters.map((ch) => ({
      ...ch,
      image: `https://example.com/${ch.id}.jpg`,
    }));
    const { container } = renderChapterList({ chapters: chaptersWithImages, showImage: false });
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('does not show images when chapters have no image property', () => {
    const { container } = renderChapterList({ showImage: true });
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  // ── className ──────────────────────────────────────────────────────

  it('passes custom className to the container', () => {
    const { container } = renderChapterList({ className: 'my-chapters' });
    expect(container.firstElementChild?.className).toContain('my-chapters');
  });

  // ── Chapter without endTime ────────────────────────────────────────

  it('calculates duration from next chapter start when endTime is absent', () => {
    const chaptersNoEnd: Chapter[] = [
      { id: 'ch-1', title: 'Part 1', startTime: 0 },
      { id: 'ch-2', title: 'Part 2', startTime: 60 },
    ];
    renderChapterList({ chapters: chaptersNoEnd, duration: 120 });
    // Part 1 duration: 60-0 = 60s -> '1:00', Part 2 duration: 120-60 = 60s -> '1:00'
    // Part 1: startTime=0 "0:00", duration=60 "1:00"
    // Part 2: startTime=60 "1:00", duration=60 "1:00"
    // Total "1:00" appearances = 3 (Part1 dur + Part2 start + Part2 dur)
    expect(screen.getAllByText('1:00').length).toBe(3);
  });
});
