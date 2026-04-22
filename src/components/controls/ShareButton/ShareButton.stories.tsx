import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ShareButton } from './ShareButton';

const meta: Meta<typeof ShareButton> = {
  title: 'Controls/ShareButton',
  component: ShareButton,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#121212' }],
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ShareButton>;

export const Default: Story = {
  args: {
    currentTime: 90,
    getShareUrl: (time?: number) =>
      `https://fairu.app/episode/123?t=${time ?? 0}`,
    copyShareUrl: async () => true,
  },
};

export const Disabled: Story = {
  args: {
    currentTime: 90,
    getShareUrl: (time?: number) =>
      `https://fairu.app/episode/123?t=${time ?? 0}`,
    copyShareUrl: async () => true,
    disabled: true,
  },
};

export const Interactive: Story = {
  render: function InteractiveShareButton() {
    const [currentTime, setCurrentTime] = useState(90);

    const getShareUrl = (time?: number) =>
      `https://fairu.app/episode/123?t=${time ?? 0}`;

    const copyShareUrl = async (time?: number) => {
      const url = getShareUrl(time);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(url);
          return true;
        } catch {
          return true;
        }
      }
      return true;
    };

    return (
      <div className="flex flex-col items-center gap-4">
        <ShareButton
          currentTime={currentTime}
          getShareUrl={getShareUrl}
          copyShareUrl={copyShareUrl}
        />

        <label className="flex flex-col items-center gap-2 text-[var(--fp-color-text-secondary)] text-sm">
          <span>Current Time: {currentTime}s</span>
          <input
            type="range"
            min={0}
            max={600}
            value={currentTime}
            onChange={(e) => setCurrentTime(Number(e.target.value))}
            className="w-48"
          />
        </label>

        <p className="text-[var(--fp-color-text-secondary)] text-xs">
          {getShareUrl(currentTime)}
        </p>
      </div>
    );
  },
};
