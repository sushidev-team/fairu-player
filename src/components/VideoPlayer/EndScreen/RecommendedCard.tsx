import { cn } from '@/utils/cn';
import { formatTime } from '@/utils/formatTime';
import type { RecommendedVideo } from '@/types/video';

export interface RecommendedCardProps {
  /** The recommended video data */
  video: RecommendedVideo;
  /** Callback when the card is clicked */
  onSelect?: (video: RecommendedVideo) => void;
  /** Whether this is the "up next" video */
  isUpNext?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Recommended video card for end screen
 */
export function RecommendedCard({
  video,
  onSelect,
  isUpNext = false,
  className,
}: RecommendedCardProps) {
  const handleClick = () => {
    onSelect?.(video);

    // If there's an external URL and no src, open it
    if (video.url && !video.src) {
      window.open(video.url, '_blank');
    }
  };

  return (
    <div
      className={cn(
        'fairu-recommended-card',
        'group cursor-pointer',
        'rounded-lg overflow-hidden',
        'bg-white/5 hover:bg-white/10',
        'transition-all duration-200',
        'transform hover:scale-[1.02]',
        isUpNext && 'ring-2 ring-white/30',
        className
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-800">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Play icon overlay */}
        <div className={cn(
          'absolute inset-0',
          'flex items-center justify-center',
          'bg-black/0 group-hover:bg-black/40',
          'transition-colors duration-200'
        )}>
          <div className={cn(
            'w-10 h-10',
            'bg-white/90 rounded-full',
            'flex items-center justify-center',
            'opacity-0 group-hover:opacity-100',
            'transform scale-75 group-hover:scale-100',
            'transition-all duration-200'
          )}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-black ml-0.5"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>

        {/* Duration badge */}
        {video.duration && (
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-white text-xs rounded">
            {formatTime(video.duration)}
          </div>
        )}

        {/* Up next badge */}
        {isUpNext && (
          <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-white text-black text-xs font-medium rounded">
            Up next
          </div>
        )}
      </div>

      {/* Video info */}
      <div className="p-2">
        <div className="flex gap-2">
          {/* Channel avatar */}
          {video.channelAvatar && (
            <img
              src={video.channelAvatar}
              alt={video.channel || ''}
              className="w-8 h-8 rounded-full flex-shrink-0"
              loading="lazy"
            />
          )}

          <div className="flex-1 min-w-0">
            {/* Title */}
            <h4 className="text-white text-sm font-medium line-clamp-2 leading-tight">
              {video.title}
            </h4>

            {/* Channel name */}
            {video.channel && (
              <p className="text-white/60 text-xs mt-0.5 truncate">
                {video.channel}
              </p>
            )}

            {/* Views */}
            {video.views && (
              <p className="text-white/40 text-xs">
                {video.views}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecommendedCard;
