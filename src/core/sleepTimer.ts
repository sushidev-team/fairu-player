/**
 * The sleep timer.
 *
 * Ported from PR #16, where it counted seconds with a `setInterval`. That is
 * the one implementation this feature cannot have: browsers throttle timers in
 * background tabs and stop them outright when a phone sleeps — which is the
 * situation a sleep timer exists for. Counting ticks means a 45-minute timer
 * silently becomes an hour, or never fires at all.
 *
 * So a deadline is stored instead, and the remaining time is *derived* from the
 * clock. Ticking then only drives repainting; missing a tick costs a smooth
 * countdown, never correctness.
 *
 * Two modes, and they run on different clocks on purpose: a duration is
 * wall-clock, and "end of track" follows the playhead — pausing a podcast
 * should not eat into it.
 */

export type SleepTimerMode = number | 'endOfTrack';

export interface SleepTimerState {
  mode: SleepTimerMode | null;
  /** Wall-clock milliseconds when playback stops. `null` in `endOfTrack` mode. */
  endsAt: number | null;
}

export interface MediaPosition {
  currentTime: number;
  duration: number;
}

export const idleSleepTimer: SleepTimerState = { mode: null, endsAt: null };

export function isActive(state: SleepTimerState): boolean {
  return state.mode !== null;
}

/** Arm the timer. `now` is `Date.now()`, passed in so this stays testable. */
export function start(mode: SleepTimerMode, now: number): SleepTimerState {
  if (mode === 'endOfTrack') return { mode, endsAt: null };
  if (!Number.isFinite(mode) || mode <= 0) return idleSleepTimer;

  return { mode, endsAt: now + mode * 60_000 };
}

/**
 * Push the deadline back.
 *
 * Extending an "end of track" timer converts it to a duration: the viewer asked
 * for more time, and there is no more track to wait for.
 */
export function extend(
  state: SleepTimerState,
  minutes: number,
  now: number,
  media?: MediaPosition
): SleepTimerState {
  if (!isActive(state) || !Number.isFinite(minutes) || minutes <= 0) return state;

  const left = remainingSeconds(state, now, media);
  return { mode: minutes, endsAt: now + (left + minutes * 60) * 1000 };
}

/**
 * Seconds left, derived rather than counted.
 *
 * Never negative: an expired timer reads zero, so a countdown does not run
 * backwards while the pause is being applied.
 */
export function remainingSeconds(
  state: SleepTimerState,
  now: number,
  media?: MediaPosition
): number {
  if (!isActive(state)) return 0;

  if (state.mode === 'endOfTrack') {
    if (!media || !Number.isFinite(media.duration) || media.duration <= 0) return 0;
    return Math.max(0, media.duration - media.currentTime);
  }

  if (state.endsAt === null) return 0;
  return Math.max(0, (state.endsAt - now) / 1000);
}

/** Whether playback should stop now. */
export function hasExpired(
  state: SleepTimerState,
  now: number,
  media?: MediaPosition
): boolean {
  if (!isActive(state)) return false;

  if (state.mode === 'endOfTrack') {
    // Before metadata there is no end to wait for, so nothing has expired yet —
    // reporting otherwise would stop playback the moment the timer was set.
    if (!media || !Number.isFinite(media.duration) || media.duration <= 0) return false;
    return media.currentTime >= media.duration;
  }

  return remainingSeconds(state, now) <= 0;
}

/**
 * How loud playback should be, as a fraction of where the volume started.
 *
 * `1` outside the fade window. Clamped, because a caller that asks after the
 * deadline should get silence rather than a negative volume.
 */
export function fadeMultiplier(remaining: number, fadeDuration: number): number {
  if (!(fadeDuration > 0) || !Number.isFinite(remaining)) return 1;
  if (remaining >= fadeDuration) return 1;

  return Math.max(0, Math.min(1, remaining / fadeDuration));
}

/** `1:30:05`, `4:59`, `0:07` — what a countdown shows. */
export function formatRemaining(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';

  const total = Math.ceil(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;

  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

export interface SleepTimerPreset {
  value: SleepTimerMode;
  /** Fallback English label; hosts with a labels table override it. */
  label: string;
}

export const DEFAULT_SLEEP_TIMER_PRESETS: readonly SleepTimerPreset[] = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
  { value: 'endOfTrack', label: 'End of track' },
];
