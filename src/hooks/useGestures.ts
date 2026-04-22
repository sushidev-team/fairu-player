import { useEffect, useCallback, useRef } from 'react';

export interface UseGesturesOptions {
  /** The element to listen for gestures on */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Called when user double-taps the left third of the container */
  onDoubleTapLeft?: () => void;
  /** Called when user double-taps the right third of the container */
  onDoubleTapRight?: () => void;
  /** Called when user swipes left */
  onSwipeLeft?: () => void;
  /** Called when user swipes right */
  onSwipeRight?: () => void;
  /** Called when user swipes up */
  onSwipeUp?: () => void;
  /** Called when user swipes down */
  onSwipeDown?: () => void;
  /** Enable or disable gesture handling (default: true) */
  enabled?: boolean;
  /** Maximum delay between taps for double-tap in ms (default: 300) */
  doubleTapDelay?: number;
  /** Minimum distance in px for a swipe to register (default: 50) */
  swipeThreshold?: number;
}

interface TouchData {
  startX: number;
  startY: number;
  startTime: number;
}

/**
 * Hook for detecting touch gestures (double-tap, swipe) on a container element.
 * Designed for video player touch controls.
 */
export function useGestures(options: UseGesturesOptions): void {
  const {
    containerRef,
    onDoubleTapLeft,
    onDoubleTapRight,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    enabled = true,
    doubleTapDelay = 300,
    swipeThreshold = 50,
  } = options;

  const touchDataRef = useRef<TouchData | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const lastTapXRef = useRef<number>(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (!event.touches.length) return;

      const touch = event.touches[0];
      touchDataRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
      };
    },
    []
  );

  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      const touchData = touchDataRef.current;
      if (!touchData) return;

      const container = containerRef.current;
      if (!container) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchData.startX;
      const deltaY = touch.clientY - touchData.startY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      const elapsed = Date.now() - touchData.startTime;

      // Check for swipe (moved enough distance and completed quickly enough)
      if (absDeltaX > swipeThreshold || absDeltaY > swipeThreshold) {
        if (elapsed < 500) {
          // Determine swipe direction - use the dominant axis
          if (absDeltaX > absDeltaY) {
            // Horizontal swipe
            if (deltaX < 0) {
              onSwipeLeft?.();
            } else {
              onSwipeRight?.();
            }
          } else {
            // Vertical swipe
            if (deltaY < 0) {
              onSwipeUp?.();
            } else {
              onSwipeDown?.();
            }
          }
        }
        touchDataRef.current = null;
        return;
      }

      // It's a tap (no significant movement)
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTimeRef.current;
      const rect = container.getBoundingClientRect();
      const tapX = touch.clientX - rect.left;

      if (timeSinceLastTap < doubleTapDelay) {
        // Double tap detected - clear any pending single-tap timer
        if (tapTimerRef.current) {
          clearTimeout(tapTimerRef.current);
          tapTimerRef.current = null;
        }

        // Use the position of the first tap to determine the side
        const firstTapX = lastTapXRef.current;
        const containerWidth = rect.width;
        const leftThreshold = containerWidth / 3;
        const rightThreshold = (containerWidth * 2) / 3;

        if (firstTapX < leftThreshold) {
          event.preventDefault();
          onDoubleTapLeft?.();
        } else if (firstTapX > rightThreshold) {
          event.preventDefault();
          onDoubleTapRight?.();
        }

        lastTapTimeRef.current = 0;
        lastTapXRef.current = 0;
      } else {
        // First tap - record and wait for potential second tap
        lastTapTimeRef.current = now;
        lastTapXRef.current = tapX;
      }

      touchDataRef.current = null;
    },
    [
      containerRef,
      doubleTapDelay,
      swipeThreshold,
      onDoubleTapLeft,
      onDoubleTapRight,
      onSwipeLeft,
      onSwipeRight,
      onSwipeUp,
      onSwipeDown,
    ]
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      // Prevent native scroll only when a gesture is likely in progress
      const touchData = touchDataRef.current;
      if (!touchData) return;

      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = Math.abs(touch.clientX - touchData.startX);
      const deltaY = Math.abs(touch.clientY - touchData.startY);

      // If the dominant direction is horizontal and the user has moved enough,
      // prevent default to avoid horizontal scroll conflicts
      if (deltaX > 10 && deltaX > deltaY) {
        event.preventDefault();
      }
    },
    []
  );

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    // Use passive listeners where possible.
    // touchstart can be passive since we only record data.
    // touchend can be passive in most cases but we may need to preventDefault for double-tap.
    // touchmove needs non-passive to call preventDefault for scroll prevention.
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchmove', handleTouchMove);

      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
      }
    };
  }, [enabled, containerRef, handleTouchStart, handleTouchEnd, handleTouchMove]);
}
