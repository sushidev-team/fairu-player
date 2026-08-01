import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';
import type { TimelineMarker } from '@/types/markers';

/**
 * Marker authoring on the seek bar.
 *
 * The bar is a player control first, so the rule every test here is checking is
 * that authoring never costs seeking: a plain click still scrubs, and the
 * gestures that make and move markers are the ones a click was not already
 * using.
 */

const DURATION = 300;

const MARKERS: TimelineMarker[] = [
  { id: 'a', time: 30, title: 'Intro' },
  { id: 'b', time: 120, title: 'Break' },
];

/**
 * jsdom has no layout, so a bar has no width and no point along it can be
 * pressed. 300 pixels standing in for 300 seconds keeps the arithmetic in the
 * tests readable: one pixel is one second.
 */
function withLayout(node: HTMLElement) {
  node.getBoundingClientRect = () =>
    ({ left: 0, width: DURATION, top: 0, height: 8, right: DURATION, bottom: 8, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  return node;
}

function setup(props: Partial<React.ComponentProps<typeof ProgressBar>> = {}) {
  const view = render(
    <ProgressBar currentTime={60} duration={DURATION} markers={MARKERS} {...props} />
  );
  const bar = withLayout(view.container.querySelector('[role="slider"]') as HTMLElement);
  const dot = (id: string) => view.container.querySelector(`[data-marker-id="${id}"]`) as HTMLElement;
  return { ...view, bar, dot };
}

describe('ProgressBar marker authoring', () => {
  it('adds a marker where the bar was double clicked', () => {
    const onMarkerAdd = vi.fn();
    const { bar } = setup({ onMarkerAdd });

    fireEvent.doubleClick(bar, { clientX: 90 });

    expect(onMarkerAdd).toHaveBeenCalledWith(90);
  });

  it('adds a marker at the playhead on M', () => {
    // The whole keyboard path: dots are dragged, so without this there is none.
    const onMarkerAdd = vi.fn();
    const { bar } = setup({ onMarkerAdd });

    fireEvent.keyDown(bar, { key: 'm' });

    expect(onMarkerAdd).toHaveBeenCalledWith(60);
  });

  it('leaves the arrow keys seeking', () => {
    const onMarkerAdd = vi.fn();
    const onSeek = vi.fn();
    const { bar } = setup({ onMarkerAdd, onSeek });

    fireEvent.keyDown(bar, { key: 'ArrowRight' });

    expect(onSeek).toHaveBeenCalledWith(65);
    expect(onMarkerAdd).not.toHaveBeenCalled();
  });

  it('still seeks on a single click', () => {
    const onSeek = vi.fn();
    const onMarkerAdd = vi.fn();
    const { bar } = setup({ onSeek, onMarkerAdd });

    fireEvent.mouseDown(bar, { clientX: 150 });

    expect(onSeek).toHaveBeenCalledWith(150);
    expect(onMarkerAdd).not.toHaveBeenCalled();
  });

  it('adds nothing when there is nobody to tell', () => {
    const onSeek = vi.fn();
    const { bar } = setup({ onSeek });

    // No handler, no editing: the bar is a plain seek control again.
    expect(() => fireEvent.doubleClick(bar, { clientX: 90 })).not.toThrow();
    expect(() => fireEvent.keyDown(bar, { key: 'm' })).not.toThrow();
  });

  it('moves a marker by dragging its dot', () => {
    const onMarkerMove = vi.fn();
    const { bar, dot } = setup({ onMarkerMove });
    const handle = dot('a');

    handle.setPointerCapture = vi.fn();

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 30 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 200 });

    expect(onMarkerMove).toHaveBeenCalledWith('a', 200);

    fireEvent.pointerUp(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 250 });

    // Released: the dot stops following the pointer.
    expect(onMarkerMove).toHaveBeenCalledTimes(1);
    expect(bar).toBeTruthy();
  });

  it('does not scrub the playhead while a marker is picked up', () => {
    /*
     * The regression this guards: a dot sits on the surface that seeks, and a
     * `mousedown` is raised alongside the `pointerdown`. Stopping only the
     * pointer event leaves the bar seeking to wherever the marker was grabbed.
     */
    const onSeek = vi.fn();
    const onMarkerMove = vi.fn();
    const { dot } = setup({ onSeek, onMarkerMove });
    const handle = dot('a');

    handle.setPointerCapture = vi.fn();

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 30 });
    fireEvent.mouseDown(handle, { clientX: 30 });

    expect(onSeek).not.toHaveBeenCalled();
  });

  it('keeps a decorative dot out of the way of seeking', () => {
    const { dot } = setup();

    // Nothing to move it to and nothing to select: it must not eat the gesture.
    expect(dot('a').className).toContain('pointer-events-none');
  });

  it('reports a marker that was clicked rather than dragged', () => {
    const onMarkerSelect = vi.fn();
    const { dot } = setup({ onMarkerSelect });

    fireEvent.click(dot('b'));

    expect(onMarkerSelect).toHaveBeenCalledWith(MARKERS[1]);
  });

  it('does none of it while disabled', () => {
    const onMarkerAdd = vi.fn();
    const onMarkerMove = vi.fn();
    const { bar, dot } = setup({ onMarkerAdd, onMarkerMove, disabled: true });
    const handle = dot('a');

    handle.setPointerCapture = vi.fn();

    fireEvent.doubleClick(bar, { clientX: 90 });
    fireEvent.keyDown(bar, { key: 'm' });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 30 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 200 });

    expect(onMarkerAdd).not.toHaveBeenCalled();
    expect(onMarkerMove).not.toHaveBeenCalled();
  });
});
