import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { cn, formatTime } from '@/utils';
import { useLabels } from '@/context/LabelsContext';
import type { Chapter } from '@/types/player';
import type { TimelineMarker } from '@/types/markers';
import type { PlayerLabels } from '@/types/labels';

export interface ProgressBarProps {
  currentTime: number;
  duration: number;
  buffered?: number;
  bufferedRanges?: Array<{ start: number; end: number }>;
  isBuffering?: boolean;
  chapters?: Chapter[];
  markers?: TimelineMarker[];
  showTooltip?: boolean;
  showChapterSegments?: boolean;
  /** A-B loop start time in seconds */
  loopStart?: number | null;
  /** A-B loop end time in seconds */
  loopEnd?: number | null;
  disabled?: boolean;
  onSeek?: (time: number) => void;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
  className?: string;
  labels?: Pick<PlayerLabels, 'seekSlider'>;
}

export function ProgressBar({
  currentTime,
  duration,
  buffered = 0,
  bufferedRanges,
  isBuffering = false,
  chapters = [],
  markers = [],
  showTooltip = true,
  showChapterSegments = true,
  loopStart = null,
  loopEnd = null,
  disabled = false,
  onSeek,
  onSeekStart,
  onSeekEnd,
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

  // Keyboard accessibility
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

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
  }, [disabled, currentTime, duration, onSeek]);

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

  // Find the active chapter based on currentTime
  const activeChapter = useMemo(() => {
    if (chapters.length === 0) return null;
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (currentTime >= chapters[i].startTime) {
        return chapters[i];
      }
    }
    return null;
  }, [chapters, currentTime]);

  // Get the chapter index for a given chapter
  const getChapterIndex = useCallback((chapter: Chapter): number => {
    return chapters.findIndex((c) => c.id === chapter.id);
  }, [chapters]);

  // Compute chapter duration
  const getChapterDuration = useCallback((chapter: Chapter): number => {
    if (chapter.endTime) {
      return chapter.endTime - chapter.startTime;
    }
    const index = getChapterIndex(chapter);
    const nextChapter = chapters[index + 1];
    if (nextChapter) {
      return nextChapter.startTime - chapter.startTime;
    }
    return duration - chapter.startTime;
  }, [chapters, duration, getChapterIndex]);

  // Handle chapter marker click
  const handleChapterClick = useCallback((e: React.MouseEvent, chapter: Chapter) => {
    e.stopPropagation();
    e.preventDefault();
    if (!disabled) {
      onSeek?.(chapter.startTime);
    }
  }, [disabled, onSeek]);

  // Compute chapter segments for visualization
  const chapterSegments = useMemo(() => {
    if (!showChapterSegments || chapters.length === 0 || duration <= 0) return [];
    return chapters.map((chapter, index) => {
      const startPercent = (chapter.startTime / duration) * 100;
      let endTime: number;
      if (chapter.endTime) {
        endTime = chapter.endTime;
      } else {
        const nextChapter = chapters[index + 1];
        endTime = nextChapter ? nextChapter.startTime : duration;
      }
      const widthPercent = ((endTime - chapter.startTime) / duration) * 100;
      return {
        chapter,
        startPercent,
        widthPercent,
        isEven: index % 2 === 0,
      };
    });
  }, [chapters, duration, showChapterSegments]);

  // Find the hover chapter index for tooltip display
  const hoverChapterIndex = useMemo(() => {
    if (!hoverChapter) return -1;
    return chapters.findIndex((c) => c.id === hoverChapter.id);
  }, [hoverChapter, chapters]);

  return (
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
        {/* Buffered progress - show individual ranges if available, otherwise fallback to total */}
        {bufferedRanges && bufferedRanges.length > 0
          ? bufferedRanges.map((range, i) => {
              const rangeStart = duration > 0 ? (range.start / duration) * 100 : 0;
              const rangeWidth = duration > 0 ? ((range.end - range.start) / duration) * 100 : 0;
              return (
                <div
                  key={i}
                  className="absolute inset-y-0 rounded-full bg-[var(--fp-color-text)] opacity-20"
                  style={{ left: `${rangeStart}%`, width: `${rangeWidth}%` }}
                />
              );
            })
          : (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[var(--fp-progress-buffer)]"
              style={{ width: `${bufferedProgress}%` }}
            />
          )
        }

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

        {/* A-B Loop region */}
        {loopStart !== null && loopEnd !== null && duration > 0 && (
          <div
            className="absolute inset-y-0 bg-[var(--fp-color-accent)] opacity-15 rounded-full"
            style={{
              left: `${(loopStart / duration) * 100}%`,
              width: `${((loopEnd - loopStart) / duration) * 100}%`,
            }}
          />
        )}

        {/* Chapter segment backgrounds */}
        {chapterSegments.map(({ chapter, startPercent, widthPercent, isEven }) => (
          <div
            key={`segment-${chapter.id}`}
            className={cn(
              'absolute inset-y-0 rounded-sm',
              isEven
                ? 'bg-[var(--fp-color-text)] opacity-[0.04]'
                : 'bg-[var(--fp-color-text)] opacity-[0.08]'
            )}
            style={{
              left: `${startPercent}%`,
              width: `${widthPercent}%`,
            }}
          />
        ))}

        {/* Chapter markers */}
        {chapters.map((chapter) => {
          const position = duration > 0 ? (chapter.startTime / duration) * 100 : 0;
          const isActiveChapter = activeChapter?.id === chapter.id;
          return (
            <button
              key={chapter.id}
              type="button"
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={`Go to chapter: ${chapter.title}`}
              title={chapter.title}
              className={cn(
                'absolute top-1/2 -translate-y-1/2 -translate-x-1/2',
                'w-1 cursor-pointer border-0 p-0',
                'rounded-full transition-all duration-150',
                isActiveChapter
                  ? 'bg-[var(--fp-color-primary)] opacity-100 z-10'
                  : 'bg-[var(--fp-color-text)] opacity-30',
                !isActiveChapter && 'hover:opacity-70 hover:scale-x-150',
                isActive && !isActiveChapter && 'opacity-50',
                disabled && 'pointer-events-none'
              )}
              style={{
                left: `${position}%`,
                height: isActive ? '6px' : '4px',
              }}
              onClick={(e) => handleChapterClick(e, chapter)}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  e.preventDefault();
                  if (!disabled) {
                    onSeek?.(chapter.startTime);
                  }
                }
              }}
            />
          );
        })}

        {/* Marker dots */}
        {markers.map((marker) => {
          const position = duration > 0 ? (marker.time / duration) * 100 : 0;
          return (
            <div
              key={marker.id}
              className={cn(
                'absolute top-1/2 -translate-y-1/2 -translate-x-1/2',
                'rounded-full',
                'transition-all duration-150',
                isActive ? 'w-2.5 h-2.5' : 'w-2 h-2'
              )}
              style={{
                left: `${position}%`,
                backgroundColor: marker.color || 'var(--fp-color-accent)',
              }}
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
            isBuffering && 'fp-animate-pulse',
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
              <div className="mt-0.5">
                {hoverChapterIndex >= 0 && (
                  <div className="text-[var(--fp-color-accent)] text-[11px] font-medium">
                    Chapter {hoverChapterIndex + 1}
                  </div>
                )}
                <div className="text-[var(--fp-color-text-secondary)] text-xs">
                  {hoverChapter.title}
                </div>
                <div className="text-[var(--fp-color-text-muted)] text-[11px]">
                  {formatTime(getChapterDuration(hoverChapter))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
