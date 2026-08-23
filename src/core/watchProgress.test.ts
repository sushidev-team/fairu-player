/**
 * Watch progress as arithmetic.
 *
 * `useVideo.test.tsx` drives these same rules through a rendered player, which
 * is the proof the binding is faithful. Here they are inputs and outputs, so
 * the awkward cases — a live stream with no duration, a segment that runs
 * backwards, a viewer scrubbing over ground they already covered — can be
 * stated directly.
 */

import { describe, it, expect } from 'vitest';
import {
  mergeSegments,
  watchedDuration,
  emptyProgress,
  applyProgress,
  DEFAULT_COMPLETION_THRESHOLD,
} from './watchProgress';
import type { WatchedSegment } from '@/types/video';

describe('mergeSegments', () => {
  it('returns nothing for nothing', () => {
    expect(mergeSegments([])).toEqual([]);
  });

  it('leaves a single segment alone', () => {
    expect(mergeSegments([{ start: 0, end: 10 }])).toEqual([{ start: 0, end: 10 }]);
  });

  it('sorts by start time', () => {
    const merged = mergeSegments([
      { start: 60, end: 70 },
      { start: 0, end: 10 },
    ]);
    expect(merged.map((s) => s.start)).toEqual([0, 60]);
  });

  it('merges an overlap', () => {
    expect(mergeSegments([
      { start: 0, end: 30 },
      { start: 10, end: 40 },
    ])).toEqual([{ start: 0, end: 40 }]);
  });

  it('merges a segment fully inside another', () => {
    expect(mergeSegments([
      { start: 0, end: 100 },
      { start: 20, end: 30 },
    ])).toEqual([{ start: 0, end: 100 }]);
  });

  it('closes a sub-second gap', () => {
    // `timeupdate` fires about four times a second and the reported time
    // drifts, so a continuous watch arrives as a string of near-adjacent
    // segments. Left unmerged the list would grow without bound.
    expect(mergeSegments([
      { start: 0, end: 10 },
      { start: 10.4, end: 20 },
    ])).toEqual([{ start: 0, end: 20 }]);
  });

  it('keeps a real gap', () => {
    const merged = mergeSegments([
      { start: 0, end: 10 },
      { start: 30, end: 40 },
    ]);
    expect(merged).toHaveLength(2);
  });

  it('collapses a whole chain into one', () => {
    expect(mergeSegments([
      { start: 0, end: 10 },
      { start: 9, end: 20 },
      { start: 19, end: 30 },
    ])).toEqual([{ start: 0, end: 30 }]);
  });

  it('does not mutate the segments it was given', () => {
    // The previous implementation shallow-copied the array and then assigned to
    // `last.end`, writing through to the caller's own objects — so a progress
    // record already handed to a consumer changed retroactively.
    const input: WatchedSegment[] = [
      { start: 0, end: 10 },
      { start: 5, end: 20 },
    ];
    const snapshot = JSON.stringify(input);

    mergeSegments(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('returns fresh objects rather than the originals', () => {
    const input: WatchedSegment[] = [{ start: 0, end: 10 }];
    expect(mergeSegments(input)[0]).not.toBe(input[0]);
  });
});

describe('watchedDuration', () => {
  it('is zero for nothing', () => {
    expect(watchedDuration([])).toBe(0);
  });

  it('adds the segments up', () => {
    expect(watchedDuration([
      { start: 0, end: 10 },
      { start: 30, end: 45 },
    ])).toBe(25);
  });
});

describe('applyProgress', () => {
  const base = { duration: 100, currentTime: 0 };

  it('records a watched stretch', () => {
    const { progress } = applyProgress(emptyProgress(), {
      ...base,
      segment: { start: 0, end: 25 },
      currentTime: 25,
    });

    expect(progress.percentageWatched).toBeCloseTo(25);
    expect(progress.watchedSegments).toHaveLength(1);
  });

  it('accumulates across separate stretches', () => {
    const first = applyProgress(emptyProgress(), {
      ...base,
      segment: { start: 0, end: 20 },
      currentTime: 20,
    }).progress;

    const { progress } = applyProgress(first, {
      ...base,
      segment: { start: 60, end: 80 },
      currentTime: 80,
    });

    expect(progress.percentageWatched).toBeCloseTo(40);
  });

  it('does not count re-watched ground twice', () => {
    const first = applyProgress(emptyProgress(), {
      ...base,
      segment: { start: 0, end: 30 },
      currentTime: 30,
    }).progress;

    const { progress } = applyProgress(first, {
      ...base,
      segment: { start: 10, end: 40 },
      currentTime: 40,
    });

    expect(progress.percentageWatched).toBeCloseTo(40);
    expect(progress.watchedSegments).toHaveLength(1);
  });

  it('never exceeds 100 percent', () => {
    // The last timeupdate before `ended` can overshoot the duration.
    const { progress } = applyProgress(emptyProgress(), {
      ...base,
      segment: { start: 0, end: 120 },
      currentTime: 120,
    });

    expect(progress.percentageWatched).toBe(100);
  });

  describe('the furthest point', () => {
    it('follows the playhead forward', () => {
      const { progress } = applyProgress(emptyProgress(), { ...base, currentTime: 50 });
      expect(progress.furthestPoint).toBe(50);
    });

    it('does not move back when the viewer rewinds', () => {
      const ahead = applyProgress(emptyProgress(), { ...base, currentTime: 50 }).progress;
      const { progress } = applyProgress(ahead, { ...base, currentTime: 10 });

      expect(progress.furthestPoint).toBe(50);
    });

    it('ignores a non-finite playhead', () => {
      const ahead = applyProgress(emptyProgress(), { ...base, currentTime: 50 }).progress;
      const { progress } = applyProgress(ahead, { ...base, currentTime: NaN });

      expect(progress.furthestPoint).toBe(50);
    });
  });

  describe('completion', () => {
    it('marks the video finished past the threshold', () => {
      const { progress, justCompleted } = applyProgress(emptyProgress(), {
        ...base,
        segment: { start: 0, end: 96 },
        currentTime: 96,
      });

      expect(progress.isFullyWatched).toBe(true);
      expect(justCompleted).toBe(true);
    });

    it('reports the crossing only once', () => {
      // The flag stays true afterwards; the transition is the edge, which is
      // what lets a caller fire a completion callback exactly once.
      const finished = applyProgress(emptyProgress(), {
        ...base,
        segment: { start: 0, end: 96 },
        currentTime: 96,
      }).progress;

      const { justCompleted } = applyProgress(finished, {
        ...base,
        segment: { start: 20, end: 40 },
        currentTime: 40,
      });

      expect(justCompleted).toBe(false);
    });

    it('is not finished just short of the threshold', () => {
      const { progress } = applyProgress(emptyProgress(), {
        ...base,
        segment: { start: 0, end: 94 },
        currentTime: 94,
      });

      expect(progress.isFullyWatched).toBe(false);
    });

    it('honours a custom threshold', () => {
      const { progress } = applyProgress(emptyProgress(), {
        ...base,
        segment: { start: 0, end: 50 },
        currentTime: 50,
        completionThreshold: 0.5,
      });

      expect(progress.isFullyWatched).toBe(true);
    });

    it('ships a threshold that leaves room for credits', () => {
      // Media rarely reaches exactly `duration`, and nobody re-watches an outro.
      expect(DEFAULT_COMPLETION_THRESHOLD).toBeLessThan(1);
      expect(DEFAULT_COMPLETION_THRESHOLD).toBeGreaterThan(0.9);
    });
  });

  describe('durations that are not numbers yet', () => {
    it('records nothing before metadata has loaded', () => {
      // Duration is 0 until `loadedmetadata`; a percentage against it would be
      // Infinity and would mark everything watched.
      const { progress } = applyProgress(emptyProgress(), {
        duration: 0,
        currentTime: 25,
        segment: { start: 0, end: 25 },
      });

      expect(progress).toEqual(emptyProgress());
    });

    it('records nothing for a live stream', () => {
      const { progress } = applyProgress(emptyProgress(), {
        duration: Infinity,
        currentTime: 25,
        segment: { start: 0, end: 25 },
      });

      expect(progress.percentageWatched).toBe(0);
    });
  });

  describe('segments worth ignoring', () => {
    it('drops a zero-length segment', () => {
      const { progress } = applyProgress(emptyProgress(), {
        ...base,
        segment: { start: 30, end: 30 },
        currentTime: 30,
      });

      expect(progress.watchedSegments).toEqual([]);
    });

    it('drops a backwards segment', () => {
      // Seeking backwards mid-play can close a segment behind where it opened.
      const { progress } = applyProgress(emptyProgress(), {
        ...base,
        segment: { start: 40, end: 10 },
        currentTime: 10,
      });

      expect(progress.watchedSegments).toEqual([]);
    });
  });

  it('does not mutate the progress it was given', () => {
    const previous = applyProgress(emptyProgress(), {
      ...base,
      segment: { start: 0, end: 20 },
      currentTime: 20,
    }).progress;
    const snapshot = JSON.stringify(previous);

    applyProgress(previous, { ...base, segment: { start: 30, end: 50 }, currentTime: 50 });

    expect(JSON.stringify(previous)).toBe(snapshot);
  });
});
