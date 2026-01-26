import { useCallback, useEffect, useState } from 'react';

export interface UsePictureInPictureOptions {
  onChange?: (isPictureInPicture: boolean) => void;
}

export interface UsePictureInPictureReturn {
  isPictureInPicture: boolean;
  enterPictureInPicture: () => Promise<void>;
  exitPictureInPicture: () => Promise<void>;
  togglePictureInPicture: () => Promise<void>;
  isSupported: boolean;
}

/**
 * Hook for managing Picture-in-Picture state
 * Wraps the browser PiP API with React state management
 */
export function usePictureInPicture(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: UsePictureInPictureOptions = {}
): UsePictureInPictureReturn {
  const { onChange } = options;
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);

  const isSupported =
    typeof document !== 'undefined' &&
    'pictureInPictureEnabled' in document &&
    document.pictureInPictureEnabled;

  const enterPictureInPicture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !isSupported) return;

    try {
      await video.requestPictureInPicture();
    } catch (error) {
      console.error('Failed to enter Picture-in-Picture:', error);
    }
  }, [videoRef, isSupported]);

  const exitPictureInPicture = useCallback(async () => {
    if (!document.pictureInPictureElement) return;

    try {
      await document.exitPictureInPicture();
    } catch (error) {
      console.error('Failed to exit Picture-in-Picture:', error);
    }
  }, []);

  const togglePictureInPicture = useCallback(async () => {
    if (isPictureInPicture) {
      await exitPictureInPicture();
    } else {
      await enterPictureInPicture();
    }
  }, [isPictureInPicture, enterPictureInPicture, exitPictureInPicture]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnter = () => {
      setIsPictureInPicture(true);
      onChange?.(true);
    };

    const handleLeave = () => {
      setIsPictureInPicture(false);
      onChange?.(false);
    };

    video.addEventListener('enterpictureinpicture', handleEnter);
    video.addEventListener('leavepictureinpicture', handleLeave);

    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnter);
      video.removeEventListener('leavepictureinpicture', handleLeave);
    };
  }, [videoRef, onChange]);

  return {
    isPictureInPicture,
    enterPictureInPicture,
    exitPictureInPicture,
    togglePictureInPicture,
    isSupported,
  };
}
