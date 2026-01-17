/**
 * Rating and Stats types for media players
 */

/**
 * User rating value
 */
export type RatingValue = 'up' | 'down' | null;

/**
 * Rating state
 */
export interface RatingState {
  /** Current user's rating */
  userRating: RatingValue;
  /** Total thumbs up count */
  upCount: number;
  /** Total thumbs down count */
  downCount: number;
  /** Whether rating is enabled */
  enabled: boolean;
  /** Whether the user can change their rating */
  canRate: boolean;
}

/**
 * Rating callbacks
 */
export interface RatingCallbacks {
  /** Called when user rates up */
  onRateUp?: () => void;
  /** Called when user rates down */
  onRateDown?: () => void;
  /** Called when user removes their rating */
  onRateRemove?: () => void;
  /** Called when rating changes (with new value) */
  onRatingChange?: (rating: RatingValue) => void;
}

/**
 * Rating configuration
 */
export interface RatingConfig extends RatingCallbacks {
  /** Initial rating state */
  initialState?: Partial<RatingState>;
  /** Show rating counts */
  showCounts?: boolean;
  /** Show percentage instead of counts */
  showPercentage?: boolean;
  /** Custom labels */
  labels?: {
    up?: string;
    down?: string;
    rateUp?: string;
    rateDown?: string;
  };
}

/**
 * Single stat item - can be any key-value pair
 */
export interface StatItem {
  /** Unique identifier for this stat */
  id: string;
  /** Display label */
  label: string;
  /** Value to display (string, number, or React node) */
  value: string | number | React.ReactNode;
  /** Optional icon (React node) */
  icon?: React.ReactNode;
  /** Optional tooltip/description */
  tooltip?: string;
  /** Optional link URL */
  href?: string;
  /** Optional click handler */
  onClick?: () => void;
  /** Display order (lower = first) */
  order?: number;
  /** Whether to hide this stat */
  hidden?: boolean;
}

/**
 * Predefined stat types for convenience
 */
export type PredefinedStatType =
  | 'plays'
  | 'likes'
  | 'dislikes'
  | 'comments'
  | 'shares'
  | 'downloads'
  | 'duration'
  | 'published'
  | 'views'
  | 'subscribers'
  | 'episodes';

/**
 * Stats configuration
 */
export interface StatsConfig {
  /** Array of stat items to display */
  items: StatItem[];
  /** Layout direction */
  layout?: 'horizontal' | 'vertical' | 'grid';
  /** Number of columns for grid layout */
  columns?: number;
  /** Whether to show dividers between items */
  showDividers?: boolean;
  /** Compact mode (smaller text) */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Combined rating and stats props for player components
 */
export interface RatingAndStatsProps {
  /** Rating configuration */
  rating?: RatingConfig & { state?: Partial<RatingState> };
  /** Stats configuration */
  stats?: StatsConfig;
  /** Position of the rating/stats section */
  position?: 'above' | 'below' | 'inline';
}

/**
 * Helper to create a stat item
 */
export function createStatItem(
  id: string,
  label: string,
  value: string | number | React.ReactNode,
  options?: Partial<Omit<StatItem, 'id' | 'label' | 'value'>>
): StatItem {
  return {
    id,
    label,
    value,
    ...options,
  };
}

/**
 * Helper to format large numbers (1000 -> 1K, 1000000 -> 1M)
 */
export function formatStatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

/**
 * Helper to format date for stats
 */
export function formatStatDate(date: Date | string, locale = 'de-DE'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Initial rating state
 */
export const initialRatingState: RatingState = {
  userRating: null,
  upCount: 0,
  downCount: 0,
  enabled: true,
  canRate: true,
};
