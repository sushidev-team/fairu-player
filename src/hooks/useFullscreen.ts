import { useCallback, useEffect, useState } from 'react';

type WebKitVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

function nativeVideo(element: HTMLElement | null): WebKitVideo | null {
  return ((element?.tagName === 'VIDEO' ? element : element?.querySelector('video')) ?? null) as WebKitVideo | null;
}

export interface UseFullscreenOptions {
  onChange?: (isFullscreen: boolean) => void;
}

export interface UseFullscreenReturn {
  isFullscreen: boolean;
  enterFullscreen: (element?: HTMLElement | null) => Promise<void>;
  exitFullscreen: () => Promise<void>;
  toggleFullscreen: (element?: HTMLElement | null) => Promise<void>;
  isSupported: boolean;
}

/**
 * Hook for managing fullscreen state
 * Handles browser prefixes for cross-browser compatibility
 */
export function useFullscreen(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseFullscreenOptions = {}
): UseFullscreenReturn {
  const { onChange } = options;
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Check if fullscreen is supported
  const isSupported =
    typeof document !== 'undefined' &&
    (document.fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      (document as any).mozFullScreenEnabled ||
      (document as any).msFullscreenEnabled ||
      (typeof HTMLVideoElement !== 'undefined' && typeof (HTMLVideoElement.prototype as WebKitVideo).webkitEnterFullscreen === 'function'));

  // Get current fullscreen element
  const getFullscreenElement = useCallback((): Element | null => {
    if (typeof document === 'undefined') return null;
    return (
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement ||
      null
    );
  }, []);

  // Enter fullscreen
  const enterFullscreen = useCallback(async (element?: HTMLElement | null) => {
    const target = element || containerRef.current;
    if (!target) return;

    try {
      if (target.requestFullscreen) {
        await target.requestFullscreen();
      } else if ((target as any).webkitRequestFullscreen) {
        await (target as any).webkitRequestFullscreen();
      } else if ((target as any).mozRequestFullScreen) {
        await (target as any).mozRequestFullScreen();
      } else if ((target as any).msRequestFullscreen) {
        await (target as any).msRequestFullscreen();
      } else {
        // iPhone Safari exposes fullscreen on the media element, not its wrapper.
        nativeVideo(target)?.webkitEnterFullscreen?.();
      }
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
    }
  }, [containerRef]);

  // Exit fullscreen
  const exitFullscreen = useCallback(async () => {
    try {
      const video = nativeVideo(containerRef.current);
      if (video?.webkitDisplayingFullscreen && video.webkitExitFullscreen) {
        video.webkitExitFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
    }
  }, [containerRef]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async (element?: HTMLElement | null) => {
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen(element);
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement = getFullscreenElement();
      const newIsFullscreen = !!fullscreenElement || !!nativeVideo(containerRef.current)?.webkitDisplayingFullscreen;
      setIsFullscreen(newIsFullscreen);
      onChange?.(newIsFullscreen);
    };
    const handleNativeBegin = () => { setIsFullscreen(true); onChange?.(true); };
    const handleNativeEnd = () => { setIsFullscreen(false); onChange?.(false); };
    const video = nativeVideo(containerRef.current);
    video?.addEventListener('webkitbeginfullscreen', handleNativeBegin);
    video?.addEventListener('webkitendfullscreen', handleNativeEnd);

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      video?.removeEventListener('webkitbeginfullscreen', handleNativeBegin);
      video?.removeEventListener('webkitendfullscreen', handleNativeEnd);
    };
  }, [getFullscreenElement, onChange, containerRef]);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    isSupported,
  };
}
