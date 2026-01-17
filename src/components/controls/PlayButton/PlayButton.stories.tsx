import type { Meta, StoryObj } from '@storybook/react';
import { PlayButton } from './PlayButton';

const meta: Meta<typeof PlayButton> = {
  title: 'Controls/PlayButton',
  component: PlayButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof PlayButton>;

export const Default: Story = {
  args: {
    isPlaying: false,
  },
};

export const Playing: Story = {
  args: {
    isPlaying: true,
  },
};

export const Loading: Story = {
  args: {
    isPlaying: false,
    isLoading: true,
  },
};

export const Disabled: Story = {
  args: {
    isPlaying: false,
    disabled: true,
  },
};

export const Small: Story = {
  args: {
    isPlaying: false,
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    isPlaying: false,
    size: 'lg',
  },
};
