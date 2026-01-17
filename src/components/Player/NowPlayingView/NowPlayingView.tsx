import { useCallback, useState } from 'react';
import { cn, formatTime } from '@/utils';
import { usePlayer } from '@/hooks/usePlayer';
import { useChapters } from '@/hooks/useChapters';
import { PlayButton } from '@/components/controls/PlayButton';
import { ProgressBar } from '@/components/controls/ProgressBar';
import { VolumeControl } from '@/components/controls/VolumeControl';
import { SkipButton } from '@/components/controls/SkipButtons';
import { NowPlayingIndicator } from '@/components/controls/NowPlayingIndicator';
import { AdOverlay } from '@/components/ads/AdOverlay';
import type { Chapter } from '@/types/player';
import type { AdState, AdControls } from '@/types/ads';

export interface NowPlayingViewProps {
  className?: string;
  onClose?: () => void;
  adState?: AdState;
  adControls?: Pick<AdControls, 'skipAd' | 'clickThrough'>;
}

export function NowPlayingView({
  className,
  onClose,
  adState,
  adControls,
}: NowPlayingViewProps) {
  const { state, playlistState, controls, config } = usePlayer();
  const [isFlipped, setIsFlipped] = useState(false);

  // Check if ads are playing - disable controls when true
  const isAdPlaying = adState?.isPlayingAd ?? false;
  const controlsDisabled = state.isLoading || isAdPlaying;

  const currentTrack = playlistState.currentTrack;
  const chapters = currentTrack?.chapters || [];

  const handleChapterChange = useCallback((chapter: Chapter) => {
    controls.seek(chapter.startTime);
  }, [controls]);

  const chapterState = useChapters({
    chapters,
    currentTime: state.currentTime,
    onChapterChange: handleChapterChange,
  });

  const toggleFlip = () => setIsFlipped(!isFlipped);

  return (
    <div
      className={cn(
        'relative flex flex-col items-center',
        'w-full max-w-md mx-auto',
        'bg-[var(--fp-color-background)]',
        'p-6 pt-8',
        'min-h-[100dvh]',
        className
      )}
    >
      {/* Background gradient from artwork */}
      {currentTrack?.artwork && (
        <div
          className="absolute inset-0 opacity-30 blur-3xl scale-150"
          style={{
            backgroundImage: `url(${currentTrack.artwork})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--fp-color-background)]/70 to-[var(--fp-color-background)]" />

      {/* Ad Overlay */}
      {adState && adControls && (
        <AdOverlay state={adState} controls={adControls} className="rounded-none" />
      )}

      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className={cn(
            'absolute top-4 right-4 z-20',
            'w-8 h-8 rounded-full',
            'flex items-center justify-center',
            'text-[var(--fp-color-text-secondary)]',
            'hover:text-[var(--fp-color-text)]',
            'hover:bg-[var(--fp-color-surface-hover)]',
            'transition-colors duration-150'
          )}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full flex-1">

        {/* Flippable Cover Art Container */}
        <div
          className="w-full aspect-square max-w-[320px] mb-8 cursor-pointer"
          style={{ perspective: '1000px' }}
          onClick={toggleFlip}
        >
          <div
            className={cn(
              'relative w-full h-full transition-transform duration-500',
              'transform-gpu'
            )}
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
            }}
          >
            {/* Front - Cover Art */}
            <div
              className="absolute inset-0 w-full h-full"
              style={{ backfaceVisibility: 'hidden' }}
            >
              {currentTrack?.artwork ? (
                <div className="relative w-full h-full">
                  {/* Glow effect */}
                  <div
                    className={cn(
                      'absolute inset-0 blur-2xl opacity-50 scale-95 translate-y-4',
                      state.isPlaying && 'animate-pulse'
                    )}
                    style={{
                      backgroundImage: `url(${currentTrack.artwork})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                  {/* Main artwork */}
                  <img
                    src={currentTrack.artwork}
                    alt={currentTrack.title || 'Album artwork'}
                    className="relative w-full h-full object-cover rounded-xl shadow-2xl"
                  />
                  {/* Flip hint */}
                  <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white/70">
                      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                    </svg>
                    <span className="text-[10px] text-white/70 font-medium">Info</span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full rounded-xl bg-[var(--fp-color-surface)] flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-20 h-20 text-[var(--fp-color-text-muted)]">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Back - Track Info */}
            <div
              className={cn(
                'absolute inset-0 w-full h-full',
                'bg-[var(--fp-color-surface)] rounded-xl',
                'border border-[var(--fp-glass-border)]',
                'shadow-2xl',
                'p-5 overflow-y-auto'
              )}
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)'
              }}
            >
              {/* Back Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[var(--fp-color-text-secondary)] uppercase tracking-wider">
                  Track Info
                </h3>
                <div className="bg-[var(--fp-color-accent)]/20 rounded-full px-2 py-0.5">
                  <span className="text-[10px] text-[var(--fp-color-accent)] font-medium">
                    Tap to flip
                  </span>
                </div>
              </div>

              {/* Track Details */}
              <div className="space-y-4">
                {/* Title & Artist */}
                <div>
                  <h4 className="text-lg font-bold text-[var(--fp-color-text)]">
                    {currentTrack?.title || 'Unknown Title'}
                  </h4>
                  <p className="text-sm text-[var(--fp-color-text-secondary)]">
                    {currentTrack?.artist || 'Unknown Artist'}
                  </p>
                </div>

                {/* Album */}
                {currentTrack?.album && (
                  <div>
                    <span className="text-xs text-[var(--fp-color-text-muted)] uppercase tracking-wider">Album</span>
                    <p className="text-sm text-[var(--fp-color-text)]">{currentTrack.album}</p>
                  </div>
                )}

                {/* Duration */}
                <div>
                  <span className="text-xs text-[var(--fp-color-text-muted)] uppercase tracking-wider">Duration</span>
                  <p className="text-sm text-[var(--fp-color-text)]">{formatTime(state.duration)}</p>
                </div>

                {/* Chapters */}
                {chapters.length > 0 && (
                  <div>
                    <span className="text-xs text-[var(--fp-color-text-muted)] uppercase tracking-wider mb-2 block">
                      Chapters ({chapters.length})
                    </span>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {chapters.map((chapter, index) => (
                        <button
                          key={chapter.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            controls.seek(chapter.startTime);
                          }}
                          className={cn(
                            'w-full flex items-center gap-2 p-2 rounded-lg text-left',
                            'hover:bg-[var(--fp-color-surface-hover)]',
                            'transition-colors duration-150',
                            chapterState.currentChapterIndex === index && 'bg-[var(--fp-color-accent)]/10'
                          )}
                        >
                          <span className={cn(
                            'text-xs tabular-nums',
                            chapterState.currentChapterIndex === index
                              ? 'text-[var(--fp-color-accent)]'
                              : 'text-[var(--fp-color-text-muted)]'
                          )}>
                            {formatTime(chapter.startTime)}
                          </span>
                          <span className={cn(
                            'text-sm truncate flex-1',
                            chapterState.currentChapterIndex === index
                              ? 'text-[var(--fp-color-accent)] font-medium'
                              : 'text-[var(--fp-color-text)]'
                          )}>
                            {chapter.title}
                          </span>
                          {chapterState.currentChapterIndex === index && (
                            <NowPlayingIndicator isPlaying={state.isPlaying} size="sm" bars={3} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Playback Info */}
                <div className="pt-3 border-t border-[var(--fp-glass-border)]">
                  <div className="flex justify-between text-xs text-[var(--fp-color-text-muted)]">
                    <span>Playback Speed</span>
                    <span className="text-[var(--fp-color-text)]">{state.playbackRate}x</span>
                  </div>
                  <div className="flex justify-between text-xs text-[var(--fp-color-text-muted)] mt-1">
                    <span>Volume</span>
                    <span className="text-[var(--fp-color-text)]">{Math.round(state.volume * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Track Info (below cover) */}
        <div className="w-full text-center mb-6 px-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            {state.isPlaying && (
              <NowPlayingIndicator isPlaying={state.isPlaying} size="sm" />
            )}
            <h1 className="text-xl font-bold text-[var(--fp-color-text)] truncate">
              {currentTrack?.title || 'No track selected'}
            </h1>
          </div>
          {currentTrack?.artist && (
            <p className="text-base text-[var(--fp-color-text-secondary)] truncate">
              {currentTrack.artist}
            </p>
          )}
          {chapterState.currentChapter && (
            <p className="text-sm text-[var(--fp-color-text-muted)] truncate mt-1">
              {chapterState.currentChapter.title}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        <div className={cn('w-full px-4 mb-2', isAdPlaying && 'opacity-50 pointer-events-none')}>
          <ProgressBar
            currentTime={state.currentTime}
            duration={state.duration}
            buffered={state.buffered}
            chapters={chapters}
            onSeek={controlsDisabled ? undefined : controls.seek}
            disabled={controlsDisabled}
          />
        </div>

        {/* Time Display */}
        <div className="w-full flex justify-between px-4 mb-8">
          <span className="text-xs text-[var(--fp-color-text-secondary)] tabular-nums">
            {formatTime(state.currentTime)}
          </span>
          <span className="text-xs text-[var(--fp-color-text-secondary)] tabular-nums">
            -{formatTime(Math.max(0, state.duration - state.currentTime))}
          </span>
        </div>

        {/* Main Controls */}
        <div className={cn('flex items-center justify-center gap-3 mb-6', isAdPlaying && 'opacity-50 pointer-events-none')}>
          <SkipButton
            direction="backward"
            seconds={config.skipBackwardSeconds}
            size="sm"
            onClick={() => controls.skipBackward()}
            disabled={controlsDisabled}
          />

          <PlayButton
            isPlaying={state.isPlaying}
            isLoading={state.isLoading}
            onClick={controls.toggle}
            size="md"
            disabled={controlsDisabled}
          />

          <SkipButton
            direction="forward"
            seconds={config.skipForwardSeconds}
            size="sm"
            onClick={() => controls.skipForward()}
            disabled={controlsDisabled}
          />
        </div>

        {/* Secondary Controls */}
        <div className={cn('flex items-center justify-center gap-4', isAdPlaying && 'opacity-50 pointer-events-none')}>
          <VolumeControl
            volume={state.volume}
            muted={state.isMuted}
            orientation="horizontal"
            onVolumeChange={controls.setVolume}
            onMuteToggle={controls.toggleMute}
            disabled={controlsDisabled}
          />
        </div>
      </div>
    </div>
  );
}
