/**
 * The live region for things the player does that are only visible.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ScreenReaderAnnouncer } from './ScreenReaderAnnouncer';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const settle = () =>
  act(() => {
    vi.advanceTimersByTime(100);
  });

describe('ScreenReaderAnnouncer', () => {
  it('announces the message', () => {
    render(<ScreenReaderAnnouncer message="Wiedergabe gestartet" />);
    settle();

    expect(screen.getByRole('status')).toHaveTextContent('Wiedergabe gestartet');
  });

  it('waits for a pause by default', () => {
    render(<ScreenReaderAnnouncer message="Lautstärke 70 %" />);

    // Interrupting someone mid-sentence for a volume step is worse than not
    // telling them.
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('uses an alert when it must interrupt', () => {
    render(<ScreenReaderAnnouncer message="Wiedergabe fehlgeschlagen" politeness="assertive" />);
    settle();

    // `role="status"` with `aria-live="assertive"` asks for two different
    // things at once; `alert` is the assertive counterpart.
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('repeats the same message', () => {
    const { rerender } = render(<ScreenReaderAnnouncer message="Übersprungen" />);
    settle();

    rerender(<ScreenReaderAnnouncer message="" />);
    rerender(<ScreenReaderAnnouncer message="Übersprungen" />);

    // A reader ignores a value that has not changed, so the region is emptied
    // first — which is what the delay is for.
    expect(screen.getByRole('status')).toHaveTextContent('');
    settle();
    expect(screen.getByRole('status')).toHaveTextContent('Übersprungen');
  });

  it('says nothing for an empty message', () => {
    render(<ScreenReaderAnnouncer message="" />);
    settle();

    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('is out of the way visually', () => {
    render(<ScreenReaderAnnouncer message="Test" />);

    expect(screen.getByRole('status')).toHaveStyle({ position: 'absolute', width: '1px' });
  });
});
