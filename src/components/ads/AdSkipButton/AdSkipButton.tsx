import { cn } from '@/utils';

export interface AdSkipButtonProps {
  canSkip: boolean;
  countdown: number;
  onClick?: () => void;
  className?: string;
}

export function AdSkipButton({
  canSkip,
  countdown,
  onClick,
  className,
}: AdSkipButtonProps) {
  if (canSkip) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'px-4 py-2 rounded-full',
          'bg-white text-black text-sm font-semibold',
          'hover:bg-white/90 active:scale-95',
          'transition-all duration-150',
          'flex items-center gap-2',
          'shadow-lg',
          className
        )}
      >
        Skip Ad
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>
    );
  }

  if (countdown > 0) {
    return (
      <div
        className={cn(
          'px-4 py-2 rounded-full',
          'bg-white/10 border border-white/20',
          'text-white/70 text-sm font-medium',
          'backdrop-blur-sm',
          className
        )}
      >
        Skip in {countdown}s
      </div>
    );
  }

  return null;
}
