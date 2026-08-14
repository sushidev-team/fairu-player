/**
 * Namespaced, failure-tolerant wrapper around Web Storage.
 *
 * Every call site in the player runs in environments where storage is not a
 * given: server-side rendering has no `window`, Safari's private mode used to
 * throw on `setItem`, cross-origin iframes (which is how the embed ships) can
 * have storage blocked outright by the parent, and a full quota throws
 * `QuotaExceededError` on write. None of those are player errors and none of
 * them should ever surface to a viewer — a player that cannot remember the
 * volume must still play.
 *
 * So: every operation is wrapped, every failure degrades to "no persistence",
 * and availability is probed once and cached.
 */

const NAMESPACE = 'fairu-player';

/** Bumped when a stored shape changes incompatibly; older entries are dropped. */
const SCHEMA_VERSION = 1;

export interface StoredEnvelope<T> {
  /** Schema version the value was written with. */
  v: number;
  /** Epoch milliseconds at write time. */
  t: number;
  /** The payload. */
  d: T;
}

export type StorageKind = 'local' | 'session';

let availability: Partial<Record<StorageKind, boolean>> = {};

function getBackend(kind: StorageKind): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    // Accessing the property itself throws when storage is blocked by policy.
    return null;
  }
}

/**
 * Whether storage can actually be written to.
 *
 * A read-only probe is not enough: blocked and quota-exhausted storage both
 * read fine and only fail on write, so this does a real round trip once and
 * caches the answer.
 */
export function isStorageAvailable(kind: StorageKind = 'local'): boolean {
  const cached = availability[kind];
  if (cached !== undefined) return cached;

  const backend = getBackend(kind);
  if (!backend) {
    availability[kind] = false;
    return false;
  }

  const probe = `${NAMESPACE}:__probe__`;
  try {
    backend.setItem(probe, '1');
    backend.removeItem(probe);
    availability[kind] = true;
  } catch {
    availability[kind] = false;
  }
  return availability[kind]!;
}

/** Test seam: forget the cached probe result. */
export function resetStorageAvailability(): void {
  availability = {};
}

function namespaced(key: string): string {
  return `${NAMESPACE}:${key}`;
}

export interface ReadOptions {
  kind?: StorageKind;
  /**
   * Maximum age in milliseconds. Entries older than this are treated as absent
   * and removed on read.
   */
  maxAge?: number;
}

/**
 * Read a value, or `null` if absent, unreadable, expired or written by an
 * incompatible schema version.
 */
export function readStored<T>(key: string, options: ReadOptions = {}): T | null {
  const { kind = 'local', maxAge } = options;
  const backend = getBackend(kind);
  if (!backend) return null;

  let raw: string | null;
  try {
    raw = backend.getItem(namespaced(key));
  } catch {
    return null;
  }
  if (raw === null) return null;

  let envelope: StoredEnvelope<T>;
  try {
    envelope = JSON.parse(raw) as StoredEnvelope<T>;
  } catch {
    // Corrupt entry — clear it so it cannot keep failing forever.
    removeStored(key, kind);
    return null;
  }

  if (typeof envelope !== 'object' || envelope === null || envelope.v !== SCHEMA_VERSION) {
    removeStored(key, kind);
    return null;
  }

  if (maxAge !== undefined && typeof envelope.t === 'number' && Date.now() - envelope.t > maxAge) {
    removeStored(key, kind);
    return null;
  }

  return envelope.d;
}

/**
 * Write a value. Returns whether it was persisted, so callers that care can
 * tell "saved" from "silently dropped" — but ignoring the result is fine and
 * is what most call sites do.
 */
export function writeStored<T>(key: string, value: T, kind: StorageKind = 'local'): boolean {
  const backend = getBackend(kind);
  if (!backend) return false;

  const envelope: StoredEnvelope<T> = { v: SCHEMA_VERSION, t: Date.now(), d: value };

  try {
    backend.setItem(namespaced(key), JSON.stringify(envelope));
    return true;
  } catch {
    // Almost always QuotaExceededError. Drop our own older entries and retry
    // once — a player's preferences are small, so if this still fails the page
    // is out of storage for reasons we cannot fix.
    try {
      pruneOldest(backend, 1);
      backend.setItem(namespaced(key), JSON.stringify(envelope));
      return true;
    } catch {
      return false;
    }
  }
}

export function removeStored(key: string, kind: StorageKind = 'local'): void {
  const backend = getBackend(kind);
  if (!backend) return;
  try {
    backend.removeItem(namespaced(key));
  } catch {
    // Nothing sensible to do.
  }
}

/** Remove every entry this player owns. Used by "forget me" style controls. */
export function clearStored(kind: StorageKind = 'local'): void {
  const backend = getBackend(kind);
  if (!backend) return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < backend.length; i++) {
      const key = backend.key(i);
      if (key?.startsWith(`${NAMESPACE}:`)) doomed.push(key);
    }
    doomed.forEach((key) => backend.removeItem(key));
  } catch {
    // Nothing sensible to do.
  }
}

/**
 * Evict the `count` oldest player-owned entries.
 *
 * Only ever touches keys under our namespace — the host page's storage is not
 * ours to reclaim, however tempting it is when we are the ones out of quota.
 */
function pruneOldest(backend: Storage, count: number): void {
  const entries: Array<{ key: string; t: number }> = [];

  for (let i = 0; i < backend.length; i++) {
    const key = backend.key(i);
    if (!key?.startsWith(`${NAMESPACE}:`)) continue;
    try {
      const parsed = JSON.parse(backend.getItem(key) ?? '') as StoredEnvelope<unknown>;
      entries.push({ key, t: typeof parsed?.t === 'number' ? parsed.t : 0 });
    } catch {
      // Unparseable entries are the best thing to evict first.
      entries.push({ key, t: 0 });
    }
  }

  entries
    .sort((a, b) => a.t - b.t)
    .slice(0, count)
    .forEach((entry) => backend.removeItem(entry.key));
}
