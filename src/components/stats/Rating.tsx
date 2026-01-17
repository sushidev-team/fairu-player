import { useState, useCallback } from 'react';
import { cn } from '@/utils/cn';
import { useLabels } from '@/context/LabelsContext';
import type { RatingValue, RatingState, RatingConfig } from '@/types/stats';

export interface RatingProps extends RatingConfig {
  /** Current rating state (controlled) */
  state?: Partial<RatingState>;
  /** Custom class name */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Disable all interactions */
  disabled?: boolean;
}

/**
 * Thumbs up/down icon
 */
function ThumbIcon({ direction, filled, className }: { direction: 'up' | 'down'; filled: boolean; className?: string }) {
  const isUp = direction === 'up';

  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      className={cn('transition-all', className)}
      style={{ transform: isUp ? 'none' : 'rotate(180deg)' }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
      />
    </svg>
  );
}

/**
 * Rating component with thumbs up/down
 */
export function Rating({
  state,
  initialState,
  showCounts = true,
  showPercentage = false,
  labels: customLabels,
  onRateUp,
  onRateDown,
  onRateRemove,
  onRatingChange,
  className,
  size = 'md',
  disabled = false,
}: RatingProps) {
  const globalLabels = useLabels();

  // Merge initial state with provided state
  const defaultState: RatingState = {
    userRating: initialState?.userRating ?? null,
    upCount: initialState?.upCount ?? 0,
    downCount: initialState?.downCount ?? 0,
    enabled: initialState?.enabled ?? true,
    canRate: initialState?.canRate ?? true,
  };

  // Use internal state if not controlled
  const [internalState, setInternalState] = useState<RatingState>(defaultState);

  // Merge controlled state with internal state
  const currentState: RatingState = {
    ...internalState,
    ...state,
  };

  const { userRating, upCount, downCount, enabled, canRate } = currentState;

  const handleRate = useCallback((rating: RatingValue) => {
    if (disabled || !enabled || !canRate) return;

    let newRating: RatingValue;
    let newUpCount = upCount;
    let newDownCount = downCount;

    // Toggle logic
    if (userRating === rating) {
      // Remove rating
      newRating = null;
      if (rating === 'up') newUpCount--;
      if (rating === 'down') newDownCount--;
      onRateRemove?.();
    } else {
      // Add/change rating
      newRating = rating;

      // Remove previous rating count
      if (userRating === 'up') newUpCount--;
      if (userRating === 'down') newDownCount--;

      // Add new rating count
      if (rating === 'up') {
        newUpCount++;
        onRateUp?.();
      }
      if (rating === 'down') {
        newDownCount++;
        onRateDown?.();
      }
    }

    // Update internal state
    setInternalState({
      ...currentState,
      userRating: newRating,
      upCount: newUpCount,
      downCount: newDownCount,
    });

    onRatingChange?.(newRating);
  }, [userRating, upCount, downCount, enabled, canRate, disabled, onRateUp, onRateDown, onRateRemove, onRatingChange, currentState]);

  // Calculate percentage
  const total = upCount + downCount;
  const upPercent = total > 0 ? Math.round((upCount / total) * 100) : 0;

  // Size classes
  const sizeClasses = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-2',
    lg: 'text-base gap-3',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const buttonClasses = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
  };

  const isDisabled = disabled || !enabled || !canRate;

  return (
    <div className={cn('flex items-center', sizeClasses[size], className)}>
      {/* Thumbs Up */}
      <button
        type="button"
        onClick={() => handleRate('up')}
        disabled={isDisabled}
        className={cn(
          'flex items-center gap-1 rounded-full transition-all',
          buttonClasses[size],
          userRating === 'up'
            ? 'text-green-500 bg-green-500/10 hover:bg-green-500/20'
            : 'text-gray-400 hover:text-green-500 hover:bg-green-500/10',
          isDisabled && 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-gray-400'
        )}
        aria-label={customLabels?.rateUp || globalLabels.rateUp}
        title={customLabels?.rateUp || globalLabels.rateUp}
      >
        <ThumbIcon
          direction="up"
          filled={userRating === 'up'}
          className={iconSizes[size]}
        />
        {showCounts && (
          <span className={cn(userRating === 'up' && 'font-medium')}>
            {showPercentage && total > 0 ? `${upPercent}%` : upCount}
          </span>
        )}
      </button>

      {/* Thumbs Down */}
      <button
        type="button"
        onClick={() => handleRate('down')}
        disabled={isDisabled}
        className={cn(
          'flex items-center gap-1 rounded-full transition-all',
          buttonClasses[size],
          userRating === 'down'
            ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20'
            : 'text-gray-400 hover:text-red-500 hover:bg-red-500/10',
          isDisabled && 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-gray-400'
        )}
        aria-label={customLabels?.rateDown || globalLabels.rateDown}
        title={customLabels?.rateDown || globalLabels.rateDown}
      >
        <ThumbIcon
          direction="down"
          filled={userRating === 'down'}
          className={iconSizes[size]}
        />
        {showCounts && !showPercentage && (
          <span className={cn(userRating === 'down' && 'font-medium')}>
            {downCount}
          </span>
        )}
      </button>
    </div>
  );
}

export default Rating;
