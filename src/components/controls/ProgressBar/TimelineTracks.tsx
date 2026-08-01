import { useCallback, useRef, useState } from 'react';
import { cn, formatTime } from '@/utils';
import type { TimelineAction, TimelineTrack } from '@/types/markers';

/** What a drag is currently doing to an action. */
type DragMode = 'move' | 'resize-start' | 'resize-end';

interface DragState {
  trackId: string;
  actionId: string;
  mode: DragMode;
  /** Seconds between the grab point and the action's start. */
  grabOffset: number;
}

export interface TimelineTracksProps {
  tracks: TimelineTrack[];
  duration: number;
  currentTime: number;
  /** Id of the currently selected action, if the host tracks one. */
  selectedActionId?: string | null;
  disabled?: boolean;
  onActionSelect?: (action: TimelineAction, track: TimelineTrack) => void;
  onActionAdd?: (time: number, track: TimelineTrack) => void;
  onActionMove?: (action: TimelineAction, time: number, track: TimelineTrack) => void;
  onActionResize?: (
    action: TimelineAction,
    start: number,
    end: number,
    track: TimelineTrack
  ) => void;
  className?: string;
}

/** Minimum length of a range, so it cannot be dragged into nothing. */
const MIN_RANGE_SECONDS = 0.25;

/**
 * Action lanes rendered underneath the seek bar.
 *
 * Deliberately a sibling of the seek surface rather than a child: the bar owns
 * pointer events for scrubbing, and anything inside it has to fight that. Out
 * here a single click can select, empty space can add, and a drag can move an
 * action without ever moving the playhead.
 *
 * Positions are expressed as percentages of `duration`, so the lanes line up
 * with the bar as long as both span the same width — which they do, because the
 * wrapper stacks them in a column.
 */
export function TimelineTracks({
  tracks,
  duration,
  currentTime,
  selectedActionId,
  disabled = false,
  onActionSelect,
  onActionAdd,
  onActionMove,
  onActionResize,
  className,
}: TimelineTracksProps) {
  const laneRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // The gesture lives in a ref, not state: within one batch React has not
  // flushed a `setState` from `pointerdown` before `pointermove` runs, so a
  // state-held drag reads as "not dragging" for the first move. `dragging`
  // mirrors it only for the bits that need to re-render.
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<{ trackId: string; time: number; left: number } | null>(null);
  // Distinguishes a click from a drag, so releasing after a move does not also select.
  const movedRef = useRef(false);

  const timeAt = useCallback(
    (trackId: string, clientX: number): number => {
      const lane = laneRefs.current[trackId];
      if (!lane || duration <= 0) return 0;
      const rect = lane.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(duration, ratio * duration));
    },
    [duration]
  );

  const beginDrag = useCallback(
    (
      event: React.PointerEvent,
      track: TimelineTrack,
      action: TimelineAction,
      mode: DragMode
    ) => {
      if (disabled || action.disabled) return;
      if (mode === 'move' && !track.movable) return;
      if (mode !== 'move' && !track.resizable) return;

      event.stopPropagation();
      event.preventDefault();
      try {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      } catch {
        // Capture can fail if the pointer was already released; the drag still
        // works through the element's own handlers.
      }

      movedRef.current = false;
      dragRef.current = {
        trackId: track.id,
        actionId: action.id,
        mode,
        grabOffset: timeAt(track.id, event.clientX) - action.time,
      };
      setDragging(true);
    },
    [disabled, timeAt]
  );

  const continueDrag = useCallback(
    (event: React.PointerEvent, track: TimelineTrack, action: TimelineAction) => {
      const drag = dragRef.current;
      if (!drag || drag.actionId !== action.id) return;
      event.stopPropagation();
      movedRef.current = true;

      const at = timeAt(track.id, event.clientX);

      if (drag.mode === 'move') {
        const length = action.endTime !== undefined ? action.endTime - action.time : 0;
        // Keep the whole range inside the timeline rather than letting the tail
        // run past the end.
        const start = Math.max(0, Math.min(duration - length, at - drag.grabOffset));
        onActionMove?.(action, start, track);
        return;
      }

      if (action.endTime === undefined) return;

      if (drag.mode === 'resize-start') {
        const start = Math.max(0, Math.min(action.endTime - MIN_RANGE_SECONDS, at));
        onActionResize?.(action, start, action.endTime, track);
      } else {
        const end = Math.min(duration, Math.max(action.time + MIN_RANGE_SECONDS, at));
        onActionResize?.(action, action.time, end, track);
      }
    },
    [duration, timeAt, onActionMove, onActionResize]
  );

  const endDrag = useCallback((event: React.PointerEvent) => {
    if (!dragRef.current) return;
    event.stopPropagation();
    dragRef.current = null;
    setDragging(false);
  }, []);

  /** Clicking empty lane space adds an action there. */
  const handleLaneClick = useCallback(
    (event: React.MouseEvent, track: TimelineTrack) => {
      if (disabled || !track.editable || !onActionAdd) return;
      // A click that ends a drag is not a request to add.
      if (movedRef.current) {
        movedRef.current = false;
        return;
      }
      if (event.target !== event.currentTarget) return;
      onActionAdd(timeAt(track.id, event.clientX), track);
    },
    [disabled, onActionAdd, timeAt]
  );

  const handleSelect = useCallback(
    (event: React.MouseEvent, track: TimelineTrack, action: TimelineAction) => {
      event.stopPropagation();
      if (disabled || action.disabled) return;
      if (movedRef.current) {
        movedRef.current = false;
        return;
      }
      onActionSelect?.(action, track);
    },
    [disabled, onActionSelect]
  );

  if (tracks.length === 0) return null;

  return (
    <div className={cn('fp-timeline-tracks flex w-full flex-col gap-1 pt-1', className)}>
      {tracks.map((track) => {
        const laneHeight = track.height ?? 10;
        const laneColor = track.color ?? 'var(--fp-color-accent)';
        const interactive = !disabled && (track.editable || track.movable || !!onActionSelect);

        return (
          // The label sits *above* the lane, never beside it. A left gutter
          // would shift the lane's 0% away from the bar's, so an action at 20s
          // would not line up with 20s on the bar — which is the one thing a
          // lane under a progress bar has to get right.
          <div key={track.id} className="flex w-full flex-col gap-0.5">
            {track.label && (
              <span
                className="truncate text-[10px] leading-none"
                style={{ color: 'var(--fp-color-text-muted)' }}
                title={track.label}
              >
                {track.label}
              </span>
            )}

            <div
              ref={(el) => {
                laneRefs.current[track.id] = el;
              }}
              role="group"
              aria-label={track.label ?? `Track ${track.id}`}
              className={cn(
                'relative w-full rounded-sm',
                'bg-[var(--fp-progress-bg)]',
                track.editable && !disabled && 'cursor-copy',
                disabled && 'opacity-50'
              )}
              style={{ height: laneHeight }}
              onClick={(event) => handleLaneClick(event, track)}
              onMouseMove={(event) => {
                if (!interactive) return;
                const lane = laneRefs.current[track.id];
                if (!lane) return;
                const rect = lane.getBoundingClientRect();
                setHover({
                  trackId: track.id,
                  time: timeAt(track.id, event.clientX),
                  left: ((event.clientX - rect.left) / rect.width) * 100,
                });
              }}
              onMouseLeave={() => setHover((h) => (h?.trackId === track.id ? null : h))}
            >
              {/* Playhead, so a lane can be read against the current position. */}
              {duration > 0 && (
                <div
                  className="pointer-events-none absolute inset-y-0 w-px bg-[var(--fp-color-text)] opacity-40"
                  style={{ left: `${Math.min(100, (currentTime / duration) * 100)}%` }}
                />
              )}

              {track.actions.map((action) => {
                const left = duration > 0 ? (action.time / duration) * 100 : 0;
                const width =
                  action.endTime !== undefined && duration > 0
                    ? Math.max(0, ((action.endTime - action.time) / duration) * 100)
                    : 0;
                const isRange = action.endTime !== undefined;
                const active = isRange
                  ? currentTime >= action.time && currentTime <= (action.endTime as number)
                  : Math.abs(currentTime - action.time) < 0.5;
                const selected = selectedActionId === action.id;
                const color = action.color ?? laneColor;

                if (track.renderAction) {
                  return (
                    <div
                      key={action.id}
                      className="absolute inset-y-0"
                      style={{ left: `${left}%`, width: isRange ? `${width}%` : undefined }}
                    >
                      {track.renderAction(action, { track, left, width, active, selected })}
                    </div>
                  );
                }

                return (
                  <button
                    key={action.id}
                    type="button"
                    data-action-id={action.id}
                    disabled={disabled || action.disabled}
                    aria-label={action.label ?? `${formatTime(action.time)}`}
                    aria-pressed={selected}
                    title={
                      action.label
                        ? `${action.label} · ${formatTime(action.time)}${
                            isRange ? `–${formatTime(action.endTime as number)}` : ''
                          }`
                        : formatTime(action.time)
                    }
                    className={cn(
                      'absolute inset-y-0 flex items-center justify-center',
                      'transition-[opacity,transform] duration-100',
                      isRange ? 'rounded-sm' : 'rounded-full',
                      // A point has no width of its own, so it is centred on its time.
                      !isRange && 'w-2 -translate-x-1/2',
                      track.movable && !disabled && 'cursor-ew-resize',
                      action.disabled && 'opacity-40',
                      selected && 'ring-1 ring-white ring-offset-0',
                      active && 'brightness-125',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-white'
                    )}
                    style={{
                      left: `${left}%`,
                      ...(isRange ? { width: `${width}%` } : {}),
                      backgroundColor: color,
                    }}
                    onPointerDown={(event) => beginDrag(event, track, action, 'move')}
                    onPointerMove={(event) => continueDrag(event, track, action)}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onClick={(event) => handleSelect(event, track, action)}
                  >
                    {action.icon}

                    {/* Edge handles, only for ranges on a resizable track. */}
                    {isRange && track.resizable && !disabled && (
                      <>
                        <span
                          role="presentation"
                          className="absolute left-0 top-0 h-full w-1 cursor-w-resize bg-black/30"
                          onPointerDown={(event) =>
                            beginDrag(event, track, action, 'resize-start')
                          }
                          onPointerMove={(event) => continueDrag(event, track, action)}
                          onPointerUp={endDrag}
                          onPointerCancel={endDrag}
                        />
                        <span
                          role="presentation"
                          className="absolute right-0 top-0 h-full w-1 cursor-e-resize bg-black/30"
                          onPointerDown={(event) => beginDrag(event, track, action, 'resize-end')}
                          onPointerMove={(event) => continueDrag(event, track, action)}
                          onPointerUp={endDrag}
                          onPointerCancel={endDrag}
                        />
                      </>
                    )}
                  </button>
                );
              })}

              {/* Where a click would add, so `editable` is discoverable. */}
              {track.editable && !disabled && hover?.trackId === track.id && !dragging && (
                <div
                  className="pointer-events-none absolute inset-y-0 w-px bg-[var(--fp-color-accent)]"
                  style={{ left: `${hover.left}%` }}
                >
                  <span
                    className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1 text-[9px] tabular-nums"
                    style={{
                      background: 'var(--fp-color-surface)',
                      color: 'var(--fp-color-text-secondary)',
                    }}
                  >
                    {formatTime(hover.time)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default TimelineTracks;
