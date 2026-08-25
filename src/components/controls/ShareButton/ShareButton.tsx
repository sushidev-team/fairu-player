import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/cn';
import { useLabels } from '@/context/LabelsContext';
import { resolveLabels, type PlayerLabels } from '@/types/labels';

export interface ShareButtonProps {
  /** The moment to link to. */
  currentTime: number;
  /** From {@link useShareableTimestamp}. Resolves `false` when it could not. */
  copyShareUrl: (time?: number) => Promise<boolean>;
  disabled?: boolean;
  labels?: PlayerLabels;
  className?: string;
}

type Outcome = 'idle' | 'copied' | 'failed';

/** How long the outcome stays on the button. */
const FEEDBACK_MS = 2000;

/**
 * Copy a link to this moment.
 *
 * Reports a failure rather than doing nothing. The clipboard is unavailable
 * outside a secure context — plenty of staging setups — and a button that
 * silently does nothing is indistinguishable from one that is broken.
 */
export function ShareButton({
  currentTime,
  copyShareUrl,
  disabled = false,
  labels: labelsProp,
  className,
}: ShareButtonProps) {
  const contextLabels = useLabels();
  const labels = resolveLabels(labelsProp ?? contextLabels);

  const [outcome, setOutcome] = useState<Outcome>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleared on unmount: the button may be gone long before the two seconds are.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const handleClick = useCallback(async () => {
    const copied = await copyShareUrl(currentTime);

    if (timerRef.current) clearTimeout(timerRef.current);
    setOutcome(copied ? 'copied' : 'failed');
    timerRef.current = setTimeout(() => setOutcome('idle'), FEEDBACK_MS);
  }, [copyShareUrl, currentTime]);

  const label =
    outcome === 'copied'
      ? labels.shareCopied
      : outcome === 'failed'
        ? labels.shareFailed
        : labels.shareTimestamp;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={label}
        title={label}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full',
          'text-[var(--fp-color-text-secondary)]',
          'transition-colors duration-[var(--fp-transition-fast)]',
          'hover:bg-[var(--fp-color-surface)] hover:text-[var(--fp-color-text)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--fp-color-accent)]',
          outcome === 'copied' && 'text-[var(--fp-color-accent)]',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        <Icon outcome={outcome} />
      </button>

      {/*
        The icon change is the only feedback a sighted viewer gets; without this
        there is none at all for anyone else.
      */}
      <span role="status" aria-live="polite" className="sr-only">
        {outcome === 'idle' ? '' : label}
      </span>
    </>
  );
}

function Icon({ outcome }: { outcome: Outcome }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (outcome === 'copied') {
    return (
      <svg {...common}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }

  if (outcome === 'failed') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}
