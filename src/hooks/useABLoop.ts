import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as core from '@/core/abLoop';

export interface ABLoopState {
  /** Point A, or `null` until it is set. */
  loopStart: number | null;
  /** Point B, or `null` until it is set. */
  loopEnd: number | null;
  /** Both points set and the span is non-empty. */
  isLooping: boolean;
}

export interface ABLoopControls {
  /** Mark point A — at `time`, or wherever the playhead is. */
  setA: (time?: number) => void;
  /** Mark point B. Marking it before A swaps the two. */
  setB: (time?: number) => void;
  clearLoop: () => void;
}

export interface UseABLoopOptions {
  /** The playhead, as the player reports it. */
  currentTime: number;
  /** Seek, from the player's controls. */
  onSeek: (time: number) => void;
  /** Default `true`. */
  enabled?: boolean;
}

export interface UseABLoopReturn {
  state: ABLoopState;
  controls: ABLoopControls;
}

/**
 * React binding over the A-B repeat rules.
 *
 * The rules live in `@/core/abLoop`; what is left here is React's share — hold
 * the two points, and turn "the playhead reached B" into a seek.
 *
 * @example
 * const { state, controls } = useABLoop({
 *   currentTime: player.state.currentTime,
 *   onSeek: player.controls.seek,
 * });
 */
export function useABLoop(options: UseABLoopOptions): UseABLoopReturn {
  const { currentTime, onSeek, enabled = true } = options;

  const [loop, setLoop] = useState<core.ABLoop>(core.noLoop);

  // Read through refs so `controls` keeps its identity. Both of these change on
  // every `timeupdate` — `currentTime` by definition, and `onSeek` because
  // callers pass an inline arrow — and controls that are rebuilt several times
  // a second defeat every memo a consumer puts around them.
  const currentTimeRef = useRef(currentTime);
  const onSeekRef = useRef(onSeek);
  useEffect(() => {
    currentTimeRef.current = currentTime;
    onSeekRef.current = onSeek;
  });

  /**
   * Whether a lap may still fire.
   *
   * Cleared after asking for a seek and restored once the playhead is observed
   * back inside the loop. Without it the seek would be requested again on every
   * `timeupdate` that still reads past B — the element does not move the instant
   * it is told to.
   */
  const armedRef = useRef(true);

  const setA = useCallback((time?: number) => {
    if (!enabled) return;
    setLoop((current) => core.setStart(current, time ?? currentTimeRef.current));
  }, [enabled]);

  const setB = useCallback((time?: number) => {
    if (!enabled) return;
    setLoop((current) => core.setEnd(current, time ?? currentTimeRef.current));
  }, [enabled]);

  const clearLoop = useCallback(() => {
    armedRef.current = true;
    setLoop(core.clear());
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const target = core.seekTarget(loop, currentTime);
    if (target === null) {
      armedRef.current = true;
      return;
    }

    if (!armedRef.current) return;
    armedRef.current = false;
    onSeekRef.current(target);
  }, [enabled, loop, currentTime]);

  const state = useMemo<ABLoopState>(
    () => ({
      loopStart: loop.start,
      loopEnd: loop.end,
      isLooping: core.isLooping(loop),
    }),
    [loop]
  );

  const controls = useMemo<ABLoopControls>(
    () => ({ setA, setB, clearLoop }),
    [setA, setB, clearLoop]
  );

  return { state, controls };
}
