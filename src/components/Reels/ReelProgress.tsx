import { useCallback, useRef, useState } from 'react';
import { cn } from '@/utils/cn';
import { useLabels } from '@/context/LabelsContext';

export interface ReelProgressProps {
  /** Current playhead in seconds. */
  currentTime: number;
  /** Total duration in seconds. `0` renders an indeterminate bar. */
  duration: number;
  /** Allow dragging to scrub. */
  scrubbable?: boolean;
  /** Called while dragging and on release. */
  onSeek?: (time: number) => void;
  /** Called when a drag starts / ends, so the caller can pause during a scrub. */
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  /** Seconds moved per arrow key. */
  keyboardStep?: number;
  /** Render in the accent colour instead of white (used for ads). */
  variant?: 'content' | 'ad';
  className?: string;
}

/**
 * The hairline progress bar pinned to the bottom edge of a reel.
 *
 * It stays 2px tall until touched, then grows — the same affordance Shorts and
 * Reels use, so the bar never competes with the caption for attention but is
 * still grabbable.
 */
export function ReelProgress({
  currentTime,
  duration,
  scrubbable = true,
  onSeek,
  onScrubStart,
  onScrubEnd,
  keyboardStep = 5,
  variant = 'content',
  className,
}: ReelProgressProps) {
  const labels = useLabels();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [hovering, setHovering] = useState(false);

  const percent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const expanded = scrubbing || hovering;

  const timeFromEvent = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || duration <= 0) return 0;

      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!scrubbable || duration <= 0) return;

      // Claim the pointer so the feed's swipe handler does not also see it.
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);

      setScrubbing(true);
      onScrubStart?.();
      onSeek?.(timeFromEvent(event.clientX));
    },
    [scrubbable, duration, onScrubStart, onSeek, timeFromEvent]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!scrubbing) return;
      event.stopPropagation();
      onSeek?.(timeFromEvent(event.clientX));
    },
    [scrubbing, onSeek, timeFromEvent]
  );

  /**
   * Keyboard seeking.
   *
   * The element already announces itself as a slider and takes focus, so
   * without this it made a promise it could not keep — a keyboard user could
   * reach the bar and then do nothing with it.
   *
   * Up and Down are deliberately left alone: the feed uses them to move between
   * reels, and a scrub bar stealing them would trap the viewer on one slide.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!scrubbable || duration <= 0) return;

      let target: number;
      switch (event.key) {
        case 'ArrowRight':
          target = currentTime + keyboardStep;
          break;
        case 'ArrowLeft':
          target = currentTime - keyboardStep;
          break;
        case 'Home':
          target = 0;
          break;
        case 'End':
          target = duration;
          break;
        default:
          return;
      }

      // Both, and for the same reason as the pointer path: the feed listens for
      // keys on its container and would act on this one too.
      event.preventDefault();
      event.stopPropagation();
      onSeek?.(Math.max(0, Math.min(duration, target)));
    },
    [scrubbable, duration, currentTime, keyboardStep, onSeek]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!scrubbing) return;
      event.stopPropagation();
      setScrubbing(false);
      onScrubEnd?.();
    },
    [scrubbing, onScrubEnd]
  );

  return (
    <div
      ref={trackRef}
      role={scrubbable ? 'slider' : 'progressbar'}
      aria-label={labels.seekSlider}
      aria-valuemin={0}
      aria-valuemax={duration || 100}
      aria-valuenow={Math.round(currentTime)}
      tabIndex={scrubbable ? 0 : -1}
      className={cn(
        'absolute bottom-0 left-0 right-0 z-30',
        // A generous hit area around a thin visual bar.
        'flex items-end pb-0 pt-3',
        scrubbable ? 'cursor-pointer touch-none' : 'pointer-events-none',
        className
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div
        className={cn(
          'relative w-full overflow-hidden bg-white/25 transition-[height] duration-150',
          expanded ? 'h-1' : 'h-[2px]'
        )}
      >
        <div
          className={cn(
            'h-full',
            variant === 'ad' ? 'bg-[var(--fp-color-accent)]' : 'bg-white',
            // Transitions fight a 60fps playhead; only animate while idle.
            scrubbing ? '' : 'transition-[width] duration-100 ease-linear'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      {expanded && scrubbable && duration > 0 && (
        <div
          className="absolute bottom-0 h-3 w-3 -translate-x-1/2 translate-y-1/3 rounded-full bg-white shadow"
          style={{ left: `${percent}%` }}
        />
      )}
    </div>
  );
}

export default ReelProgress;
