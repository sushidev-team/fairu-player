import type { Meta, StoryObj } from '@storybook/react';
import { NowPlayingView } from './NowPlayingView';
import { PlayerProvider } from '@/context/PlayerContext';

const sampleTrack = {
  id: '1',
  src: 'https://example.com/audio.mp3',
  title: 'Awesome Track Title',
  artist: 'Amazing Artist',
  album: 'Greatest Hits',
  artwork: 'https://picsum.photos/400/400',
  chapters: [
    { id: 'ch1', title: 'Introduction', startTime: 0 },
    { id: 'ch2', title: 'Verse 1', startTime: 30 },
    { id: 'ch3', title: 'Chorus', startTime: 60 },
    { id: 'ch4', title: 'Verse 2', startTime: 90 },
    { id: 'ch5', title: 'Bridge', startTime: 120 },
    { id: 'ch6', title: 'Outro', startTime: 150 },
  ],
};

const meta: Meta<typeof NowPlayingView> = {
  title: 'Player/NowPlayingView',
  component: NowPlayingView,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#121212' },
      ],
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <PlayerProvider
        config={{
          playlist: [sampleTrack],
        }}
      >
        <Story />
      </PlayerProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof NowPlayingView>;

export const Default: Story = {
  args: {},
};

export const WithCloseButton: Story = {
  args: {
    onClose: () => alert('Close clicked'),
  },
};
