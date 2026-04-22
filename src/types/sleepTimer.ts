/**
 * Sleep timer types
 */

/** Preset duration option for the sleep timer */
export interface SleepTimerPreset {
  /** Duration in minutes, or 'endOfTrack' for end of current track */
  value: number | 'endOfTrack';
  /** Display label */
  label: string;
}

/** Configuration for the sleep timer */
export interface SleepTimerConfig {
  /** Preset duration options (in minutes) */
  presets?: SleepTimerPreset[];
  /** Whether to fade out volume in the last 30 seconds before pausing */
  fadeOut?: boolean;
  /** Duration of the fade out in seconds (default: 30) */
  fadeOutDuration?: number;
}

/** State of the sleep timer */
export interface SleepTimerState {
  /** Whether the timer is currently active */
  isActive: boolean;
  /** Remaining time in seconds */
  remainingTime: number;
  /** The selected duration in minutes, or 'endOfTrack' */
  selectedDuration: number | 'endOfTrack' | null;
  /** Whether the timer is currently fading out volume */
  isFadingOut: boolean;
}

/** Controls for the sleep timer */
export interface SleepTimerControls {
  /** Start the timer with a duration in minutes, or 'endOfTrack' */
  startTimer: (duration: number | 'endOfTrack') => void;
  /** Stop/cancel the timer */
  stopTimer: () => void;
  /** Extend the timer by additional minutes */
  extendTimer: (minutes: number) => void;
}

/** Options for the useSleepTimer hook */
export interface UseSleepTimerOptions {
  /** Reference to the media element to pause when timer ends */
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  /** Callback when the timer ends */
  onTimerEnd?: () => void;
  /** Whether to fade out volume in the last 30 seconds */
  fadeOut?: boolean;
  /** Duration of the fade out in seconds (default: 30) */
  fadeOutDuration?: number;
  /** Current time of the media (needed for 'endOfTrack' mode) */
  currentTime?: number;
  /** Duration of the current track (needed for 'endOfTrack' mode) */
  duration?: number;
}

/** Return type for the useSleepTimer hook */
export interface UseSleepTimerReturn {
  state: SleepTimerState;
  controls: SleepTimerControls;
}

/** Default preset durations */
export const DEFAULT_SLEEP_TIMER_PRESETS: SleepTimerPreset[] = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
  { value: 'endOfTrack', label: 'End of track' },
];
