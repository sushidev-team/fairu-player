import { useCallback, useEffect, useState } from 'react';

/**
 * Extended video element type with WebKit AirPlay APIs (not in standard lib).
 * The Remote Playback API (`remote`) is already in the DOM typings.
 */
interface HTMLVideoElementWithCast extends HTMLVideoElement {
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
}

/**
 * Detect cast support. Safari exposes webkit APIs on instances only (not on the
 * prototype), so we need to check both the prototype and an actual element.
 */
function detectCastSupport(video: HTMLVideoElement | null): boolean {
  if (typeof window === 'undefined') return false;

  // Chrome/Edge: Remote Playback API (always on the prototype)
  if ('remote' in HTMLVideoElement.prototype) return true;

  // Safari: webkitShowPlaybackTargetPicker may only exist on instances
  if (video && 'webkitShowPlaybackTargetPicker' in video) return true;

  // Fallback: Safari global event constructor indicates AirPlay support
  if (typeof (window as unknown as Record<string, unknown>).WebKitPlaybackTargetAvailabilityEvent === 'function') return true;

  return false;
}

export interface UseCastOptions {
  onChange?: (isCasting: boolean) => void;
}

export interface UseCastReturn {
  isCasting: boolean;
  toggleCast: () => Promise<void>;
  isSupported: boolean;
}

/**
 * Hook for managing Cast state (Chromecast via Remote Playback API, AirPlay via WebKit)
 * Wraps browser cast APIs with React state management
 */
export function useCast(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: UseCastOptions = {}
): UseCastReturn {
  const { onChange } = options;
  const [isCasting, setIsCasting] = useState(false);
  const [isSupported, setIsSupported] = useState(() => detectCastSupport(null));

  // Re-evaluate support once the video element is available
  useEffect(() => {
    setIsSupported(detectCastSupport(videoRef.current));
  }, [videoRef]);

  const toggleCast = useCallback(async () => {
    const video = videoRef.current as HTMLVideoElementWithCast | null;
    if (!video) return;

    try {
      if (video.webkitShowPlaybackTargetPicker) {
        // Safari: AirPlay — check first because Safari may also expose
        // video.remote (partial Remote Playback API) which does not
        // trigger the AirPlay picker via prompt().
        video.webkitShowPlaybackTargetPicker();
      } else if (video.remote) {
        // Chrome/Edge: Remote Playback API → Chromecast
        await video.remote.prompt();
      }
    } catch (error) {
      // User cancelled the picker or no devices available — not an error
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        return;
      }
      console.error('Failed to open cast picker:', error);
    }
  }, [videoRef]);

  useEffect(() => {
    const video = videoRef.current as HTMLVideoElementWithCast | null;
    if (!video) return;

    const handleCastChange = (casting: boolean) => {
      setIsCasting(casting);
      onChange?.(casting);
    };

    // Safari: AirPlay event — check first (same reason as toggleCast)
    if ('webkitCurrentPlaybackTargetIsWireless' in video) {
      const handleWirelessChange = () => {
        handleCastChange(!!video.webkitCurrentPlaybackTargetIsWireless);
      };

      video.addEventListener(
        'webkitcurrentplaybacktargetiswirelesschanged' as keyof HTMLMediaElementEventMap,
        handleWirelessChange as EventListener
      );

      return () => {
        video.removeEventListener(
          'webkitcurrentplaybacktargetiswirelesschanged' as keyof HTMLMediaElementEventMap,
          handleWirelessChange as EventListener
        );
      };
    }

    // Chrome/Edge: Remote Playback API events
    if (video.remote) {
      const handleConnect = () => handleCastChange(true);
      const handleDisconnect = () => handleCastChange(false);

      video.remote.addEventListener('connect', handleConnect);
      video.remote.addEventListener('disconnect', handleDisconnect);

      return () => {
        video.remote!.removeEventListener('connect', handleConnect);
        video.remote!.removeEventListener('disconnect', handleDisconnect);
      };
    }
  }, [videoRef, onChange]);

  return {
    isCasting,
    toggleCast,
    isSupported,
  };
}
