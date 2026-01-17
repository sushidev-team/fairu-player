import type { Meta, StoryObj } from '@storybook/react';
import { PlayerProvider } from '@/context/PlayerContext';
import { TrackingProvider } from '@/context/TrackingContext';
import { Player } from './index';
import type { Track, PlayerConfig } from '@/types/player';

// Sample tracks for stories
const sampleTrack: Track = {
  id: '1',
  src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  title: 'Sample Podcast Episode',
  artist: 'Podcast Host',
  artwork: 'https://picsum.photos/200',
  duration: 375,
  chapters: [
    { id: 'ch1', title: 'Introduction', startTime: 0 },
    { id: 'ch2', title: 'Main Topic', startTime: 60 },
    { id: 'ch3', title: 'Deep Dive', startTime: 180 },
    { id: 'ch4', title: 'Conclusion', startTime: 300 },
  ],
};

const samplePlaylist: Track[] = [
  {
    id: '1',
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    title: 'Episode 1: Getting Started',
    artist: 'Tech Podcast',
    artwork: 'https://picsum.photos/200?random=1',
    duration: 375,
  },
  {
    id: '2',
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    title: 'Episode 2: Advanced Topics',
    artist: 'Tech Podcast',
    artwork: 'https://picsum.photos/200?random=2',
    duration: 420,
  },
  {
    id: '3',
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    title: 'Episode 3: Best Practices',
    artist: 'Tech Podcast',
    artwork: 'https://picsum.photos/200?random=3',
    duration: 390,
  },
];

// Wrapper component for stories
function PlayerWrapper({
  config,
  showChapters,
  showPlaylist,
  compact,
}: {
  config: PlayerConfig;
  showChapters?: boolean;
  showPlaylist?: boolean;
  compact?: boolean;
}) {
  return (
    <TrackingProvider>
      <PlayerProvider config={config}>
        <div style={{ maxWidth: '500px' }}>
          <Player
            showChapters={showChapters}
            showPlaylist={showPlaylist}
            compact={compact}
          />
        </div>
      </PlayerProvider>
    </TrackingProvider>
  );
}

const meta: Meta<typeof PlayerWrapper> = {
  title: 'Components/Player',
  component: PlayerWrapper,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PlayerWrapper>;

export const Default: Story = {
  args: {
    config: {
      track: sampleTrack,
    },
  },
};

export const WithChapters: Story = {
  args: {
    config: {
      track: sampleTrack,
    },
    showChapters: true,
  },
};

export const Playlist: Story = {
  args: {
    config: {
      playlist: samplePlaylist,
    },
    showPlaylist: true,
  },
};

export const PlaylistWithChapters: Story = {
  args: {
    config: {
      playlist: [
        { ...sampleTrack, id: '1', title: 'Episode with Chapters' },
        ...samplePlaylist.slice(1),
      ],
    },
    showChapters: true,
    showPlaylist: true,
  },
};

export const Compact: Story = {
  args: {
    config: {
      track: sampleTrack,
    },
    compact: true,
  },
};

export const MinimalFeatures: Story = {
  args: {
    config: {
      track: sampleTrack,
      features: {
        chapters: false,
        volumeControl: false,
        playbackSpeed: false,
        skipButtons: false,
      },
    },
  },
};

export const CustomSpeeds: Story = {
  args: {
    config: {
      track: sampleTrack,
      playbackSpeeds: [0.5, 1, 1.5, 2, 3],
    },
  },
};

export const AutoPlay: Story = {
  args: {
    config: {
      track: sampleTrack,
      autoPlay: true,
    },
  },
};

export const ShuffleAndRepeat: Story = {
  args: {
    config: {
      playlist: samplePlaylist,
      shuffle: true,
      repeat: 'all',
    },
    showPlaylist: true,
  },
};
