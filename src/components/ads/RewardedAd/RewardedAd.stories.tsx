import type { Meta, StoryObj } from '@storybook/react';
import { useState, useCallback } from 'react';
import { RewardedAdOverlay } from './RewardedAd';
import type { RewardedAd as RewardedAdType } from '@/types/rewardedAd';

const mockAd: RewardedAdType = {
  id: 'rewarded-1',
  src: 'https://files.fairu.app/41b8d7ef-3698-5c75-83e1-9325953a72a4/file.mp4',
  duration: 30,
  title: 'Watch to unlock premium episode',
  rewardDescription: 'Watch this short ad to unlock the full episode',
  poster: 'https://placehold.co/800x450/1a1a2e/00a99d?text=Rewarded+Ad',
  clickThroughUrl: 'https://example.com',
};

const meta: Meta<typeof RewardedAdOverlay> = {
  title: 'Ads/RewardedAd',
  component: RewardedAdOverlay,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#121212' }],
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RewardedAdOverlay>;

// Default: Visible rewarded ad overlay
// Since the component uses fixed inset-0, it covers the whole viewport.
// We wrap it in a relative container with defined height so Storybook's
// canvas area still shows surrounding chrome.
export const Default: Story = {
  decorators: [
    (Story) => (
      <div className="relative w-full h-[600px] bg-[var(--fp-color-background)] overflow-hidden">
        <Story />
      </div>
    ),
  ],
  args: {
    ad: mockAd,
    visible: true,
    onReward: (ad) => console.log('Reward earned:', ad.id),
    onClose: (ad, completed) =>
      console.log('Closed:', ad.id, 'completed:', completed),
    onClick: (ad) => console.log('Clicked:', ad.id),
  },
};

// Hidden: visible=false renders nothing
export const Hidden: Story = {
  args: {
    ad: mockAd,
    visible: false,
    onReward: (ad) => console.log('Reward earned:', ad.id),
    onClose: (ad, completed) =>
      console.log('Closed:', ad.id, 'completed:', completed),
  },
};

// Interactive: Full flow simulation with state management and event logging
export const Interactive: Story = {
  render: function InteractiveRewardedAd() {
    const [visible, setVisible] = useState(false);
    const [rewarded, setRewarded] = useState(false);
    const [events, setEvents] = useState<string[]>([]);

    const log = useCallback((message: string) => {
      setEvents((prev) => [
        `[${new Date().toLocaleTimeString()}] ${message}`,
        ...prev,
      ]);
    }, []);

    const handleReward = useCallback(
      (ad: RewardedAdType) => {
        log(`onReward: "${ad.title}" (${ad.id})`);
        setRewarded(true);
      },
      [log]
    );

    const handleClose = useCallback(
      (ad: RewardedAdType, completed: boolean) => {
        log(
          `onClose: "${ad.title}" (${ad.id}) completed=${String(completed)}`
        );
        setVisible(false);
      },
      [log]
    );

    const handleClick = useCallback(
      (ad: RewardedAdType) => {
        log(`onClick: "${ad.title}" → ${ad.clickThroughUrl ?? 'N/A'}`);
      },
      [log]
    );

    const handleStartAd = useCallback(() => {
      setRewarded(false);
      setVisible(true);
      log('Ad triggered by user');
    }, [log]);

    // Simulate the video completing (since the video element won't actually
    // play in Storybook with a fake URL). This manually dispatches the
    // "ended" event on the video element inside the overlay.
    const handleSimulateComplete = useCallback(() => {
      const videoEl = document.querySelector(
        '[data-testid="rewarded-ad-video"]'
      ) as HTMLVideoElement | null;
      if (videoEl) {
        videoEl.dispatchEvent(new Event('ended'));
        log('Simulated video completion (dispatched "ended" event)');
      } else {
        log('Could not find video element to simulate completion');
      }
    }, [log]);

    return (
      <div className="flex flex-col items-center gap-6 p-8 min-h-[600px] bg-[var(--fp-color-background)]">
        {/* Controls */}
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-white text-lg font-semibold">
            Rewarded Ad Demo
          </h2>

          {rewarded ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/40 rounded-lg">
                <svg
                  className="w-5 h-5 text-green-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-green-400 font-medium">
                  Premium episode unlocked!
                </span>
              </div>
              <button
                onClick={handleStartAd}
                className="px-4 py-2 text-white/60 text-sm underline hover:text-white transition-colors"
              >
                Watch again
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartAd}
              className="px-6 py-3 bg-yellow-500 text-black font-semibold rounded-full hover:bg-yellow-400 transition-colors"
            >
              Watch Ad to Unlock
            </button>
          )}
        </div>

        {/* Simulate Complete button (always visible when ad is showing) */}
        {visible && (
          <button
            onClick={handleSimulateComplete}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors z-[60]"
            style={{ position: 'fixed', bottom: 20, right: 20 }}
          >
            Simulate Complete
          </button>
        )}

        {/* Event Log */}
        <div className="w-full max-w-md">
          <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">
            Event Log
          </h3>
          <div className="bg-black/40 border border-white/10 rounded-lg p-3 h-48 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-white/30 text-xs">
                No events yet. Click "Watch Ad to Unlock" to start.
              </p>
            ) : (
              <ul className="space-y-1">
                {events.map((event, i) => (
                  <li key={i} className="text-white/70 text-xs font-mono">
                    {event}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* The overlay */}
        <RewardedAdOverlay
          ad={mockAd}
          visible={visible}
          onReward={handleReward}
          onClose={handleClose}
          onClick={handleClick}
        />
      </div>
    );
  },
};
