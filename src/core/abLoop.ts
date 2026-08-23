/**
 * A-B repeat, as plain state and plain functions.
 *
 * Two points on the timeline and one rule: when playback reaches B, jump back
 * to A. It is the feature a language learner uses to replay one sentence and a
 * musician to drill four bars, so the loop has to be settable *while* playing,
 * from whatever the playhead happens to read.
 *
 * Ported from the work stranded in PR #16. The rules live here rather than in
 * the hook for the same reason as the rest of `src/core/`: they are decisions,
 * not React, and a Vue or Angular binding should not have to reimplement them.
 */

export interface ABLoop {
  /** Point A. `null` until the viewer sets it. */
  start: number | null;
  /** Point B. `null` until the viewer sets it. */
  end: number | null;
}

export const noLoop: ABLoop = { start: null, end: null };

/**
 * Whether this pair actually loops.
 *
 * Both points set is not enough — a zero-length loop would ask playback to jump
 * to the position it is already at, forever. Such a pair is kept rather than
 * rejected, because the viewer is usually mid-way through defining it and the
 * UI should show both markers; it simply does not loop until they differ.
 */
export function isLooping(loop: ABLoop): boolean {
  return loop.start !== null && loop.end !== null && loop.end > loop.start;
}

/** The span in seconds, or `null` when the loop is not complete. */
export function loopDuration(loop: ABLoop): number | null {
  return isLooping(loop) ? (loop.end as number) - (loop.start as number) : null;
}

/**
 * Place point A.
 *
 * Setting A after B swaps them rather than refusing: the viewer marked two
 * points and meant the span between them, and which one they pressed first is
 * not information worth enforcing.
 */
export function setStart(loop: ABLoop, time: number): ABLoop {
  const at = clampToZero(time);
  if (at === null) return loop;

  if (loop.end !== null && loop.end < at) {
    return { start: loop.end, end: at };
  }
  return { ...loop, start: at };
}

/** Place point B. Mirrors {@link setStart}, including the swap. */
export function setEnd(loop: ABLoop, time: number): ABLoop {
  const at = clampToZero(time);
  if (at === null) return loop;

  if (loop.start !== null && at < loop.start) {
    return { start: at, end: loop.start };
  }
  return { ...loop, end: at };
}

export function clear(): ABLoop {
  return noLoop;
}

/**
 * Where playback should jump to, or `null` to leave it alone.
 *
 * `>=` rather than `>`: a `timeupdate` fires a few times a second, so the
 * playhead is only ever *observed* near B, never exactly on it. Waiting for a
 * strict overshoot would let a fraction of a second past B play every lap.
 */
export function seekTarget(loop: ABLoop, currentTime: number): number | null {
  if (!isLooping(loop)) return null;
  return currentTime >= (loop.end as number) ? loop.start : null;
}

/**
 * A time that is safe to store, or `null` for one that is not.
 *
 * `number` admits NaN and Infinity, and both reach `currentTime` unchallenged —
 * an unplayable element rather than a rejected input.
 */
function clampToZero(time: number): number | null {
  if (!Number.isFinite(time)) return null;
  return Math.max(0, time);
}
