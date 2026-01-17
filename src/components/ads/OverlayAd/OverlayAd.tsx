import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/utils/cn';
import type { OverlayAd as OverlayAdType } from '@/types/video';

export interface OverlayAdProps {
  /** The overlay ad configuration */
  ad: OverlayAdType;
  /** Current video time in seconds */
  currentTime: number;
  /** Whether to show the overlay */
  visible?: boolean;
  /** Skip time-based visibility check (for manually triggered ads) */
  forceShow?: boolean;
  /** Callback when the overlay is closed */
  onClose?: (ad: OverlayAdType) => void;
  /** Callback when the overlay is clicked */
  onClick?: (ad: OverlayAdType) => void;
  /** Callback when the overlay is shown (impression) */
  onImpression?: (ad: OverlayAdType) => void;
  /** Custom class name */
  className?: string;
}

/**
 * Overlay ad component - displays a banner ad during video playback
 */
export function OverlayAd({
  ad,
  currentTime,
  visible = true,
  forceShow = false,
  onClose,
  onClick,
  onImpression,
  className,
}: OverlayAdProps) {
  const [isShowing, setIsShowing] = useState(false);
  const [wasClosed, setWasClosed] = useState(false);
  const [impressionFired, setImpressionFired] = useState(false);

  const duration = ad.duration ?? 10;
  const position = ad.position ?? 'bottom';
  const closeable = ad.closeable !== false;

  // Determine if the ad should be visible based on time (or forceShow)
  useEffect(() => {
    if (wasClosed) {
      setIsShowing(false);
      return;
    }

    // If forceShow is true, skip time-based check
    const shouldShow = forceShow || (currentTime >= ad.displayAt && currentTime < ad.displayAt + duration);
    setIsShowing(shouldShow && visible);

    // Fire impression when first shown
    if (shouldShow && visible && !impressionFired) {
      setImpressionFired(true);
      onImpression?.(ad);

      // Track impression URL
      if (ad.trackingUrls?.impression) {
        fetch(ad.trackingUrls.impression, { method: 'GET', mode: 'no-cors' }).catch(() => {});
      }
    }
  }, [currentTime, ad, duration, visible, forceShow, wasClosed, impressionFired, onImpression]);

  // Handle close
  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setWasClosed(true);
    setIsShowing(false);
    onClose?.(ad);

    // Track close URL
    if (ad.trackingUrls?.close) {
      fetch(ad.trackingUrls.close, { method: 'GET', mode: 'no-cors' }).catch(() => {});
    }
  }, [ad, onClose]);

  // Handle click
  const handleClick = useCallback(() => {
    onClick?.(ad);

    // Track click URL
    if (ad.trackingUrls?.click) {
      fetch(ad.trackingUrls.click, { method: 'GET', mode: 'no-cors' }).catch(() => {});
    }

    // Open click-through URL
    if (ad.clickThroughUrl) {
      window.open(ad.clickThroughUrl, '_blank');
    }
  }, [ad, onClick]);

  if (!isShowing) {
    return null;
  }

  return (
    <div
      className={cn(
        'fairu-overlay-ad',
        'absolute left-4 right-4 z-30',
        'flex items-center',
        'transition-all duration-300 ease-in-out',
        'animate-in fade-in slide-in-from-bottom-2',
        position === 'bottom' ? 'bottom-20' : 'top-4',
        className
      )}
    >
      {/* Close button - outside the banner */}
      {closeable && (
        <button
          onClick={handleClose}
          className={cn(
            'flex-shrink-0 mr-2',
            'w-7 h-7',
            'flex items-center justify-center',
            'bg-black/70 hover:bg-black/90',
            'rounded-full',
            'text-white/70 hover:text-white',
            'transition-colors',
            'border border-white/20'
          )}
          aria-label="Close ad"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* Banner container */}
      <div
        className={cn(
          'relative flex-1',
          'bg-black/90 backdrop-blur-sm',
          'rounded-lg overflow-hidden',
          'shadow-2xl',
          'cursor-pointer',
          'transform transition-all duration-200',
          'hover:bg-black/95',
          'border border-white/10',
          'flex items-center'
        )}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        aria-label={ad.altText || 'Sponsored content'}
      >
        {/* Ad badge */}
        <div className="flex-shrink-0 px-3 py-2 bg-yellow-500/90 self-stretch flex items-center">
          <span className="text-black text-[10px] font-bold tracking-wide">
            AD
          </span>
        </div>

        {/* Banner image */}
        <div className="flex-1 py-1.5 px-3">
          <img
            src={ad.imageUrl}
            alt={ad.altText || 'Advertisement'}
            className="w-full h-12 object-contain"
            loading="lazy"
          />
        </div>

        {/* Click hint */}
        {ad.clickThroughUrl && (
          <div className="flex-shrink-0 px-3 py-2 self-stretch flex items-center border-l border-white/10 hover:bg-white/5 transition-colors">
            <span className="text-white/80 text-xs font-medium whitespace-nowrap flex items-center gap-1">
              Learn more
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default OverlayAd;
