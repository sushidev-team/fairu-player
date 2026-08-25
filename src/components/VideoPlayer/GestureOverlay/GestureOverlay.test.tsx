/**
 * The flash that acknowledges a gesture.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { GestureOverlay } from './GestureOverlay';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const overlay = () => screen.queryByTestId('gesture-overlay');
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('GestureOverlay', () => {
  it('shows nothing without a gesture', () => {
    render(<GestureOverlay feedback={null} />);

    expect(overlay()).not.toBeInTheDocument();
  });

  it('acknowledges a gesture', () => {
    render(<GestureOverlay feedback={{ type: 'skip-forward', label: '10s' }} />);

    expect(overlay()).toBeInTheDocument();
    expect(screen.getByText('10s')).toBeInTheDocument();
  });

  it('takes itself away again', () => {
    const onDismiss = vi.fn();
    render(<GestureOverlay feedback={{ type: 'skip-forward' }} onDismiss={onDismiss} />);

    advance(800);

    expect(overlay()).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('is not restarted by a parent that re-renders', () => {
    const feedback = { type: 'skip-forward' as const };
    const { rerender } = render(
      <GestureOverlay feedback={feedback} onDismiss={() => {}} />
    );

    advance(600);
    // A fresh arrow, as every caller passes.
    rerender(<GestureOverlay feedback={feedback} onDismiss={() => {}} />);
    advance(300);

    // Depending on the callback would restart the timer here and leave the
    // flash sitting over the picture.
    expect(overlay()).not.toBeInTheDocument();
  });

  it('is invisible to a screen reader', () => {
    render(<GestureOverlay feedback={{ type: 'volume-up', label: '70 %' }} />);

    // The reader's user did not make this gesture. Anything worth saying goes
    // through the announcer, where it can be phrased.
    expect(overlay()).toHaveAttribute('aria-hidden', 'true');
  });

  it('never swallows a touch', () => {
    render(<GestureOverlay feedback={{ type: 'skip-backward' }} />);

    expect(overlay()).toHaveClass('pointer-events-none');
  });

  it('restarts the flash for a second gesture', () => {
    const { rerender } = render(<GestureOverlay feedback={{ type: 'skip-forward' }} />);
    const first = overlay()!.querySelector('.fp-gesture-flash');

    advance(400);
    rerender(<GestureOverlay feedback={{ type: 'skip-backward' }} />);
    const second = overlay()!.querySelector('.fp-gesture-flash');

    // A reused node would keep the first animation's progress, so the second
    // acknowledgement would appear already half faded.
    expect(second).not.toBe(first);
  });

  it('keeps the animation as long as the element', () => {
    render(<GestureOverlay feedback={{ type: 'skip-forward' }} displayDuration={2000} />);
    const flash = overlay()!.querySelector('.fp-gesture-flash') as HTMLElement;

    // A fixed 800ms animation with `forwards` would leave a transparent box
    // sitting there for the remaining 1.2 seconds.
    expect(flash.style.animationDuration).toBe('2000ms');
  });

  it('centres the flash without the animation fighting it', () => {
    render(<GestureOverlay feedback={{ type: 'skip-forward' }} />);
    const flash = overlay()!.querySelector('.fp-gesture-flash') as HTMLElement;

    // Every keyframe sets `transform`; sharing an element with `-translate-y-1/2`
    // would drop the flash half its own height.
    expect(flash.className).not.toContain('-translate-y-1/2');
    expect(flash.parentElement?.className).toContain('-translate-y-1/2');
  });

  it('honours a custom duration', () => {
    render(<GestureOverlay feedback={{ type: 'skip-forward' }} displayDuration={2000} />);

    advance(900);
    expect(overlay()).toBeInTheDocument();

    advance(1200);
    expect(overlay()).not.toBeInTheDocument();
  });
});
