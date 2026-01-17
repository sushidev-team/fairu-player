import type { Meta, StoryObj } from '@storybook/react';
import { CoverArtView } from './CoverArtView';

const meta: Meta<typeof CoverArtView> = {
  title: 'Player/CoverArtView',
  component: CoverArtView,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#121212' },
      ],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['md', 'lg', 'full'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof CoverArtView>;

export const Default: Story = {
  args: {
    artwork: 'https://picsum.photos/400/400',
    title: 'Awesome Track',
    artist: 'Amazing Artist',
    album: 'Greatest Hits',
    isPlaying: false,
  },
};

export const Playing: Story = {
  args: {
    artwork: 'https://picsum.photos/400/400',
    title: 'Awesome Track',
    artist: 'Amazing Artist',
    album: 'Greatest Hits',
    isPlaying: true,
  },
};

export const Medium: Story = {
  args: {
    artwork: 'https://picsum.photos/400/400',
    title: 'Awesome Track',
    artist: 'Amazing Artist',
    size: 'md',
  },
};

export const Large: Story = {
  args: {
    artwork: 'https://picsum.photos/400/400',
    title: 'Awesome Track',
    artist: 'Amazing Artist',
    size: 'lg',
  },
};

export const NoFlip: Story = {
  args: {
    artwork: 'https://picsum.photos/400/400',
    title: 'Awesome Track',
    artist: 'Amazing Artist',
    showFlip: false,
  },
};

export const NoInfo: Story = {
  args: {
    artwork: 'https://picsum.photos/400/400',
    title: 'Awesome Track',
    artist: 'Amazing Artist',
    showInfo: false,
  },
};

export const NoArtwork: Story = {
  args: {
    title: 'Track Without Cover',
    artist: 'Unknown Artist',
  },
};
