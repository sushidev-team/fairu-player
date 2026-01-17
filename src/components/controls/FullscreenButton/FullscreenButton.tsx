import { cn } from '@/utils/cn';
import { useLabels } from '@/context/LabelsContext';
import type { PlayerLabels } from '@/types/labels';

export interface FullscreenButtonProps {
  isFullscreen: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  labels?: Pick<PlayerLabels, 'enterFullscreen' | 'exitFullscreen'>;
}

/**
 * Button to toggle fullscreen mode
 */
export function FullscreenButton({
  isFullscreen,
  onClick,
  disabled = false,
  className,
  labels: labelsProp,
}: FullscreenButtonProps) {
  const contextLabels = useLabels();
  const labels = labelsProp ?? contextLabels;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'fp-fullscreen-button',
        'p-2 rounded-lg',
        'text-[var(--fp-color-text-secondary)] hover:text-[var(--fp-color-text-primary)]',
        'hover:bg-[var(--fp-color-surface-hover)]',
        'transition-colors duration-[var(--fp-transition-fast)]',
        'focus:outline-none focus:ring-2 focus:ring-[var(--fp-color-accent)]/50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      aria-label={isFullscreen ? labels.exitFullscreen : labels.enterFullscreen}
      title={isFullscreen ? labels.exitFullscreen : labels.enterFullscreen}
    >
      {isFullscreen ? (
        // Exit fullscreen icon
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
        </svg>
      ) : (
        // Enter fullscreen icon
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      )}
    </button>
  );
}

export default FullscreenButton;
