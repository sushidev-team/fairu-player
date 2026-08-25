import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { readStored, removeStored, writeStored } from '@/utils/storage';
import {
  DEFAULT_HISTORY_LIMITS,
  findEntry,
  normalizeHistory,
  record,
  removeEntry,
  resumeList,
  type HistoryLimits,
  type PlaybackHistoryEntry,
  type PlaybackRecord,
} from '@/core/playbackHistory';

const DEFAULT_KEY = 'playback-history';
const EMPTY: PlaybackHistoryEntry[] = [];

export interface PlaybackHistoryConfig {
  /** Default `true`. When off, nothing is read and nothing is written. */
  enabled?: boolean;
  maxEntries?: number;
  expiryDays?: number;
  /** Storage key, within the package's namespace. */
  storageKey?: string;
}

export interface UsePlaybackHistoryReturn {
  /** Everything remembered, newest first. */
  entries: PlaybackHistoryEntry[];
  /** Started and not finished — what a "continue watching" row shows. */
  resumable: PlaybackHistoryEntry[];
  count: number;
  recordPlay: (played: PlaybackRecord) => void;
  isPlayed: (trackId: string) => boolean;
  getEntry: (trackId: string) => PlaybackHistoryEntry | null;
  remove: (trackId: string) => void;
  clear: () => void;
}

/* -------------------------------------------------------------------------- */

/**
 * One store per storage key, shared by every hook instance.
 *
 * The version this was ported from held only a `count` in state and re-read
 * storage on every call. Two components then disagreed: a "continue watching"
 * row never heard about a play the player next to it had just recorded, because
 * nothing told React the list had changed. A store with subscribers is what
 * makes both of them see the same history — and it turns `isPlayed` from a
 * parse of the whole list into a lookup.
 */
interface HistoryStore {
  getEntries: () => PlaybackHistoryEntry[];
  subscribe: (listener: () => void) => () => void;
  update: (next: (current: PlaybackHistoryEntry[]) => PlaybackHistoryEntry[]) => void;
  clear: () => void;
  refresh: () => void;
}

const stores = new Map<string, HistoryStore>();

function getStore(storageKey: string, limits: HistoryLimits): HistoryStore {
  const existing = stores.get(storageKey);
  if (existing) return existing;

  let entries = normalizeHistory(readStored(storageKey), Date.now(), limits);
  const listeners = new Set<() => void>();

  const publish = () => listeners.forEach((listener) => listener());

  const store: HistoryStore = {
    getEntries: () => entries,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(next) {
      entries = next(entries);
      writeStored(storageKey, entries);
      publish();
    },
    clear() {
      entries = EMPTY;
      removeStored(storageKey);
      publish();
    },
    refresh() {
      entries = normalizeHistory(readStored(storageKey), Date.now(), limits);
      publish();
    },
  };

  // Another tab writing the same key. Without this, a viewer with two tabs open
  // sees two different histories and the last one to write wins silently.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === `fairu-player:${storageKey}`) store.refresh();
    });
  }

  stores.set(storageKey, store);
  return store;
}

/** Test seam: drop the cached stores so a suite starts from storage again. */
export function resetPlaybackHistoryStores(): void {
  stores.clear();
}

/* -------------------------------------------------------------------------- */

/**
 * What was played, how far, and when.
 *
 * The rules live in `@/core/playbackHistory`; the list itself lives in a store
 * shared by every instance, so a "continue watching" row and the player writing
 * to it stay in step.
 */
export function usePlaybackHistory(
  config: PlaybackHistoryConfig = {}
): UsePlaybackHistoryReturn {
  const {
    enabled = true,
    maxEntries = DEFAULT_HISTORY_LIMITS.maxEntries,
    expiryDays = DEFAULT_HISTORY_LIMITS.expiryMs / (24 * 60 * 60 * 1000),
    storageKey = DEFAULT_KEY,
  } = config;

  const limits = useMemo<HistoryLimits>(
    () => ({ maxEntries, expiryMs: expiryDays * 24 * 60 * 60 * 1000 }),
    [maxEntries, expiryDays]
  );

  const store = useMemo(() => getStore(storageKey, limits), [storageKey, limits]);

  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(listener),
    [store]
  );
  const getSnapshot = useCallback(() => store.getEntries(), [store]);
  const getServerSnapshot = useCallback(() => EMPTY, []);

  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const entries = enabled ? stored : EMPTY;

  const recordPlay = useCallback(
    (played: PlaybackRecord) => {
      if (!enabled) return;
      store.update((current) => record(current, played, Date.now(), limits));
    },
    [enabled, store, limits]
  );

  const remove = useCallback(
    (trackId: string) => {
      if (!enabled) return;
      store.update((current) => removeEntry(current, trackId));
    },
    [enabled, store]
  );

  const clear = useCallback(() => {
    // Deliberately not gated on `enabled`: forgetting is the one thing a viewer
    // must always be able to do, whatever the host has switched off.
    store.clear();
  }, [store]);

  return useMemo(
    () => ({
      entries,
      resumable: resumeList(entries),
      count: entries.length,
      recordPlay,
      isPlayed: (trackId: string) => findEntry(entries, trackId) !== null,
      getEntry: (trackId: string) => findEntry(entries, trackId),
      remove,
      clear,
    }),
    [entries, recordPlay, remove, clear]
  );
}
