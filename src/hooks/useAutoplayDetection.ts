import { useState, useEffect, useCallback, useRef } from 'react';

export interface AutoplayPolicy {
  /** Whether autoplay with sound is allowed */
  canAutoplay: boolean;
  /** Whether autoplay is allowed when muted */
  canAutoplayMuted: boolean;
  /** Whether detection has completed */
  detected: boolean;
  /** If autoplay was blocked, call this to attempt playing after user gesture */
  requestPlay: () => void;
}

export interface UseAutoplayDetectionOptions {
  /** Whether to run the detection. Default: true */
  enabled?: boolean;
  /** Callback when autoplay is blocked */
  onBlocked?: () => void;
  /** Callback when autoplay is allowed */
  onAllowed?: () => void;
}

// Minimal valid silent mp4 data URI for autoplay detection
const SILENT_VIDEO_SRC =
  'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhtZGF0AAAA1m1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAYdHJhawAAAFx0a2hkAAAAAwAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAABRG1kaWEAAAAgbWRoZAAAAAAAAAAAAAAAAAAAKAAAAAAAAFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAADvbWluZgAAABBzbWhkAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAACzc3RibAAAAGdzdHNkAAAAAAAAAAEAAABXbXA0YQAAAAAAAAABAAAAAAAAAAAAAgAQAAAAAKAAAAAAAAAAAAMYZXNkcwAAAAADgICAIgACAASAgIAUQBUAAAAAAfQAAAHz+QWAgIACEhAGgICAAQIAAAAYc3R0cwAAAAAAAAABAAAAAgAABAAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAIAAAABAAAAHHN0c3oAAAAAAAAAAAAAAAIAAAAaAAAAFgAAABRzdGNvAAAAAAAAAAEAAAAs';

/**
 * Hook that detects browser autoplay policy on mount.
 *
 * Creates a temporary video element (not attached to the DOM) and attempts
 * to play it — first with sound, then muted — to determine what the browser
 * allows.
 */
export function useAutoplayDetection(
  options: UseAutoplayDetectionOptions = {}
): AutoplayPolicy {
  const { enabled = true } = options;

  const [canAutoplay, setCanAutoplay] = useState(false);
  const [canAutoplayMuted, setCanAutoplayMuted] = useState(false);
  const [detected, setDetected] = useState(false);

  // Store callbacks in refs so the effect always calls the latest version
  const onBlockedRef = useRef(options.onBlocked);
  const onAllowedRef = useRef(options.onAllowed);
  onBlockedRef.current = options.onBlocked;
  onAllowedRef.current = options.onAllowed;

  const requestPlay = useCallback(() => {
    // No-op placeholder — consumers can replace this to trigger play after a user gesture
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === 'undefined') return;

    let cancelled = false;

    const detect = async () => {
      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.src = SILENT_VIDEO_SRC;

      try {
        // First try: autoplay with sound
        await video.play();

        if (!cancelled) {
          setCanAutoplay(true);
          setCanAutoplayMuted(true);
          setDetected(true);
          onAllowedRef.current?.();
        }
      } catch {
        // Autoplay with sound was blocked — try muted
        video.pause();
        video.muted = true;

        try {
          await video.play();

          if (!cancelled) {
            setCanAutoplay(false);
            setCanAutoplayMuted(true);
            setDetected(true);
            onBlockedRef.current?.();
          }
        } catch {
          // Both attempts failed
          if (!cancelled) {
            setCanAutoplay(false);
            setCanAutoplayMuted(false);
            setDetected(true);
            onBlockedRef.current?.();
          }
        }
      } finally {
        // Clean up the temporary video element
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };

    detect();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return {
    canAutoplay,
    canAutoplayMuted,
    detected,
    requestPlay,
  };
}
