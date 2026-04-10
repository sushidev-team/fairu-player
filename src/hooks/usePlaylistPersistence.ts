import { useState, useCallback, useEffect, useRef } from 'react';
import type { PlaylistPersistenceConfig, PlaylistPersistenceData, UsePlaylistPersistenceReturn } from '@/types/playlistPersistence';

const STORAGE_PREFIX = 'fairu_playlist_';

/**
 * Get the localStorage key for a given playlist ID
 */
function getStorageKey(playlistId: string): string {
  return `${STORAGE_PREFIX}${playlistId}`;
}

/**
 * Safely read from localStorage
 */
function readFromStorage(key: string): PlaylistPersistenceData | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const data: unknown = JSON.parse(raw);

    // Validate the shape of the data
    if (
      data !== null &&
      typeof data === 'object' &&
      'playlistId' in data &&
      'currentIndex' in data &&
      'shuffle' in data &&
      'repeat' in data &&
      'trackIds' in data &&
      'timestamp' in data &&
      typeof (data as PlaylistPersistenceData).playlistId === 'string' &&
      typeof (data as PlaylistPersistenceData).currentIndex === 'number' &&
      typeof (data as PlaylistPersistenceData).shuffle === 'boolean' &&
      typeof (data as PlaylistPersistenceData).repeat === 'string' &&
      Array.isArray((data as PlaylistPersistenceData).trackIds) &&
      typeof (data as PlaylistPersistenceData).timestamp === 'number'
    ) {
      return data as PlaylistPersistenceData;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Safely write to localStorage
 */
function writeToStorage(key: string, data: PlaylistPersistenceData): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage quota exceeded or other error - silently ignore
  }
}

/**
 * Safely remove from localStorage
 */
function removeFromStorage(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(key);
  } catch {
    // Silently ignore
  }
}

/**
 * Clean up expired playlist entries from localStorage
 */
function cleanupExpiredEntries(expiryDays: number): void {
  if (typeof window === 'undefined') return;

  try {
    const now = Date.now();
    const expiryMs = expiryDays * 24 * 60 * 60 * 1000;
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;

      const data = readFromStorage(key);
      if (data && now - data.timestamp > expiryMs) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      removeFromStorage(key);
    }
  } catch {
    // Silently ignore
  }
}

/**
 * Hook that persists and restores playlist state using localStorage.
 * Allows users to resume a playlist from where they left off, including
 * track index, shuffle, and repeat mode.
 */
export function usePlaylistPersistence(config: PlaylistPersistenceConfig): UsePlaylistPersistenceReturn {
  const {
    playlistId,
    enabled = true,
    expiryDays = 30,
    saveDebounce = 1000,
  } = config;

  const [hasSavedState, setHasSavedState] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for existing saved state on mount
  useEffect(() => {
    if (!enabled) return;

    const data = readFromStorage(getStorageKey(playlistId));
    setHasSavedState(data !== null && data.playlistId === playlistId);

    // Clean up expired entries periodically
    cleanupExpiredEntries(expiryDays);
  }, [playlistId, enabled, expiryDays]);

  const restore = useCallback((): PlaylistPersistenceData | null => {
    if (!enabled) return null;

    const data = readFromStorage(getStorageKey(playlistId));
    if (data && data.playlistId === playlistId) {
      return data;
    }

    return null;
  }, [playlistId, enabled]);

  const save = useCallback((data: Omit<PlaylistPersistenceData, 'playlistId' | 'timestamp'>) => {
    if (!enabled) return;

    // Debounce saves
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const fullData: PlaylistPersistenceData = {
        ...data,
        playlistId,
        timestamp: Date.now(),
      };
      writeToStorage(getStorageKey(playlistId), fullData);
      setHasSavedState(true);
    }, saveDebounce);
  }, [playlistId, enabled, saveDebounce]);

  const clear = useCallback(() => {
    removeFromStorage(getStorageKey(playlistId));
    setHasSavedState(false);
  }, [playlistId]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    restore,
    save,
    clear,
    hasSavedState,
  };
}
