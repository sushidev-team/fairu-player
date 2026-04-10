export interface PlaybackHistoryEntry {
  /** Track ID */
  trackId: string;
  /** Track title (for display without needing to look up track) */
  title?: string;
  /** Track artist */
  artist?: string;
  /** Track artwork URL */
  artwork?: string;
  /** Last playback position in seconds */
  lastPosition: number;
  /** Track duration in seconds */
  duration: number;
  /** Progress as percentage 0-100 */
  progress: number;
  /** Whether the track was completed (>= 95%) */
  completed: boolean;
  /** Timestamp of last play */
  lastPlayedAt: number;
  /** Number of times played */
  playCount: number;
}

export interface PlaybackHistoryConfig {
  /** Whether history tracking is enabled. Default: true */
  enabled?: boolean;
  /** Maximum number of entries to keep. Default: 100 */
  maxEntries?: number;
  /** Number of days before entries expire. Default: 90 */
  expiryDays?: number;
  /** localStorage key. Default: 'fairu_history' */
  storageKey?: string;
}

export interface UsePlaybackHistoryReturn {
  /** Get all history entries, sorted by lastPlayedAt descending */
  getHistory: () => PlaybackHistoryEntry[];
  /** Get entries that are in progress (not completed) */
  getResumeList: () => PlaybackHistoryEntry[];
  /** Record/update a playback entry */
  recordPlay: (entry: Omit<PlaybackHistoryEntry, 'lastPlayedAt' | 'playCount'>) => void;
  /** Check if a track has been played before */
  isPlayed: (trackId: string) => boolean;
  /** Get a specific entry by track ID */
  getEntry: (trackId: string) => PlaybackHistoryEntry | null;
  /** Remove a specific entry */
  removeEntry: (trackId: string) => void;
  /** Clear all history */
  clearHistory: () => void;
  /** Number of entries in history */
  count: number;
}
