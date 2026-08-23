/**
 * The timestamp format, both directions.
 *
 * The parser reads a query parameter, so its input is whatever the sender felt
 * like typing. Most of what follows is about what it must *refuse* — the
 * version this was ported from accepted `Infinity`, and a non-finite seek
 * leaves a media element unplayable.
 */

import { describe, it, expect } from 'vitest';
import {
  formatTimestamp,
  parseTimestamp,
  timestampFrom,
  withTimestamp,
} from './timestamp';

describe('formatTimestamp', () => {
  it('writes the compact form', () => {
    expect(formatTimestamp(45)).toBe('45s');
    expect(formatTimestamp(90)).toBe('1m30s');
    expect(formatTimestamp(3661)).toBe('1h1m1s');
  });

  it('leaves out the parts that are zero', () => {
    expect(formatTimestamp(3600)).toBe('1h');
    expect(formatTimestamp(120)).toBe('2m');
    expect(formatTimestamp(3720)).toBe('1h2m');
  });

  it('drops sub-second precision', () => {
    // The value goes into a link somebody reads out loud.
    expect(formatTimestamp(90.7)).toBe('1m30s');
  });

  it('treats the start of the media as 0s', () => {
    expect(formatTimestamp(0)).toBe('0s');
    expect(formatTimestamp(-30)).toBe('0s');
  });

  it('refuses to write a nonsense number into a link', () => {
    expect(formatTimestamp(Number.NaN)).toBe('0s');
    expect(formatTimestamp(Number.POSITIVE_INFINITY)).toBe('0s');
  });
});

describe('parseTimestamp', () => {
  it('reads plain seconds', () => {
    expect(parseTimestamp('90')).toBe(90);
    expect(parseTimestamp('90.5')).toBe(90.5);
    expect(parseTimestamp('0')).toBe(0);
  });

  it('reads the compact form', () => {
    expect(parseTimestamp('45s')).toBe(45);
    expect(parseTimestamp('1m30s')).toBe(90);
    expect(parseTimestamp('1h2m3s')).toBe(3723);
    expect(parseTimestamp('1h')).toBe(3600);
    expect(parseTimestamp('2m')).toBe(120);
  });

  it('reads clock notation', () => {
    expect(parseTimestamp('1:30')).toBe(90);
    expect(parseTimestamp('1:02:03')).toBe(3723);
  });

  it('ignores surrounding whitespace', () => {
    expect(parseTimestamp('  1m30s  ')).toBe(90);
  });

  describe('refuses', () => {
    it('an empty or blank value', () => {
      expect(parseTimestamp('')).toBeNull();
      expect(parseTimestamp('   ')).toBeNull();
    });

    it('a run of digits long enough to overflow', () => {
      // Rejecting the literal string is not enough — `Number('9'.repeat(400))`
      // is `Infinity` too, and a caller clamping against the duration would
      // seek to the end of the media instead of ignoring the link.
      const huge = '9'.repeat(400);
      expect(parseTimestamp(huge)).toBeNull();
      expect(parseTimestamp(`${huge}s`)).toBeNull();
      expect(parseTimestamp(`1:${huge}`)).toBeNull();
      expect(parseTimestamp(`1:2:${huge}`)).toBeNull();
    });

    it('anything that is not finite', () => {
      // `Number('Infinity')` is a number, and it is greater than zero — which
      // is exactly how the original let it through.
      expect(parseTimestamp('Infinity')).toBeNull();
      expect(parseTimestamp('-Infinity')).toBeNull();
      expect(parseTimestamp('1e400')).toBeNull();
    });

    it('numbers written the exotic ways', () => {
      // All valid to `Number()`, none of them a timestamp.
      expect(parseTimestamp('0x10')).toBeNull();
      expect(parseTimestamp('1e3')).toBeNull();
    });

    it('a negative time', () => {
      expect(parseTimestamp('-30')).toBeNull();
      expect(parseTimestamp('1:-30')).toBeNull();
    });

    it('a malformed clock', () => {
      expect(parseTimestamp(':')).toBeNull();
      expect(parseTimestamp('1:')).toBeNull();
      expect(parseTimestamp('1:2:3:4')).toBeNull();
    });

    it('plain nonsense', () => {
      expect(parseTimestamp('soon')).toBeNull();
      expect(parseTimestamp('1m30')).toBeNull();
    });
  });

  it('round-trips whatever it wrote', () => {
    for (const seconds of [0, 7, 45, 90, 599, 3600, 3661, 7322]) {
      expect(parseTimestamp(formatTimestamp(seconds))).toBe(seconds);
    }
  });
});

describe('URLs', () => {
  it('adds the timestamp', () => {
    expect(withTimestamp('https://example.test/watch', 90)).toBe(
      'https://example.test/watch?t=1m30s'
    );
  });

  it('replaces one that is already there', () => {
    expect(withTimestamp('https://example.test/watch?t=10s', 90)).toBe(
      'https://example.test/watch?t=1m30s'
    );
  });

  it('leaves the other parameters alone', () => {
    expect(withTimestamp('https://example.test/watch?v=abc&list=xyz', 90)).toBe(
      'https://example.test/watch?v=abc&list=xyz&t=1m30s'
    );
  });

  it('honours a different parameter name', () => {
    expect(withTimestamp('https://example.test/w', 90, 'start')).toBe(
      'https://example.test/w?start=1m30s'
    );
  });

  it('reads the timestamp back', () => {
    expect(timestampFrom('https://example.test/watch?t=1m30s')).toBe(90);
    expect(timestampFrom('https://example.test/w?start=45s', 'start')).toBe(45);
  });

  it('reports nothing for a URL without one', () => {
    expect(timestampFrom('https://example.test/watch')).toBeNull();
  });

  it('reports nothing for one it cannot read', () => {
    expect(timestampFrom('https://example.test/watch?t=Infinity')).toBeNull();
  });
});
