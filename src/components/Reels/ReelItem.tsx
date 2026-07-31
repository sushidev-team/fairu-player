import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/cn';
import { useHLS } from '@/hooks/useHLS';
import { useLabels } from '@/context/LabelsContext';
import type { HLSConfig } from '@/types/video';
import type { Reel, ReelInteraction, ReelsFeatures } from '@/types/reels';
import { ReelActionRail } from './ReelActionRail';
import { ReelInfo } from './ReelInfo';
import { ReelProgress } from './ReelProgress';

export interface ReelItemProps {
  reel: Reel;
  interaction: ReelInteraction;
  /** This slide is the one in view. Only the active slide ever plays. */
  active: boolean;
  /** Feed-level play/pause intent. */
  playing: boolean;
  /** Feed-level mute state. */
  muted: boolean;
  /**
   * Load the media. Inactive-but-mounted neighbours load so a swipe starts
   * instantly; anything outside the window should not be rendered at all.
   */
  shouldLoad: boolean;
  /** Fetch the full stream rather than just metadata. */
  eager?: boolean;
  loop?: boolean;
  features?: ReelsFeatures;
  hls?: HLSConfig;
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
  /** Toggle feed-level playback (tap on the surface). */
  onTogglePlay?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onSave?: () => void;
  onFollow?: () => void;
  onToggleMute?: () => void;
  onCtaClick?: () => void;
  className?: string;
}

/** Max gap between taps that still counts as a double-tap. */
const DOUBLE_TAP_MS = 280;
/** How long a press must last before it pauses instead of toggling. */
const HOLD_MS = 220;

/**
 * A single content reel.
 *
 * The whole point of this component is that it owns exactly one `<video>` and
 * only feeds it a source when `shouldLoad` is true. Mobile Safari refuses to
 * decode more than a handful of media elements at once, so an unbounded feed of
 * mounted videos stops playing entirely after a few swipes.
 */
export function ReelItem({
  reel,
  interaction,
  active,
  playing,
  muted,
  shouldLoad,
  eager = false,
  loop = true,
  features = {},
  hls,
  onProgress,
  onEnded,
  onError,
  onTogglePlay,
  onLike,
  onComment,
  onShare,
  onSave,
  onFollow,
  onToggleMute,
  onCtaClick,
  className,
}: ReelItemProps) {
  const labels = useLabels();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(reel.duration ?? 0);
  const [buffering, setBuffering] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [heartBurst, setHeartBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const [holdPaused, setHoldPaused] = useState(false);

  // hls.js only attaches when `src` is set, so gating the src here also gates
  // manifest loading for off-screen slides.
  useHLS({
    src: shouldLoad ? reel.src : undefined,
    videoRef,
    config: hls,
    onError,
  });

  const isHls = reel.src.includes('.m3u8');

  /* --------------------------- Source management -------------------------- */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!shouldLoad) {
      // Releasing the source frees the decoder. `removeAttribute` + `load()` is
      // the only reliable way to make the element actually let go.
      if (video.src) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      setFirstFrameReady(false);
      setCurrentTime(0);
      return;
    }

    // HLS sources are attached by useHLS (or natively in Safari).
    if (isHls) return;

    if (video.src !== reel.src) {
      video.src = reel.src;
      video.load();
    }
  }, [shouldLoad, reel.src, isHls]);

  /* ------------------------------ Play control ---------------------------- */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const shouldPlay = active && playing && !holdPaused;

    if (shouldPlay) {
      const attempt = video.play();
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch((error: unknown) => {
          // A rejected play() while muted is a real error; unmuted rejections
          // are just the autoplay policy and are expected.
          if (video.muted) {
            onError?.(error instanceof Error ? error : new Error('Reel playback failed'));
          }
        });
      }
      return;
    }

    video.pause();

    // Rewind when the slide leaves the viewport so returning to it restarts the
    // reel, which is what every short-form feed does.
    if (!active) {
      try {
        video.currentTime = 0;
      } catch {
        // Seeking before metadata is available throws in some browsers.
      }
    }
  }, [active, playing, holdPaused, onError]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = muted;
  }, [muted]);

  /* ------------------------------ Media events ---------------------------- */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onProgress?.(video.currentTime, video.duration || duration);
    };
    const handleLoadedMetadata = () => {
      if (Number.isFinite(video.duration)) setDuration(video.duration);
    };
    const handleWaiting = () => setBuffering(true);
    const handlePlaying = () => {
      setBuffering(false);
      setFirstFrameReady(true);
    };
    const handleLoadedData = () => setFirstFrameReady(true);
    const handleEnded = () => onEnded?.();
    const handleError = () => {
      const message = video.error?.message || 'Reel failed to load';
      onError?.(new Error(message));
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [onProgress, onEnded, onError, duration]);

  /* --------------------------- Gesture handling --------------------------- */

  const lastTapRef = useRef(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartIdRef = useRef(0);

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTapTimer = () => {
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }
  };

  useEffect(
    () => () => {
      clearHoldTimer();
      // A tap immediately followed by a swipe unmounts this slide while the
      // single-tap timer is still pending. Left running, it would toggle
      // playback of whichever slide became active in the meantime.
      clearTapTimer();
    },
    []
  );

  const handlePointerDown = useCallback(() => {
    if (features.holdToPause === false) return;
    clearHoldTimer();
    holdTimerRef.current = setTimeout(() => setHoldPaused(true), HOLD_MS);
  }, [features.holdToPause]);

  const handlePointerUp = useCallback(() => {
    clearHoldTimer();
    setHoldPaused(false);
  }, []);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const now = Date.now();
      const isDoubleTap = now - lastTapRef.current < DOUBLE_TAP_MS;
      lastTapRef.current = now;

      if (isDoubleTap && features.doubleTapLike !== false) {
        lastTapRef.current = 0;
        // Cancel the first tap's pending play toggle — a double-tap likes, it
        // does not also pause.
        clearTapTimer();

        const rect = event.currentTarget.getBoundingClientRect();
        heartIdRef.current += 1;
        setHeartBurst({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          id: heartIdRef.current,
        });

        // Double-tap only ever *adds* a like, matching Instagram — it never
        // un-likes, because that would make a mistimed tap destructive.
        if (!interaction.liked) onLike?.();
        return;
      }

      // Give the double-tap window a chance to land before toggling playback.
      const tapId = now;
      clearTapTimer();
      tapTimerRef.current = setTimeout(
        () => {
          tapTimerRef.current = null;
          if (lastTapRef.current !== tapId) return;
          onTogglePlay?.();
        },
        features.doubleTapLike === false ? 0 : DOUBLE_TAP_MS
      );
    },
    [features.doubleTapLike, interaction.liked, onLike, onTogglePlay]
  );

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    try {
      video.currentTime = time;
      setCurrentTime(time);
    } catch {
      // Seeking before metadata is available throws; ignore.
    }
  }, []);

  const showPoster = !firstFrameReady && !!reel.poster;
  const showSpinner = active && (buffering || (!firstFrameReady && shouldLoad));
  const showPausedIcon = active && (!playing || holdPaused);

  return (
    <div
      className={cn('relative h-full w-full overflow-hidden bg-black', className)}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted={muted}
        loop={reel.loop ?? loop}
        preload={eager ? 'auto' : 'metadata'}
        poster={reel.poster}
        // Short-form feeds are portrait; disabling the native PiP button keeps
        // the surface clean and avoids an accidental pop-out mid-swipe.
        disablePictureInPicture
        aria-label={reel.caption ?? reel.author?.name ?? labels.playVideo}
      >
        {reel.subtitles?.map((subtitle) => (
          <track
            key={subtitle.id}
            kind="subtitles"
            label={subtitle.label}
            srcLang={subtitle.language}
            src={subtitle.src}
            default={subtitle.default}
          />
        ))}
      </video>

      {showPoster && (
        <img
          src={reel.poster}
          alt=""
          className="absolute inset-0 h-full w-full scale-105 object-cover blur-[2px]"
          aria-hidden="true"
        />
      )}

      {showSpinner && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="fp-animate-spin h-8 w-8 rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}

      {showPausedIcon && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="rgba(255,255,255,0.9)"
            className="drop-shadow-lg"
            aria-hidden="true"
          >
            <polygon points="6 4 20 12 6 20 6 4" />
          </svg>
        </div>
      )}

      {heartBurst && (
        <svg
          key={heartBurst.id}
          className="fp-reel-heart pointer-events-none absolute z-20"
          style={{ left: heartBurst.x - 40, top: heartBurst.y - 40 }}
          width="80"
          height="80"
          viewBox="0 0 24 24"
          fill="#ff2d55"
          aria-hidden="true"
          onAnimationEnd={() => setHeartBurst(null)}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l8.84 8.84 8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      )}

      <ReelInfo
        reel={reel}
        interaction={interaction}
        features={features}
        onFollow={onFollow}
        onCtaClick={onCtaClick}
      />

      {features.actionRail !== false && (
        <ReelActionRail
          reel={reel}
          interaction={interaction}
          features={features}
          muted={muted}
          onLike={onLike}
          onComment={onComment}
          onShare={onShare}
          onSave={onSave}
          onToggleMute={onToggleMute}
        />
      )}

      {features.progressBar !== false && (
        <ReelProgress
          currentTime={currentTime}
          duration={duration}
          scrubbable={features.scrubbing !== false}
          onSeek={handleSeek}
        />
      )}
    </div>
  );
}

export default ReelItem;
