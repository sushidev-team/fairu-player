import { cn } from '@/utils/cn';
import { useLabels } from '@/context/LabelsContext';
import { PlayButton } from '@/components/controls/PlayButton';
import { ProgressBar } from '@/components/controls/ProgressBar';
import { TimeDisplay } from '@/components/controls/TimeDisplay';
import { VolumeControl } from '@/components/controls/VolumeControl';
import { PlaybackSpeed } from '@/components/controls/PlaybackSpeed';
import { SkipButton } from '@/components/controls/SkipButtons';
import { SubtitleSelector } from '@/components/controls/SubtitleSelector';
import { PictureInPictureButton } from '@/components/controls/PictureInPictureButton';
import type { VideoState, VideoControls as VideoControlsType, VideoFeatures, Subtitle } from '@/types/video';
import type { PlaylistState, PlaylistControls } from '@/types/player';
import type { TimelineMarker } from '@/types/markers';

export interface VideoControlsProps {
  visible: boolean;
  state: VideoState;
  controls: VideoControlsType;
  features?: VideoFeatures;
  disabled?: boolean;
  className?: string;
  /** Playlist state for showing playlist controls */
  playlistState?: PlaylistState;
  /** Playlist controls for next/previous */
  playlistControls?: PlaylistControls;
  /** Available subtitles */
  subtitles?: Subtitle[];
  /** Timeline markers */
  markers?: TimelineMarker[];
  onFullscreenClick?: () => void;
  onQualityChange?: (quality: string) => void;
}

/**
 * Floating video controls bar
 */
export function VideoControls({
  visible,
  state,
  controls,
  features = {},
  disabled = false,
  className,
  playlistState,
  playlistControls,
  subtitles = [],
  markers,
  onFullscreenClick,
  onQualityChange,
}: VideoControlsProps) {
  const labels = useLabels();
  const hasPlaylist = playlistState && playlistState.tracks.length > 1;
  const hasPrevious = playlistState && playlistState.currentIndex > 0;
  const hasNext = playlistState && playlistState.currentIndex < playlistState.tracks.length - 1;
  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 right-0 z-20',
        'bg-gradient-to-t from-black/80 via-black/50 to-transparent',
        'px-4 pb-4 pt-12',
        'transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        className
      )}
    >
      {/* Progress bar - full width */}
      {features.progressBar !== false && (
        <ProgressBar
          currentTime={state.currentTime}
          duration={state.duration}
          buffered={state.buffered}
          markers={markers}
          disabled={disabled || features.seekingDisabled}
          onSeek={features.seekingDisabled ? undefined : controls.seek}
          className="mb-3"
        />
      )}

      {/* Control buttons row */}
      <div className="flex items-center justify-between">
        {/* Left controls */}
        <div className="flex items-center gap-2">
          {/* Previous track button */}
          {hasPlaylist && playlistControls && (
            <button
              onClick={playlistControls.previous}
              disabled={disabled || !hasPrevious}
              className={cn(
                'p-2 rounded-lg',
                'text-white/80 hover:text-white hover:bg-white/10',
                'transition-colors',
                (disabled || !hasPrevious) && 'opacity-50 cursor-not-allowed'
              )}
              aria-label={labels.previousTrack}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>
          )}

          <PlayButton
            isPlaying={state.isPlaying}
            isLoading={state.isLoading}
            disabled={disabled}
            onClick={controls.toggle}
            size="sm"
          />

          {/* Next track button */}
          {hasPlaylist && playlistControls && (
            <button
              onClick={playlistControls.next}
              disabled={disabled || !hasNext}
              className={cn(
                'p-2 rounded-lg',
                'text-white/80 hover:text-white hover:bg-white/10',
                'transition-colors',
                (disabled || !hasNext) && 'opacity-50 cursor-not-allowed'
              )}
              aria-label={labels.nextTrack}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          )}

          {features.skipButtons !== false && !features.seekingDisabled && (
            <>
              <SkipButton
                direction="backward"
                disabled={disabled}
                onClick={() => controls.skipBackward()}
              />
              <SkipButton
                direction="forward"
                disabled={disabled}
                onClick={() => controls.skipForward()}
              />
            </>
          )}

          {features.volumeControl !== false && (
            <VolumeControl
              volume={state.volume}
              muted={state.isMuted}
              disabled={false}
              orientation="horizontal"
              onVolumeChange={controls.setVolume}
              onMuteToggle={controls.toggleMute}
            />
          )}

          {features.timeDisplay !== false && (
            <TimeDisplay
              currentTime={state.currentTime}
              duration={state.duration}
              className="text-white text-sm ml-2"
            />
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {features.playbackSpeed !== false && (
            <PlaybackSpeed
              speed={state.playbackRate}
              disabled={disabled}
              onSpeedChange={controls.setPlaybackRate}
            />
          )}

          {features.qualitySelector !== false && state.availableQualities.length > 1 && (
            <button
              onClick={() => onQualityChange?.(state.currentQuality)}
              disabled={disabled}
              className={cn(
                'px-2 py-1 rounded text-sm text-white/80',
                'hover:text-white hover:bg-white/10',
                'transition-colors',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {state.currentQuality}
            </button>
          )}

          {features.subtitles !== false && subtitles.length > 0 && (
            <SubtitleSelector
              currentSubtitle={state.currentSubtitle}
              subtitles={subtitles}
              onSubtitleChange={controls.setSubtitle}
              disabled={disabled}
            />
          )}

          {features.pictureInPicture && (
            <PictureInPictureButton
              isPictureInPicture={state.isPictureInPicture}
              disabled={disabled}
              onClick={controls.togglePictureInPicture}
            />
          )}

          {features.fullscreen !== false && (
            <button
              onClick={onFullscreenClick || controls.toggleFullscreen}
              disabled={disabled}
              className={cn(
                'p-2 rounded-lg',
                'text-white/80 hover:text-white hover:bg-white/10',
                'transition-colors',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              aria-label={state.isFullscreen ? labels.exitFullscreen : labels.enterFullscreen}
            >
              {state.isFullscreen ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default VideoControls;
