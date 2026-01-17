import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { VolumeControl } from './VolumeControl';

const meta: Meta<typeof VolumeControl> = {
  title: 'Controls/VolumeControl',
  component: VolumeControl,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof VolumeControl>;

export const Default: Story = {
  args: {
    volume: 0.75,
    muted: false,
  },
};

export const Muted: Story = {
  args: {
    volume: 0.75,
    muted: true,
  },
};

export const LowVolume: Story = {
  args: {
    volume: 0.25,
    muted: false,
  },
};

export const FullVolume: Story = {
  args: {
    volume: 1,
    muted: false,
  },
};

export const Interactive: Story = {
  render: () => {
    const [volume, setVolume] = useState(0.75);
    const [muted, setMuted] = useState(false);

    return (
      <div>
        <VolumeControl
          volume={volume}
          muted={muted}
          onVolumeChange={setVolume}
          onMuteToggle={() => setMuted(!muted)}
        />
        <div style={{ marginTop: '16px', fontSize: '14px', color: 'var(--fp-color-text-muted)' }}>
          Volume: {Math.round(volume * 100)}% {muted ? '(muted)' : ''}
        </div>
      </div>
    );
  },
};

export const Horizontal: Story = {
  args: {
    volume: 0.75,
    muted: false,
    orientation: 'horizontal',
  },
};

export const HorizontalMuted: Story = {
  args: {
    volume: 0.75,
    muted: true,
    orientation: 'horizontal',
  },
};

export const HorizontalInteractive: Story = {
  render: () => {
    const [volume, setVolume] = useState(0.75);
    const [muted, setMuted] = useState(false);

    return (
      <div>
        <VolumeControl
          volume={volume}
          muted={muted}
          orientation="horizontal"
          onVolumeChange={setVolume}
          onMuteToggle={() => setMuted(!muted)}
        />
        <div style={{ marginTop: '16px', fontSize: '14px', color: 'var(--fp-color-text-muted)' }}>
          Volume: {Math.round(volume * 100)}% {muted ? '(muted)' : ''}
        </div>
      </div>
    );
  },
};
