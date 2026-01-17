import type { Meta, StoryObj } from '@storybook/react';
import { NowPlayingIndicator } from './NowPlayingIndicator';

const meta: Meta<typeof NowPlayingIndicator> = {
  title: 'Controls/NowPlayingIndicator',
  component: NowPlayingIndicator,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#121212' },
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    bars: {
      control: { type: 'range', min: 2, max: 6, step: 1 },
    },
  },
};

export default meta;
type Story = StoryObj<typeof NowPlayingIndicator>;

export const Playing: Story = {
  args: {
    isPlaying: true,
  },
};

export const Paused: Story = {
  args: {
    isPlaying: false,
  },
};

export const Small: Story = {
  args: {
    isPlaying: true,
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    isPlaying: true,
    size: 'lg',
  },
};

export const ThreeBars: Story = {
  args: {
    isPlaying: true,
    bars: 3,
  },
};

export const FiveBars: Story = {
  args: {
    isPlaying: true,
    bars: 5,
  },
};
