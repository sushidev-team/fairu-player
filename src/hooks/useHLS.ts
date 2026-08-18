import { useCallback, useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import { loadHls, mayUseHlsJs, type HlsConstructor } from '@/utils/hlsLoader';
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

/**
 * How many times a fatal error of one class is retried before giving up.
 *
 * Three is enough to ride out a redeploy or a dropped connection, and few
 * enough that a genuinely dead stream surfaces as an error in a few seconds
 * rather than never.
 */
const MAX_RECOVERY_ATTEMPTS = 3;

/** First network retry delay; doubles per attempt (1s, 2s, 4s). */
const RECOVERY_BASE_DELAY_MS = 1000;

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
  /**
   * Attach HLS to the video element (call this to start playback).
   *
   * Asynchronous: hls.js is fetched on demand, so the instance does not exist
   * until the module has landed.
   */
  attachHLS: () => Promise<void>;
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
  // Recovery budget, per error class. Reset whenever a level loads cleanly.
  const networkRetries = useRef(0);
  const mediaRetries = useRef(0);
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set on teardown so an in-flight module load does not attach afterwards. */
  const cancelledRef = useRef(false);
  const [levels, setLevels] = useState<VideoQuality[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(startLevel);
  const [isAutoQuality, setIsAutoQualityState] = useState<boolean>(autoQuality);

  // Determine if source is HLS
  const isHLS = isHLSSource(src);

  // Determine if we need to use hls.js.
  //
  // `mayUseHlsJs()` replaces `Hls.isSupported()` here because asking the real
  // one means downloading the library first — which is exactly what this hook
  // now avoids. It is confirmed against `isSupported()` in `attachHLS`, once
  // the module has actually landed.
  const nativeSupport = supportsNativeHLS();
  const shouldUseHlsJs = isHLS && !nativeSupport && mayUseHlsJs() && enabled;

  /**
   * Create and configure the hls.js instance
   */
  const createHlsInstance = useCallback((Hls: HlsConstructor) => {
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

    // Handle errors.
    //
    // Recovery used to be unconditional: every fatal network error called
    // `startLoad()` and every fatal media error called `recoverMediaError()`,
    // with no limit and no delay. Against a CDN that is actually down that is a
    // tight loop — each attempt fails, fires ERROR again, and retries
    // immediately, hammering the origin and pinning the tab's CPU while the
    // viewer sees a spinner that never resolves and no error is ever reported.
    //
    // So: a bounded number of attempts, spaced out, and a real failure when
    // they run out.
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal) return;

      const giveUp = (reason: string) => {
        hls.destroy();
        onError?.(new Error(`HLS fatal error: ${reason} - ${data.details}`));
      };

      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR: {
          if (networkRetries.current >= MAX_RECOVERY_ATTEMPTS) {
            giveUp(data.type);
            return;
          }
          // Exponential backoff, so a stream that comes back after a blip is
          // still picked up while a dead one is not retried into the ground.
          const delay = RECOVERY_BASE_DELAY_MS * 2 ** networkRetries.current;
          networkRetries.current += 1;
          recoveryTimer.current = setTimeout(() => hls.startLoad(), delay);
          break;
        }

        case Hls.ErrorTypes.MEDIA_ERROR: {
          if (mediaRetries.current >= MAX_RECOVERY_ATTEMPTS) {
            giveUp(data.type);
            return;
          }
          mediaRetries.current += 1;
          // No delay here: `recoverMediaError` re-appends buffers rather than
          // going to the network, so waiting only lengthens the stall.
          hls.recoverMediaError();
          break;
        }

        default:
          giveUp(data.type);
          break;
      }
    });

    // A level that plays is proof the stream recovered, so the budgets reset
    // and a later, unrelated blip gets its own full set of attempts.
    hls.on(Hls.Events.LEVEL_LOADED, () => {
      networkRetries.current = 0;
      mediaRetries.current = 0;
    });

    return hls;
  }, [startLevel, maxBufferLength, lowLatencyMode, onQualityLevelsLoaded, onError]);

  /**
   * Attach HLS to the video element
   */
  // Read inside `attachHLS` without being a dependency of it.
  //
  // `isAutoQuality` changes every time someone picks a quality, and attaching
  // is what the mount effect keys on — so a level switch destroyed the running
  // instance and re-attached, restarting the stream. Picking 720p meant a stall
  // and a fresh buffer, and the pinned level was lost in the rebuild. The value
  // is only needed to seed the *initial* level, which is a mount concern.
  const isAutoQualityRef = useRef(isAutoQuality);
  useEffect(() => {
    isAutoQualityRef.current = isAutoQuality;
  }, [isAutoQuality]);

  const attachHLS = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !src || !shouldUseHlsJs) return;

    const Hls = await loadHls();

    // The authoritative check, now that the library is here. `mayUseHlsJs()`
    // only established that Media Source Extensions exist; hls.js additionally
    // wants specific codec support, and a browser that fails this has nothing
    // to fall back on — reporting it beats a silent black frame.
    if (!Hls.isSupported()) {
      onError?.(new Error('HLS is not supported in this browser'));
      return;
    }

    // The element or the source may have changed while the module was in
    // flight; attaching to a stale one would leave an orphaned instance
    // buffering in the background.
    if (videoRef.current !== video || cancelledRef.current) return;

    const hls = createHlsInstance(Hls);
    hls.loadSource(src);
    hls.attachMedia(video);

    // Set initial auto quality state
    if (isAutoQualityRef.current) {
      hls.currentLevel = -1;
      setCurrentLevel(0); // "Auto" is at index 0
    } else if (startLevel >= 0) {
      hls.currentLevel = startLevel;
      setCurrentLevel(startLevel + 1); // +1 because of "Auto" at index 0
    }
  }, [src, videoRef, shouldUseHlsJs, createHlsInstance, startLevel, onError]);

  /**
   * Detach and cleanup HLS
   */
  const detachHLS = useCallback(() => {
    // The pending retry goes first: it closes over the instance about to be
    // destroyed, and firing afterwards would call `startLoad` on a dead object.
    if (recoveryTimer.current) {
      clearTimeout(recoveryTimer.current);
      recoveryTimer.current = null;
    }
    networkRetries.current = 0;
    mediaRetries.current = 0;

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
    cancelledRef.current = false;

    if (shouldUseHlsJs && src) {
      void attachHLS();
    } else if (isHLS && nativeSupport && videoRef.current) {
      // Native HLS (Safari) - just set the source
      videoRef.current.src = src || '';
    }

    return () => {
      cancelledRef.current = true;
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
