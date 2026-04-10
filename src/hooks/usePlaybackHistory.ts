import { useState, useCallback, useEffect } from 'react';
import type { PlaybackHistoryEntry, PlaybackHistoryConfig, UsePlaybackHistoryReturn } from '@/types/history';

const DEFAULT_STORAGE_KEY = 'fairu_history';
const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_EXPIRY_DAYS = 90;

function readHistory(storageKey: string): PlaybackHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data as PlaybackHistoryEntry[];
  } catch {
    return [];
  }
}

function writeHistory(storageKey: string, entries: PlaybackHistoryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(entries));
  } catch {
    // Storage quota exceeded - silently ignore
  }
}

function cleanupExpired(entries: PlaybackHistoryEntry[], expiryDays: number): PlaybackHistoryEntry[] {
  const expiryMs = expiryDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return entries.filter((e) => now - e.lastPlayedAt < expiryMs);
}

function enforceMaxEntries(entries: PlaybackHistoryEntry[], maxEntries: number): PlaybackHistoryEntry[] {
  if (entries.length <= maxEntries) return entries;
  // Sort by lastPlayedAt desc and trim
  return entries
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
    .slice(0, maxEntries);
}

export function usePlaybackHistory(config: PlaybackHistoryConfig = {}): UsePlaybackHistoryReturn {
  const {
    enabled = true,
    maxEntries = DEFAULT_MAX_ENTRIES,
    expiryDays = DEFAULT_EXPIRY_DAYS,
    storageKey = DEFAULT_STORAGE_KEY,
  } = config;

  const [count, setCount] = useState(0);

  // Initialize count on mount
  useEffect(() => {
    if (!enabled) return;
    const entries = readHistory(storageKey);
    const cleaned = cleanupExpired(entries, expiryDays);
    if (cleaned.length !== entries.length) {
      writeHistory(storageKey, cleaned);
    }
    setCount(cleaned.length);
  }, [enabled, storageKey, expiryDays]);

  const getHistory = useCallback((): PlaybackHistoryEntry[] => {
    if (!enabled) return [];
    return readHistory(storageKey)
      .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  }, [enabled, storageKey]);

  const getResumeList = useCallback((): PlaybackHistoryEntry[] => {
    if (!enabled) return [];
    return readHistory(storageKey)
      .filter((e) => !e.completed && e.progress > 0)
      .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  }, [enabled, storageKey]);

  const recordPlay = useCallback((
    entry: Omit<PlaybackHistoryEntry, 'lastPlayedAt' | 'playCount'>
  ) => {
    if (!enabled) return;

    let entries = readHistory(storageKey);
    const existingIndex = entries.findIndex((e) => e.trackId === entry.trackId);

    if (existingIndex >= 0) {
      // Update existing entry
      const existing = entries[existingIndex];
      entries[existingIndex] = {
        ...entry,
        lastPlayedAt: Date.now(),
        playCount: existing.playCount + 1,
      };
    } else {
      // Add new entry
      entries.push({
        ...entry,
        lastPlayedAt: Date.now(),
        playCount: 1,
      });
    }

    entries = cleanupExpired(entries, expiryDays);
    entries = enforceMaxEntries(entries, maxEntries);
    writeHistory(storageKey, entries);
    setCount(entries.length);
  }, [enabled, storageKey, expiryDays, maxEntries]);

  const isPlayed = useCallback((trackId: string): boolean => {
    if (!enabled) return false;
    return readHistory(storageKey).some((e) => e.trackId === trackId);
  }, [enabled, storageKey]);

  const getEntry = useCallback((trackId: string): PlaybackHistoryEntry | null => {
    if (!enabled) return null;
    return readHistory(storageKey).find((e) => e.trackId === trackId) ?? null;
  }, [enabled, storageKey]);

  const removeEntry = useCallback((trackId: string) => {
    if (!enabled) return;
    const entries = readHistory(storageKey).filter((e) => e.trackId !== trackId);
    writeHistory(storageKey, entries);
    setCount(entries.length);
  }, [enabled, storageKey]);

  const clearHistory = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Silently ignore
    }
    setCount(0);
  }, [storageKey]);

  return {
    getHistory,
    getResumeList,
    recordPlay,
    isPlayed,
    getEntry,
    removeEntry,
    clearHistory,
    count,
  };
}
