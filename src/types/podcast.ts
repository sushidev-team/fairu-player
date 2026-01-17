import type { Track } from './player';
import type { RatingState, RatingValue, StatItem } from './stats';

/**
 * Episode extends Track with podcast-specific metadata
 */
export interface Episode extends Track {
  /** Episode description/summary */
  description?: string;
  /** Publication date */
  publishedAt?: Date | string;
  /** Episode number within the season */
  episodeNumber?: number;
  /** Season number */
  seasonNumber?: number;
  /** Whether this episode is explicit */
  explicit?: boolean;
}

/**
 * Podcast metadata
 */
export interface Podcast {
  id: string;
  title: string;
  author: string;
  description: string;
  artwork: string;
  /** Podcast categories/tags */
  categories?: string[];
  /** RSS feed URL */
  feedUrl?: string;
  /** Website URL */
  websiteUrl?: string;
  /** Language code */
  language?: string;
  /** Whether the podcast contains explicit content */
  explicit?: boolean;
}

/**
 * Rating configuration for the podcast page
 */
export interface PodcastRatingConfig {
  /** Initial rating state */
  initialState: RatingState;
  /** Callback when user rates up */
  onRateUp?: () => void;
  /** Callback when user rates down */
  onRateDown?: () => void;
  /** Callback when rating changes */
  onRatingChange?: (rating: RatingValue) => void;
}

/**
 * Sort options for episode list
 */
export type EpisodeSortOrder = 'newest' | 'oldest' | 'popular';

/**
 * PodcastPage component props
 */
export interface PodcastPageProps {
  /** Podcast metadata */
  podcast: Podcast;
  /** List of episodes */
  episodes: Episode[];
  /** Custom stats to display */
  stats?: StatItem[];
  /** Rating configuration */
  rating?: PodcastRatingConfig;
  /** Currently playing episode index */
  currentEpisodeIndex?: number;
  /** Whether player is currently playing */
  isPlaying?: boolean;
  /** Auto-play when episode is selected */
  autoPlay?: boolean;
  /** Show sticky player at bottom */
  stickyPlayer?: boolean;
  /** Episode sort order */
  sortOrder?: EpisodeSortOrder;
  /** Callback when episode is selected */
  onEpisodeSelect?: (episode: Episode, index: number) => void;
  /** Callback when subscribe button is clicked */
  onSubscribe?: () => void;
  /** Callback when sort order changes */
  onSortChange?: (order: EpisodeSortOrder) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * PodcastHeader component props
 */
export interface PodcastHeaderProps {
  /** Podcast metadata */
  podcast: Podcast;
  /** Rating configuration */
  rating?: PodcastRatingConfig;
  /** Callback when subscribe button is clicked */
  onSubscribe?: () => void;
  /** Show subscribe button */
  showSubscribe?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * EpisodeList component props
 */
export interface EpisodeListProps {
  /** List of episodes */
  episodes: Episode[];
  /** Currently active episode index */
  currentIndex?: number;
  /** Whether the active episode is playing */
  isPlaying?: boolean;
  /** Sort order */
  sortOrder?: EpisodeSortOrder;
  /** Callback when episode is clicked */
  onEpisodeClick?: (episode: Episode, index: number) => void;
  /** Callback when sort order changes */
  onSortChange?: (order: EpisodeSortOrder) => void;
  /** Max height for scrollable list */
  maxHeight?: string;
  /** Additional CSS class */
  className?: string;
}

/**
 * EpisodeItem component props
 */
export interface EpisodeItemProps {
  /** Episode data */
  episode: Episode;
  /** Episode index in the list */
  index: number;
  /** Whether this episode is currently active */
  isActive?: boolean;
  /** Whether this episode is playing */
  isPlaying?: boolean;
  /** Callback when episode is clicked */
  onClick?: (episode: Episode, index: number) => void;
  /** Show episode number */
  showNumber?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * StickyPlayer component props
 */
export interface StickyPlayerProps {
  /** Currently playing episode */
  episode: Episode | null;
  /** Whether player is playing */
  isPlaying: boolean;
  /** Whether player is loading */
  isLoading?: boolean;
  /** Current playback time in seconds */
  currentTime: number;
  /** Episode duration in seconds */
  duration: number;
  /** Callback to toggle play/pause */
  onTogglePlay: () => void;
  /** Callback to seek */
  onSeek: (time: number) => void;
  /** Callback to close/hide the player */
  onClose?: () => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Format episode date for display
 */
export function formatEpisodeDate(date: Date | string | undefined): string {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;

  // Use relative date for recent episodes
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

  // For older episodes, show the date
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Format episode number/season for display
 */
export function formatEpisodeNumber(episode: Episode): string | null {
  if (episode.seasonNumber && episode.episodeNumber) {
    return `S${episode.seasonNumber}E${episode.episodeNumber}`;
  }
  if (episode.episodeNumber) {
    return `Ep. ${episode.episodeNumber}`;
  }
  return null;
}
