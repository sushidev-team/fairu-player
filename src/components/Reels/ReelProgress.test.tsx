/**
 * The reel scrub bar.
 *
 * Every pointer handler in this component was uncovered, which matters more
 * here than the number suggests: the bar sits on top of the feed's swipe
 * surface, so a scrub that fails to claim its pointer does not merely scrub
 * badly — it flicks to the next reel instead.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReelProgress } from './ReelProgress';

/** jsdom measures everything as zero, so the track needs a width to seek in. */
function giveTrackAWidth(element: HTMLElement, left = 0, width = 200) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left,
    width,
    right: left + width,
    top: 0,
    bottom: 4,
    height: 4,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

function bar() {
  return screen.getByRole('slider');
}

/** Press, drag, release — with the track measured first. */
function scrub(element: HTMLElement, points: number[]) {
  giveTrackAWidth(element);
  fireEvent.pointerDown(element, { clientX: points[0], pointerId: 1 });
  for (const x of points.slice(1)) {
    fireEvent.pointerMove(element, { clientX: x, pointerId: 1 });
  }
}

let onSeek: Mock<(time: number) => void>;
let onScrubStart: Mock<() => void>;
let onScrubEnd: Mock<() => void>;

beforeEach(() => {
  onSeek = vi.fn();
  onScrubStart = vi.fn();
  onScrubEnd = vi.fn();
});

function mount(props: Partial<React.ComponentProps<typeof ReelProgress>> = {}) {
  return render(
    <ReelProgress
      currentTime={30}
      duration={120}
      onSeek={onSeek}
      onScrubStart={onScrubStart}
      onScrubEnd={onScrubEnd}
      {...props}
    />
  );
}

describe('ReelProgress', () => {
  describe('role', () => {
    it('is a slider when it can be dragged', () => {
      mount();

      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('is a plain progress bar when it cannot', () => {
      mount({ scrubbable: false });

      // Not merely cosmetic: a slider a viewer cannot move is a promise the
      // component does not keep, and screen readers announce it as one.
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    });

    it('is reachable by keyboard only while scrubbable', () => {
      const { unmount } = mount();
      expect(screen.getByRole('slider')).toHaveAttribute('tabindex', '0');
      unmount();

      mount({ scrubbable: false });
      expect(screen.getByRole('progressbar')).toHaveAttribute('tabindex', '-1');
    });

    it('reports the playhead to assistive technology', () => {
      mount({ currentTime: 42.6, duration: 120 });

      expect(bar()).toHaveAttribute('aria-valuenow', '43');
      expect(bar()).toHaveAttribute('aria-valuemax', '120');
    });

    it('falls back to a percentage scale without a duration', () => {
      mount({ duration: 0 });

      expect(bar()).toHaveAttribute('aria-valuemax', '100');
    });
  });

  describe('scrubbing', () => {
    it('seeks to where it was pressed', () => {
      mount();

      scrub(bar(), [100]); // half of a 200px track

      expect(onSeek).toHaveBeenCalledWith(60);
    });

    it('follows the finger', () => {
      mount();

      scrub(bar(), [50, 150]);

      expect(onSeek).toHaveBeenLastCalledWith(90);
    });

    it('accounts for the track not starting at the screen edge', () => {
      mount();
      const track = bar();
      giveTrackAWidth(track, 40, 200);

      fireEvent.pointerDown(track, { clientX: 140, pointerId: 1 });

      expect(onSeek).toHaveBeenCalledWith(60);
    });

    it('clamps a drag past either end', () => {
      mount();

      scrub(bar(), [100, -500]);
      expect(onSeek).toHaveBeenLastCalledWith(0);

      scrub(bar(), [100, 5000]);
      expect(onSeek).toHaveBeenLastCalledWith(120);
    });

    it('announces the start and end of a drag', () => {
      mount();
      const track = bar();

      scrub(track, [100]);
      expect(onScrubStart).toHaveBeenCalledTimes(1);
      expect(onScrubEnd).not.toHaveBeenCalled();

      fireEvent.pointerUp(track, { clientX: 100, pointerId: 1 });
      expect(onScrubEnd).toHaveBeenCalledTimes(1);
    });

    it('treats a cancelled gesture as a finished one', () => {
      mount();
      const track = bar();

      scrub(track, [100]);
      fireEvent.pointerCancel(track, { clientX: 100, pointerId: 1 });

      // A gesture the browser takes away — a system swipe, an incoming call —
      // must still release the scrub. Otherwise the reel stays paused with no
      // finger on the screen and nothing to resume it.
      expect(onScrubEnd).toHaveBeenCalledTimes(1);
    });

    it('ignores movement that did not start with a press', () => {
      mount();
      const track = bar();
      giveTrackAWidth(track);

      fireEvent.pointerMove(track, { clientX: 100, pointerId: 1 });

      // A finger travelling across the screen to swipe passes over this bar.
      expect(onSeek).not.toHaveBeenCalled();
      expect(onScrubStart).not.toHaveBeenCalled();
    });

    it('claims the pointer so the feed does not also swipe', () => {
      mount();
      const track = bar();
      giveTrackAWidth(track);
      const capture = vi.spyOn(track, 'setPointerCapture');

      const event = new PointerEvent('pointerdown', {
        clientX: 100,
        pointerId: 7,
        bubbles: true,
      });
      const stopped = vi.spyOn(event, 'stopPropagation');
      fireEvent(track, event);

      expect(stopped).toHaveBeenCalled();
      expect(capture).toHaveBeenCalledWith(7);
    });
  });

  describe('the keyboard', () => {
    it('steps forward and back with the arrow keys', () => {
      mount({ currentTime: 30, duration: 120 });

      fireEvent.keyDown(bar(), { key: 'ArrowRight' });
      expect(onSeek).toHaveBeenLastCalledWith(35);

      fireEvent.keyDown(bar(), { key: 'ArrowLeft' });
      expect(onSeek).toHaveBeenLastCalledWith(25);
    });

    it('honours a custom step', () => {
      mount({ currentTime: 30, duration: 120, keyboardStep: 10 });

      fireEvent.keyDown(bar(), { key: 'ArrowRight' });

      expect(onSeek).toHaveBeenLastCalledWith(40);
    });

    it('jumps to either end with Home and End', () => {
      mount({ currentTime: 30, duration: 120 });

      fireEvent.keyDown(bar(), { key: 'Home' });
      expect(onSeek).toHaveBeenLastCalledWith(0);

      fireEvent.keyDown(bar(), { key: 'End' });
      expect(onSeek).toHaveBeenLastCalledWith(120);
    });

    it('clamps at the ends', () => {
      mount({ currentTime: 2, duration: 120 });
      fireEvent.keyDown(bar(), { key: 'ArrowLeft' });
      expect(onSeek).toHaveBeenLastCalledWith(0);

      mount({ currentTime: 118, duration: 120 });
      fireEvent.keyDown(screen.getAllByRole('slider')[1], { key: 'ArrowRight' });
      expect(onSeek).toHaveBeenLastCalledWith(120);
    });

    it('leaves the up and down keys to the feed', () => {
      mount();

      fireEvent.keyDown(bar(), { key: 'ArrowUp' });
      fireEvent.keyDown(bar(), { key: 'ArrowDown' });

      // Those move between reels. A scrub bar that swallowed them would trap
      // the viewer on one slide as soon as the bar had focus.
      expect(onSeek).not.toHaveBeenCalled();
    });

    it('keeps the key from reaching the feed when it acts on it', () => {
      mount();
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      const stopped = vi.spyOn(event, 'stopPropagation');

      fireEvent(bar(), event);

      expect(stopped).toHaveBeenCalled();
    });

    it('does nothing without a duration', () => {
      mount({ duration: 0 });

      fireEvent.keyDown(bar(), { key: 'ArrowRight' });

      expect(onSeek).not.toHaveBeenCalled();
    });

    it('does nothing when scrubbing is switched off', () => {
      mount({ scrubbable: false });

      fireEvent.keyDown(screen.getByRole('progressbar'), { key: 'ArrowRight' });

      expect(onSeek).not.toHaveBeenCalled();
    });
  });

  describe('when it must not scrub', () => {
    it('does nothing without a duration', () => {
      mount({ duration: 0 });
      const track = screen.getByRole('slider');
      giveTrackAWidth(track);

      fireEvent.pointerDown(track, { clientX: 100, pointerId: 1 });

      // A live stream has no end to seek to.
      expect(onSeek).not.toHaveBeenCalled();
      expect(onScrubStart).not.toHaveBeenCalled();
    });

    it('does nothing when scrubbing is switched off', () => {
      mount({ scrubbable: false });
      const track = screen.getByRole('progressbar');
      giveTrackAWidth(track);

      fireEvent.pointerDown(track, { clientX: 100, pointerId: 1 });

      // Ads use this: the bar shows how long is left but cannot be skipped past.
      expect(onSeek).not.toHaveBeenCalled();
    });
  });
});
