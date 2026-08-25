import { useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/cn';

export type GestureFeedbackType =
  | 'skip-forward'
  | 'skip-backward'
  | 'volume-up'
  | 'volume-down'
  | 'brightness-up'
  | 'brightness-down';

export interface GestureFeedback {
  type: GestureFeedbackType;
  /** What to show — `10s`, `70 %`. */
  label?: string;
}

export interface GestureOverlayProps {
  /** The gesture to acknowledge, or `null`. */
  feedback: GestureFeedback | null;
  /** Called once the acknowledgement has faded. */
  onDismiss?: () => void;
  /** Milliseconds it stays up. Default `800`. */
  displayDuration?: number;
  className?: string;
}

/**
 * The flash that acknowledges a gesture — the double-tap ripple, the skip
 * amount, the volume step.
 *
 * Decorative by design, and marked so: a screen reader user did not make this
 * gesture and does not need it read out. Anything worth announcing goes through
 * `ScreenReaderAnnouncer`, where it can be phrased.
 */
export function GestureOverlay({
  feedback,
  onDismiss,
  displayDuration = 800,
  className,
}: GestureOverlayProps) {
  /**
   * The feedback plus a serial number.
   *
   * The number keys the animated element. Without it a second gesture arriving
   * mid-flash reuses the same node, the browser does not restart the CSS
   * animation, and the new acknowledgement inherits the old one's progress —
   * appearing already faded.
   */
  const [shown, setShown] = useState<{ feedback: GestureFeedback; seq: number } | null>(null);
  const seqRef = useRef(0);

  // Held in a ref so an inline arrow — which every caller passes — does not
  // restart the timer on each render and leave the flash on screen.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!feedback) {
      setShown(null);
      return;
    }

    seqRef.current += 1;
    setShown({ feedback, seq: seqRef.current });
    const timer = setTimeout(() => {
      setShown(null);
      onDismissRef.current?.();
    }, displayDuration);

    return () => clearTimeout(timer);
  }, [feedback, displayDuration]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!shown) return null;
  const { feedback: current, seq } = shown;

  const alignment: Record<GestureFeedbackType, string> = {
    'skip-backward': 'left-[15%]',
    'skip-forward': 'right-[15%]',
    'volume-up': 'right-[15%]',
    'volume-down': 'right-[15%]',
    'brightness-up': 'left-[15%]',
    'brightness-down': 'left-[15%]',
  };

  return (
    <div
      aria-hidden="true"
      data-testid="gesture-overlay"
      className={cn('pointer-events-none absolute inset-0 z-20', className)}
    >
      {/*
        Placement and animation on two elements, deliberately. Every keyframe
        sets `transform`, which would otherwise wipe out the `-translate-y-1/2`
        that centres this — and drop the flash half its own height too low.
      */}
      <div className={cn('absolute top-1/2 -translate-y-1/2', alignment[current.type])}>
        <div
          key={seq}
          className={cn(
            'flex flex-col items-center gap-1 rounded-full bg-black/50 px-5 py-4',
            'text-white backdrop-blur-sm',
            'fp-gesture-flash'
          )}
          // The animation has to last as long as the element does, or a longer
          // display leaves a transparent box sitting there.
          style={{ animationDuration: `${displayDuration}ms` }}
        >
          <GestureIcon type={current.type} />
          {current.label && (
            <span className="text-xs font-semibold tabular-nums">{current.label}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function GestureIcon({ type }: { type: GestureFeedbackType }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    'aria-hidden': true,
  };

  if (type === 'skip-forward') {
    return (
      <svg {...common}>
        <polygon points="5 4 13 12 5 20" />
        <polygon points="13 4 21 12 13 20" />
      </svg>
    );
  }

  if (type === 'skip-backward') {
    return (
      <svg {...common}>
        <polygon points="19 4 11 12 19 20" />
        <polygon points="11 4 3 12 11 20" />
      </svg>
    );
  }

  if (type === 'volume-up' || type === 'volume-down') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
        {type === 'volume-up' ? (
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        ) : (
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        )}
      </svg>
    );
  }

  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
