import { useState } from 'react';
import { cn, formatTime } from '@/utils';
import { PlayButton } from '@/components/controls/PlayButton';
import { ProgressBar } from '@/components/controls/ProgressBar';
import { SkipButton } from '@/components/controls/SkipButtons';
import { VolumeControl } from '@/components/controls/VolumeControl';
import { NowPlayingIndicator } from '@/components/controls/NowPlayingIndicator';
import { AdOverlay } from '@/components/ads/AdOverlay';
import type { AdState, AdControls } from '@/types/ads';

export interface EpisodeViewProps {
  artwork?: string;
  title: string;
  showName?: string;
  description?: string;
  publishedAt?: string;
  duration?: number;
  currentTime?: number;
  buffered?: number;
  isPlaying?: boolean;
  isLoading?: boolean;
  volume?: number;
  muted?: boolean;
  skipForwardSeconds?: number;
  skipBackwardSeconds?: number;
  className?: string;
  // Ad props
  adState?: AdState;
  adControls?: Pick<AdControls, 'skipAd' | 'clickThrough'>;
  // Callbacks
  onPlay?: () => void;
  onSeek?: (time: number) => void;
  onSkipForward?: () => void;
  onSkipBackward?: () => void;
  onVolumeChange?: (volume: number) => void;
  onMuteToggle?: () => void;
}

export function EpisodeView({
  artwork,
  title,
  showName,
  description,
  publishedAt,
  duration = 0,
  currentTime = 0,
  buffered = 0,
  isPlaying = false,
  isLoading = false,
  volume = 1,
  muted = false,
  skipForwardSeconds = 30,
  skipBackwardSeconds = 10,
  className,
  adState,
  adControls,
  onPlay,
  onSeek,
  onSkipForward,
  onSkipBackward,
  onVolumeChange,
  onMuteToggle,
}: EpisodeViewProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const toggleDescription = () => setIsDescriptionExpanded(!isDescriptionExpanded);

  // Check if ads are playing - disable controls when true
  const isAdPlaying = adState?.isPlayingAd ?? false;
  const controlsDisabled = isLoading || isAdPlaying;

  return (
    <div
      className={cn(
        'relative w-full max-w-2xl mx-auto',
        'bg-[var(--fp-color-background)]',
        'rounded-xl overflow-hidden',
        'border border-[var(--fp-glass-border)]',
        'shadow-lg',
        className
      )}
    >
      {/* Ad Overlay */}
      {adState && adControls && (
        <AdOverlay state={adState} controls={adControls} />
      )}
      {/* Header with Cover and Info */}
      <div className="flex gap-4 p-4">
        {/* Cover Art */}
        <div className="flex-shrink-0">
          {artwork ? (
            <div className="relative">
              <img
                src={artwork}
                alt={title}
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg object-cover shadow-md"
              />
              {isPlaying && (
                <div className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-sm rounded-full p-1">
                  <NowPlayingIndicator isPlaying={isPlaying} size="sm" bars={3} />
                </div>
              )}
            </div>
          ) : (
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg bg-[var(--fp-color-surface)] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-[var(--fp-color-text-muted)]">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
        </div>

        {/* Episode Info */}
        <div className="flex-1 min-w-0">
          {showName && (
            <p className="text-xs font-medium text-[var(--fp-color-accent)] uppercase tracking-wider mb-1">
              {showName}
            </p>
          )}
          <h2 className="text-lg font-bold text-[var(--fp-color-text)] line-clamp-2 mb-1">
            {title}
          </h2>
          <div className="flex items-center gap-2 text-xs text-[var(--fp-color-text-muted)]">
            {publishedAt && <span>{publishedAt}</span>}
            {publishedAt && duration > 0 && <span>•</span>}
            {duration > 0 && <span>{formatTime(duration)}</span>}
          </div>
        </div>
      </div>

      {/* Description */}
      {description && (
        <div className="px-4 pb-3">
          <div
            className={cn(
              'text-sm text-[var(--fp-color-text-secondary)] leading-relaxed',
              !isDescriptionExpanded && 'line-clamp-3'
            )}
          >
            {description}
          </div>
          {description.length > 150 && (
            <button
              onClick={toggleDescription}
              className="text-xs font-medium text-[var(--fp-color-accent)] hover:text-[var(--fp-color-accent-hover)] mt-1"
            >
              {isDescriptionExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className="px-4">
        <ProgressBar
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
          onSeek={controlsDisabled ? undefined : onSeek}
          disabled={controlsDisabled}
        />
        <div className="flex justify-between mt-1 mb-3">
          <span className="text-[10px] text-[var(--fp-color-text-muted)] tabular-nums">
            {formatTime(currentTime)}
          </span>
          <span className="text-[10px] text-[var(--fp-color-text-muted)] tabular-nums">
            -{formatTime(Math.max(0, duration - currentTime))}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className={cn(
        'flex items-center justify-between px-4 pb-4',
        isAdPlaying && 'opacity-50 pointer-events-none'
      )}>
        <div className="flex items-center gap-1">
          <SkipButton
            direction="backward"
            seconds={skipBackwardSeconds}
            size="sm"
            onClick={onSkipBackward}
            disabled={controlsDisabled}
          />

          <PlayButton
            isPlaying={isPlaying}
            isLoading={isLoading}
            onClick={onPlay}
            size="md"
            disabled={controlsDisabled}
          />

          <SkipButton
            direction="forward"
            seconds={skipForwardSeconds}
            size="sm"
            onClick={onSkipForward}
            disabled={controlsDisabled}
          />
        </div>

        <VolumeControl
          volume={volume}
          muted={muted}
          onVolumeChange={onVolumeChange}
          onMuteToggle={onMuteToggle}
          disabled={controlsDisabled}
        />
      </div>
    </div>
  );
}
