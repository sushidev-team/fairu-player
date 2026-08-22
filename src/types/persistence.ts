/**
 * Types for the persistence layer (preferences + resume positions).
 */

/** Player settings that survive a reload. */
export interface PersistedPreferences {
  /** 0–1. */
  volume?: number;
  muted?: boolean;
  /** Playback rate multiplier, e.g. 1.5. */
  playbackRate?: number;
  /** BCP-47 language tag of the chosen subtitle track, or `null` for "off". */
  subtitleLanguage?: string | null;
  /** Label of the chosen quality level, or `'auto'`. */
  quality?: string;
}

/** Shared options for anything that persists. */
export interface PersistenceConfig {
  /**
   * Turn persistence off entirely. Useful for kiosk/preview embeds and for
   * consent-gated setups where storage is only allowed after opt-in.
   *
   * @default true
   */
  enabled?: boolean;
  /**
   * Namespace for the stored entry. Lets several independent players coexist on
   * one origin without sharing state.
   */
  scope?: string;
  /** Discard entries older than this, in milliseconds. */
  maxAge?: number;
}

/** A remembered playback position for one track. */
export interface ResumePosition {
  /** Seconds into the media. */
  position: number;
  /** Total duration in seconds, when it was known at save time. */
  duration?: number;
  /** Epoch milliseconds of the last update. */
  updatedAt: number;
  /** Whether the track was watched/listened to the end. */
  completed: boolean;
}

export interface ResumeConfig extends PersistenceConfig {
  /**
   * Seek to the remembered position automatically when a track loads.
   *
   * **Off by default, deliberately.** Recording a position is invisible;
   * jumping playback to it is not. An existing embed that upgrades should not
   * suddenly start its videos in the middle, so switching this on is the host
   * page's decision.
   *
   * With it off, the position is still recorded and `resumeAt` still reports
   * it — which is what you want for a "Continue from 12:34?" prompt, where the
   * viewer chooses rather than the player deciding for them.
   *
   * @default false
   */
  autoResume?: boolean;
  /**
   * Do not store a position below this many seconds. Stops a stray tap at the
   * very start from creating a resume point.
   *
   * @default 10
   */
  minPosition?: number;
  /**
   * Treat the track as finished once this fraction of the duration is reached,
   * and stop offering a resume point.
   *
   * Media rarely reaches exactly `duration` — the last timeupdate typically
   * lands a beat short, and many files carry credits or an outro nobody
   * re-watches. Without this, "resume" would drop the viewer into the final
   * seconds of something they already finished.
   *
   * @default 0.95
   */
  completedThreshold?: number;
  /**
   * How often to persist while playing, in milliseconds. `timeupdate` fires
   * roughly every 250 ms; writing that often would be a needless amount of
   * JSON serialisation and storage churn.
   *
   * @default 5000
   */
  saveInterval?: number;
  /**
   * Maximum number of remembered tracks. The oldest are evicted first.
   *
   * @default 100
   */
  maxEntries?: number;
}
