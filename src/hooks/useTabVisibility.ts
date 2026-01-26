import { useEffect, useRef, useState } from 'react';

export interface UseTabVisibilityOptions {
  onHidden?: () => void;
  onVisible?: (hiddenDuration: number) => void;
}

export interface UseTabVisibilityReturn {
  isTabVisible: boolean;
  hiddenSince: number | null;
}

/**
 * Hook for tracking tab/page visibility using the Page Visibility API
 * Tracks hidden duration for return-ad logic
 *
 * Uses refs for callbacks to avoid stale closures and constant
 * re-registration of the visibilitychange listener.
 */
export function useTabVisibility(
  options: UseTabVisibilityOptions = {}
): UseTabVisibilityReturn {
  const [isTabVisible, setIsTabVisible] = useState(
    typeof document !== 'undefined' ? !document.hidden : true
  );
  const hiddenSinceRef = useRef<number | null>(null);

  // Store callbacks in refs so the event listener always calls the latest version
  const onHiddenRef = useRef(options.onHidden);
  const onVisibleRef = useRef(options.onVisible);
  onHiddenRef.current = options.onHidden;
  onVisibleRef.current = options.onVisible;

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenSinceRef.current = Date.now();
        setIsTabVisible(false);
        onHiddenRef.current?.();
      } else {
        const hiddenDuration = hiddenSinceRef.current
          ? (Date.now() - hiddenSinceRef.current) / 1000
          : 0;
        hiddenSinceRef.current = null;
        setIsTabVisible(true);
        onVisibleRef.current?.(hiddenDuration);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return {
    isTabVisible,
    hiddenSince: hiddenSinceRef.current,
  };
}
