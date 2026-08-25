/**
 * "Continue watching", without a renderer.
 *
 * The stored list is the one input nobody reviews: it outlives the schema that
 * wrote it and is rendered straight into a UI. So most of this is about what
 * `normalizeHistory` refuses.
 */

import { describe, it, expect } from 'vitest';
import * as core from './playbackHistory';

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function entry(over: Partial<core.PlaybackHistoryEntry> = {}): core.PlaybackHistoryEntry {
  return {
    trackId: 't1',
    lastPosition: 30,
    duration: 300,
    progress: 10,
    completed: false,
    lastPlayedAt: NOW - DAY,
    playCount: 1,
    ...over,
  };
}

describe('playbackHistory core', () => {
  describe('reading what was stored', () => {
    it('keeps a well-formed entry', () => {
      const parsed = core.normalizeHistory([entry()], NOW);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].trackId).toBe('t1');
    });

    it('drops anything without an id', () => {
      // It would render as a blank row that resumes nothing.
      expect(core.normalizeHistory([entry({ trackId: '' })], NOW)).toEqual([]);
      expect(core.normalizeHistory([{ lastPlayedAt: NOW }], NOW)).toEqual([]);
    });

    it('drops anything without a usable timestamp', () => {
      expect(core.normalizeHistory([entry({ lastPlayedAt: 0 })], NOW)).toEqual([]);
      expect(
        core.normalizeHistory([{ trackId: 'x', lastPlayedAt: 'yesterday' }], NOW)
      ).toEqual([]);
    });

    it('repairs a field rather than discarding the entry', () => {
      const parsed = core.normalizeHistory(
        [{ trackId: 't1', lastPlayedAt: NOW, progress: 500, playCount: -3 }],
        NOW
      );

      expect(parsed[0].progress).toBe(100);
      expect(parsed[0].playCount).toBe(1);
    });

    it('clamps a position past the end', () => {
      const parsed = core.normalizeHistory(
        [entry({ lastPosition: 9999, duration: 300 })],
        NOW
      );

      expect(parsed[0].lastPosition).toBe(300);
    });

    it('ignores a stored value that is not a list', () => {
      expect(core.normalizeHistory(null, NOW)).toEqual([]);
      expect(core.normalizeHistory({ trackId: 't1' }, NOW)).toEqual([]);
      expect(core.normalizeHistory('[]', NOW)).toEqual([]);
    });

    it('keeps one row per track', () => {
      const parsed = core.normalizeHistory(
        [entry({ lastPlayedAt: NOW - 10 }), entry({ lastPlayedAt: NOW - 5 })],
        NOW
      );

      expect(parsed).toHaveLength(1);
    });

    it('keeps the newest of two rows for the same track', () => {
      // Storage order is not recency order — a list merged from two tabs can
      // have the older copy first, and keeping it would resume from a position
      // the viewer has already passed.
      const parsed = core.normalizeHistory(
        [
          entry({ lastPlayedAt: NOW - 5000, lastPosition: 30 }),
          entry({ lastPlayedAt: NOW - 100, lastPosition: 220 }),
        ],
        NOW
      );

      expect(parsed).toHaveLength(1);
      expect(parsed[0].lastPosition).toBe(220);
    });

    it('forgets entries past their expiry', () => {
      const parsed = core.normalizeHistory(
        [entry({ trackId: 'old', lastPlayedAt: NOW - 91 * DAY }), entry({ trackId: 'new' })],
        NOW
      );

      expect(parsed.map((e) => e.trackId)).toEqual(['new']);
    });

    it('caps the list, newest first', () => {
      const many = Array.from({ length: 150 }, (_, i) =>
        entry({ trackId: `t${i}`, lastPlayedAt: NOW - i * 1000 })
      );

      const parsed = core.normalizeHistory(many, NOW, { maxEntries: 10, expiryMs: 90 * DAY });

      expect(parsed).toHaveLength(10);
      expect(parsed[0].trackId).toBe('t0');
      expect(parsed[9].trackId).toBe('t9');
    });
  });

  describe('recording a play', () => {
    it('adds a track that was not there', () => {
      const next = core.record([], { ...entry(), trackId: 'new' }, NOW);

      expect(next).toHaveLength(1);
      expect(next[0]).toMatchObject({ trackId: 'new', playCount: 1, lastPlayedAt: NOW });
    });

    it('bumps a track that was', () => {
      const before = [entry({ playCount: 3 })];

      const next = core.record(before, { ...entry(), lastPosition: 120 }, NOW);

      // One row, not two — and the count carries over.
      expect(next).toHaveLength(1);
      expect(next[0]).toMatchObject({ playCount: 4, lastPosition: 120, lastPlayedAt: NOW });
    });

    it('moves it to the top', () => {
      const before = [
        entry({ trackId: 'a', lastPlayedAt: NOW - 100 }),
        entry({ trackId: 'b', lastPlayedAt: NOW - 200 }),
      ];

      const next = core.record(before, { ...entry(), trackId: 'b' }, NOW);

      expect(next.map((e) => e.trackId)).toEqual(['b', 'a']);
    });

    it('never mutates the list it is given', () => {
      const before = [entry()];
      const snapshot = JSON.stringify(before);

      core.record(before, { ...entry(), trackId: 'other' }, NOW);

      expect(JSON.stringify(before)).toBe(snapshot);
    });

    it('applies the cap and the expiry on the way in', () => {
      const before = [
        entry({ trackId: 'stale', lastPlayedAt: NOW - 91 * DAY }),
        entry({ trackId: 'a' }),
      ];

      const next = core.record(before, { ...entry(), trackId: 'b' }, NOW, {
        maxEntries: 2,
        expiryMs: 90 * DAY,
      });

      expect(next.map((e) => e.trackId)).toEqual(['b', 'a']);
    });
  });

  describe('the resume list', () => {
    it('offers what was started and not finished', () => {
      const entries = [
        entry({ trackId: 'started', progress: 40 }),
        entry({ trackId: 'finished', progress: 100, completed: true }),
        entry({ trackId: 'untouched', progress: 0 }),
      ];

      expect(core.resumeList(entries).map((e) => e.trackId)).toEqual(['started']);
    });

    it('is newest first', () => {
      const entries = [
        entry({ trackId: 'older', progress: 10, lastPlayedAt: NOW - 5000 }),
        entry({ trackId: 'newer', progress: 10, lastPlayedAt: NOW - 100 }),
      ];

      expect(core.resumeList(entries).map((e) => e.trackId)).toEqual(['newer', 'older']);
    });
  });

  describe('looking up and removing', () => {
    it('finds an entry', () => {
      expect(core.findEntry([entry({ trackId: 'a' })], 'a')?.trackId).toBe('a');
      expect(core.findEntry([entry({ trackId: 'a' })], 'b')).toBeNull();
    });

    it('removes one', () => {
      const entries = [entry({ trackId: 'a' }), entry({ trackId: 'b' })];

      expect(core.removeEntry(entries, 'a').map((e) => e.trackId)).toEqual(['b']);
    });

    it('leaves the list alone for an id it does not have', () => {
      const entries = [entry({ trackId: 'a' })];

      expect(core.removeEntry(entries, 'nope')).toEqual(entries);
    });
  });
});
