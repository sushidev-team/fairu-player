import type { Meta, StoryObj } from '@storybook/react';
import { useState, useEffect } from 'react';
import { OverlayAd } from './OverlayAd';
import type { OverlayAd as OverlayAdType } from '@/types/video';

const meta: Meta<typeof OverlayAd> = {
  title: 'Ads/OverlayAd',
  component: OverlayAd,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#121212' }],
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="relative w-[640px] h-[360px] bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">
          Video Content Area
        </div>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof OverlayAd>;

const sampleOverlayAd: OverlayAdType = {
  id: 'overlay-1',
  imageUrl: 'https://placehold.co/600x100/1a1a2e/ffffff?text=Sponsored+Banner+Ad',
  clickThroughUrl: 'https://example.com/promo',
  displayAt: 0,
  duration: 15,
  position: 'bottom',
  closeable: true,
  altText: 'Special offer - 50% off',
};

export const Default: Story = {
  args: {
    ad: sampleOverlayAd,
    currentTime: 5,
    visible: true,
  },
};

export const TopPosition: Story = {
  args: {
    ad: {
      ...sampleOverlayAd,
      id: 'overlay-top',
      position: 'top',
    },
    currentTime: 5,
    visible: true,
  },
};

export const NotCloseable: Story = {
  args: {
    ad: {
      ...sampleOverlayAd,
      id: 'overlay-no-close',
      closeable: false,
    },
    currentTime: 5,
    visible: true,
  },
};

export const NoClickThrough: Story = {
  args: {
    ad: {
      ...sampleOverlayAd,
      id: 'overlay-no-click',
      clickThroughUrl: undefined,
    },
    currentTime: 5,
    visible: true,
  },
};

// Interactive story with time-based visibility
export const Interactive: Story = {
  render: function InteractiveOverlay() {
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const overlayAd: OverlayAdType = {
      id: 'overlay-interactive',
      imageUrl: 'https://placehold.co/600x100/2d5a27/ffffff?text=Limited+Time+Offer+-+Click+Here!',
      clickThroughUrl: 'https://example.com/promo',
      displayAt: 3,
      duration: 10,
      position: 'bottom',
      closeable: true,
    };

    useEffect(() => {
      if (!isPlaying) return;

      const interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= 20) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, 100);

      return () => clearInterval(interval);
    }, [isPlaying]);

    return (
      <div className="relative w-full h-full">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="text-white/50 text-sm">
            Time: {currentTime.toFixed(1)}s (Ad shows at {overlayAd.displayAt}s for {overlayAd.duration}s)
          </div>
          <button
            onClick={() => {
              setIsPlaying(!isPlaying);
              if (!isPlaying) setCurrentTime(0);
            }}
            className="px-4 py-2 bg-white text-black rounded font-medium"
          >
            {isPlaying ? 'Stop' : 'Play Video'}
          </button>
        </div>

        <OverlayAd
          ad={overlayAd}
          currentTime={currentTime}
          visible={isPlaying}
          onClose={(ad) => console.log('Closed overlay:', ad.id)}
          onClick={() => alert('Clicked overlay ad!')}
          onImpression={(ad) => console.log('Impression tracked:', ad.id)}
        />
      </div>
    );
  },
};
