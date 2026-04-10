import { useRef, useCallback, useState, useEffect } from 'react';
import { cn } from '@/utils/cn';
import type { RewardedAd as RewardedAdType } from '@/types/rewardedAd';

export interface RewardedAdOverlayProps {
  /** The rewarded ad */
  ad: RewardedAdType;
  /** Whether the overlay is visible */
  visible: boolean;
  /** Called when the ad completes and reward is earned */
  onReward: (ad: RewardedAdType) => void;
  /** Called when user closes (completed or not) */
  onClose: (ad: RewardedAdType, completed: boolean) => void;
  /** Called on click-through */
  onClick?: (ad: RewardedAdType) => void;
  /** Additional CSS classes */
  className?: string;
}

export function RewardedAdOverlay({
  ad,
  visible,
  onReward,
  onClose,
  onClick,
  className,
}: RewardedAdOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(ad.duration);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const rewardedRef = useRef(false);

  // Reset state when ad changes or becomes visible
  useEffect(() => {
    if (visible) {
      setProgress(0);
      setDuration(ad.duration);
      setIsPlaying(false);
      setIsCompleted(false);
      rewardedRef.current = false;
    }
  }, [visible, ad]);

  // Auto-play when visible
  useEffect(() => {
    if (visible && videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay blocked - user needs to interact
      });
    }
  }, [visible]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setProgress(videoRef.current.currentTime);
      if (videoRef.current.duration && isFinite(videoRef.current.duration)) {
        setDuration(videoRef.current.duration);
      }
    }
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setIsCompleted(true);
    if (!rewardedRef.current) {
      rewardedRef.current = true;
      onReward(ad);
    }
  }, [ad, onReward]);

  const handleClick = useCallback(() => {
    if (ad.clickThroughUrl) {
      window.open(ad.clickThroughUrl, '_blank', 'noopener,noreferrer');
    }
    onClick?.(ad);
  }, [ad, onClick]);

  const handleClose = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    onClose(ad, isCompleted);
  }, [ad, isCompleted, onClose]);

  if (!visible) return null;

  const percentage = duration > 0 ? (progress / duration) * 100 : 0;
  const remainingSeconds = Math.max(0, Math.ceil(duration - progress));

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center',
        'bg-black/90',
        className
      )}
      data-testid="rewarded-ad"
    >
      {/* Header */}
      <div className="w-full max-w-2xl px-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-yellow-500 text-black text-[10px] font-bold rounded">
            AD
          </span>
          {ad.title && (
            <span className="text-white text-sm">{ad.title}</span>
          )}
        </div>

        {/* Close / remaining time */}
        {isCompleted ? (
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-1 bg-white text-black text-sm font-medium rounded hover:bg-white/90 transition-colors"
            data-testid="rewarded-ad-close"
          >
            Close
          </button>
        ) : (
          <span className="text-white/60 text-sm" data-testid="rewarded-ad-countdown">
            {remainingSeconds}s remaining
          </span>
        )}
      </div>

      {/* Video */}
      <div className="relative w-full max-w-2xl aspect-video rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          src={ad.src}
          poster={ad.poster}
          className="w-full h-full object-cover"
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onEnded={handleEnded}
          data-testid="rewarded-ad-video"
        />

        {/* Click area */}
        {ad.clickThroughUrl && isPlaying && (
          <button
            type="button"
            onClick={handleClick}
            className="absolute inset-0 cursor-pointer"
            aria-label="Learn more"
            data-testid="rewarded-ad-click"
          />
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-2xl px-4 mt-3">
        <div className="h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--fp-color-accent)] transition-all duration-200"
            style={{ width: `${percentage}%` }}
            data-testid="rewarded-ad-progress"
          />
        </div>
      </div>

      {/* Reward description */}
      {ad.rewardDescription && (
        <p className="mt-3 text-white/60 text-xs text-center" data-testid="rewarded-ad-description">
          {ad.rewardDescription}
        </p>
      )}

      {/* Completed state */}
      {isCompleted && (
        <div className="mt-4 flex flex-col items-center gap-2" data-testid="rewarded-ad-completed">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-green-400 text-sm font-medium">Reward earned!</span>
          </div>
        </div>
      )}
    </div>
  );
}
