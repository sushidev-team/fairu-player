import React, { useRef, useState, useCallback, useEffect } from 'react';
import { cn, formatTime } from '@/utils';
import { useLabels } from '@/context/LabelsContext';
import type { Chapter } from '@/types/player';
import type { PlayerLabels } from '@/types/labels';

export interface ProgressBarProps {
  currentTime: number;
  duration: number;
  buffered?: number;
  chapters?: Chapter[];
  showTooltip?: boolean;
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
  chapters = [],
  showTooltip = true,
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
            'rounded-md bg-[var(--fp-color-surface)] px-2.5 py-1.5',
            'text-xs text-[var(--fp-color-text)] shadow-lg',
            'pointer-events-none whitespace-nowrap',
            'border border-[var(--fp-glass-border)]'
          )}
          style={{
            left: `${hoverPosition}%`,
            animation: 'fp-tooltip-in 150ms ease-out',
          }}
        >
          <div className="font-medium">{formatTime(hoverTime)}</div>
          {hoverChapter && (
            <div className="text-[var(--fp-color-text-secondary)] text-[10px] mt-0.5">
              {hoverChapter.title}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
