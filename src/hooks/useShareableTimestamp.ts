import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Format seconds into a human-readable timestamp string.
 * Examples: 90 → "1m30s", 3661 → "1h1m1s", 45 → "45s"
 */
export function formatTimestamp(seconds: number): string {
  const s = Math.floor(seconds);
  if (s <= 0) return '0s';

  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  let result = '';
  if (hours > 0) result += `${hours}h`;
  if (minutes > 0) result += `${minutes}m`;
  if (secs > 0 || result === '') result += `${secs}s`;
  return result;
}

/**
 * Parse a timestamp string back to seconds.
 * Supports: "1h2m3s", "1m30s", "90" (plain seconds), "45s", "1:30", "1:02:03"
 */
export function parseTimestamp(timestamp: string): number | null {
  if (!timestamp) return null;

  // Try plain number (seconds)
  const plainNum = Number(timestamp);
  if (!isNaN(plainNum) && plainNum >= 0) return plainNum;

  // Try "XhYmZs" format
  const hmsMatch = timestamp.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (hmsMatch && (hmsMatch[1] || hmsMatch[2] || hmsMatch[3])) {
    const h = parseInt(hmsMatch[1] || '0');
    const m = parseInt(hmsMatch[2] || '0');
    const s = parseInt(hmsMatch[3] || '0');
    return h * 3600 + m * 60 + s;
  }

  // Try "H:MM:SS" or "MM:SS" format
  const colonParts = timestamp.split(':').map(Number);
  if (colonParts.length === 2 && colonParts.every((n) => !isNaN(n))) {
    return colonParts[0] * 60 + colonParts[1];
  }
  if (colonParts.length === 3 && colonParts.every((n) => !isNaN(n))) {
    return colonParts[0] * 3600 + colonParts[1] * 60 + colonParts[2];
  }

  return null;
}

export interface UseShareableTimestampOptions {
  /** Current playback time in seconds */
  currentTime: number;
  /** Seek function to jump to a time */
  onSeek?: (time: number) => void;
  /** Whether to auto-parse the URL on mount and seek. Default: true */
  parseOnMount?: boolean;
  /** The URL parameter name for the timestamp. Default: 't' */
  paramName?: string;
  /** Called when a timestamp is parsed from the URL */
  onTimestampParsed?: (time: number) => void;
}

export interface UseShareableTimestampReturn {
  /** Generate a shareable URL with the current time (or a specific time) */
  getShareUrl: (time?: number) => string;
  /** Copy the share URL to clipboard. Returns true if successful. */
  copyShareUrl: (time?: number) => Promise<boolean>;
  /** Whether a timestamp was found in the current URL */
  hasUrlTimestamp: boolean;
  /** The timestamp parsed from the URL (null if none) */
  urlTimestamp: number | null;
}

export function useShareableTimestamp({
  currentTime,
  onSeek,
  parseOnMount = true,
  paramName = 't',
  onTimestampParsed,
}: UseShareableTimestampOptions): UseShareableTimestampReturn {
  const [urlTimestamp, setUrlTimestamp] = useState<number | null>(null);
  const [hasUrlTimestamp, setHasUrlTimestamp] = useState(false);
  const parsedRef = useRef(false);

  // Parse URL timestamp on mount
  useEffect(() => {
    if (!parseOnMount || parsedRef.current) return;
    if (typeof window === 'undefined') return;

    parsedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const raw = params.get(paramName);
    if (!raw) return;

    const parsed = parseTimestamp(raw);
    if (parsed !== null && parsed >= 0) {
      setUrlTimestamp(parsed);
      setHasUrlTimestamp(true);
      onSeek?.(parsed);
      onTimestampParsed?.(parsed);
    }
  }, [parseOnMount, paramName, onSeek, onTimestampParsed]);

  const getShareUrl = useCallback(
    (time?: number): string => {
      if (typeof window === 'undefined') return '';

      const url = new URL(window.location.href);
      const t = time ?? currentTime;
      url.searchParams.set(paramName, formatTimestamp(t));
      return url.toString();
    },
    [currentTime, paramName]
  );

  const copyShareUrl = useCallback(
    async (time?: number): Promise<boolean> => {
      try {
        const url = getShareUrl(time);
        if (!url) return false;
        await navigator.clipboard.writeText(url);
        return true;
      } catch {
        return false;
      }
    },
    [getShareUrl]
  );

  return {
    getShareUrl,
    copyShareUrl,
    hasUrlTimestamp,
    urlTimestamp,
  };
}
