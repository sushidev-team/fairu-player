import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/utils/cn';
import type { RecommendedVideo } from '@/types/video';

export interface AutoPlayCountdownProps {
  /** The video that will auto-play */
  video: RecommendedVideo;
  /** Countdown duration in seconds */
  duration?: number;
  /** Whether the countdown is active */
  active: boolean;
  /** Callback when countdown completes */
  onComplete?: (video: RecommendedVideo) => void;
  /** Callback when user cancels the countdown */
  onCancel?: () => void;
  /** Custom class name */
  className?: string;
}

/**
 * Auto-play countdown component for end screen
 */
export function AutoPlayCountdown({
  video,
  duration = 5,
  active,
  onComplete,
  onCancel,
  className,
}: AutoPlayCountdownProps) {
  const [countdown, setCountdown] = useState(duration);
  const [isPaused, setIsPaused] = useState(false);

  // Reset countdown when video changes or becomes active
  useEffect(() => {
    setCountdown(duration);
    setIsPaused(false);
  }, [video.id, duration, active]);

  // Countdown timer
  useEffect(() => {
    if (!active || isPaused || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [active, isPaused, countdown]);

  // Fire complete callback when countdown reaches 0
  useEffect(() => {
    if (active && countdown === 0 && !isPaused) {
      onComplete?.(video);
    }
  }, [active, countdown, isPaused, video, onComplete]);

  const handleCancel = useCallback(() => {
    setIsPaused(true);
    onCancel?.();
  }, [onCancel]);

  const handlePlayNow = useCallback(() => {
    onComplete?.(video);
  }, [video, onComplete]);

  if (!active) {
    return null;
  }

  const progress = ((duration - countdown) / duration) * 100;

  return (
    <div
      className={cn(
        'fairu-autoplay-countdown',
        'w-full',
        'bg-black/60 backdrop-blur-sm',
        'rounded-lg',
        'p-3',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {/* Thumbnail */}
        <div className="relative w-24 h-14 flex-shrink-0 rounded overflow-hidden">
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
          />
          {/* Circular countdown */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="relative w-10 h-10">
              {/* Background circle */}
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="2"
                />
                {/* Progress circle */}
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={`${progress} 100`}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              {/* Countdown number */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white text-sm font-bold">
                  {isPaused ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  ) : (
                    countdown
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Video info */}
        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-xs mb-0.5">
            {isPaused ? 'Autoplay paused' : 'Up next'}
          </p>
          <h4 className="text-white text-sm font-medium line-clamp-1">
            {video.title}
          </h4>
          {video.channel && (
            <p className="text-white/40 text-xs truncate">
              {video.channel}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          {!isPaused && (
            <button
              onClick={handleCancel}
              className={cn(
                'px-3 py-1.5',
                'bg-white/10 hover:bg-white/20',
                'text-white text-xs font-medium',
                'rounded',
                'transition-colors'
              )}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handlePlayNow}
            className={cn(
              'px-3 py-1.5',
              'bg-white hover:bg-white/90',
              'text-black text-xs font-medium',
              'rounded',
              'transition-colors'
            )}
          >
            {isPaused ? 'Play' : 'Play now'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AutoPlayCountdown;
