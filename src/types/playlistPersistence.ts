export interface PlaylistPersistenceConfig {
  /** Unique key to identify this playlist. Used as localStorage key suffix. */
  playlistId: string;
  /** Whether persistence is enabled. Default: true */
  enabled?: boolean;
  /** How many days before the saved data expires. Default: 30 */
  expiryDays?: number;
  /** Debounce interval in ms for saving changes. Default: 1000 */
  saveDebounce?: number;
}

export interface PlaylistPersistenceData {
  /** The playlist ID */
  playlistId: string;
  /** Current track index */
  currentIndex: number;
  /** Whether shuffle is enabled */
  shuffle: boolean;
  /** Repeat mode */
  repeat: 'none' | 'one' | 'all';
  /** Ordered track IDs (to detect if playlist changed) */
  trackIds: string[];
  /** Timestamp when this was saved */
  timestamp: number;
}

export interface UsePlaylistPersistenceReturn {
  /** Restore saved playlist state. Returns the saved data or null. */
  restore: () => PlaylistPersistenceData | null;
  /** Save the current playlist state */
  save: (data: Omit<PlaylistPersistenceData, 'playlistId' | 'timestamp'>) => void;
  /** Clear saved state for this playlist */
  clear: () => void;
  /** Whether there is saved state available */
  hasSavedState: boolean;
}
