import { useCallback } from 'react';
import { cn } from '@/utils';
import { usePlayer } from '@/hooks/usePlayer';
import { useChapters } from '@/hooks/useChapters';
import { useKeyboardControls } from '@/hooks/useKeyboardControls';
import { PlayButton } from '@/components/controls/PlayButton';
import { ProgressBar } from '@/components/controls/ProgressBar';
import { TimeDisplay } from '@/components/controls/TimeDisplay';
import { VolumeControl } from '@/components/controls/VolumeControl';
import { PlaybackSpeed } from '@/components/controls/PlaybackSpeed';
import { SkipButton } from '@/components/controls/SkipButtons';
import { ChapterList } from '@/components/chapters/ChapterList';
import { PlaylistView } from '@/components/playlist/PlaylistView';
import { PlaylistControls } from '@/components/playlist/PlaylistControls';
import { AdOverlay } from '@/components/ads/AdOverlay';
import type { PlayerProps, Chapter } from '@/types/player';
import type { AdState, AdControls } from '@/types/ads';

export interface PlayerInnerProps {
  showChapters?: boolean;
  showPlaylist?: boolean;
  compact?: boolean;
  className?: string;
  adState?: AdState;
  adControls?: Pick<AdControls, 'skipAd' | 'clickThrough'>;
}

export function PlayerInner({
  showChapters = false,
  showPlaylist = false,
  compact = false,
  className,
  adState,
  adControls,
}: PlayerInnerProps) {
  const { state, playlistState, controls, playlistControls, config } = usePlayer();
  const { features = {} } = config;

  // Check if ads are playing - disable controls when true
  const isAdPlaying = adState?.isPlayingAd ?? false;
  const controlsDisabled = state.isLoading || isAdPlaying;

  const currentTrack = playlistState.currentTrack;
  const chapters = currentTrack?.chapters || [];

  // Chapter handling
  const handleChapterChange = useCallback((chapter: Chapter) => {
    controls.seek(chapter.startTime);
  }, [controls]);

  const chapterState = useChapters({
    chapters,
    currentTime: state.currentTime,
    onChapterChange: handleChapterChange,
  });

  // Keyboard controls
  useKeyboardControls({
    controls,
    enabled: true,
  });

  // Playlist handling
  const handleTrackClick = useCallback((_track: unknown, index: number) => {
    playlistControls.goToTrack(index);
  }, [playlistControls]);

  const hasMultipleTracks = playlistState.tracks.length > 1;

  return (
    <div
      className={cn(
        'fairu-player relative overflow-hidden',
        // Glassmorphism background
        'bg-[var(--fp-glass-bg)] backdrop-blur-[20px]',
        // Border and radius
        'rounded-xl',
        'border border-[var(--fp-glass-border)]',
        // Enhanced shadow
        'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
        // Padding
        'p-5',
        className
      )}
    >
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(29,185,84,0.02) 100%)',
        }}
      />

      {/* Ad Overlay */}
      {adState && adControls && (
        <AdOverlay state={adState} controls={adControls} />
      )}

      {/* Track info */}
      {currentTrack && (
        <div className="relative flex items-center gap-4 mb-5">
          {currentTrack.artwork && (
            <div className="relative flex-shrink-0">
              {/* Artwork glow reflection */}
              <div
                className="absolute inset-0 blur-xl opacity-40 rounded-lg"
                style={{
                  backgroundImage: `url(${currentTrack.artwork})`,
                  backgroundSize: 'cover',
                  transform: 'translateY(8px) scale(0.9)',
                }}
              />
              <img
                src={currentTrack.artwork}
                alt={currentTrack.title || 'Track artwork'}
                className={cn(
                  'relative w-16 h-16 rounded-lg object-cover',
                  'shadow-lg',
                  // Subtle playing animation
                  state.isPlaying && 'fp-animate-glow'
                )}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-[var(--fp-color-text)] truncate">
              {currentTrack.title || 'Untitled'}
            </h2>
            {currentTrack.artist && (
              <p className="text-sm text-[var(--fp-color-text-secondary)] truncate">
                {currentTrack.artist}
              </p>
            )}
            {chapterState.currentChapter && (
              <p className="text-xs text-[var(--fp-color-text-muted)] truncate mt-1">
                Chapter: {chapterState.currentChapter.title}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Progress bar */}
      {features.progressBar !== false && (
        <div className={cn('relative mb-4', isAdPlaying && 'opacity-50 pointer-events-none')}>
          <ProgressBar
            currentTime={state.currentTime}
            duration={state.duration}
            buffered={state.buffered}
            chapters={chapters}
            onSeek={controlsDisabled ? undefined : controls.seek}
            disabled={controlsDisabled}
          />
        </div>
      )}

      {/* Controls */}
      <div className={cn('relative flex items-center justify-between gap-2', isAdPlaying && 'opacity-50 pointer-events-none')}>
        <div className="flex items-center gap-1">
          {/* Skip backward */}
          {features.skipButtons !== false && (
            <SkipButton
              direction="backward"
              seconds={config.skipBackwardSeconds}
              onClick={() => controls.skipBackward()}
              disabled={controlsDisabled}
            />
          )}

          {/* Play/Pause */}
          <PlayButton
            isPlaying={state.isPlaying}
            isLoading={state.isLoading}
            onClick={controls.toggle}
            size={compact ? 'sm' : 'md'}
            disabled={controlsDisabled}
          />

          {/* Skip forward */}
          {features.skipButtons !== false && (
            <SkipButton
              direction="forward"
              seconds={config.skipForwardSeconds}
              onClick={() => controls.skipForward()}
              disabled={controlsDisabled}
            />
          )}
        </div>

        {/* Time display */}
        {features.timeDisplay !== false && (
          <TimeDisplay
            currentTime={state.currentTime}
            duration={state.duration}
          />
        )}

        <div className="flex items-center gap-1">
          {/* Playlist controls */}
          {hasMultipleTracks && (
            <PlaylistControls
              hasPrevious={playlistState.currentIndex > 0 || playlistState.repeat === 'all'}
              hasNext={playlistState.currentIndex < playlistState.tracks.length - 1 || playlistState.repeat === 'all'}
              shuffle={playlistState.shuffle}
              repeat={playlistState.repeat}
              onPrevious={playlistControls.previous}
              onNext={playlistControls.next}
              onShuffleToggle={playlistControls.toggleShuffle}
              onRepeatChange={playlistControls.setRepeat}
              disabled={controlsDisabled}
            />
          )}

          {/* Playback speed */}
          {features.playbackSpeed !== false && (
            <PlaybackSpeed
              speed={state.playbackRate}
              speeds={config.playbackSpeeds}
              onSpeedChange={controls.setPlaybackRate}
              disabled={controlsDisabled}
            />
          )}

          {/* Volume */}
          {features.volumeControl !== false && (
            <VolumeControl
              volume={state.volume}
              muted={state.isMuted}
              onVolumeChange={controls.setVolume}
              onMuteToggle={controls.toggleMute}
              disabled={controlsDisabled}
            />
          )}
        </div>
      </div>

      {/* Chapter list */}
      {showChapters && features.chapters !== false && chapters.length > 0 && (
        <div className="relative mt-5 pt-5 border-t border-[var(--fp-glass-border)]">
          <ChapterList
            chapters={chapters}
            currentChapterIndex={chapterState.currentChapterIndex}
            currentTime={state.currentTime}
            duration={state.duration}
            onChapterClick={(chapter) => controls.seek(chapter.startTime)}
          />
        </div>
      )}

      {/* Playlist view */}
      {showPlaylist && features.playlistView !== false && hasMultipleTracks && (
        <div className="relative mt-5 pt-5 border-t border-[var(--fp-glass-border)]">
          <PlaylistView
            tracks={playlistState.tracks}
            currentIndex={playlistState.currentIndex}
            isPlaying={state.isPlaying}
            onTrackClick={handleTrackClick}
          />
        </div>
      )}

      {/* Error display */}
      {state.error && (
        <div className="relative mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          Error: {state.error.message}
        </div>
      )}
    </div>
  );
}

// Re-export props type
export type { PlayerProps };
