import React, { useRef, useState, useCallback, useEffect } from 'react';
import { cn, formatTime } from '@/utils';
import { useLabels } from '@/context/LabelsContext';
import type { Chapter } from '@/types/player';
import type { TimelineAction, TimelineMarker, TimelineTrack } from '@/types/markers';
import { TimelineTracks } from './TimelineTracks';
import type { PlayerLabels } from '@/types/labels';

export interface ProgressBarProps {
  currentTime: number;
  duration: number;
  buffered?: number;
  chapters?: Chapter[];
  markers?: TimelineMarker[];
  showTooltip?: boolean;
  disabled?: boolean;
  onSeek?: (time: number) => void;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
  /**
   * Add a marker at a point on the bar.
   *
   * Given, the bar becomes somewhere markers are made as well as read: a double
   * click on the track adds one there, and `M` adds one at the playhead. Seeking
   * is untouched — a single click still seeks, because this is a player first.
   */
  onMarkerAdd?: (time: number) => void;
  /** Move an existing marker. Given, its dot can be dragged along the bar. */
  onMarkerMove?: (id: string, time: number) => void;
  /** A marker was clicked without being dragged. */
  onMarkerSelect?: (marker: TimelineMarker) => void;
  /**
   * Action lanes rendered **below** the seek bar.
   *
   * Separate from `markers`, which sit on the bar itself. A lane is its own
   * surface, so its actions never compete with scrubbing: a single click can
   * select, empty space can add, and a drag moves the action rather than the
   * playhead. Ranges (`endTime`) are only possible here.
   */
  tracks?: TimelineTrack[];
  /** Id of the selected action, when the host tracks a selection. */
  selectedActionId?: string | null;
  /** An action was clicked. Seeks first unless `track.seekOnSelect === false`. */
  onActionSelect?: (action: TimelineAction, track: TimelineTrack) => void;
  /** Empty space in an `editable` lane was clicked. */
  onActionAdd?: (time: number, track: TimelineTrack) => void;
  /** An action on a `movable` lane was dragged. `time` is its new start. */
  onActionMove?: (action: TimelineAction, time: number, track: TimelineTrack) => void;
  /** A range on a `resizable` lane had an edge dragged. */
  onActionResize?: (
    action: TimelineAction,
    start: number,
    end: number,
    track: TimelineTrack
  ) => void;
  className?: string;
  labels?: Pick<PlayerLabels, 'seekSlider'>;
}

export function ProgressBar({
  currentTime,
  duration,
  buffered = 0,
  chapters = [],
  markers = [],
  showTooltip = true,
  disabled = false,
  onSeek,
  onSeekStart,
  onSeekEnd,
  onMarkerAdd,
  onMarkerMove,
  onMarkerSelect,
  tracks = [],
  selectedActionId,
  onActionSelect,
  onActionAdd,
  onActionMove,
  onActionResize,
  className,
  labels: labelsProp,
}: ProgressBarProps) {
  const contextLabels = useLabels();
  const labels = labelsProp ?? contextLabels;
  const progressRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState(0);
  const [draggedMarker, setDraggedMarker] = useState<string | null>(null);

  const canMoveMarkers = Boolean(onMarkerMove) && !disabled;
  const canAddMarkers = Boolean(onMarkerAdd) && !disabled;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;

  // Active state for interactions
  const isActive = isHovering || isDragging;

  // Calculate time from position
  const calculateTimeFromPosition = useCallback((clientX: number): number => {
    if (!progressRef.current || duration <= 0) return 0;

    const rect = progressRef.current.getBoundingClientRect();
    const position = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(duration, position * duration));
  }, [duration]);

  // Handle click/drag
  const handleSeek = useCallback((clientX: number) => {
    const time = calculateTimeFromPosition(clientX);
    onSeek?.(time);
  }, [calculateTimeFromPosition, onSeek]);

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    onSeekStart?.();
    handleSeek(e.clientX);
  }, [disabled, onSeekStart, handleSeek]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const position = ((e.clientX - rect.left) / rect.width) * 100;
    setHoverPosition(Math.max(0, Math.min(100, position)));
    setHoverTime(calculateTimeFromPosition(e.clientX));

    if (isDragging) {
      handleSeek(e.clientX);
    }
  }, [isDragging, calculateTimeFromPosition, handleSeek]);

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    setHoverPosition(null);
  }, []);

  // Global mouse events for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      handleSeek(e.clientX);
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      onSeekEnd?.();
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, handleSeek, onSeekEnd]);

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    setIsDragging(true);
    onSeekStart?.();
    handleSeek(e.touches[0].clientX);
  }, [disabled, onSeekStart, handleSeek]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDragging) {
      handleSeek(e.touches[0].clientX);
    }
  }, [isDragging, handleSeek]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    onSeekEnd?.();
  }, [onSeekEnd]);

  /**
   * Drag a marker instead of seeking.
   *
   * A dot sits on the surface that seeks, so every one of these handlers has to
   * stop the event reaching it — and mouse and touch are stopped separately from
   * pointer, because stopping a `pointerdown` does not stop the `mousedown` the
   * browser raises alongside it. Without that, picking a marker up would scrub
   * the playhead to wherever it was grabbed.
   *
   * `setPointerCapture` is what keeps the dot following once the cursor leaves
   * the bar; without it a drag that strays upward stops dead halfway.
   */
  const handleMarkerPointerDown = useCallback((e: React.PointerEvent, marker: TimelineMarker) => {
    if (!canMoveMarkers) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDraggedMarker(marker.id);
  }, [canMoveMarkers]);

  const handleMarkerPointerMove = useCallback((e: React.PointerEvent, marker: TimelineMarker) => {
    if (draggedMarker !== marker.id) return;
    e.stopPropagation();
    onMarkerMove?.(marker.id, calculateTimeFromPosition(e.clientX));
  }, [draggedMarker, onMarkerMove, calculateTimeFromPosition]);

  const handleMarkerPointerUp = useCallback((e: React.PointerEvent, marker: TimelineMarker) => {
    if (draggedMarker !== marker.id) return;
    e.stopPropagation();
    setDraggedMarker(null);
  }, [draggedMarker]);

  const handleMarkerClick = useCallback((e: React.MouseEvent, marker: TimelineMarker) => {
    if (!onMarkerSelect) return;
    e.stopPropagation();
    onMarkerSelect(marker);
  }, [onMarkerSelect]);

  /**
   * Add a marker where the bar was double clicked.
   *
   * Double rather than single: a single click seeks, and taking that away would
   * make the bar unusable as a bar. The first click of the pair still seeks,
   * which puts the playhead at the marker being made — the right place to be.
   */
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!canAddMarkers) return;
    onMarkerAdd?.(calculateTimeFromPosition(e.clientX));
  }, [canAddMarkers, onMarkerAdd, calculateTimeFromPosition]);

  // Keyboard accessibility
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    /*
     * `M`, the key every editing tool uses for this. It is also the whole
     * keyboard path to authoring: the dots are dragged with a pointer, so
     * without this there would be no way to place a marker without a mouse.
     * Arrow to the moment, press M.
     */
    if (canAddMarkers && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      onMarkerAdd?.(currentTime);
      return;
    }

    const step = e.shiftKey ? 10 : 5;
    let newTime = currentTime;

    switch (e.key) {
      case 'ArrowLeft':
        newTime = Math.max(0, currentTime - step);
        break;
      case 'ArrowRight':
        newTime = Math.min(duration, currentTime + step);
        break;
      case 'Home':
        newTime = 0;
        break;
      case 'End':
        newTime = duration;
        break;
      default:
        return;
    }

    e.preventDefault();
    onSeek?.(newTime);
  }, [disabled, currentTime, duration, onSeek, canAddMarkers, onMarkerAdd]);

  // Find current chapter for tooltip
  const getChapterAtTime = (time: number): Chapter | undefined => {
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (time >= chapters[i].startTime) {
        return chapters[i];
      }
    }
    return undefined;
  };

  const hoverChapter = hoverTime > 0 ? getChapterAtTime(hoverTime) : undefined;

  // Find nearest marker within 3s threshold
  const getMarkerAtTime = (time: number): TimelineMarker | undefined => {
    let closest: { marker: TimelineMarker; distance: number } | undefined;
    for (const marker of markers) {
      const distance = Math.abs(time - marker.time);
      if (distance <= 3 && (!closest || distance < closest.distance)) {
        closest = { marker, distance };
      }
    }
    return closest?.marker;
  };

  const hoverMarker = hoverTime > 0 ? getMarkerAtTime(hoverTime) : undefined;

  /** Selecting an action seeks to it unless the track opts out. */
  const handleActionSelect = useCallback(
    (action: TimelineAction, track: TimelineTrack) => {
      if (track.seekOnSelect !== false) onSeek?.(action.time);
      onActionSelect?.(action, track);
    },
    [onSeek, onActionSelect]
  );

  const seekBar = (
    <div
      ref={progressRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={labels.seekSlider}
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
      className={cn(
        'group relative w-full cursor-pointer',
        'py-2', // Larger hit area
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Track background */}
      <div
        className={cn(
          'relative w-full rounded-full',
          'bg-[var(--fp-progress-bg)]',
          'transition-all duration-150',
          isActive ? 'h-1.5' : 'h-1'
        )}
      >
        {/* Buffered progress */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--fp-progress-buffer)]"
          style={{ width: `${bufferedProgress}%` }}
        />

        {/* Current progress */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            'transition-colors duration-150',
            isActive
              ? 'bg-[var(--fp-color-accent)]'
              : 'bg-[var(--fp-color-text)]'
          )}
          style={{ width: `${progress}%` }}
        />

        {/* Chapter markers */}
        {chapters.map((chapter) => {
          const position = duration > 0 ? (chapter.startTime / duration) * 100 : 0;
          return (
            <div
              key={chapter.id}
              className={cn(
                'absolute top-0 h-full w-0.5 rounded-full',
                'bg-[var(--fp-color-text)] opacity-30',
                isActive && 'opacity-50'
              )}
              style={{ left: `${position}%` }}
            />
          );
        })}

        {/* Marker dots */}
        {markers.map((marker) => {
          const position = duration > 0 ? (marker.time / duration) * 100 : 0;
          const isDragged = draggedMarker === marker.id;
          return (
            <div
              key={marker.id}
              data-marker-id={marker.id}
              className={cn(
                'absolute top-1/2 -translate-y-1/2 -translate-x-1/2',
                'rounded-full',
                'transition-all duration-150',
                isActive ? 'w-2.5 h-2.5' : 'w-2 h-2',
                canMoveMarkers && 'cursor-ew-resize',
                // Grown while held, so it is clear which one is moving.
                isDragged && 'w-3.5 h-3.5',
                // Nothing to grab, nothing to hit: stay out of the seek gesture.
                !canMoveMarkers && !onMarkerSelect && 'pointer-events-none'
              )}
              style={{
                left: `${position}%`,
                backgroundColor: marker.color || 'var(--fp-color-accent)',
              }}
              onPointerDown={(e) => handleMarkerPointerDown(e, marker)}
              onPointerMove={(e) => handleMarkerPointerMove(e, marker)}
              onPointerUp={(e) => handleMarkerPointerUp(e, marker)}
              onPointerCancel={(e) => handleMarkerPointerUp(e, marker)}
              onMouseDown={(e) => { if (canMoveMarkers) e.stopPropagation(); }}
              onTouchStart={(e) => { if (canMoveMarkers) e.stopPropagation(); }}
              onClick={(e) => handleMarkerClick(e, marker)}
            />
          );
        })}

        {/* Drag handle - hidden by default, shown on hover */}
        <div
          className={cn(
            'absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2',
            'rounded-full bg-[var(--fp-color-text)]',
            'shadow-md',
            'transition-all duration-150',
            isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
            isDragging && 'scale-125',
            disabled && 'hidden'
          )}
          style={{ left: `${progress}%` }}
        />
      </div>

      {/* Tooltip - animated fade in from bottom */}
      {showTooltip && hoverPosition !== null && !disabled && (
        <div
          className={cn(
            'absolute bottom-full mb-3 -translate-x-1/2',
            'rounded-md bg-[var(--fp-color-surface)]',
            'text-xs text-[var(--fp-color-text)] shadow-lg',
            'pointer-events-none whitespace-nowrap',
            'border border-[var(--fp-glass-border)]',
            'overflow-hidden',
            hoverMarker?.previewImage ? 'p-0' : 'px-2.5 py-1.5'
          )}
          style={{
            left: `${hoverPosition}%`,
            animation: 'fp-tooltip-in 150ms ease-out',
          }}
        >
          {hoverMarker?.previewImage && (
            <img
              src={hoverMarker.previewImage}
              alt=""
              className="block"
              style={{ width: 160, height: 90, objectFit: 'cover' }}
            />
          )}
          <div className={hoverMarker?.previewImage ? 'px-2.5 py-1.5' : ''}>
            <div className="font-medium">{formatTime(hoverTime)}</div>
            {hoverMarker?.title && (
              <div className="text-[var(--fp-color-accent)] text-[10px] mt-0.5">
                {hoverMarker.title}
              </div>
            )}
            {!hoverMarker && hoverChapter && (
              <div className="text-[var(--fp-color-text-secondary)] text-[10px] mt-0.5">
                {hoverChapter.title}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Without lanes the markup is exactly what it always was, so nothing about
  // existing layout or styling shifts for callers that do not use tracks.
  if (tracks.length === 0) return seekBar;

  return (
    <div className="fp-progress-with-tracks flex w-full flex-col">
      {seekBar}
      <TimelineTracks
        tracks={tracks}
        duration={duration}
        currentTime={currentTime}
        selectedActionId={selectedActionId}
        disabled={disabled}
        onActionSelect={handleActionSelect}
        onActionAdd={onActionAdd}
        onActionMove={onActionMove}
        onActionResize={onActionResize}
      />
    </div>
  );
}
