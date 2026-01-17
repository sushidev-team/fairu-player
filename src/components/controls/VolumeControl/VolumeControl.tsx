import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/utils';

export interface VolumeControlProps {
  volume: number;
  muted: boolean;
  disabled?: boolean;
  /** 'vertical' shows overlay popup, 'horizontal' shows inline slider */
  orientation?: 'vertical' | 'horizontal';
  onVolumeChange?: (volume: number) => void;
  onMuteToggle?: () => void;
  className?: string;
}

export function VolumeControl({
  volume,
  muted,
  disabled = false,
  orientation = 'vertical',
  onVolumeChange,
  onMuteToggle,
  className,
}: VolumeControlProps) {
  const [showSlider, setShowSlider] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveVolume = muted ? 0 : volume;
  const isActive = showSlider || isDragging;
  const isHorizontal = orientation === 'horizontal';

  // Calculate volume from mouse position
  const calculateVolume = useCallback((clientX: number, clientY: number) => {
    if (!sliderRef.current) return volume;
    const rect = sliderRef.current.getBoundingClientRect();

    if (isHorizontal) {
      // Horizontal: left = 0, right = 1
      const position = (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(1, position));
    } else {
      // Vertical: bottom = 0, top = 1
      const position = 1 - (clientY - rect.top) / rect.height;
      return Math.max(0, Math.min(1, position));
    }
  }, [volume, isHorizontal]);

  // Handle mouse down on slider
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    const newVolume = calculateVolume(e.clientX, e.clientY);
    onVolumeChange?.(newVolume);
  }, [disabled, calculateVolume, onVolumeChange]);

  // Handle global mouse events for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newVolume = calculateVolume(e.clientX, e.clientY);
      onVolumeChange?.(newVolume);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, calculateVolume, onVolumeChange]);

  // Handle keyboard input on slider
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    const step = e.shiftKey ? 0.1 : 0.05;
    let newVolume = volume;

    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        newVolume = Math.min(1, volume + step);
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        newVolume = Math.max(0, volume - step);
        break;
      default:
        return;
    }

    e.preventDefault();
    onVolumeChange?.(newVolume);
  }, [disabled, volume, onVolumeChange]);

  // Close slider when clicking outside
  useEffect(() => {
    if (!isActive) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSlider(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isActive]);

  // Horizontal layout - inline slider
  if (isHorizontal) {
    return (
      <div
        ref={containerRef}
        className={cn('flex items-center gap-2 group/volume', className)}
      >
        {/* Mute/Unmute Button */}
        <button
          type="button"
          onClick={onMuteToggle}
          disabled={disabled}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className={cn(
            'flex items-center justify-center',
            'w-8 h-8 rounded-full flex-shrink-0',
            'text-[var(--fp-color-text-secondary)]',
            'hover:text-[var(--fp-color-text)]',
            'hover:bg-[var(--fp-color-surface-hover)]',
            'transition-all duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fp-color-accent)]',
            disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent'
          )}
        >
          <VolumeIcon volume={effectiveVolume} />
        </button>

        {/* Horizontal Slider Track */}
        <div
          ref={sliderRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label="Volume"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(effectiveVolume * 100)}
          aria-valuetext={`${Math.round(effectiveVolume * 100)}%`}
          className={cn(
            'relative w-24 h-6 flex items-center cursor-pointer',
            'group/slider',
            disabled && 'cursor-not-allowed'
          )}
          onMouseDown={handleMouseDown}
          onKeyDown={handleKeyDown}
        >
          {/* Track Background */}
          <div
            className={cn(
              'absolute w-full top-1/2 -translate-y-1/2 rounded-full bg-[var(--fp-progress-bg)]',
              'transition-all duration-150',
              'h-1 group-hover/slider:h-1.5 group-hover/volume:h-1.5',
              isDragging && 'h-1.5'
            )}
          >
            {/* Volume Fill - grows from left */}
            <div
              className={cn(
                'absolute left-0 top-0 bottom-0 rounded-full',
                'transition-colors duration-150',
                'bg-[var(--fp-color-text-secondary)]',
                'group-hover/volume:bg-[var(--fp-color-accent)]',
                isDragging && 'bg-[var(--fp-color-accent)]'
              )}
              style={{ width: `${effectiveVolume * 100}%` }}
            />
          </div>

          {/* Thumb */}
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 -translate-x-1/2',
              'w-3 h-3 rounded-full',
              'bg-[var(--fp-color-text)]',
              'shadow-md',
              'transition-all duration-150',
              'opacity-0 scale-75',
              'group-hover/volume:opacity-100 group-hover/volume:scale-100',
              isDragging && 'opacity-100 scale-125'
            )}
            style={{ left: `${effectiveVolume * 100}%` }}
          />
        </div>
      </div>
    );
  }

  // Vertical layout - overlay popup
  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => !isDragging && setShowSlider(false)}
    >
      {/* Vertical Slider Overlay - appears above the button */}
      <div
        className={cn(
          'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
          'transition-all duration-200 ease-out',
          'z-50',
          isActive
            ? 'opacity-100 visible translate-y-0'
            : 'opacity-0 invisible translate-y-2'
        )}
      >
        <div
          className={cn(
            'flex flex-col items-center',
            'bg-[var(--fp-color-surface)] rounded-lg',
            'border border-[var(--fp-glass-border)]',
            'shadow-lg',
            'p-2 pb-3'
          )}
        >
          {/* Volume percentage */}
          <span className="text-[10px] text-[var(--fp-color-text-secondary)] mb-2 font-medium">
            {Math.round(effectiveVolume * 100)}%
          </span>

          {/* Vertical Slider Track */}
          <div
            ref={sliderRef}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label="Volume"
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(effectiveVolume * 100)}
            aria-valuetext={`${Math.round(effectiveVolume * 100)}%`}
            className={cn(
              'relative w-6 h-24 flex justify-center cursor-pointer',
              'group/slider',
              disabled && 'cursor-not-allowed'
            )}
            onMouseDown={handleMouseDown}
            onKeyDown={handleKeyDown}
          >
            {/* Track Background */}
            <div
              className={cn(
                'absolute h-full left-1/2 -translate-x-1/2 rounded-full bg-[var(--fp-progress-bg)]',
                'transition-all duration-150',
                'w-1 group-hover/slider:w-1.5'
              )}
            >
              {/* Volume Fill - grows from bottom */}
              <div
                className={cn(
                  'absolute bottom-0 left-0 right-0 rounded-full',
                  'transition-colors duration-150',
                  'bg-[var(--fp-color-accent)]'
                )}
                style={{ height: `${effectiveVolume * 100}%` }}
              />
            </div>

            {/* Thumb */}
            <div
              className={cn(
                'absolute left-1/2 -translate-x-1/2 translate-y-1/2',
                'w-3 h-3 rounded-full',
                'bg-[var(--fp-color-text)]',
                'shadow-md',
                'transition-all duration-150',
                'opacity-100 scale-100',
                isDragging && 'scale-125'
              )}
              style={{ bottom: `${effectiveVolume * 100}%` }}
            />
          </div>
        </div>

        {/* Arrow pointer */}
        <div
          className={cn(
            'absolute left-1/2 -translate-x-1/2 -bottom-1',
            'w-2 h-2 rotate-45',
            'bg-[var(--fp-color-surface)]',
            'border-r border-b border-[var(--fp-glass-border)]'
          )}
        />
      </div>

      {/* Mute/Unmute Button */}
      <button
        type="button"
        onClick={onMuteToggle}
        disabled={disabled}
        aria-label={muted ? 'Unmute' : 'Mute'}
        className={cn(
          'flex items-center justify-center',
          'w-8 h-8 rounded-full',
          'text-[var(--fp-color-text-secondary)]',
          'hover:text-[var(--fp-color-text)]',
          'hover:bg-[var(--fp-color-surface-hover)]',
          'transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fp-color-accent)]',
          disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent'
        )}
      >
        <VolumeIcon volume={effectiveVolume} />
      </button>
    </div>
  );
}

function VolumeIcon({ volume }: { volume: number }) {
  const showWave1 = volume > 0;
  const showWave2 = volume >= 0.5;

  if (volume === 0) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        aria-hidden="true"
      >
        <path
          d="M3 9v6h4l5 5V4L7 9H3z"
          fill="currentColor"
        />
        <g
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        >
          <line x1="16" y1="9" x2="22" y2="15" />
          <line x1="22" y1="9" x2="16" y2="15" />
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path
        d="M3 9v6h4l5 5V4L7 9H3z"
        fill="currentColor"
      />
      <g fill="currentColor">
        <path
          d="M14 12c0-1.1-.45-2.1-1.17-2.83l1.41-1.41C15.34 8.86 16 10.35 16 12s-.66 3.14-1.76 4.24l-1.41-1.41C13.55 14.1 14 13.1 14 12z"
          className="transition-all duration-200"
          style={{
            opacity: showWave1 ? 1 : 0,
            transform: showWave1 ? 'translateX(0)' : 'translateX(-2px)',
          }}
        />
        <path
          d="M16.24 7.76l1.41-1.41C19.15 7.85 20 9.85 20 12s-.85 4.15-2.35 5.65l-1.41-1.41C17.32 15.16 18 13.65 18 12s-.68-3.16-1.76-4.24z"
          className="transition-all duration-200"
          style={{
            opacity: showWave2 ? 1 : 0,
            transform: showWave2 ? 'translateX(0)' : 'translateX(-2px)',
          }}
        />
      </g>
    </svg>
  );
}
