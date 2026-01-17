import type { Meta, StoryObj } from '@storybook/react';
import { useState, useEffect, useCallback } from 'react';
import { EpisodeView } from './EpisodeView';
import type { AdState, AdBreak } from '@/types/ads';

const meta: Meta<typeof EpisodeView> = {
  title: 'Player/EpisodeView',
  component: EpisodeView,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#003333' },
        { name: 'light', value: '#effefb' },
      ],
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof EpisodeView>;

const sampleEpisode = {
  artwork: 'https://picsum.photos/seed/podcast1/400/400',
  title: 'Episode 42: The Future of Artificial Intelligence',
  showName: 'Tech Talk Podcast',
  description: `In this episode, we discuss the latest developments in artificial intelligence. We explore Large Language Models, their applications, and the ethical challenges they present. We also take a look at the future of AI and how it will change our daily lives. Our guest today is Dr. Maria Schmidt, a leading expert in machine learning.`,
  publishedAt: 'Jan 15, 2025',
  duration: 2847,
};

export const Default: Story = {
  args: {
    ...sampleEpisode,
    currentTime: 423,
    buffered: 1200,
    isPlaying: false,
    volume: 0.8,
  },
};

export const Playing: Story = {
  args: {
    ...sampleEpisode,
    currentTime: 423,
    buffered: 1200,
    isPlaying: true,
    volume: 0.8,
  },
};

export const Loading: Story = {
  args: {
    ...sampleEpisode,
    currentTime: 0,
    isPlaying: false,
    isLoading: true,
  },
};

export const ShortDescription: Story = {
  args: {
    ...sampleEpisode,
    description: 'A short description of the episode.',
    currentTime: 100,
  },
};

export const NoArtwork: Story = {
  args: {
    ...sampleEpisode,
    artwork: undefined,
    currentTime: 500,
  },
};

export const Interactive: Story = {
  render: function InteractiveEpisode() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(423);
    const [volume, setVolume] = useState(0.8);
    const [muted, setMuted] = useState(false);

    return (
      <EpisodeView
        {...sampleEpisode}
        currentTime={currentTime}
        buffered={1200}
        isPlaying={isPlaying}
        volume={volume}
        muted={muted}
        onPlay={() => setIsPlaying(!isPlaying)}
        onSeek={setCurrentTime}
        onSkipForward={() => setCurrentTime(Math.min(sampleEpisode.duration, currentTime + 30))}
        onSkipBackward={() => setCurrentTime(Math.max(0, currentTime - 10))}
        onVolumeChange={setVolume}
        onMuteToggle={() => setMuted(!muted)}
      />
    );
  },
};

// Story demonstrating ad playback
export const WithAds: Story = {
  render: function EpisodeWithAds() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [muted, setMuted] = useState(false);

    // Ad state
    const [adState, setAdState] = useState<AdState>({
      isPlayingAd: false,
      currentAd: null,
      currentAdBreak: null,
      adProgress: 0,
      adDuration: 0,
      canSkip: false,
      skipCountdown: 0,
      adsRemaining: 0,
    });

    const sampleAdBreak: AdBreak = {
      id: 'preroll-1',
      position: 'pre-roll',
      ads: [
        {
          id: 'ad-1',
          src: 'https://example.com/ad.mp3',
          duration: 10,
          skipAfterSeconds: 5,
          title: 'Sponsor: Fairu Premium',
          clickThroughUrl: 'https://fairu.app/premium',
        },
      ],
    };

    const [currentAdIndex, setCurrentAdIndex] = useState(0);

    // Start ad break when user presses play for the first time
    const handlePlay = useCallback(() => {
      if (currentTime === 0 && !isPlaying && !adState.isPlayingAd) {
        // Trigger pre-roll ad
        const ad = sampleAdBreak.ads[0];
        setCurrentAdIndex(0);
        setAdState({
          isPlayingAd: true,
          currentAd: ad,
          currentAdBreak: sampleAdBreak,
          adProgress: 0,
          adDuration: ad.duration,
          canSkip: false,
          skipCountdown: ad.skipAfterSeconds ?? 0,
          adsRemaining: sampleAdBreak.ads.length - 1,
        });
      } else {
        setIsPlaying(!isPlaying);
      }
    }, [currentTime, isPlaying, adState.isPlayingAd]);

    // Skip ad handler
    const skipAd = useCallback(() => {
      const nextIndex = currentAdIndex + 1;
      if (nextIndex < sampleAdBreak.ads.length) {
        const nextAd = sampleAdBreak.ads[nextIndex];
        setCurrentAdIndex(nextIndex);
        setAdState((prev) => ({
          ...prev,
          currentAd: nextAd,
          adProgress: 0,
          adDuration: nextAd.duration,
          canSkip: false,
          skipCountdown: nextAd.skipAfterSeconds ?? 0,
          adsRemaining: sampleAdBreak.ads.length - nextIndex - 1,
        }));
      } else {
        // End ad break, start content
        setAdState({
          isPlayingAd: false,
          currentAd: null,
          currentAdBreak: null,
          adProgress: 0,
          adDuration: 0,
          canSkip: false,
          skipCountdown: 0,
          adsRemaining: 0,
        });
        setIsPlaying(true);
      }
    }, [currentAdIndex]);

    // Simulate ad progress
    useEffect(() => {
      if (!adState.isPlayingAd) return;

      const interval = setInterval(() => {
        setAdState((prev) => {
          const newProgress = prev.adProgress + 0.1;
          const newCountdown = Math.max(0, prev.skipCountdown - 0.1);
          const canSkip = newCountdown <= 0;

          // Ad finished
          if (newProgress >= prev.adDuration) {
            skipAd();
            return prev;
          }

          return {
            ...prev,
            adProgress: newProgress,
            skipCountdown: Math.ceil(newCountdown),
            canSkip,
          };
        });
      }, 100);

      return () => clearInterval(interval);
    }, [adState.isPlayingAd, skipAd]);

    // Simulate content progress
    useEffect(() => {
      if (!isPlaying || adState.isPlayingAd) return;

      const interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= sampleEpisode.duration) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }, [isPlaying, adState.isPlayingAd]);

    return (
      <div>
        <EpisodeView
          {...sampleEpisode}
          currentTime={currentTime}
          buffered={1200}
          isPlaying={isPlaying}
          volume={volume}
          muted={muted}
          adState={adState}
          adControls={{
            skipAd,
            clickThrough: () => alert('Clicked through to advertiser'),
          }}
          onPlay={handlePlay}
          onSeek={setCurrentTime}
          onSkipForward={() => setCurrentTime(Math.min(sampleEpisode.duration, currentTime + 30))}
          onSkipBackward={() => setCurrentTime(Math.max(0, currentTime - 10))}
          onVolumeChange={setVolume}
          onMuteToggle={() => setMuted(!muted)}
        />
        <p className="text-xs text-center mt-4 text-[var(--fp-color-text-muted)]">
          Press Play to start the pre-roll ad
        </p>
      </div>
    );
  },
};
