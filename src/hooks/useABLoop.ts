import { useState, useCallback, useEffect, useRef } from 'react';

export interface ABLoopState {
  /** Start time of the loop (point A), null if not set */
  loopStart: number | null;
  /** End time of the loop (point B), null if not set */
  loopEnd: number | null;
  /** Whether a complete loop is active (both A and B set) */
  isLooping: boolean;
}

export interface ABLoopControls {
  /** Set point A at the given time (or current time if not provided) */
  setA: (time?: number) => void;
  /** Set point B at the given time (or current time if not provided). If B < A, swap them. */
  setB: (time?: number) => void;
  /** Clear both loop points */
  clearLoop: () => void;
}

export interface UseABLoopOptions {
  /** Current playback time - used to auto-seek back to A when reaching B */
  currentTime: number;
  /** Seek function from the media controls */
  onSeek: (time: number) => void;
  /** Whether the hook is enabled. Default: true */
  enabled?: boolean;
}

export interface UseABLoopReturn {
  state: ABLoopState;
  controls: ABLoopControls;
}

export function useABLoop(options: UseABLoopOptions): UseABLoopReturn {
  const { currentTime, onSeek, enabled = true } = options;

  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);

  const isLooping = loopStart !== null && loopEnd !== null;

  // Ref to track whether we just seeked, to avoid infinite re-seeks
  const justSeekedRef = useRef(false);

  const setA = useCallback((time?: number) => {
    if (!enabled) return;
    const t = time ?? currentTime;
    setLoopStart(t);
    // If B is already set and is less than the new A, swap them
    setLoopEnd((prevEnd) => {
      if (prevEnd !== null && prevEnd < t) {
        setLoopStart(prevEnd);
        return t;
      }
      return prevEnd;
    });
  }, [enabled, currentTime]);

  const setB = useCallback((time?: number) => {
    if (!enabled) return;
    const t = time ?? currentTime;
    setLoopEnd(t);
    // If A is already set and B < A, swap them
    setLoopStart((prevStart) => {
      if (prevStart !== null && t < prevStart) {
        setLoopEnd(prevStart);
        return t;
      }
      return prevStart;
    });
  }, [enabled, currentTime]);

  const clearLoop = useCallback(() => {
    setLoopStart(null);
    setLoopEnd(null);
    justSeekedRef.current = false;
  }, []);

  // Auto-seek back to A when currentTime reaches B
  useEffect(() => {
    if (!enabled || !isLooping || loopStart === null || loopEnd === null) return;

    if (justSeekedRef.current) {
      // After a seek, wait until the currentTime moves back below loopEnd - tolerance
      if (currentTime < loopEnd - 0.15) {
        justSeekedRef.current = false;
      }
      return;
    }

    if (currentTime >= loopEnd) {
      justSeekedRef.current = true;
      onSeek(loopStart);
    }
  }, [enabled, isLooping, currentTime, loopStart, loopEnd, onSeek]);

  return {
    state: {
      loopStart,
      loopEnd,
      isLooping,
    },
    controls: {
      setA,
      setB,
      clearLoop,
    },
  };
}
