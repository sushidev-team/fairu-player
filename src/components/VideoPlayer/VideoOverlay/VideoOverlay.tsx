import { cn } from '@/utils/cn';
import { useLabels } from '@/context/LabelsContext';
import type { PlayerLabels } from '@/types/labels';

export interface VideoOverlayProps {
  isPlaying: boolean;
  isLoading: boolean;
  onClick?: () => void;
  visible?: boolean;
  className?: string;
  labels?: Pick<PlayerLabels, 'playVideo'>;
}

/**
 * Video overlay with big play button and loading indicator
 */
export function VideoOverlay({
  isPlaying,
  isLoading,
  onClick,
  visible = true,
  className,
  labels: labelsProp,
}: VideoOverlayProps) {
  const contextLabels = useLabels();
  const labels = labelsProp ?? contextLabels;
  if (!visible && !isLoading) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 z-10',
        'flex items-center justify-center',
        'transition-opacity duration-300',
        visible || isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none',
        className
      )}
      onClick={onClick}
    >
      {/* Semi-transparent background */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Loading spinner */}
      {isLoading && (
        <div className="relative z-10">
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Big play button */}
      {!isLoading && !isPlaying && (
        <button
          className={cn(
            'relative z-10',
            'w-20 h-20 rounded-full',
            'bg-white/20 backdrop-blur-sm',
            'flex items-center justify-center',
            'transition-all duration-200',
            'hover:bg-white/30 hover:scale-110',
            'focus:outline-none focus:ring-2 focus:ring-white/50'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          aria-label={labels.playVideo}
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-10 h-10 text-white ml-1"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default VideoOverlay;
