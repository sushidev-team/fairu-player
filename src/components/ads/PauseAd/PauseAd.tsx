import { useCallback } from 'react';
import { cn } from '@/utils/cn';
import type { PauseAd as PauseAdType } from '@/types/pauseAd';

export interface PauseAdComponentProps {
  /** The pause ad data */
  ad: PauseAdType;
  /** Whether the ad is visible */
  visible: boolean;
  /** Dismiss callback */
  onDismiss: () => void;
  /** Click callback */
  onClick?: (ad: PauseAdType) => void;
  /** Additional CSS classes */
  className?: string;
}

export function PauseAd({
  ad,
  visible,
  onDismiss,
  onClick,
  className,
}: PauseAdComponentProps) {
  const handleClick = useCallback(() => {
    if (ad.clickThroughUrl) {
      window.open(ad.clickThroughUrl, '_blank', 'noopener,noreferrer');
    }
    onClick?.(ad);
  }, [ad, onClick]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 z-40 flex items-center justify-center',
        'bg-black/60 backdrop-blur-sm',
        'animate-in fade-in duration-300',
        className
      )}
      data-testid="pause-ad"
    >
      {/* Ad content */}
      <div className="relative max-w-[80%] max-h-[80%]">
        {/* Close button */}
        <button
          type="button"
          onClick={onDismiss}
          className={cn(
            'absolute -top-3 -right-3 z-50',
            'w-8 h-8 rounded-full flex items-center justify-center',
            'bg-black/80 text-white/80 hover:text-white',
            'border border-white/20',
            'transition-colors duration-150'
          )}
          aria-label="Close ad"
          data-testid="pause-ad-close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Ad badge */}
        <div className="absolute top-2 left-2 z-50">
          <span className="px-2 py-0.5 bg-yellow-500 text-black text-[10px] font-bold rounded">
            AD
          </span>
        </div>

        {/* Image */}
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'block rounded-xl overflow-hidden shadow-2xl',
            ad.clickThroughUrl && 'cursor-pointer hover:scale-[1.01] transition-transform duration-200'
          )}
          aria-label={ad.altText || ad.title || 'Advertisement'}
          data-testid="pause-ad-image"
        >
          <img
            src={ad.imageUrl}
            alt={ad.altText || ad.title || 'Advertisement'}
            className="block max-w-full max-h-[60vh] object-contain"
          />
        </button>

        {/* Title and description */}
        {(ad.title || ad.description) && (
          <div className="mt-3 text-center">
            {ad.title && (
              <h3 className="text-white text-sm font-medium">{ad.title}</h3>
            )}
            {ad.description && (
              <p className="text-white/60 text-xs mt-1">{ad.description}</p>
            )}
          </div>
        )}

        {/* CTA */}
        {ad.clickThroughUrl && (
          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={handleClick}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-medium',
                'bg-[var(--fp-color-accent)] text-white',
                'hover:opacity-90 transition-opacity'
              )}
              data-testid="pause-ad-cta"
            >
              Learn More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
