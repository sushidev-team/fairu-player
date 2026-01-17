import { useState, useRef, useEffect } from 'react';
import { cn } from '@/utils/cn';
import { useLabels } from '@/context/LabelsContext';
import type { Subtitle } from '@/types/video';
import type { PlayerLabels } from '@/types/labels';

export interface SubtitleSelectorProps {
  currentSubtitle: string | null;
  subtitles: Subtitle[];
  onSubtitleChange?: (subtitleId: string | null) => void;
  disabled?: boolean;
  className?: string;
  labels?: Pick<PlayerLabels, 'subtitles' | 'subtitleOptions' | 'subtitlesOff'>;
}

/**
 * Subtitle/caption selector dropdown
 */
export function SubtitleSelector({
  currentSubtitle,
  subtitles,
  onSubtitleChange,
  disabled = false,
  className,
  labels: labelsProp,
}: SubtitleSelectorProps) {
  const contextLabels = useLabels();
  const labels = labelsProp ?? contextLabels;
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

  const handleSelect = (subtitleId: string | null) => {
    onSubtitleChange?.(subtitleId);
    setIsOpen(false);
  };

  if (subtitles.length === 0) {
    return null;
  }

  // Find current subtitle label for display
  const currentSubtitleLabel = currentSubtitle
    ? subtitles.find((s) => s.id === currentSubtitle)?.label
    : labels.subtitlesOff;

  return (
    <div ref={containerRef} className={cn('fp-subtitle-selector relative', className)}>
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
        aria-label={labels.subtitles}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="flex items-center gap-1">
          {/* Closed Captions (CC) icon */}
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z" />
          </svg>
          {currentSubtitle && (
            <span className="hidden sm:inline">{currentSubtitleLabel}</span>
          )}
        </div>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute bottom-full right-0 mb-2',
            'min-w-[140px] py-1',
            'bg-[var(--fp-color-surface)] rounded-lg shadow-lg',
            'border border-[var(--fp-glass-border)]',
            'z-50'
          )}
          role="listbox"
          aria-label={labels.subtitleOptions}
        >
          {/* Off option */}
          <button
            onClick={() => handleSelect(null)}
            className={cn(
              'w-full px-3 py-2 text-left text-sm',
              'transition-colors duration-[var(--fp-transition-fast)]',
              currentSubtitle === null
                ? 'bg-[var(--fp-color-accent)] text-white'
                : 'text-[var(--fp-color-text-secondary)] hover:bg-[var(--fp-color-surface-hover)] hover:text-[var(--fp-color-text-primary)]'
            )}
            role="option"
            aria-selected={currentSubtitle === null}
          >
            <div className="flex items-center justify-between">
              <span>{labels.subtitlesOff}</span>
              {currentSubtitle === null && (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
            </div>
          </button>

          {/* Subtitle options */}
          {subtitles.map((subtitle) => (
            <button
              key={subtitle.id}
              onClick={() => handleSelect(subtitle.id)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm',
                'transition-colors duration-[var(--fp-transition-fast)]',
                subtitle.id === currentSubtitle
                  ? 'bg-[var(--fp-color-accent)] text-white'
                  : 'text-[var(--fp-color-text-secondary)] hover:bg-[var(--fp-color-surface-hover)] hover:text-[var(--fp-color-text-primary)]'
              )}
              role="option"
              aria-selected={subtitle.id === currentSubtitle}
            >
              <div className="flex items-center justify-between">
                <span>{subtitle.label}</span>
                {subtitle.id === currentSubtitle && (
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

export default SubtitleSelector;
