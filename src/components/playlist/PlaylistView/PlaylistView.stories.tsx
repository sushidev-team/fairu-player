import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { PlaylistView } from './PlaylistView';
import type { Track } from '@/types/player';

const sampleTracks: Track[] = [
  {
    id: '1',
    src: 'https://example.com/track1.mp3',
    title: 'Episode 1: Getting Started with React',
    artist: 'Tech Talks Podcast',
    artwork: 'https://picsum.photos/100?random=1',
    duration: 1800,
  },
  {
    id: '2',
    src: 'https://example.com/track2.mp3',
    title: 'Episode 2: State Management Deep Dive',
    artist: 'Tech Talks Podcast',
    artwork: 'https://picsum.photos/100?random=2',
    duration: 2100,
  },
  {
    id: '3',
    src: 'https://example.com/track3.mp3',
    title: 'Episode 3: Building Custom Hooks',
    artist: 'Tech Talks Podcast',
    artwork: 'https://picsum.photos/100?random=3',
    duration: 1650,
  },
  {
    id: '4',
    src: 'https://example.com/track4.mp3',
    title: 'Episode 4: Performance Optimization',
    artist: 'Tech Talks Podcast',
    artwork: 'https://picsum.photos/100?random=4',
    duration: 1920,
  },
  {
    id: '5',
    src: 'https://example.com/track5.mp3',
    title: 'Episode 5: Testing Best Practices',
    artist: 'Tech Talks Podcast',
    artwork: 'https://picsum.photos/100?random=5',
    duration: 2040,
  },
];

const meta: Meta<typeof PlaylistView> = {
  title: 'Playlist/PlaylistView',
  component: PlaylistView,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '400px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PlaylistView>;

export const Default: Story = {
  args: {
    tracks: sampleTracks,
    currentIndex: 1,
    isPlaying: true,
  },
};

export const NotPlaying: Story = {
  args: {
    tracks: sampleTracks,
    currentIndex: 0,
    isPlaying: false,
  },
};

export const LongPlaylist: Story = {
  args: {
    tracks: [...sampleTracks, ...sampleTracks.map((t, i) => ({ ...t, id: `${t.id}-copy-${i}`, title: `${t.title} (Replay)` }))],
    currentIndex: 3,
    isPlaying: true,
    maxHeight: '200px',
  },
};

export const Interactive: Story = {
  render: () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    return (
      <div>
        <PlaylistView
          tracks={sampleTracks}
          currentIndex={currentIndex}
          isPlaying={isPlaying}
          onTrackClick={(_, index) => {
            setCurrentIndex(index);
            setIsPlaying(true);
          }}
        />
        <div style={{ marginTop: '16px' }}>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{ padding: '8px 16px', cursor: 'pointer' }}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
        </div>
      </div>
    );
  },
};
