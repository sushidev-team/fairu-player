import { useState, useRef, useEffect } from 'react';
import { cn } from '@/utils/cn';
import type { VideoQuality } from '@/types/video';

export interface QualitySelectorProps {
  currentQuality: string;
  qualities: VideoQuality[];
  onQualityChange?: (quality: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Video quality selector dropdown
 */
export function QualitySelector({
  currentQuality,
  qualities,
  onQualityChange,
  disabled = false,
  className,
}: QualitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSelect = (quality: string) => {
    onQualityChange?.(quality);
    setIsOpen(false);
  };

  if (qualities.length <= 1) {
    return null;
  }

  return (
    <div ref={containerRef} className={cn('fp-quality-selector relative', className)}>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'px-2 py-1 rounded text-sm',
          'text-[var(--fp-color-text-secondary)] hover:text-[var(--fp-color-text-primary)]',
          'hover:bg-[var(--fp-color-surface-hover)]',
          'transition-colors duration-[var(--fp-transition-fast)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--fp-color-accent)]/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        aria-label="Select video quality"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="flex items-center gap-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{currentQuality}</span>
        </div>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute bottom-full right-0 mb-2',
            'min-w-[120px] py-1',
            'bg-[var(--fp-color-surface)] rounded-lg shadow-lg',
            'border border-[var(--fp-glass-border)]',
            'z-50'
          )}
          role="listbox"
          aria-label="Video quality options"
        >
          {qualities.map((quality) => (
            <button
              key={quality.label}
              onClick={() => handleSelect(quality.label)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm',
                'transition-colors duration-[var(--fp-transition-fast)]',
                quality.label === currentQuality
                  ? 'bg-[var(--fp-color-accent)] text-white'
                  : 'text-[var(--fp-color-text-secondary)] hover:bg-[var(--fp-color-surface-hover)] hover:text-[var(--fp-color-text-primary)]'
              )}
              role="option"
              aria-selected={quality.label === currentQuality}
            >
              <div className="flex items-center justify-between">
                <span>{quality.label}</span>
                {quality.label === currentQuality && (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default QualitySelector;
