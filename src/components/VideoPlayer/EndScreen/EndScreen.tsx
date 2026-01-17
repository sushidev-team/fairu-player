import { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/utils/cn';
import { RecommendedCard } from './RecommendedCard';
import { AutoPlayCountdown } from './AutoPlayCountdown';
import type { EndScreenConfig, RecommendedVideo } from '@/types/video';

export interface EndScreenProps {
  /** End screen configuration */
  config: EndScreenConfig;
  /** Current video time in seconds */
  currentTime: number;
  /** Video duration in seconds */
  duration: number;
  /** Whether the video has ended */
  isEnded: boolean;
  /** Callback when a video is selected */
  onVideoSelect?: (video: RecommendedVideo) => void;
  /** Callback when replay is clicked */
  onReplay?: () => void;
  /** Custom class name */
  className?: string;
}

/**
 * End screen component with recommended videos
 */
export function EndScreen({
  config,
  currentTime,
  duration,
  isEnded,
  onVideoSelect,
  onReplay,
  className,
}: EndScreenProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [autoPlayCancelled, setAutoPlayCancelled] = useState(false);

  const showAt = config.showAt ?? 10;
  const layout = config.layout ?? 'grid';
  const columns = config.columns ?? 3;
  const title = config.title ?? 'Recommended Videos';
  const showReplay = config.showReplay !== false;
  const autoPlayNext = config.autoPlayNext ?? false;
  const autoPlayDelay = config.autoPlayDelay ?? 5;

  // First recommended video for auto-play
  const upNextVideo = config.recommendations[0] || null;

  // Determine visibility
  useEffect(() => {
    if (!config.enabled || config.recommendations.length === 0) {
      setIsVisible(false);
      return;
    }

    // Show when video ends or when we're within showAt seconds of the end
    const shouldShow = isEnded || (showAt > 0 && duration > 0 && duration - currentTime <= showAt);
    setIsVisible(shouldShow);

    // Reset auto-play cancelled when end screen hides
    if (!shouldShow) {
      setAutoPlayCancelled(false);
    }
  }, [config.enabled, config.recommendations.length, isEnded, currentTime, duration, showAt]);

  // Handle video selection
  const handleVideoSelect = useCallback((video: RecommendedVideo) => {
    config.onVideoSelect?.(video);
    onVideoSelect?.(video);
  }, [config, onVideoSelect]);

  // Handle auto-play complete
  const handleAutoPlayComplete = useCallback((video: RecommendedVideo) => {
    handleVideoSelect(video);
  }, [handleVideoSelect]);

  // Handle auto-play cancel
  const handleAutoPlayCancel = useCallback(() => {
    setAutoPlayCancelled(true);
  }, []);

  // Get grid column class
  const gridColsClass = useMemo(() => {
    switch (columns) {
      case 2:
        return 'grid-cols-2';
      case 4:
        return 'grid-cols-2 md:grid-cols-4';
      case 3:
      default:
        return 'grid-cols-2 md:grid-cols-3';
    }
  }, [columns]);

  // Limit recommendations based on layout
  const displayedVideos = useMemo(() => {
    const maxVideos = layout === 'carousel' ? 10 : columns * 2;
    return config.recommendations.slice(0, maxVideos);
  }, [config.recommendations, layout, columns]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        'fairu-end-screen',
        'absolute inset-0 z-40',
        'bg-black/90 backdrop-blur-sm',
        'flex flex-col',
        'p-4 md:p-6',
        'overflow-hidden',
        'animate-in fade-in duration-300',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white text-lg md:text-xl font-semibold">
          {title}
        </h2>

        {/* Replay button */}
        {showReplay && onReplay && (
          <button
            onClick={onReplay}
            className={cn(
              'flex items-center gap-2',
              'px-4 py-2',
              'bg-white/10 hover:bg-white/20',
              'text-white text-sm font-medium',
              'rounded-full',
              'transition-colors'
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Replay
          </button>
        )}
      </div>

      {/* Recommendations */}
      <div className="flex-1 overflow-y-auto">
        {layout === 'grid' ? (
          <div className={cn('grid gap-3 md:gap-4', gridColsClass)}>
            {displayedVideos.map((video, index) => (
              <RecommendedCard
                key={video.id}
                video={video}
                onSelect={handleVideoSelect}
                isUpNext={index === 0 && autoPlayNext && !autoPlayCancelled}
              />
            ))}
          </div>
        ) : (
          /* Carousel layout */
          <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
            {displayedVideos.map((video, index) => (
              <div key={video.id} className="flex-shrink-0 w-56 md:w-64 snap-start">
                <RecommendedCard
                  video={video}
                  onSelect={handleVideoSelect}
                  isUpNext={index === 0 && autoPlayNext && !autoPlayCancelled}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auto-play countdown */}
      {autoPlayNext && upNextVideo && isEnded && !autoPlayCancelled && (
        <div className="mt-4">
          <AutoPlayCountdown
            video={upNextVideo}
            duration={autoPlayDelay}
            active={isEnded && !autoPlayCancelled}
            onComplete={handleAutoPlayComplete}
            onCancel={handleAutoPlayCancel}
          />
        </div>
      )}
    </div>
  );
}

export default EndScreen;
