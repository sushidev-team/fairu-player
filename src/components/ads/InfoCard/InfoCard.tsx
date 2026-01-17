import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/utils/cn';
import type { InfoCard as InfoCardType } from '@/types/video';

export interface InfoCardProps {
  /** The info card configuration */
  card: InfoCardType;
  /** Current video time in seconds */
  currentTime: number;
  /** Video duration in seconds */
  duration: number;
  /** Whether the card is expanded (shown) */
  expanded?: boolean;
  /** Skip time-based visibility check (for manually triggered cards) */
  forceShow?: boolean;
  /** Callback when the card is dismissed */
  onDismiss?: (card: InfoCardType) => void;
  /** Callback when the card is clicked/selected */
  onSelect?: (card: InfoCardType) => void;
  /** Callback when the card is shown (impression) */
  onImpression?: (card: InfoCardType) => void;
  /** Custom class name */
  className?: string;
}

/**
 * Info card component - displays sponsored/clickable cards during video
 */
export function InfoCard({
  card,
  currentTime,
  duration,
  expanded = false,
  forceShow = false,
  onDismiss,
  onSelect,
  onImpression,
  className,
}: InfoCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [wasDismissed, setWasDismissed] = useState(false);
  const [impressionFired, setImpressionFired] = useState(false);

  const cardDuration = card.duration ?? (duration - card.displayAt);
  const position = card.position ?? 'top-right';

  // Determine if the card should be visible based on time (or forceShow)
  useEffect(() => {
    if (wasDismissed) {
      setIsVisible(false);
      return;
    }

    // If forceShow is true, skip time-based check
    const shouldShow = forceShow || (currentTime >= card.displayAt && currentTime < card.displayAt + cardDuration);
    setIsVisible(shouldShow);

    // Fire impression when first shown
    if (shouldShow && !impressionFired) {
      setImpressionFired(true);
      onImpression?.(card);

      // Track impression URL
      if (card.trackingUrls?.impression) {
        fetch(card.trackingUrls.impression, { method: 'GET', mode: 'no-cors' }).catch(() => {});
      }
    }
  }, [currentTime, card, cardDuration, forceShow, wasDismissed, impressionFired, onImpression]);

  // Handle dismiss
  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setWasDismissed(true);
    setIsVisible(false);
    onDismiss?.(card);

    // Track dismiss URL
    if (card.trackingUrls?.dismiss) {
      fetch(card.trackingUrls.dismiss, { method: 'GET', mode: 'no-cors' }).catch(() => {});
    }
  }, [card, onDismiss]);

  // Handle select/click
  const handleSelect = useCallback(() => {
    // Call custom onSelect if provided on the card
    card.onSelect?.(card);
    onSelect?.(card);

    // Track click URL
    if (card.trackingUrls?.click) {
      fetch(card.trackingUrls.click, { method: 'GET', mode: 'no-cors' }).catch(() => {});
    }

    // Open URL if provided
    if (card.url) {
      window.open(card.url, '_blank');
    }
  }, [card, onSelect]);

  if (!isVisible || !expanded) {
    return null;
  }

  // Get icon based on card type
  const getCardIcon = () => {
    switch (card.type) {
      case 'product':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        );
      case 'video':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        );
      case 'link':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
    }
  };

  return (
    <div
      className={cn(
        'fairu-info-card',
        'absolute z-30',
        'w-64',
        'transition-all duration-300 ease-in-out',
        'animate-in fade-in slide-in-from-right-4',
        position === 'top-right' ? 'top-4 right-4' : 'top-4 left-4',
        className
      )}
    >
      <div
        className={cn(
          'relative',
          'bg-black/90 backdrop-blur-sm',
          'rounded-lg overflow-hidden',
          'shadow-xl',
          'cursor-pointer',
          'transform transition-transform duration-200',
          'hover:scale-[1.02]',
          'border border-white/10'
        )}
        onClick={handleSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleSelect()}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className={cn(
            'absolute top-2 right-2 z-10',
            'w-6 h-6',
            'flex items-center justify-center',
            'bg-black/60 hover:bg-black/80',
            'rounded-full',
            'text-white/80 hover:text-white',
            'transition-colors'
          )}
          aria-label="Dismiss card"
        >
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Thumbnail */}
        {card.thumbnail && (
          <div className="relative w-full h-32 bg-gray-800">
            <img
              src={card.thumbnail}
              alt={card.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {/* Video play icon for video cards */}
            {card.type === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="text-black ml-1"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-3">
          {/* Card type badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white/60">{getCardIcon()}</span>
            <span className="px-1.5 py-0.5 bg-white/10 text-white/60 text-[10px] uppercase rounded">
              {card.type === 'product' ? 'Sponsored' : card.type}
            </span>
          </div>

          {/* Title */}
          <h4 className="text-white text-sm font-medium line-clamp-2 mb-1">
            {card.title}
          </h4>

          {/* Description */}
          {card.description && (
            <p className="text-white/60 text-xs line-clamp-2 mb-2">
              {card.description}
            </p>
          )}

          {/* Price for product cards */}
          {card.type === 'product' && card.price && (
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-lg">{card.price}</span>
              <span className="px-3 py-1 bg-blue-500 text-white text-xs font-medium rounded hover:bg-blue-600 transition-colors">
                View
              </span>
            </div>
          )}

          {/* CTA for non-product cards */}
          {card.type !== 'product' && card.url && (
            <span className="text-blue-400 text-xs hover:underline">
              {card.type === 'video' ? 'Watch now' : 'Learn more'} &rarr;
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default InfoCard;
