import type { Meta, StoryObj } from '@storybook/react';
import { useState, useCallback } from 'react';
import { PauseAd } from './PauseAd';
import type { PauseAd as PauseAdType } from '@/types/pauseAd';

const meta: Meta<typeof PauseAd> = {
  title: 'Ads/PauseAd',
  component: PauseAd,
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
      <div className="relative w-[640px] aspect-video bg-black rounded-xl overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">
          Video Content Area
        </div>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PauseAd>;

const samplePauseAd: PauseAdType = {
  id: 'pause-ad-1',
  imageUrl: 'https://placehold.co/800x400/1a1a2e/00a99d?text=Pause+Ad',
  clickThroughUrl: 'https://example.com/promo',
  altText: 'Special promotional offer',
  title: 'Special Offer',
  description: 'Get 50% off your first month - Limited time only!',
  minPauseDuration: 0,
  trackingUrls: {
    impression: 'https://example.com/track/impression',
    click: 'https://example.com/track/click',
    close: 'https://example.com/track/close',
  },
};

export const Default: Story = {
  args: {
    ad: samplePauseAd,
    visible: true,
    onDismiss: () => console.log('Ad dismissed'),
    onClick: (ad) => console.log('Ad clicked:', ad.id),
  },
};

export const WithoutClickThrough: Story = {
  args: {
    ad: {
      ...samplePauseAd,
      id: 'pause-ad-no-cta',
      clickThroughUrl: undefined,
    },
    visible: true,
    onDismiss: () => console.log('Ad dismissed'),
    onClick: (ad) => console.log('Ad clicked:', ad.id),
  },
};

export const Hidden: Story = {
  args: {
    ad: samplePauseAd,
    visible: false,
    onDismiss: () => console.log('Ad dismissed'),
  },
};

export const Interactive: Story = {
  decorators: [
    // Override the default decorator to remove the outer container —
    // the render function provides its own.
    (Story) => <Story />,
  ],
  render: function InteractivePauseAd() {
    const [isPlaying, setIsPlaying] = useState(true);
    const [showAd, setShowAd] = useState(false);
    const [events, setEvents] = useState<string[]>([]);

    const log = useCallback((message: string) => {
      setEvents((prev) => [
        `[${new Date().toLocaleTimeString()}] ${message}`,
        ...prev.slice(0, 19),
      ]);
    }, []);

    const handlePause = useCallback(() => {
      setIsPlaying(false);
      log('Video paused');
      // Show the ad after a brief moment, simulating minPauseDuration
      const timer = setTimeout(() => {
        setShowAd(true);
        log('Pause ad shown');
      }, 500);
      return () => clearTimeout(timer);
    }, [log]);

    const handlePlay = useCallback(() => {
      setIsPlaying(true);
      setShowAd(false);
      log('Video resumed - ad hidden');
    }, [log]);

    const handleDismiss = useCallback(() => {
      setShowAd(false);
      log('onDismiss fired - ad closed by user');
    }, [log]);

    const handleClick = useCallback(
      (ad: PauseAdType) => {
        log(`onClick fired - ad "${ad.id}" clicked`);
      },
      [log]
    );

    const pauseAd: PauseAdType = {
      id: 'pause-ad-interactive',
      imageUrl: 'https://placehold.co/800x400/1a1a2e/00a99d?text=Pause+Ad',
      clickThroughUrl: 'https://example.com/promo',
      altText: 'Interactive demo ad',
      title: 'Try Our New Product',
      description: 'Click to learn more about this limited-time offer.',
    };

    return (
      <div className="flex flex-col gap-4 w-[640px]">
        {/* Mock video player */}
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
          {/* Simulated video content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-gray-800 to-gray-900">
            <div className="text-white/50 text-sm">
              {isPlaying ? 'Playing...' : 'Paused'}
            </div>
            <button
              onClick={isPlaying ? handlePause : handlePlay}
              className="px-6 py-2.5 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>

          {/* Pause ad overlay */}
          <PauseAd
            ad={pauseAd}
            visible={showAd}
            onDismiss={handleDismiss}
            onClick={handleClick}
          />
        </div>

        {/* Event log */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-3 max-h-[160px] overflow-y-auto">
          <div className="text-white/60 text-xs font-medium mb-2">
            Event Log
          </div>
          {events.length === 0 ? (
            <div className="text-white/30 text-xs">
              Click "Pause" to trigger the ad...
            </div>
          ) : (
            <ul className="space-y-1">
              {events.map((event, i) => (
                <li key={i} className="text-green-400/80 text-xs font-mono">
                  {event}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  },
};
