import type { WatchProgress, WatchedSegment } from '@/types/video';

/**
 * How much of a video has actually been watched.
 *
 * The second slice of the framework-neutral core (see Phase 3 in ROADMAP.md).
 * Pure functions over plain data: no React, no DOM, no media element. The
 * numbers this produces decide whether an episode counts as finished, which is
 * what a "continue watching" row and any completion reporting are built on — so
 * they are worth being able to test as arithmetic rather than through a
 * rendered player.
 */

/**
 * Two segments this close together count as one.
 *
 * `timeupdate` fires roughly every 250 ms and the reported time drifts, so a
 * continuous watch arrives as a string of segments with sub-second gaps between
 * them. Without this they would never merge and the segment list would grow
 * without bound over a long video.
 */
const ADJACENCY_TOLERANCE_SECONDS = 0.5;

/** Treated as finished at this fraction of the duration. */
export const DEFAULT_COMPLETION_THRESHOLD = 0.95;

/**
 * Merge overlapping and adjacent segments, sorted by start.
 *
 * Merging is what stops re-watching count twice: the first minute viewed five
 * times is still one minute watched.
 *
 * Every segment in the result is a fresh object. The previous implementation
 * shallow-copied the array and then assigned to `last.end`, which wrote through
 * to the caller's own segment objects — so a `WatchProgress` already handed to a
 * consumer changed retroactively under them.
 */
export function mergeSegments(segments: WatchedSegment[]): WatchedSegment[] {
  if (segments.length === 0) return [];

  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: WatchedSegment[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end + ADJACENCY_TOLERANCE_SECONDS) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/** Total seconds covered by a set of segments. Assumes they are merged. */
export function watchedDuration(segments: WatchedSegment[]): number {
  return segments.reduce((total, segment) => total + (segment.end - segment.start), 0);
}

/** A progress record with nothing watched. */
export function emptyProgress(): WatchProgress {
  return {
    watchedSegments: [],
    percentageWatched: 0,
    isFullyWatched: false,
    furthestPoint: 0,
  };
}

export interface ProgressUpdate {
  /** A newly watched stretch, if one just finished. */
  segment?: WatchedSegment;
  /** Total length of the media. Progress is meaningless without it. */
  duration: number;
  /** Where the playhead is now, for the furthest-point mark. */
  currentTime: number;
  /** Fraction of the duration that counts as finished. */
  completionThreshold?: number;
}

export interface ProgressTransition {
  progress: WatchProgress;
  /**
   * Whether this update is the one that crossed into "finished".
   *
   * Separate from `progress.isFullyWatched` so the caller can fire a completion
   * callback exactly once: the flag stays true for every later update, the
   * transition is true only on the edge.
   */
  justCompleted: boolean;
}

/**
 * Fold a newly watched stretch into the running progress.
 *
 * A zero-length or backwards segment is ignored — seeking without playing
 * produces those, and they would otherwise litter the list.
 */
export function applyProgress(
  previous: WatchProgress,
  update: ProgressUpdate
): ProgressTransition {
  const {
    segment,
    duration,
    currentTime,
    completionThreshold = DEFAULT_COMPLETION_THRESHOLD,
  } = update;

  // Duration is 0 until `loadedmetadata` and Infinity for a live stream.
  // A percentage against either is meaningless, so nothing is recorded.
  if (!Number.isFinite(duration) || duration <= 0) {
    return { progress: previous, justCompleted: false };
  }

  let segments = previous.watchedSegments;
  if (segment && segment.end > segment.start) {
    segments = mergeSegments([...segments, segment]);
  }

  const watched = watchedDuration(segments);
  const percentageWatched = Math.min(100, (watched / duration) * 100);
  const furthestPoint = Math.max(
    previous.furthestPoint,
    Number.isFinite(currentTime) ? currentTime : previous.furthestPoint
  );
  const isFullyWatched = percentageWatched >= completionThreshold * 100;

  return {
    progress: {
      watchedSegments: segments,
      percentageWatched,
      isFullyWatched,
      furthestPoint,
    },
    justCompleted: isFullyWatched && !previous.isFullyWatched,
  };
}
