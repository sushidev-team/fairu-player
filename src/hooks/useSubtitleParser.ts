import { useState, useEffect, useCallback, useRef } from 'react';

export interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface UseSubtitleParserOptions {
  /** URL to the subtitle file (VTT) */
  src?: string;
  /** Current playback time */
  currentTime: number;
  /** Whether subtitle display is enabled */
  enabled?: boolean;
}

export interface UseSubtitleParserReturn {
  /** Currently active cue text (null if no cue active) */
  activeCue: string | null;
  /** All parsed cues */
  cues: SubtitleCue[];
  /** Whether the file is loaded */
  isLoaded: boolean;
  /** Error if parsing failed */
  error: Error | null;
}

function parseVTTTimestamp(ts: string): number {
  const parts = ts.trim().split(':');
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(parts[0]);
}

export function parseVTTCues(vttContent: string): SubtitleCue[] {
  if (!vttContent || !vttContent.trim()) {
    return [];
  }

  const lines = vttContent.replace(/\r\n/g, '\n').split('\n');
  const cues: SubtitleCue[] = [];
  let i = 0;

  // Skip WEBVTT header and any metadata
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }

  if (i >= lines.length) {
    return [];
  }

  // Back up to check for cue ID
  let cueIndex = 0;

  while (i < lines.length) {
    // Skip empty lines
    if (!lines[i].trim()) {
      i++;
      continue;
    }

    // Check if this line is a timestamp line
    if (lines[i].includes('-->')) {
      const timestampLine = lines[i];
      const [startStr, endStr] = timestampLine.split('-->').map((s) => s.trim());
      const startTime = parseVTTTimestamp(startStr);
      const endTime = parseVTTTimestamp(endStr);

      // Check if the line before the timestamp was a cue ID
      let id: string;
      const prevLine = i > 0 ? lines[i - 1].trim() : '';
      if (prevLine && !prevLine.includes('-->') && prevLine !== 'WEBVTT') {
        id = prevLine;
      } else {
        id = `cue-${cueIndex}`;
      }

      i++;

      // Collect cue text lines
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim());
        i++;
      }

      const text = textLines
        .join('\n')
        .replace(/<[^>]+>/g, ''); // Strip HTML tags

      if (text) {
        cues.push({ id, startTime, endTime, text });
      }

      cueIndex++;
    } else {
      i++;
    }
  }

  return cues;
}

export function useSubtitleParser(options: UseSubtitleParserOptions): UseSubtitleParserReturn {
  const { src, currentTime, enabled = true } = options;
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const prevSrcRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !src) {
      setCues([]);
      setIsLoaded(false);
      setError(null);
      return;
    }

    // Don't refetch if src hasn't changed
    if (src === prevSrcRef.current && isLoaded) {
      return;
    }

    let cancelled = false;
    prevSrcRef.current = src;

    setIsLoaded(false);
    setError(null);

    fetch(src)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch subtitle file: ${response.status} ${response.statusText}`);
        }
        return response.text();
      })
      .then((text) => {
        if (!cancelled) {
          const parsedCues = parseVTTCues(text);
          setCues(parsedCues);
          setIsLoaded(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setCues([]);
          setIsLoaded(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [src, enabled]);

  const activeCue = useCallback((): string | null => {
    if (!enabled || cues.length === 0) {
      return null;
    }

    const active = cues.find(
      (cue) => currentTime >= cue.startTime && currentTime < cue.endTime
    );

    return active?.text ?? null;
  }, [enabled, cues, currentTime]);

  return {
    activeCue: activeCue(),
    cues,
    isLoaded,
    error,
  };
}
