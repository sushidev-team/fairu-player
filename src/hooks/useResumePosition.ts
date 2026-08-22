import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readStored, writeStored, removeStored } from '@/utils/storage';
import type { ResumeConfig, ResumePosition } from '@/types/persistence';

const RESUME_KEY = 'resume';

type ResumeMap = Record<string, ResumePosition>;

export interface UseResumePositionOptions extends ResumeConfig {
  /**
   * Identifier of the current track. Positions are keyed by this, so it has to
   * be stable across sessions — a track id, not an array index or a blob URL.
   * When absent, the hook is inert.
   */
  trackId?: string;
}

export interface UseResumePositionReturn {
  /**
   * Seconds to resume from, or `null` when there is nothing worth resuming
   * (never played, too early, or already finished).
   */
  resumeAt: number | null;
  /** The full stored record for the current track, if any. */
  entry: ResumePosition | null;
  /** Record a position. Throttled internally by `saveInterval`. */
  save: (position: number, duration?: number) => void;
  /** Mark the current track finished, clearing its resume point. */
  markCompleted: () => void;
  /** Forget the current track's position. */
  clear: () => void;
  /** Forget every remembered position. */
  clearAll: () => void;
  /** Whether the initial read has happened. */
  isHydrated: boolean;
}

function storageKey(scope?: string): string {
  return scope ? `${RESUME_KEY}:${scope}` : RESUME_KEY;
}

/**
 * Drop the oldest entries until the map is within `maxEntries`.
 */
function evict(map: ResumeMap, maxEntries: number): ResumeMap {
  const keys = Object.keys(map);
  if (keys.length <= maxEntries) return map;

  const kept = keys
    .sort((a, b) => (map[b].updatedAt ?? 0) - (map[a].updatedAt ?? 0))
    .slice(0, maxEntries);

  const next: ResumeMap = {};
  kept.forEach((key) => {
    next[key] = map[key];
  });
  return next;
}

/**
 * Remembers where playback stopped, per track.
 *
 * Positions for every track live in one stored map rather than a key each: it
 * keeps eviction possible (the oldest entries can only be found by comparing
 * them), and it means a library of hundreds of episodes costs one read instead
 * of one per episode.
 */
export function useResumePosition(
  options: UseResumePositionOptions = {}
): UseResumePositionReturn {
  const {
    trackId,
    enabled = true,
    scope,
    maxAge,
    minPosition = 10,
    completedThreshold = 0.95,
    saveInterval = 5000,
    maxEntries = 100,
  } = options;

  const key = storageKey(scope);
  const active = enabled && Boolean(trackId);

  const [map, setMap] = useState<ResumeMap>({});
  const [isHydrated, setIsHydrated] = useState(false);

  // Last write time, for throttling. A ref, not state: it must not re-render.
  const lastSaveRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setIsHydrated(true);
      return;
    }
    setMap(readStored<ResumeMap>(key, { maxAge }) ?? {});
    setIsHydrated(true);
  }, [enabled, key, maxAge]);

  const entry = useMemo<ResumePosition | null>(
    () => (trackId ? map[trackId] ?? null : null),
    [map, trackId]
  );

  const resumeAt = useMemo<number | null>(() => {
    if (!entry || entry.completed) return null;
    if (entry.position < minPosition) return null;
    return entry.position;
  }, [entry, minPosition]);

  const save = useCallback(
    (position: number, duration?: number) => {
      if (!active || !trackId) return;
      if (!Number.isFinite(position) || position < 0) return;

      const now = Date.now();
      const completed =
        duration !== undefined && duration > 0
          ? position / duration >= completedThreshold
          : false;

      // Throttle — but never drop the write that flips `completed`, which is a
      // one-shot state change rather than a running position.
      if (!completed && now - lastSaveRef.current < saveInterval) return;
      lastSaveRef.current = now;

      setMap((prev) => {
        const next: ResumeMap = {
          ...prev,
          [trackId]: {
            position,
            duration,
            updatedAt: now,
            completed,
          },
        };
        const trimmed = evict(next, maxEntries);
        if (enabled) writeStored(key, trimmed);
        return trimmed;
      });
    },
    [active, trackId, completedThreshold, saveInterval, maxEntries, enabled, key]
  );

  const markCompleted = useCallback(() => {
    if (!active || !trackId) return;
    setMap((prev) => {
      const existing = prev[trackId];
      const next: ResumeMap = {
        ...prev,
        [trackId]: {
          position: existing?.position ?? 0,
          duration: existing?.duration,
          updatedAt: Date.now(),
          completed: true,
        },
      };
      if (enabled) writeStored(key, next);
      return next;
    });
  }, [active, trackId, enabled, key]);

  const clear = useCallback(() => {
    if (!trackId) return;
    setMap((prev) => {
      if (!(trackId in prev)) return prev;
      const next = { ...prev };
      delete next[trackId];
      if (enabled) writeStored(key, next);
      return next;
    });
  }, [trackId, enabled, key]);

  const clearAll = useCallback(() => {
    removeStored(key);
    setMap({});
  }, [key]);

  return { resumeAt, entry, save, markCompleted, clear, clearAll, isHydrated };
}
