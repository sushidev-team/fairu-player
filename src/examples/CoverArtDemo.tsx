import { useState } from 'react';
import { CoverArtView } from '@/components/Player/CoverArtView';
import { PlayButton } from '@/components/controls/PlayButton';
import { ProgressBar } from '@/components/controls/ProgressBar';
import { SkipButton } from '@/components/controls/SkipButtons';
import { VolumeControl } from '@/components/controls/VolumeControl';
import { cn, formatTime } from '@/utils';

const demoTrack = {
  artwork: 'https://picsum.photos/seed/album1/400/400',
  title: 'Midnight Dreams',
  artist: 'Luna Wave',
  album: 'Nocturnal Vibes',
};

export function CoverArtDemo() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(73);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);

  const duration = 245;

  return (
    <div
      className={cn(
        'min-h-screen w-full',
        'bg-[var(--fp-color-background)]',
        'flex flex-col items-center justify-center',
        'p-6'
      )}
    >
      {/* Background blur from artwork */}
      <div
        className="fixed inset-0 opacity-20 blur-3xl scale-125"
        style={{
          backgroundImage: `url(${demoTrack.artwork})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="fixed inset-0 bg-[var(--fp-color-background)]/80" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* Cover Art */}
        <CoverArtView
          artwork={demoTrack.artwork}
          title={demoTrack.title}
          artist={demoTrack.artist}
          album={demoTrack.album}
          isPlaying={isPlaying}
          size="lg"
          showInfo={true}
          showFlip={true}
        />

        {/* Progress */}
        <div className="w-full mt-8">
          <ProgressBar
            currentTime={currentTime}
            duration={duration}
            buffered={duration * 0.6}
            onSeek={setCurrentTime}
          />
          <div className="flex justify-between mt-2">
            <span className="text-xs text-[var(--fp-color-text-secondary)] tabular-nums">
              {formatTime(currentTime)}
            </span>
            <span className="text-xs text-[var(--fp-color-text-secondary)] tabular-nums">
              -{formatTime(duration - currentTime)}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <SkipButton
            direction="backward"
            seconds={10}
            size="sm"
            onClick={() => setCurrentTime(Math.max(0, currentTime - 10))}
          />

          <PlayButton
            isPlaying={isPlaying}
            onClick={() => setIsPlaying(!isPlaying)}
            size="md"
          />

          <SkipButton
            direction="forward"
            seconds={30}
            size="sm"
            onClick={() => setCurrentTime(Math.min(duration, currentTime + 30))}
          />
        </div>

        {/* Volume */}
        <div className="mt-6">
          <VolumeControl
            volume={volume}
            muted={muted}
            onVolumeChange={setVolume}
            onMuteToggle={() => setMuted(!muted)}
          />
        </div>
      </div>
    </div>
  );
}

export default CoverArtDemo;
