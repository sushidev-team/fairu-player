import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/utils/cn';

export type GestureFeedbackType = 'skip-forward' | 'skip-backward' | 'swipe-up' | 'swipe-down' | 'swipe-left' | 'swipe-right';

export interface GestureFeedback {
  type: GestureFeedbackType;
  label?: string;
}

export interface GestureOverlayProps {
  /** The current gesture feedback to display, or null for none */
  feedback: GestureFeedback | null;
  /** Called when the feedback animation completes */
  onDismiss?: () => void;
  /** How long to show the feedback in ms (default: 800) */
  displayDuration?: number;
  className?: string;
}

/**
 * Visual feedback overlay for touch gestures on the video player.
 * Shows skip amount, volume indicators, and ripple animations.
 */
export function GestureOverlay({
  feedback,
  onDismiss,
  displayDuration = 800,
  className,
}: GestureOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<GestureFeedback | null>(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  useEffect(() => {
    if (feedback) {
      setCurrentFeedback(feedback);
      setVisible(true);

      const timer = setTimeout(() => {
        dismiss();
      }, displayDuration);

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [feedback, displayDuration, dismiss]);

  if (!visible || !currentFeedback) return null;

  const isSkipForward = currentFeedback.type === 'skip-forward';
  const isSkipBackward = currentFeedback.type === 'skip-backward';
  const isSkip = isSkipForward || isSkipBackward;
  const isSwipeVertical = currentFeedback.type === 'swipe-up' || currentFeedback.type === 'swipe-down';
  const isSwipeHorizontal = currentFeedback.type === 'swipe-left' || currentFeedback.type === 'swipe-right';

  return (
    <div
      className={cn(
        'absolute inset-0 z-20 pointer-events-none',
        className
      )}
    >
      {/* Double-tap skip feedback */}
      {isSkip && (
        <div
          className={cn(
            'absolute top-0 bottom-0 flex items-center justify-center',
            isSkipBackward && 'left-0 w-1/3',
            isSkipForward && 'right-0 w-1/3'
          )}
        >
          {/* Ripple background */}
          <div
            className={cn(
              'absolute inset-0',
              isSkipBackward && 'rounded-r-full',
              isSkipForward && 'rounded-l-full'
            )}
            style={{
              background: 'radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, transparent 70%)',
              animation: 'fairu-gesture-ripple 0.6s ease-out forwards',
            }}
          />

          {/* Skip label and icon */}
          <div
            className="relative flex flex-col items-center gap-1"
            style={{ animation: 'fairu-gesture-fade-in 0.2s ease-out forwards' }}
          >
            {/* Skip arrows */}
            <div className="flex items-center gap-0.5">
              {isSkipBackward && (
                <>
                  <SkipArrow direction="backward" />
                  <SkipArrow direction="backward" />
                </>
              )}
              {isSkipForward && (
                <>
                  <SkipArrow direction="forward" />
                  <SkipArrow direction="forward" />
                </>
              )}
            </div>
            <span className="text-white text-sm font-medium drop-shadow-lg">
              {currentFeedback.label}
            </span>
          </div>
        </div>
      )}

      {/* Swipe vertical feedback (volume) */}
      {isSwipeVertical && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="flex flex-col items-center gap-2 px-4 py-3 rounded-lg bg-black/50 backdrop-blur-sm"
            style={{ animation: 'fairu-gesture-fade-in 0.15s ease-out forwards' }}
          >
            <SwipeIcon direction={currentFeedback.type === 'swipe-up' ? 'up' : 'down'} />
            {currentFeedback.label && (
              <span className="text-white text-sm font-medium">
                {currentFeedback.label}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Swipe horizontal feedback */}
      {isSwipeHorizontal && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-lg bg-black/50 backdrop-blur-sm"
            style={{ animation: 'fairu-gesture-fade-in 0.15s ease-out forwards' }}
          >
            <SwipeIcon direction={currentFeedback.type === 'swipe-left' ? 'left' : 'right'} />
            {currentFeedback.label && (
              <span className="text-white text-sm font-medium">
                {currentFeedback.label}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes fairu-gesture-ripple {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          40% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scale(1.2);
          }
        }
        @keyframes fairu-gesture-fade-in {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Skip arrow icon for double-tap feedback
 */
function SkipArrow({ direction }: { direction: 'forward' | 'backward' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn(
        'w-5 h-5 text-white drop-shadow-lg',
        direction === 'backward' && 'rotate-180'
      )}
    >
      <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
    </svg>
  );
}

/**
 * Swipe direction indicator icon
 */
function SwipeIcon({ direction }: { direction: 'up' | 'down' | 'left' | 'right' }) {
  const rotation = {
    up: '-rotate-90',
    down: 'rotate-90',
    left: 'rotate-180',
    right: '',
  }[direction];

  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn('w-6 h-6 text-white', rotation)}
    >
      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
    </svg>
  );
}

export default GestureOverlay;
