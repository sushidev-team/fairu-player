import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import type { VideoQuality, HLSConfig } from '@/types/video';

/**
 * Check if a source URL is an HLS stream
 */
export function isHLSSource(src: string | undefined): boolean {
  if (!src) return false;
  return src.endsWith('.m3u8') || src.includes('.m3u8?') || src.includes('/manifest/');
}

/**
 * Check if the browser natively supports HLS
 * Safari and iOS browsers support HLS natively
 */
export function supportsNativeHLS(): boolean {
  const video = document.createElement('video');
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

export interface UseHLSOptions {
  /** Video source URL */
  src: string | undefined;
  /** Reference to the video element */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** HLS configuration */
  config?: HLSConfig;
  /** Callback when quality levels are loaded from manifest */
  onQualityLevelsLoaded?: (levels: VideoQuality[]) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

export interface UseHLSReturn {
  /** Whether the current source is an HLS stream */
  isHLS: boolean;
  /** Whether HLS is being handled by hls.js (vs native) */
  isUsingHlsJs: boolean;
  /** The hls.js instance (null if not using hls.js) */
  hlsInstance: Hls | null;
  /** Available quality levels from the manifest */
  levels: VideoQuality[];
  /** Current quality level index (-1 for auto) */
  currentLevel: number;
  /** Set the quality level (-1 for auto) */
  setLevel: (index: number) => void;
  /** Whether auto quality selection is enabled */
  isAutoQuality: boolean;
  /** Enable/disable auto quality selection */
  setAutoQuality: (auto: boolean) => void;
  /** Attach HLS to the video element (call this to start playback) */
  attachHLS: () => void;
  /** Detach and cleanup HLS */
  detachHLS: () => void;
}

/**
 * Hook to manage HLS playback using hls.js
 *
 * - Automatically detects HLS sources (.m3u8)
 * - Uses hls.js for browsers that don't natively support HLS
 * - Falls back to native playback in Safari
 * - Extracts quality levels from the manifest
 * - Handles quality switching
 */
export function useHLS({
  src,
  videoRef,
  config = {},
  onQualityLevelsLoaded,
  onError,
}: UseHLSOptions): UseHLSReturn {
  const {
    enabled = true,
    autoQuality = true,
    startLevel = -1,
    maxBufferLength,
    lowLatencyMode = false,
  } = config;

  const hlsRef = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<VideoQuality[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(startLevel);
  const [isAutoQuality, setIsAutoQualityState] = useState<boolean>(autoQuality);

  // Determine if source is HLS
  const isHLS = isHLSSource(src);

  // Determine if we need to use hls.js
  const nativeSupport = supportsNativeHLS();
  const hlsJsSupported = Hls.isSupported();
  const shouldUseHlsJs = isHLS && !nativeSupport && hlsJsSupported && enabled;

  /**
   * Create and configure the hls.js instance
   */
  const createHlsInstance = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    const hlsConfig: Partial<Hls['config']> = {
      startLevel: startLevel,
      enableWorker: true,
      lowLatencyMode: lowLatencyMode,
    };

    if (maxBufferLength !== undefined) {
      hlsConfig.maxBufferLength = maxBufferLength;
    }

    const hls = new Hls(hlsConfig);
    hlsRef.current = hls;

    // Handle manifest parsing - extract quality levels
    hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
      const qualityLevels: VideoQuality[] = data.levels.map((level, index) => ({
        label: level.height ? `${level.height}p` : `Level ${index + 1}`,
        src: '', // HLS levels don't have separate src, managed by hls.js
        bitrate: level.bitrate,
        width: level.width,
        height: level.height,
      }));

      // Add "Auto" option at the beginning
      const allLevels: VideoQuality[] = [
        { label: 'Auto', src: '', bitrate: 0 },
        ...qualityLevels,
      ];

      setLevels(allLevels);
      onQualityLevelsLoaded?.(allLevels);
    });

    // Handle level switching
    hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
      // data.level is 0-indexed (without Auto)
      // We add 1 because our levels array has "Auto" at index 0
      setCurrentLevel(data.level + 1);
    });

    // Handle errors
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // Try to recover network error
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            // Try to recover media error
            hls.recoverMediaError();
            break;
          default:
            // Cannot recover, destroy and report error
            hls.destroy();
            onError?.(new Error(`HLS fatal error: ${data.type} - ${data.details}`));
            break;
        }
      }
    });

    return hls;
  }, [startLevel, maxBufferLength, lowLatencyMode, onQualityLevelsLoaded, onError]);

  /**
   * Attach HLS to the video element
   */
  const attachHLS = useCallback(() => {
    const video = videoRef.current;
    if (!video || !src || !shouldUseHlsJs) return;

    const hls = createHlsInstance();
    hls.loadSource(src);
    hls.attachMedia(video);

    // Set initial auto quality state
    if (isAutoQuality) {
      hls.currentLevel = -1;
      setCurrentLevel(0); // "Auto" is at index 0
    } else if (startLevel >= 0) {
      hls.currentLevel = startLevel;
      setCurrentLevel(startLevel + 1); // +1 because of "Auto" at index 0
    }
  }, [src, videoRef, shouldUseHlsJs, createHlsInstance, isAutoQuality, startLevel]);

  /**
   * Detach and cleanup HLS
   */
  const detachHLS = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setLevels([]);
    setCurrentLevel(-1);
  }, []);

  /**
   * Set the quality level
   * @param index - Level index (0 for Auto, 1+ for specific levels)
   */
  const setLevel = useCallback((index: number) => {
    const hls = hlsRef.current;
    if (!hls) return;

    if (index === 0) {
      // Auto quality
      hls.currentLevel = -1;
      setIsAutoQualityState(true);
    } else {
      // Specific level (subtract 1 because index 0 is "Auto")
      hls.currentLevel = index - 1;
      setIsAutoQualityState(false);
    }
    setCurrentLevel(index);
  }, []);

  /**
   * Enable/disable auto quality
   */
  const setAutoQuality = useCallback((auto: boolean) => {
    const hls = hlsRef.current;
    if (hls) {
      if (auto) {
        hls.currentLevel = -1;
        setCurrentLevel(0); // "Auto" is at index 0
      }
    }
    setIsAutoQualityState(auto);
  }, []);

  // Auto-attach when source changes (if using hls.js)
  useEffect(() => {
    if (shouldUseHlsJs && src) {
      attachHLS();
    } else if (isHLS && nativeSupport && videoRef.current) {
      // Native HLS (Safari) - just set the source
      videoRef.current.src = src || '';
    }

    return () => {
      detachHLS();
    };
  }, [src, shouldUseHlsJs, isHLS, nativeSupport, attachHLS, detachHLS, videoRef]);

  return {
    isHLS,
    isUsingHlsJs: shouldUseHlsJs,
    hlsInstance: hlsRef.current,
    levels,
    currentLevel,
    setLevel,
    isAutoQuality,
    setAutoQuality,
    attachHLS,
    detachHLS,
  };
}

export default useHLS;
