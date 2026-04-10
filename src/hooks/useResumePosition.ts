import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResumeConfig, ResumeData, UseResumePositionReturn } from '@/types/resume';

const STORAGE_PREFIX = 'fairu_resume_';

/**
 * Get the localStorage key for a given track ID
 */
function getStorageKey(trackId: string): string {
  return `${STORAGE_PREFIX}${trackId}`;
}

/**
 * Safely read from localStorage
 */
function readFromStorage(key: string): ResumeData | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const data: unknown = JSON.parse(raw);

    // Validate the shape of the data
    if (
      data !== null &&
      typeof data === 'object' &&
      'position' in data &&
      'timestamp' in data &&
      'duration' in data &&
      'trackId' in data &&
      typeof (data as ResumeData).position === 'number' &&
      typeof (data as ResumeData).timestamp === 'number' &&
      typeof (data as ResumeData).duration === 'number' &&
      typeof (data as ResumeData).trackId === 'string'
    ) {
      return data as ResumeData;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Safely write to localStorage
 */
function writeToStorage(key: string, data: ResumeData): void {
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
 * Clean up expired resume entries from localStorage
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
 * Hook that persists and restores playback position using localStorage.
 * Allows users to resume playback from where they left off.
 */
export function useResumePosition(config: ResumeConfig): UseResumePositionReturn {
  const {
    trackId,
    mediaRef,
    enabled = true,
    threshold = 10,
    saveInterval = 5000,
    expiryDays = 30,
    onResume,
  } = config;

  const [savedPosition, setSavedPosition] = useState<number | null>(null);
  const hasResumedRef = useRef(false);
  const onResumeRef = useRef(onResume);
  onResumeRef.current = onResume;

  // Clear saved position for the current track
  const clearPosition = useCallback(() => {
    removeFromStorage(getStorageKey(trackId));
    setSavedPosition(null);
  }, [trackId]);

  // Save current position to localStorage
  const savePosition = useCallback(() => {
    const media = mediaRef.current;
    if (!media || !enabled) return;

    const currentTime = media.currentTime;
    const duration = media.duration;

    // Don't save if not enough has been played
    if (currentTime < threshold) return;

    // Don't save if duration is unknown
    if (!duration || !isFinite(duration)) return;

    // Don't save if past 95% (treat as completed)
    if (currentTime / duration >= 0.95) {
      removeFromStorage(getStorageKey(trackId));
      return;
    }

    const data: ResumeData = {
      position: currentTime,
      timestamp: Date.now(),
      duration,
      trackId,
    };

    writeToStorage(getStorageKey(trackId), data);
  }, [mediaRef, enabled, threshold, trackId]);

  // On mount: load saved position and clean up expired entries
  useEffect(() => {
    if (!enabled) return;

    const data = readFromStorage(getStorageKey(trackId));
    if (data && data.trackId === trackId) {
      // Don't resume past 95% of duration
      if (data.duration > 0 && data.position / data.duration >= 0.95) {
        removeFromStorage(getStorageKey(trackId));
        setSavedPosition(null);
      } else {
        setSavedPosition(data.position);
      }
    } else {
      setSavedPosition(null);
    }

    // Reset resume flag when track changes
    hasResumedRef.current = false;

    // Clean up expired entries periodically
    cleanupExpiredEntries(expiryDays);
  }, [trackId, enabled, expiryDays]);

  // Seek to saved position once media is ready
  useEffect(() => {
    if (!enabled || savedPosition === null || hasResumedRef.current) return;

    const media = mediaRef.current;
    if (!media) return;

    const handleCanPlay = () => {
      if (hasResumedRef.current) return;

      // Verify saved position is still valid
      if (media.duration && savedPosition / media.duration >= 0.95) {
        removeFromStorage(getStorageKey(trackId));
        setSavedPosition(null);
        return;
      }

      media.currentTime = savedPosition;
      hasResumedRef.current = true;
      onResumeRef.current?.(savedPosition);
    };

    // If media is already ready, seek immediately
    if (media.readyState >= 2) {
      handleCanPlay();
    } else {
      media.addEventListener('canplay', handleCanPlay, { once: true });
      return () => {
        media.removeEventListener('canplay', handleCanPlay);
      };
    }
  }, [savedPosition, enabled, mediaRef, trackId]);

  // Save position on interval during playback
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const media = mediaRef.current;
      if (media && !media.paused && !media.ended) {
        savePosition();
      }
    }, saveInterval);

    return () => clearInterval(interval);
  }, [enabled, saveInterval, savePosition, mediaRef]);

  // Clear position when playback completes
  useEffect(() => {
    if (!enabled) return;

    const media = mediaRef.current;
    if (!media) return;

    const handleEnded = () => {
      removeFromStorage(getStorageKey(trackId));
      setSavedPosition(null);
    };

    media.addEventListener('ended', handleEnded);
    return () => {
      media.removeEventListener('ended', handleEnded);
    };
  }, [enabled, trackId, mediaRef]);

  // Save position on unmount
  useEffect(() => {
    if (!enabled) return;

    return () => {
      savePosition();
    };
  }, [enabled, savePosition]);

  return {
    savedPosition,
    clearPosition,
    hasSavedPosition: savedPosition !== null,
  };
}
