import type { Meta, StoryObj } from '@storybook/react';
import { useState, useEffect, useCallback } from 'react';
import { AdOverlay } from './AdOverlay';
import type { AdState, Ad, AdBreak } from '@/types/ads';

const meta: Meta<typeof AdOverlay> = {
  title: 'Ads/AdOverlay',
  component: AdOverlay,
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
  decorators: [
    (Story) => (
      <div className="relative w-[400px] h-[600px] bg-[var(--fp-color-background)] rounded-xl overflow-hidden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AdOverlay>;

const sampleAd: Ad = {
  id: 'ad-1',
  src: 'https://example.com/ad.mp3',
  duration: 15,
  skipAfterSeconds: 5,
  title: 'Sponsor: Fairu Premium',
  clickThroughUrl: 'https://fairu.app/premium',
};

const defaultState: AdState = {
  isPlayingAd: true,
  currentAd: sampleAd,
  currentAdBreak: {
    id: 'break-1',
    position: 'pre-roll',
    ads: [sampleAd],
  },
  adProgress: 3,
  adDuration: 15,
  canSkip: false,
  skipCountdown: 2,
  adsRemaining: 0,
};

export const Default: Story = {
  args: {
    state: defaultState,
    controls: {
      skipAd: () => console.log('Skip ad'),
      clickThrough: () => console.log('Click through'),
    },
  },
};

export const CanSkip: Story = {
  args: {
    state: {
      ...defaultState,
      adProgress: 8,
      canSkip: true,
      skipCountdown: 0,
    },
    controls: {
      skipAd: () => console.log('Skip ad'),
      clickThrough: () => console.log('Click through'),
    },
  },
};

export const MultipleAds: Story = {
  args: {
    state: {
      ...defaultState,
      adsRemaining: 2,
    },
    controls: {
      skipAd: () => console.log('Skip ad'),
      clickThrough: () => console.log('Click through'),
    },
  },
};

export const NoClickThrough: Story = {
  args: {
    state: {
      ...defaultState,
      currentAd: {
        ...sampleAd,
        clickThroughUrl: undefined,
      },
    },
    controls: {
      skipAd: () => console.log('Skip ad'),
      clickThrough: () => console.log('Click through'),
    },
  },
};

export const LongAd: Story = {
  args: {
    state: {
      ...defaultState,
      adDuration: 30,
      adProgress: 5,
      currentAd: {
        ...sampleAd,
        duration: 30,
        skipAfterSeconds: 10,
      },
      skipCountdown: 5,
    },
    controls: {
      skipAd: () => console.log('Skip ad'),
      clickThrough: () => console.log('Click through'),
    },
  },
};

// Interactive story that simulates real ad playback
export const Interactive: Story = {
  render: function InteractiveAd() {
    const [state, setState] = useState<AdState>({
      isPlayingAd: false,
      currentAd: null,
      currentAdBreak: null,
      adProgress: 0,
      adDuration: 0,
      canSkip: false,
      skipCountdown: 0,
      adsRemaining: 0,
    });

    const sampleAdBreak: AdBreak = {
      id: 'break-1',
      position: 'pre-roll',
      ads: [
        {
          id: 'ad-1',
          src: 'https://example.com/ad1.mp3',
          duration: 10,
          skipAfterSeconds: 5,
          title: 'Sponsor: Fairu Premium',
          clickThroughUrl: 'https://fairu.app/premium',
        },
        {
          id: 'ad-2',
          src: 'https://example.com/ad2.mp3',
          duration: 8,
          skipAfterSeconds: 3,
          title: 'Sponsor: Podcast Hosting',
          clickThroughUrl: 'https://example.com',
        },
      ],
    };

    const [currentAdIndex, setCurrentAdIndex] = useState(0);

    const startAds = useCallback(() => {
      const ad = sampleAdBreak.ads[0];
      setCurrentAdIndex(0);
      setState({
        isPlayingAd: true,
        currentAd: ad,
        currentAdBreak: sampleAdBreak,
        adProgress: 0,
        adDuration: ad.duration,
        canSkip: false,
        skipCountdown: ad.skipAfterSeconds ?? 0,
        adsRemaining: sampleAdBreak.ads.length - 1,
      });
    }, []);

    const skipAd = useCallback(() => {
      const nextIndex = currentAdIndex + 1;
      if (nextIndex < sampleAdBreak.ads.length) {
        const nextAd = sampleAdBreak.ads[nextIndex];
        setCurrentAdIndex(nextIndex);
        setState((prev) => ({
          ...prev,
          currentAd: nextAd,
          adProgress: 0,
          adDuration: nextAd.duration,
          canSkip: false,
          skipCountdown: nextAd.skipAfterSeconds ?? 0,
          adsRemaining: sampleAdBreak.ads.length - nextIndex - 1,
        }));
      } else {
        setState({
          isPlayingAd: false,
          currentAd: null,
          currentAdBreak: null,
          adProgress: 0,
          adDuration: 0,
          canSkip: false,
          skipCountdown: 0,
          adsRemaining: 0,
        });
      }
    }, [currentAdIndex]);

    // Simulate ad progress
    useEffect(() => {
      if (!state.isPlayingAd) return;

      const interval = setInterval(() => {
        setState((prev) => {
          const newProgress = prev.adProgress + 0.1;
          const newCountdown = Math.max(0, prev.skipCountdown - 0.1);
          const canSkip = newCountdown <= 0;

          // Ad finished
          if (newProgress >= prev.adDuration) {
            skipAd();
            return prev;
          }

          return {
            ...prev,
            adProgress: newProgress,
            skipCountdown: Math.ceil(newCountdown),
            canSkip,
          };
        });
      }, 100);

      return () => clearInterval(interval);
    }, [state.isPlayingAd, skipAd]);

    return (
      <div className="flex flex-col h-full">
        {!state.isPlayingAd ? (
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={startAds}
              className="px-6 py-3 bg-[var(--fp-color-accent)] text-white rounded-full font-semibold hover:bg-[var(--fp-color-accent-hover)] transition-colors"
            >
              Start Ad Break (2 Ads)
            </button>
          </div>
        ) : (
          <AdOverlay
            state={state}
            controls={{
              skipAd,
              clickThrough: () => alert('Clicked through to advertiser'),
            }}
          />
        )}
      </div>
    );
  },
};
