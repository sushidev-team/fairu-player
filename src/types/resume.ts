/**
 * Resume position persistence types
 */

/**
 * Configuration for the useResumePosition hook
 */
export interface ResumeConfig {
  /** Unique identifier for the media track */
  trackId: string;
  /** Reference to the media element to seek on resume */
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  /** Whether resume functionality is enabled (default: true) */
  enabled?: boolean;
  /** Minimum seconds played before saving position (default: 10) */
  threshold?: number;
  /** How often to save position in milliseconds (default: 5000) */
  saveInterval?: number;
  /** Auto-expire old entries after this many days (default: 30) */
  expiryDays?: number;
  /** Callback when resuming from a saved position */
  onResume?: (position: number) => void;
}

/**
 * Data structure stored in localStorage for resume position
 */
export interface ResumeData {
  /** Saved playback position in seconds */
  position: number;
  /** Timestamp when the position was saved (ms since epoch) */
  timestamp: number;
  /** Total duration of the media in seconds */
  duration: number;
  /** Unique identifier for the media track */
  trackId: string;
}

/**
 * Return type for useResumePosition hook
 */
export interface UseResumePositionReturn {
  /** The saved position in seconds, or null if none */
  savedPosition: number | null;
  /** Clear the saved position for the current track */
  clearPosition: () => void;
  /** Whether a saved position exists for the current track */
  hasSavedPosition: boolean;
}
