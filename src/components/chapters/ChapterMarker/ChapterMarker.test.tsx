import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChapterMarker } from './ChapterMarker';
import type { Chapter } from '@/types/player';

const chapter: Chapter = {
  id: 'ch-1',
  title: 'Introduction',
  startTime: 30,
};

function renderChapterMarker(props: Partial<Parameters<typeof ChapterMarker>[0]> = {}) {
  const defaults = {
    chapter,
    duration: 300,
    isActive: false,
    onClick: vi.fn(),
  };
  return render(<ChapterMarker {...defaults} {...props} />);
}

describe('ChapterMarker', () => {
  // ── Rendering ──────────────────────────────────────────────────────

  it('renders as a button', () => {
    renderChapterMarker();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('has type="button"', () => {
    renderChapterMarker();
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });

  it('has an aria-label with the chapter title', () => {
    renderChapterMarker();
    expect(screen.getByRole('button', { name: 'Chapter: Introduction' })).toBeInTheDocument();
  });

  it('has a title attribute with the chapter title', () => {
    renderChapterMarker();
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Introduction');
  });

  // ── Position calculation ───────────────────────────────────────────

  it('calculates left position as percentage of duration', () => {
    renderChapterMarker({ chapter: { ...chapter, startTime: 60 }, duration: 300 });
    const btn = screen.getByRole('button');
    // 60 / 300 * 100 = 20%
    expect(btn.style.left).toBe('20%');
  });

  it('calculates 0% position for startTime 0', () => {
    renderChapterMarker({ chapter: { ...chapter, startTime: 0 }, duration: 300 });
    expect(screen.getByRole('button').style.left).toBe('0%');
  });

  it('calculates position for a chapter near the end', () => {
    renderChapterMarker({ chapter: { ...chapter, startTime: 270 }, duration: 300 });
    // 270 / 300 * 100 = 90%
    expect(screen.getByRole('button').style.left).toBe('90%');
  });

  it('handles zero duration gracefully (0% position)', () => {
    renderChapterMarker({ duration: 0 });
    expect(screen.getByRole('button').style.left).toBe('0%');
  });

  // ── Active state ───────────────────────────────────────────────────

  it('applies active styling when isActive is true', () => {
    renderChapterMarker({ isActive: true });
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-[var(--fp-color-primary)]');
    expect(btn.className).toContain('z-10');
  });

  it('applies inactive styling when isActive is false', () => {
    renderChapterMarker({ isActive: false });
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('opacity-40');
    expect(btn.className).not.toContain('z-10');
  });

  // ── Click handler ──────────────────────────────────────────────────

  it('calls onClick with the chapter when clicked', () => {
    const onClick = vi.fn();
    renderChapterMarker({ onClick });
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(chapter);
  });

  it('calls onClick with a different chapter', () => {
    const onClick = vi.fn();
    const otherChapter: Chapter = { id: 'ch-2', title: 'Middle', startTime: 100 };
    renderChapterMarker({ chapter: otherChapter, onClick });
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(otherChapter);
  });

  // ── className ──────────────────────────────────────────────────────

  it('passes custom className', () => {
    renderChapterMarker({ className: 'my-marker' });
    expect(screen.getByRole('button').className).toContain('my-marker');
  });

  // ── Absolute positioning ───────────────────────────────────────────

  it('has absolute positioning class', () => {
    renderChapterMarker();
    expect(screen.getByRole('button').className).toContain('absolute');
  });

  // ── Different chapters ─────────────────────────────────────────────

  it('renders correct label for a different chapter title', () => {
    renderChapterMarker({
      chapter: { id: 'ch-x', title: 'The Finale', startTime: 200 },
    });
    expect(screen.getByRole('button', { name: 'Chapter: The Finale' })).toBeInTheDocument();
  });
});
