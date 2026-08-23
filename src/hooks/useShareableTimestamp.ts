import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatTimestamp, parseTimestamp, withTimestamp } from '@/core/timestamp';

export interface UseShareableTimestampOptions {
  /** The playhead, as the player reports it. */
  currentTime: number;
  /**
   * Media duration. `0` until `loadedmetadata`.
   *
   * Required because the seek waits for it — see the note on the hook.
   */
  duration: number;
  /** Seek, from the player's controls. */
  onSeek?: (time: number) => void;
  /** Read the URL on mount and jump there. Default `true`. */
  seekOnMount?: boolean;
  /** Query parameter to use. Default `'t'`. */
  paramName?: string;
  /** Called once, with the time taken from the URL. */
  onTimestampParsed?: (time: number) => void;
}

export interface UseShareableTimestampReturn {
  /** A link to the current position, or to `time` if given. */
  getShareUrl: (time?: number) => string;
  /** Copy that link. `false` when the clipboard refused or is unavailable. */
  copyShareUrl: (time?: number) => Promise<boolean>;
  /** The time this page was opened at, or `null`. */
  urlTimestamp: number | null;
  /** Whether the URL carried a timestamp. */
  hasUrlTimestamp: boolean;
  /**
   * A timestamp is waiting for the media to report its duration.
   *
   * Derived rather than tracked: it is exactly "there is one, we are meant to
   * apply it, and we cannot yet". Use it for a "starting at 1:30…" label; to
   * hear about the seek itself, pass `onTimestampParsed`.
   */
  pendingSeek: boolean;
}

/**
 * Shareable timestamps — `?t=1m30s`.
 *
 * The format lives in `@/core/timestamp`; this is the part that reads the
 * address bar and drives the player.
 *
 * **The seek waits for the duration.** Seeking on mount does not work: the
 * player clamps a seek against the element's duration, and that is `0` until
 * `loadedmetadata` — so a `?t=1m30s` applied straight away lands at `0`, and
 * the feature silently does nothing. The version in PR #16 seeked on mount and
 * was never wired into a player, which is why nobody noticed. So the timestamp
 * is reported immediately — a UI can say "starting at 1:30" — and applied once
 * the media can accept it.
 */
export function useShareableTimestamp(
  options: UseShareableTimestampOptions
): UseShareableTimestampReturn {
  const {
    currentTime,
    duration,
    onSeek,
    seekOnMount = true,
    paramName = 't',
    onTimestampParsed,
  } = options;

  // Read once. The address bar can change under a single-page app, but the
  // timestamp is about how this page was *opened*.
  const [urlTimestamp] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const raw = new URLSearchParams(window.location.search).get(paramName);
    return raw === null ? null : parseTimestamp(raw);
  });

  // Read through refs: `currentTime` changes several times a second, and both
  // callbacks are inline arrows at every call site.
  const currentTimeRef = useRef(currentTime);
  const onSeekRef = useRef(onSeek);
  const onTimestampParsedRef = useRef(onTimestampParsed);
  useEffect(() => {
    currentTimeRef.current = currentTime;
    onSeekRef.current = onSeek;
    onTimestampParsedRef.current = onTimestampParsed;
  });

  const appliedRef = useRef(false);

  useEffect(() => {
    if (!seekOnMount || appliedRef.current) return;
    if (urlTimestamp === null) return;
    // The one thing this hook waits for.
    if (!(duration > 0)) return;

    appliedRef.current = true;
    // A link can outlive the cut it points into.
    const target = Math.min(urlTimestamp, duration);
    onSeekRef.current?.(target);
    onTimestampParsedRef.current?.(target);
  }, [seekOnMount, urlTimestamp, duration]);

  const getShareUrl = useCallback(
    (time?: number): string => {
      if (typeof window === 'undefined') return '';
      return withTimestamp(
        window.location.href,
        time ?? currentTimeRef.current,
        paramName
      );
    },
    [paramName]
  );

  const copyShareUrl = useCallback(
    async (time?: number): Promise<boolean> => {
      const url = getShareUrl(time);
      if (!url) return false;

      try {
        // Absent outside a secure context, which includes plenty of staging
        // setups — a caller that shows "copied!" needs to hear about that.
        await navigator.clipboard.writeText(url);
        return true;
      } catch {
        return false;
      }
    },
    [getShareUrl]
  );

  return useMemo(
    () => ({
      getShareUrl,
      copyShareUrl,
      urlTimestamp,
      hasUrlTimestamp: urlTimestamp !== null,
      pendingSeek: urlTimestamp !== null && seekOnMount && !(duration > 0),
    }),
    [getShareUrl, copyShareUrl, urlTimestamp, seekOnMount, duration]
  );
}

export { formatTimestamp, parseTimestamp };
