import { useState, useCallback } from 'react';
import { cn } from '@/utils/cn';

export interface ShareButtonProps {
  /** Current playback time */
  currentTime: number;
  /** Function to generate the share URL */
  getShareUrl: (time?: number) => string;
  /** Function to copy to clipboard */
  copyShareUrl: (time?: number) => Promise<boolean>;
  /** Additional CSS classes */
  className?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
}

export function ShareButton({
  currentTime,
  getShareUrl: _getShareUrl,
  copyShareUrl,
  className,
  disabled = false,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(async () => {
    const success = await copyShareUrl(currentTime);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [copyShareUrl, currentTime]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center',
        'w-8 h-8 rounded-full',
        'text-[var(--fp-color-text-secondary)]',
        'hover:text-[var(--fp-color-text)] hover:bg-[var(--fp-color-surface)]',
        'transition-colors duration-[var(--fp-transition-fast)]',
        'focus:outline-none focus:ring-2 focus:ring-[var(--fp-color-accent)]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      aria-label={copied ? 'Link copied' : 'Share timestamp'}
      title={copied ? 'Link copied!' : 'Share current position'}
    >
      {copied ? (
        // Checkmark icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        // Share icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      )}
    </button>
  );
}
