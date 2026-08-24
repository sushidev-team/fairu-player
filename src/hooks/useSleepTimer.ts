import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as core from '@/core/sleepTimer';
import type { SleepTimerMode, SleepTimerState } from '@/core/sleepTimer';

export interface UseSleepTimerOptions {
  /** The element to pause, and to fade if `fadeOut` is on. */
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  /** Playhead, needed only for `'endOfTrack'`. */
  currentTime?: number;
  /** Duration, needed only for `'endOfTrack'`. */
  duration?: number;
  /** Ease the volume down before pausing. Default `false`. */
  fadeOut?: boolean;
  /** Length of that fade, in seconds. Default `30`. */
  fadeOutDuration?: number;
  onTimerEnd?: () => void;
}

export interface UseSleepTimerReturn {
  state: {
    isActive: boolean;
    /** Seconds left, derived from the clock rather than counted. */
    remainingTime: number;
    selectedDuration: SleepTimerMode | null;
    isFadingOut: boolean;
  };
  controls: {
    startTimer: (mode: SleepTimerMode) => void;
    stopTimer: () => void;
    extendTimer: (minutes: number) => void;
  };
}

/**
 * Stop playback after a while.
 *
 * The rules live in `@/core/sleepTimer`, deadline-based rather than counted —
 * see the note there for why a `setInterval` is the one thing this feature must
 * not be built on.
 *
 * What is left here is React's share: re-render once a second so the countdown
 * moves, apply the fade, and pause when the deadline passes.
 */
export function useSleepTimer(options: UseSleepTimerOptions): UseSleepTimerReturn {
  const {
    mediaRef,
    currentTime = 0,
    duration = 0,
    fadeOut = false,
    fadeOutDuration = 30,
    onTimerEnd,
  } = options;

  const [timer, setTimer] = useState<SleepTimerState>(core.idleSleepTimer);
  /**
   * The clock, held in state.
   *
   * Reading `Date.now()` while rendering would make the same commit produce
   * different countdowns; the value has to enter through a state update like
   * any other external reading.
   */
  const [now, setNow] = useState(0);

  const media = useMemo(() => ({ currentTime, duration }), [currentTime, duration]);
  const active = core.isActive(timer);

  // Read by the tick, which must not be rebuilt several times a second.
  const timerRef = useRef(timer);
  const mediaRef2 = useRef(media);
  const onTimerEndRef = useRef(onTimerEnd);
  useEffect(() => {
    timerRef.current = timer;
    mediaRef2.current = media;
    onTimerEndRef.current = onTimerEnd;
  });

  /** The volume to come back to, captured before the fade starts. */
  const volumeBeforeFadeRef = useRef<number | null>(null);

  const restoreVolume = useCallback(() => {
    const element = mediaRef.current;
    if (element && volumeBeforeFadeRef.current !== null) {
      element.volume = volumeBeforeFadeRef.current;
    }
    volumeBeforeFadeRef.current = null;
  }, [mediaRef]);

  const startTimer = useCallback(
    (mode: SleepTimerMode) => {
      const at = Date.now();
      restoreVolume();
      setNow(at);
      setTimer(core.start(mode, at));
    },
    [restoreVolume]
  );

  const stopTimer = useCallback(() => {
    restoreVolume();
    setTimer(core.idleSleepTimer);
  }, [restoreVolume]);

  const extendTimer = useCallback(
    (minutes: number) => {
      const at = Date.now();
      // Outside the updater: React may run one of those more than once, and
      // restoring a volume twice is not the same as restoring it once.
      restoreVolume();
      setNow(at);
      setTimer((current) => core.extend(current, minutes, at, mediaRef2.current));
    },
    [restoreVolume]
  );

  /*
    One interval, and it owns both the countdown and the ending.

    The remaining time is derived from the clock, so a throttled or skipped tick
    costs a smooth countdown and nothing else. Expiry is checked here rather than
    in an effect because "time passed" is an external system reporting in — which
    is exactly the shape an effect is meant to subscribe to, not to be.
  */
  useEffect(() => {
    if (!active) return;

    const check = () => {
      const at = Date.now();
      setNow(at);

      if (!core.hasExpired(timerRef.current, at, mediaRef2.current)) return;

      mediaRef.current?.pause();
      restoreVolume();
      setTimer(core.idleSleepTimer);
      onTimerEndRef.current?.();
    };

    const id = setInterval(check, 1000);
    // A tab that was asleep can come back long past the deadline; waiting for
    // the next tick would leave it playing for up to another second.
    document.addEventListener('visibilitychange', check);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [active, mediaRef, restoreVolume]);

  const remaining = active ? core.remainingSeconds(timer, now, media) : 0;
  const isFadingOut = active && fadeOut && remaining < fadeOutDuration;

  // Apply the fade. In an effect, not while deriving state.
  useEffect(() => {
    const element = mediaRef.current;
    if (!element) return;

    if (!isFadingOut) {
      if (volumeBeforeFadeRef.current !== null) restoreVolume();
      return;
    }

    if (volumeBeforeFadeRef.current === null) {
      volumeBeforeFadeRef.current = element.volume;
    }
    element.volume = volumeBeforeFadeRef.current * core.fadeMultiplier(remaining, fadeOutDuration);
  }, [isFadingOut, remaining, fadeOutDuration, mediaRef, restoreVolume]);

  // Leave the volume as it was found.
  useEffect(
    () => () => {
      const element = mediaRef.current;
      if (element && volumeBeforeFadeRef.current !== null) {
        element.volume = volumeBeforeFadeRef.current;
      }
    },
    [mediaRef]
  );

  return useMemo(
    () => ({
      state: {
        isActive: active,
        remainingTime: remaining,
        selectedDuration: timer.mode,
        isFadingOut,
      },
      controls: { startTimer, stopTimer, extendTimer },
    }),
    [active, remaining, timer.mode, isFadingOut, startTimer, stopTimer, extendTimer]
  );
}
