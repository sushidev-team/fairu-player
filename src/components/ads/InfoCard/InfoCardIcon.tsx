import { cn } from '@/utils/cn';

export interface InfoCardIconProps {
  /** Whether there are active info cards available */
  hasActiveCards: boolean;
  /** Number of active cards */
  cardCount?: number;
  /** Whether the cards panel is expanded */
  expanded: boolean;
  /** Callback to toggle expansion */
  onToggle: () => void;
  /** Position of the icon */
  position?: 'top-right' | 'top-left';
  /** Custom class name */
  className?: string;
}

/**
 * Info card icon - corner button to show/hide info cards
 */
export function InfoCardIcon({
  hasActiveCards,
  cardCount = 0,
  expanded,
  onToggle,
  position = 'top-right',
  className,
}: InfoCardIconProps) {
  if (!hasActiveCards) {
    return null;
  }

  return (
    <button
      onClick={onToggle}
      className={cn(
        'fairu-info-card-icon',
        'absolute z-20',
        'w-8 h-8',
        'flex items-center justify-center',
        'bg-black/60 hover:bg-black/80',
        'backdrop-blur-sm',
        'rounded-full',
        'text-white/80 hover:text-white',
        'transition-all duration-200',
        'shadow-lg',
        expanded && 'bg-white/20',
        position === 'top-right' ? 'top-3 right-3' : 'top-3 left-3',
        className
      )}
      aria-label={expanded ? 'Hide info cards' : 'Show info cards'}
      aria-expanded={expanded}
    >
      {/* Info icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          'transition-transform duration-200',
          expanded && 'rotate-180'
        )}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>

      {/* Card count badge */}
      {cardCount > 1 && (
        <span className={cn(
          'absolute -top-1 -right-1',
          'min-w-4 h-4 px-1',
          'flex items-center justify-center',
          'bg-blue-500 text-white',
          'text-[10px] font-bold',
          'rounded-full'
        )}>
          {cardCount}
        </span>
      )}
    </button>
  );
}

export default InfoCardIcon;
