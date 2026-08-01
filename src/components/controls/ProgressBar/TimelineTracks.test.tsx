import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';
import type { TimelineTrack } from '@/types/markers';

const DURATION = 300;

const track = (overrides: Partial<TimelineTrack> = {}): TimelineTrack => ({
  id: 'actions',
  label: 'Actions',
  actions: [
    { id: 'a1', time: 30, label: 'Sponsor' },
    { id: 'a2', time: 90, endTime: 150, label: 'Intro' },
  ],
  ...overrides,
});

/** jsdom does no layout, so lanes need a measurable width. */
function sizeLane(container: HTMLElement, width = 300, left = 0) {
  const lane = container.querySelector('[role="group"]') as HTMLElement;
  lane.getBoundingClientRect = () =>
    ({ left, width, right: left + width, top: 0, bottom: 10, height: 10, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
  return lane;
}

describe('ProgressBar action tracks', () => {
  it('renders nothing extra when no tracks are given', () => {
    const { container } = render(<ProgressBar currentTime={0} duration={DURATION} />);
    expect(container.querySelector('.fp-timeline-tracks')).toBeNull();
    // The markup stays exactly as it was, so existing layouts do not shift.
    expect(container.querySelector('.fp-progress-with-tracks')).toBeNull();
  });

  it('leaves no horizontal gutter before a lane', () => {
    // A label beside the lane would shift its 0% away from the bar's, so an
    // action at 20s would not sit under 20s on the bar above it.
    const { container } = render(
      <ProgressBar currentTime={0} duration={DURATION} tracks={[track()]} />
    );

    const lane = container.querySelector('[role="group"]') as HTMLElement;
    // Siblings must stack vertically, so a label cannot push the lane sideways.
    expect(lane.parentElement?.className).toContain('flex-col');
    expect(lane.className).toContain('w-full');
  });

  it('renders a lane per track with its label', () => {
    render(
      <ProgressBar
        currentTime={0}
        duration={DURATION}
        tracks={[track(), track({ id: 'second', label: 'Cues', actions: [] })]}
      />
    );

    expect(screen.getByRole('group', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Cues' })).toBeInTheDocument();
  });

  it('positions points and ranges as a percentage of duration', () => {
    render(<ProgressBar currentTime={0} duration={DURATION} tracks={[track()]} />);

    const point = screen.getByRole('button', { name: 'Sponsor' });
    const range = screen.getByRole('button', { name: 'Intro' });

    expect(point.style.left).toBe('10%'); // 30 / 300
    expect(point.style.width).toBe(''); // a point has no width
    expect(range.style.left).toBe('30%'); // 90 / 300
    expect(range.style.width).toBe('20%'); // (150 - 90) / 300
  });

  it('seeks to an action when selected, and reports it', () => {
    const onSeek = vi.fn();
    const onActionSelect = vi.fn();

    render(
      <ProgressBar
        currentTime={0}
        duration={DURATION}
        tracks={[track()]}
        onSeek={onSeek}
        onActionSelect={onActionSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sponsor' }));

    expect(onSeek).toHaveBeenCalledWith(30);
    expect(onActionSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1' }),
      expect.objectContaining({ id: 'actions' })
    );
  });

  it('can report a selection without seeking', () => {
    const onSeek = vi.fn();
    const onActionSelect = vi.fn();

    render(
      <ProgressBar
        currentTime={0}
        duration={DURATION}
        tracks={[track({ seekOnSelect: false })]}
        onSeek={onSeek}
        onActionSelect={onActionSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sponsor' }));

    expect(onSeek).not.toHaveBeenCalled();
    expect(onActionSelect).toHaveBeenCalled();
  });

  /**
   * The whole point of a separate lane. On the seek bar every marker handler
   * needs `stopPropagation` or grabbing one scrubs the playhead; out here the
   * surfaces are simply different elements.
   */
  it('never seeks when interacting with a lane', () => {
    const onSeek = vi.fn();
    const onSeekStart = vi.fn();

    const { container } = render(
      <ProgressBar
        currentTime={0}
        duration={DURATION}
        tracks={[track({ movable: true, editable: true, seekOnSelect: false })]}
        onSeek={onSeek}
        onSeekStart={onSeekStart}
        onActionMove={vi.fn()}
        onActionAdd={vi.fn()}
      />
    );

    const lane = sizeLane(container);
    const action = screen.getByRole('button', { name: 'Sponsor' });

    act(() => {
      fireEvent.pointerDown(action, { pointerId: 1, clientX: 30, isPrimary: true });
      fireEvent.pointerMove(action, { pointerId: 1, clientX: 150 });
      fireEvent.pointerUp(action, { pointerId: 1, clientX: 150 });
      fireEvent.mouseDown(lane, { clientX: 200 });
      fireEvent.click(lane, { clientX: 200 });
    });

    expect(onSeek).not.toHaveBeenCalled();
    expect(onSeekStart).not.toHaveBeenCalled();
  });

  describe('adding', () => {
    it('adds at the clicked time on an editable lane', () => {
      const onActionAdd = vi.fn();
      const { container } = render(
        <ProgressBar
          currentTime={0}
          duration={DURATION}
          tracks={[track({ editable: true })]}
          onActionAdd={onActionAdd}
        />
      );

      const lane = sizeLane(container);
      fireEvent.click(lane, { clientX: 150 }); // half way

      expect(onActionAdd).toHaveBeenCalledWith(150, expect.objectContaining({ id: 'actions' }));
    });

    it('does not add on a lane that is not editable', () => {
      const onActionAdd = vi.fn();
      const { container } = render(
        <ProgressBar
          currentTime={0}
          duration={DURATION}
          tracks={[track()]}
          onActionAdd={onActionAdd}
        />
      );

      fireEvent.click(sizeLane(container), { clientX: 150 });
      expect(onActionAdd).not.toHaveBeenCalled();
    });

    it('does not add when the click landed on an existing action', () => {
      // Otherwise selecting an action would also create one on top of it.
      const onActionAdd = vi.fn();
      render(
        <ProgressBar
          currentTime={0}
          duration={DURATION}
          tracks={[track({ editable: true })]}
          onActionAdd={onActionAdd}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Sponsor' }));
      expect(onActionAdd).not.toHaveBeenCalled();
    });
  });

  describe('moving', () => {
    it('reports the new start while dragging', () => {
      const onActionMove = vi.fn();
      const { container } = render(
        <ProgressBar
          currentTime={0}
          duration={DURATION}
          tracks={[track({ movable: true })]}
          onActionMove={onActionMove}
        />
      );

      sizeLane(container);
      const action = screen.getByRole('button', { name: 'Sponsor' });

      act(() => {
        // Grab exactly on the action (30s = x 30), drag to x 150 = 150s.
        fireEvent.pointerDown(action, { pointerId: 1, clientX: 30, isPrimary: true });
        fireEvent.pointerMove(action, { pointerId: 1, clientX: 150 });
      });

      expect(onActionMove).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'a1' }),
        150,
        expect.objectContaining({ id: 'actions' })
      );
    });

    it('keeps a range inside the timeline', () => {
      const onActionMove = vi.fn();
      const { container } = render(
        <ProgressBar
          currentTime={0}
          duration={DURATION}
          tracks={[track({ movable: true })]}
          onActionMove={onActionMove}
        />
      );

      sizeLane(container);
      const range = screen.getByRole('button', { name: 'Intro' }); // 90–150, 60s long

      act(() => {
        fireEvent.pointerDown(range, { pointerId: 1, clientX: 90, isPrimary: true });
        // Drag far past the end.
        fireEvent.pointerMove(range, { pointerId: 1, clientX: 999 });
      });

      // The tail must not run past the duration: 300 - 60 = 240.
      expect(onActionMove).toHaveBeenLastCalledWith(expect.anything(), 240, expect.anything());
    });

    it('does not move on a lane that is not movable', () => {
      const onActionMove = vi.fn();
      const { container } = render(
        <ProgressBar
          currentTime={0}
          duration={DURATION}
          tracks={[track()]}
          onActionMove={onActionMove}
        />
      );

      sizeLane(container);
      const action = screen.getByRole('button', { name: 'Sponsor' });

      act(() => {
        fireEvent.pointerDown(action, { pointerId: 1, clientX: 30, isPrimary: true });
        fireEvent.pointerMove(action, { pointerId: 1, clientX: 150 });
      });

      expect(onActionMove).not.toHaveBeenCalled();
    });

    it('does not also select after a drag', () => {
      // A release that ends a move is not a click.
      const onActionSelect = vi.fn();
      const { container } = render(
        <ProgressBar
          currentTime={0}
          duration={DURATION}
          tracks={[track({ movable: true, seekOnSelect: false })]}
          onActionMove={vi.fn()}
          onActionSelect={onActionSelect}
        />
      );

      sizeLane(container);
      const action = screen.getByRole('button', { name: 'Sponsor' });

      act(() => {
        fireEvent.pointerDown(action, { pointerId: 1, clientX: 30, isPrimary: true });
        fireEvent.pointerMove(action, { pointerId: 1, clientX: 150 });
        fireEvent.pointerUp(action, { pointerId: 1, clientX: 150 });
        fireEvent.click(action);
      });

      expect(onActionSelect).not.toHaveBeenCalled();
    });
  });

  describe('resizing', () => {
    it('grows edge handles only on a resizable lane', () => {
      const { container, rerender } = render(
        <ProgressBar currentTime={0} duration={DURATION} tracks={[track()]} />
      );
      expect(container.querySelectorAll('[role="presentation"]')).toHaveLength(0);

      rerender(
        <ProgressBar currentTime={0} duration={DURATION} tracks={[track({ resizable: true })]} />
      );
      // Two handles, and only on the range — points cannot be resized.
      expect(container.querySelectorAll('[role="presentation"]')).toHaveLength(2);
    });

    it('reports a new end when the right edge is dragged', () => {
      const onActionResize = vi.fn();
      const { container } = render(
        <ProgressBar
          currentTime={0}
          duration={DURATION}
          tracks={[track({ resizable: true })]}
          onActionResize={onActionResize}
        />
      );

      sizeLane(container);
      const [, rightHandle] = Array.from(container.querySelectorAll('[role="presentation"]'));

      act(() => {
        fireEvent.pointerDown(rightHandle, { pointerId: 1, clientX: 150, isPrimary: true });
        fireEvent.pointerMove(rightHandle, { pointerId: 1, clientX: 210 });
      });

      expect(onActionResize).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'a2' }),
        90,
        210,
        expect.anything()
      );
    });

    it('refuses to collapse a range below its minimum', () => {
      const onActionResize = vi.fn();
      const { container } = render(
        <ProgressBar
          currentTime={0}
          duration={DURATION}
          tracks={[track({ resizable: true })]}
          onActionResize={onActionResize}
        />
      );

      sizeLane(container);
      const [, rightHandle] = Array.from(container.querySelectorAll('[role="presentation"]'));

      act(() => {
        fireEvent.pointerDown(rightHandle, { pointerId: 1, clientX: 150, isPrimary: true });
        // Drag the end back past the start.
        fireEvent.pointerMove(rightHandle, { pointerId: 1, clientX: 0 });
      });

      const calls = onActionResize.mock.calls;
    const [, start, end] = calls[calls.length - 1];
      expect(end).toBeGreaterThan(start);
    });
  });

  it('honours disabled actions and a disabled bar', () => {
    const onActionSelect = vi.fn();
    render(
      <ProgressBar
        currentTime={0}
        duration={DURATION}
        tracks={[
          track({
            seekOnSelect: false,
            actions: [{ id: 'x', time: 10, label: 'Locked', disabled: true }],
          }),
        ]}
        onActionSelect={onActionSelect}
      />
    );

    const action = screen.getByRole('button', { name: 'Locked' });
    expect(action).toBeDisabled();

    fireEvent.click(action);
    expect(onActionSelect).not.toHaveBeenCalled();
  });

  it('marks the selected action', () => {
    render(
      <ProgressBar
        currentTime={0}
        duration={DURATION}
        tracks={[track()]}
        selectedActionId="a2"
      />
    );

    expect(screen.getByRole('button', { name: 'Intro' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Sponsor' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('supports a custom renderer', () => {
    render(
      <ProgressBar
        currentTime={120}
        duration={DURATION}
        tracks={[
          track({
            renderAction: (action, ctx) => (
              <span data-testid={`custom-${action.id}`}>
                {action.label}:{ctx.active ? 'active' : 'idle'}
              </span>
            ),
          }),
        ]}
      />
    );

    // The playhead at 120 is inside the 90–150 range but not on the 30s point.
    expect(screen.getByTestId('custom-a1')).toHaveTextContent('Sponsor:idle');
    expect(screen.getByTestId('custom-a2')).toHaveTextContent('Intro:active');
  });

  it('still supports seeking on the bar itself while lanes are present', () => {
    const onSeek = vi.fn();
    const { container } = render(
      <ProgressBar
        currentTime={0}
        duration={DURATION}
        tracks={[track()]}
        onSeek={onSeek}
      />
    );

    const bar = container.querySelector('[role="slider"]') as HTMLElement;
    bar.getBoundingClientRect = () =>
      ({ left: 0, width: 300, right: 300, top: 0, bottom: 8, height: 8, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    fireEvent.mouseDown(bar, { clientX: 150 });
    expect(onSeek).toHaveBeenCalledWith(150);
  });
});
