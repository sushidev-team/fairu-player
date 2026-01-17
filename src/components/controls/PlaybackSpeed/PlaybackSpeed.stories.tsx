import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { PlaybackSpeed } from './PlaybackSpeed';

const meta: Meta<typeof PlaybackSpeed> = {
  title: 'Controls/PlaybackSpeed',
  component: PlaybackSpeed,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PlaybackSpeed>;

export const Default: Story = {
  args: {
    speed: 1,
  },
};

export const Fast: Story = {
  args: {
    speed: 1.5,
  },
};

export const Slow: Story = {
  args: {
    speed: 0.75,
  },
};

export const CustomSpeeds: Story = {
  args: {
    speed: 1,
    speeds: [0.5, 1, 1.5, 2, 3],
  },
};

export const Interactive: Story = {
  render: () => {
    const [speed, setSpeed] = useState(1);

    return (
      <div>
        <PlaybackSpeed speed={speed} onSpeedChange={setSpeed} />
        <div style={{ marginTop: '16px', fontSize: '14px', color: 'var(--fp-color-text-muted)' }}>
          Current speed: {speed}x
        </div>
      </div>
    );
  },
};
