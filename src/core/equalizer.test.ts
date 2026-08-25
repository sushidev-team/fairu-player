/**
 * The equaliser's data side, without an audio graph.
 */

import { describe, it, expect } from 'vitest';
import * as core from './equalizer';

describe('equalizer core', () => {
  describe('gains', () => {
    it('keeps a usable value', () => {
      expect(core.clampGain(4)).toBe(4);
      expect(core.clampGain(-7.5)).toBe(-7.5);
    });

    it('clamps past the range', () => {
      // Beyond ±12 dB a five-band EQ mostly produces clipping, not tone.
      expect(core.clampGain(40)).toBe(12);
      expect(core.clampGain(-40)).toBe(-12);
    });

    it('falls back to flat for a value that is not a number', () => {
      // Infinity in a gain means corrupt data, not "as loud as possible" —
      // clamping it to the maximum would honour an intent nobody had.
      expect(core.clampGain(Number.NaN)).toBe(0);
      expect(core.clampGain(Number.POSITIVE_INFINITY)).toBe(0);
    });
  });

  describe('presets', () => {
    it('describes each band', () => {
      const bands = core.bandsForPreset('bass-boost');

      expect(bands).toHaveLength(core.DEFAULT_BANDS.length);
      expect(bands.map((b) => b.gain)).toEqual([6, 4, 0, 0, 0]);
      expect(bands[0].type).toBe('lowshelf');
    });

    it('falls back to flat for a name it does not know', () => {
      expect(core.bandsForPreset('nope').every((b) => b.gain === 0)).toBe(true);
    });

    it('recognises itself by value', () => {
      expect(core.matchPreset(core.bandsForPreset('podcast'))).toBe('podcast');
      expect(core.matchPreset(core.bandsForPreset('flat'))).toBe('flat');
    });

    it('stops claiming a preset once a band moves', () => {
      const nudged = core.setBandGain(core.bandsForPreset('podcast'), 2, 6);

      // A UI still saying "Podcast" would be lying about what is being heard.
      expect(core.matchPreset(nudged)).toBeNull();
    });
  });

  describe('setting a band', () => {
    it('changes one and leaves the rest', () => {
      const bands = core.setBandGain(core.DEFAULT_BANDS, 1, 5);

      expect(bands[1].gain).toBe(5);
      expect(bands[0].gain).toBe(0);
    });

    it('clamps what it is given', () => {
      expect(core.setBandGain(core.DEFAULT_BANDS, 0, 99)[0].gain).toBe(12);
    });

    it('ignores an index that is not there', () => {
      expect(core.setBandGain(core.DEFAULT_BANDS, 9, 5)).toEqual(core.DEFAULT_BANDS);
    });

    it('never mutates the bands it is given', () => {
      const before = core.bandsForPreset('music');
      const snapshot = JSON.stringify(before);

      core.setBandGain(before, 0, 9);

      expect(JSON.stringify(before)).toBe(snapshot);
    });
  });

  describe('what was stored', () => {
    it('reads a setting back', () => {
      const { bands, enabled } = core.normalizeStored({ gains: [1, 2, 3, 4, 5], enabled: true });

      expect(bands.map((b) => b.gain)).toEqual([1, 2, 3, 4, 5]);
      expect(enabled).toBe(true);
    });

    it('falls back to flat for anything unreadable', () => {
      for (const value of [null, undefined, 'flat', { gains: 'loud' }]) {
        const { bands, enabled } = core.normalizeStored(value);
        expect(bands.every((b) => b.gain === 0)).toBe(true);
        expect(enabled).toBe(false);
      }
    });

    it('repairs a single bad gain', () => {
      const { bands } = core.normalizeStored({ gains: [1, 'loud', 99, null, 2] });

      expect(bands.map((b) => b.gain)).toEqual([1, 0, 12, 0, 2]);
    });

    it('survives a stored setting with too few bands', () => {
      const { bands } = core.normalizeStored({ gains: [3] });

      expect(bands).toHaveLength(5);
      expect(bands.map((b) => b.gain)).toEqual([3, 0, 0, 0, 0]);
    });

    it('round-trips', () => {
      const bands = core.bandsForPreset('voice-boost');

      expect(core.normalizeStored(core.toStored(bands, true)).bands).toEqual(bands);
    });
  });
});
