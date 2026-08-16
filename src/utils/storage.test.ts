import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isStorageAvailable,
  resetStorageAvailability,
  readStored,
  writeStored,
  removeStored,
  clearStored,
} from './storage';

const NS = 'fairu-player:';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetStorageAvailability();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('round trip', () => {
    it('writes and reads a value', () => {
      expect(writeStored('k', { a: 1 })).toBe(true);
      expect(readStored<{ a: number }>('k')).toEqual({ a: 1 });
    });

    it('namespaces keys so it cannot collide with the host page', () => {
      writeStored('volume', 0.5);
      expect(localStorage.getItem(`${NS}volume`)).not.toBeNull();
      expect(localStorage.getItem('volume')).toBeNull();
    });

    it('returns null for a key that was never written', () => {
      expect(readStored('nope')).toBeNull();
    });

    it('keeps local and session storage separate', () => {
      writeStored('k', 'local-value', 'local');
      writeStored('k', 'session-value', 'session');
      expect(readStored('k', { kind: 'local' })).toBe('local-value');
      expect(readStored('k', { kind: 'session' })).toBe('session-value');
    });

    it('round-trips falsy values without treating them as absent', () => {
      writeStored('zero', 0);
      writeStored('false', false);
      writeStored('empty', '');
      expect(readStored('zero')).toBe(0);
      expect(readStored('false')).toBe(false);
      expect(readStored('empty')).toBe('');
    });
  });

  describe('expiry', () => {
    it('drops entries older than maxAge', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1_000);
      writeStored('k', 'stale');

      vi.spyOn(Date, 'now').mockReturnValue(1_000 + 60_000);
      expect(readStored('k', { maxAge: 30_000 })).toBeNull();
      // The expired entry is evicted rather than left to rot.
      expect(localStorage.getItem(`${NS}k`)).toBeNull();
    });

    it('keeps entries within maxAge', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1_000);
      writeStored('k', 'fresh');

      vi.spyOn(Date, 'now').mockReturnValue(1_000 + 10_000);
      expect(readStored('k', { maxAge: 30_000 })).toBe('fresh');
    });

    it('ignores age when no maxAge is given', () => {
      vi.spyOn(Date, 'now').mockReturnValue(0);
      writeStored('k', 'ancient');
      vi.spyOn(Date, 'now').mockReturnValue(10 ** 12);
      expect(readStored('k')).toBe('ancient');
    });
  });

  describe('corrupt and foreign data', () => {
    it('returns null and self-heals on unparseable JSON', () => {
      localStorage.setItem(`${NS}k`, '{not json');
      expect(readStored('k')).toBeNull();
      expect(localStorage.getItem(`${NS}k`)).toBeNull();
    });

    it('rejects an entry written by an incompatible schema version', () => {
      localStorage.setItem(`${NS}k`, JSON.stringify({ v: 999, t: Date.now(), d: 'x' }));
      expect(readStored('k')).toBeNull();
    });

    it('rejects a bare value that is not an envelope', () => {
      localStorage.setItem(`${NS}k`, JSON.stringify('just a string'));
      expect(readStored('k')).toBeNull();
    });
  });

  describe('removal', () => {
    it('removes a single key', () => {
      writeStored('a', 1);
      writeStored('b', 2);
      removeStored('a');
      expect(readStored('a')).toBeNull();
      expect(readStored('b')).toBe(2);
    });

    it('clearStored removes only player-owned keys', () => {
      writeStored('mine', 1);
      localStorage.setItem('host-page-key', 'do not touch');

      clearStored();

      expect(readStored('mine')).toBeNull();
      expect(localStorage.getItem('host-page-key')).toBe('do not touch');
    });
  });

  describe('hostile environments', () => {
    it('reports unavailable and degrades quietly when setItem throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });

      expect(isStorageAvailable()).toBe(false);
      // The write fails, but it must not throw at the call site.
      expect(() => writeStored('k', 1)).not.toThrow();
      expect(writeStored('k', 1)).toBe(false);
    });

    it('does not throw when getItem throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
      expect(() => readStored('k')).not.toThrow();
      expect(readStored('k')).toBeNull();
    });

    it('caches the availability probe rather than re-running it', () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      isStorageAvailable();
      const afterFirst = setItem.mock.calls.length;
      isStorageAvailable();
      isStorageAvailable();
      expect(setItem.mock.calls.length).toBe(afterFirst);
    });

    it('evicts its oldest entry and retries once on a quota error', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1_000);
      writeStored('old', 'x');
      vi.spyOn(Date, 'now').mockReturnValue(2_000);
      writeStored('newer', 'y');

      const real = Storage.prototype.setItem;
      let failed = false;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
        this: Storage,
        key: string,
        value: string
      ) {
        if (!failed) {
          failed = true;
          throw new DOMException('quota', 'QuotaExceededError');
        }
        real.call(this, key, value);
      });

      expect(writeStored('another', 'z')).toBe(true);
      // The oldest player-owned entry was evicted to make room; the newer one
      // and the value that triggered the retry both survive.
      expect(localStorage.getItem(`${NS}old`)).toBeNull();
      expect(readStored('newer')).toBe('y');
      expect(readStored('another')).toBe('z');
    });

    it('does not evict anything when the value cannot be serialised', () => {
      // A cyclic value throws in JSON.stringify, which used to land in the
      // quota-recovery path: it evicted a stored entry and then failed anyway,
      // destroying unrelated data over a caller's bad argument.
      vi.spyOn(Date, 'now').mockReturnValue(1_000);
      writeStored('keep-me', 'x');

      const cyclic: Record<string, unknown> = {};
      cyclic.self = cyclic;

      expect(writeStored('bad', cyclic)).toBe(false);
      expect(readStored('keep-me')).toBe('x');
    });

    it('does not evict anything when the write fails for a non-quota reason', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1_000);
      writeStored('keep-me', 'x');

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

      expect(writeStored('other', 'y')).toBe(false);
      // Pruning cannot fix a blocked origin, so nothing should have been lost.
      expect(localStorage.getItem(`${NS}keep-me`)).not.toBeNull();
    });

    it('recognises the Firefox spelling of a quota failure', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1_000);
      writeStored('old', 'x');

      const real = Storage.prototype.setItem;
      let failed = false;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
        this: Storage,
        key: string,
        value: string
      ) {
        if (!failed) {
          failed = true;
          throw new DOMException('full', 'NS_ERROR_DOM_QUOTA_REACHED');
        }
        real.call(this, key, value);
      });

      expect(writeStored('another', 'z')).toBe(true);
    });

    it('never evicts keys belonging to the host page', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1_000);
      writeStored('mine', 'x');
      localStorage.setItem('host-page-key', 'do not touch');

      const real = Storage.prototype.setItem;
      let failed = false;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
        this: Storage,
        key: string,
        value: string
      ) {
        if (!failed) {
          failed = true;
          throw new DOMException('quota', 'QuotaExceededError');
        }
        real.call(this, key, value);
      });

      writeStored('another', 'z');
      expect(localStorage.getItem('host-page-key')).toBe('do not touch');
    });
  });
});
