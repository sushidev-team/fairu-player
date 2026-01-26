import { cn } from '@/utils/cn';
import { useLabels } from '@/context/LabelsContext';
import type { PlayerLabels } from '@/types/labels';

export interface PictureInPictureButtonProps {
  isPictureInPicture: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  labels?: Pick<PlayerLabels, 'enterPictureInPicture' | 'exitPictureInPicture'>;
}

/**
 * Button to toggle Picture-in-Picture mode
 */
export function PictureInPictureButton({
  isPictureInPicture,
  onClick,
  disabled = false,
  className,
  labels: labelsProp,
}: PictureInPictureButtonProps) {
  const contextLabels = useLabels();
  const labels = labelsProp ?? contextLabels;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'fp-pip-button',
        'p-2 rounded-lg',
        'text-[var(--fp-color-text-secondary)] hover:text-[var(--fp-color-text-primary)]',
        'hover:bg-[var(--fp-color-surface-hover)]',
        'transition-colors duration-[var(--fp-transition-fast)]',
        'focus:outline-none focus:ring-2 focus:ring-[var(--fp-color-accent)]/50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      aria-label={isPictureInPicture ? labels.exitPictureInPicture : labels.enterPictureInPicture}
      title={isPictureInPicture ? labels.exitPictureInPicture : labels.enterPictureInPicture}
    >
      {isPictureInPicture ? (
        // Exit PiP icon (window returning to main view)
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
          <rect x="2" y="3" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 12l-4 4m0 0h3m-3 0v-3" />
        </svg>
      ) : (
        // Enter PiP icon (small window overlay)
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
          <rect x="2" y="3" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="12" y="9" width="8" height="6" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export default PictureInPictureButton;
