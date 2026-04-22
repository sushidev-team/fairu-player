import type { Meta, StoryObj } from '@storybook/react';
import { useState, useEffect, useMemo } from 'react';
import { VideoPlayer } from '@/components/VideoPlayer/VideoPlayer';
import { SubtitleDisplay } from '@/components/VideoPlayer/SubtitleDisplay';
import { PauseAd } from '@/components/ads/PauseAd';
import { RewardedAdOverlay } from '@/components/ads/RewardedAd';
import { ProgressBar } from '@/components/controls/ProgressBar';
import { DEFAULT_SUBTITLE_STYLE, SUBTITLE_PRESETS } from '@/types/subtitleStyling';
import type { VideoTrack } from '@/types/video';
import type { PauseAd as PauseAdType } from '@/types/pauseAd';
import type { RewardedAd as RewardedAdType } from '@/types/rewardedAd';
import type { SubtitleStyle } from '@/types/subtitleStyling';

const sampleVideo: VideoTrack = {
  id: '1',
  src: 'https://files.fairu.app/41b8d7ef-3698-5c75-83e1-9325953a72a4/file.mp4',
  title: 'Big Buck Bunny',
  artist: 'Blender Foundation',
  poster:
    '',
  duration: 596,
};

/** Convert a SubtitleStyle to React.CSSProperties */
function styleToCss(s: SubtitleStyle): React.CSSProperties {
  const hexToRgba = (hex: string, opacity: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  return {
    fontSize: `${s.fontSize}px`,
    fontFamily: s.fontFamily,
    color: s.textColor,
    backgroundColor: hexToRgba(s.backgroundColor, s.backgroundOpacity),
    textShadow: s.textShadow,
    ...(s.position === 'top'
      ? { top: '10%', bottom: 'auto' }
      : { bottom: '10%', top: 'auto' }),
    padding: '4px 8px',
    borderRadius: '4px',
  };
}

const meta: Meta = {
  title: 'Examples/New Features Demo',
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
  decorators: [
    (Story) => (
      <div className="fp-dark w-[800px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj;

function IntegratedDemoComponent() {
  // --- State ---
  const [currentTime, setCurrentTime] = useState(0);
  const [, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  // Subtitle state
  const [subtitleMode, setSubtitleMode] = useState<'overlay' | 'below' | 'off'>(
    'overlay',
  );
  const [subtitleStyle, setSubtitleStyle] =
    useState<SubtitleStyle>(DEFAULT_SUBTITLE_STYLE);
  const [subtitleText, setSubtitleText] = useState<string | null>(null);

  // Pause ad state
  const [showPauseAd, setShowPauseAd] = useState(false);

  // Rewarded ad state
  const [showRewardedAd, setShowRewardedAd] = useState(false);
  const [isRewarded, setIsRewarded] = useState(false);

  // A-B Loop state
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);

  // Event log
  const [events, setEvents] = useState<string[]>([]);
  const addEvent = (msg: string) => {
    setEvents((prev) => [
      ...prev.slice(-9),
      `${new Date().toLocaleTimeString()}: ${msg}`,
    ]);
  };

  // Simulate subtitle cues based on time
  useEffect(() => {
    if (subtitleMode === 'off') {
      setSubtitleText(null);
      return;
    }
    const cues = [
      { start: 0, end: 5, text: 'Welcome to Big Buck Bunny' },
      { start: 5, end: 10, text: 'A short film by the Blender Foundation' },
      { start: 10, end: 15, text: 'In a world of beauty and wonder...' },
      { start: 15, end: 20, text: 'One bunny discovers adventure' },
      { start: 25, end: 30, text: 'Big Buck Bunny - Enjoy the show!' },
      { start: 35, end: 40, text: 'The forest is full of surprises' },
      { start: 45, end: 50, text: 'Watch out for the butterflies!' },
    ];
    const activeCue = cues.find(
      (c) => currentTime >= c.start && currentTime < c.end,
    );
    setSubtitleText(activeCue?.text ?? null);
  }, [currentTime, subtitleMode]);

  // Pause ad logic
  useEffect(() => {
    if (isPaused && hasPlayed && !showRewardedAd) {
      const timer = setTimeout(() => setShowPauseAd(true), 500);
      return () => clearTimeout(timer);
    } else {
      setShowPauseAd(false);
    }
  }, [isPaused, hasPlayed, showRewardedAd]);

  // Convert subtitle style to CSS
  const subtitleCss = useMemo(
    () => styleToCss(subtitleStyle),
    [subtitleStyle],
  );

  // Pause ad data
  const pauseAd: PauseAdType = {
    id: 'demo-pause-ad',
    imageUrl: 'https://placehold.co/600x300/1a1a2e/00a99d?text=Sponsored+Content',
    title: 'Check out our sponsor',
    description: 'Premium podcast hosting for creators',
    clickThroughUrl: 'https://example.com',
  };

  // Rewarded ad data
  const rewardedAd: RewardedAdType = {
    id: 'demo-rewarded',
    src: 'https://files.fairu.app/41b8d7ef-3698-5c75-83e1-9325953a72a4/file.mp4',
    duration: 15,
    title: 'Watch to unlock bonus content',
    rewardDescription:
      "Watch this 15s ad to unlock the director's commentary",
    poster:
      'https://placehold.co/800x450/1a1a2e/ffcc00?text=Rewarded+Ad',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-white text-lg font-semibold">New Features Demo</div>
      <p className="text-white/60 text-sm">
        This demo showcases: Custom Subtitles, Pause Ads, Rewarded Ads, A-B
        Loop, and Subtitle Styling.
      </p>

      {/* Video Player Container */}
      <div className="relative">
        <VideoPlayer
          track={sampleVideo}
          onPlay={() => {
            setIsPlaying(true);
            setIsPaused(false);
            setHasPlayed(true);
            addEvent('Play');
          }}
          onPause={() => {
            setIsPlaying(false);
            setIsPaused(true);
            addEvent('Pause');
          }}
          onTimeUpdate={(time) => setCurrentTime(time)}
        />

        {/* Subtitle Overlay (rendered on top of video) */}
        {subtitleMode === 'overlay' && (
          <SubtitleDisplay
            text={subtitleText}
            mode="overlay"
            style={subtitleCss}
          />
        )}

        {/* Pause Ad Overlay */}
        <PauseAd
          ad={pauseAd}
          visible={showPauseAd}
          onDismiss={() => {
            setShowPauseAd(false);
            addEvent('Pause Ad dismissed');
          }}
          onClick={() => addEvent('Pause Ad clicked')}
        />
      </div>

      {/* Subtitle Below Mode */}
      {subtitleMode === 'below' && (
        <SubtitleDisplay
          text={subtitleText}
          mode="below"
          style={subtitleCss}
        />
      )}

      {/* Controls Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Subtitle Controls */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-white text-sm font-semibold mb-3">Subtitles</h3>

          {/* Mode toggle */}
          <div className="flex gap-1 mb-3">
            {(['overlay', 'below', 'off'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setSubtitleMode(mode);
                  addEvent(`Subtitles: ${mode}`);
                }}
                className={`flex-1 px-2 py-1 rounded text-xs capitalize border transition-colors ${
                  subtitleMode === mode
                    ? 'border-[var(--fp-color-accent)] text-[var(--fp-color-accent)]'
                    : 'border-gray-600 text-gray-400 hover:border-gray-400'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Style presets */}
          <div className="text-xs text-gray-500 mb-1">Style Presets</div>
          <div className="flex flex-wrap gap-1 mb-3">
            {SUBTITLE_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => {
                  setSubtitleStyle(preset.style);
                  addEvent(`Subtitle style: ${preset.label}`);
                }}
                className="px-2 py-1 rounded text-xs border border-gray-600 text-gray-400 hover:border-[var(--fp-color-accent)] hover:text-[var(--fp-color-accent)] transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Font size slider */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Font Size</span>
            <span className="text-xs text-gray-400">
              {subtitleStyle.fontSize}px
            </span>
          </div>
          <input
            type="range"
            min={12}
            max={32}
            value={subtitleStyle.fontSize}
            onChange={(e) =>
              setSubtitleStyle((prev) => ({
                ...prev,
                fontSize: Number(e.target.value),
              }))
            }
            className="w-full h-1 rounded-full appearance-none bg-gray-700 accent-[var(--fp-color-accent)] mb-2"
          />
        </div>

        {/* Right: Ad Controls */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-white text-sm font-semibold mb-3">Ad Formats</h3>

          {/* Pause Ad info */}
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1">Pause Ad</div>
            <p className="text-xs text-gray-400">
              Pause the video to see the Pause Ad overlay.
              {showPauseAd && (
                <span className="text-yellow-400 ml-1">Active</span>
              )}
            </p>
          </div>

          {/* Rewarded Ad */}
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1">Rewarded Ad</div>
            {isRewarded ? (
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-green-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-green-400 text-xs">
                  Bonus content unlocked!
                </span>
              </div>
            ) : (
              <button
                onClick={() => {
                  setShowRewardedAd(true);
                  addEvent('Rewarded Ad started');
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-500 text-black hover:bg-yellow-400 transition-colors"
              >
                Watch Ad to Unlock Bonus
              </button>
            )}
          </div>

          {/* A-B Loop */}
          <div>
            <div className="text-xs text-gray-500 mb-1">A-B Loop</div>
            <div className="flex gap-1 mb-1">
              <button
                onClick={() => {
                  setLoopStart(currentTime);
                  addEvent(`Loop A set: ${Math.floor(currentTime)}s`);
                }}
                className={`flex-1 px-2 py-1 rounded text-xs border transition-colors ${
                  loopStart !== null
                    ? 'border-blue-400 text-blue-400'
                    : 'border-gray-600 text-gray-400'
                }`}
              >
                Set A{' '}
                {loopStart !== null ? `(${Math.floor(loopStart)}s)` : ''}
              </button>
              <button
                onClick={() => {
                  setLoopEnd(currentTime);
                  addEvent(`Loop B set: ${Math.floor(currentTime)}s`);
                }}
                className={`flex-1 px-2 py-1 rounded text-xs border transition-colors ${
                  loopEnd !== null
                    ? 'border-blue-400 text-blue-400'
                    : 'border-gray-600 text-gray-400'
                }`}
              >
                Set B {loopEnd !== null ? `(${Math.floor(loopEnd)}s)` : ''}
              </button>
              <button
                onClick={() => {
                  setLoopStart(null);
                  setLoopEnd(null);
                  addEvent('Loop cleared');
                }}
                className="px-2 py-1 rounded text-xs border border-gray-600 text-gray-400 hover:border-red-400 hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            </div>
            {loopStart !== null && loopEnd !== null && (
              <div className="text-xs text-blue-400">
                Looping: {Math.floor(loopStart)}s &rarr;{' '}
                {Math.floor(loopEnd)}s
              </div>
            )}
          </div>
        </div>
      </div>

      {/* A-B Loop Progress Bar Preview */}
      {loopStart !== null && loopEnd !== null && (
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-2">
            Loop Region Preview
          </div>
          <ProgressBar
            currentTime={currentTime}
            duration={596}
            loopStart={loopStart}
            loopEnd={loopEnd}
            disabled
          />
        </div>
      )}

      {/* Event Log */}
      <div className="bg-gray-900 rounded-lg p-3">
        <h4 className="text-xs font-semibold mb-2 text-gray-500">
          Event Log
        </h4>
        <div className="space-y-0.5 text-[11px] font-mono text-gray-400 max-h-32 overflow-y-auto">
          {events.length === 0 ? (
            <span className="text-gray-600">
              Interact with the player to see events...
            </span>
          ) : (
            events.map((e, i) => <div key={i}>{e}</div>)
          )}
        </div>
      </div>

      {/* Rewarded Ad Overlay (renders on top of everything) */}
      <RewardedAdOverlay
        ad={rewardedAd}
        visible={showRewardedAd}
        onReward={() => {
          setIsRewarded(true);
          addEvent('Reward earned!');
        }}
        onClose={(_, completed) => {
          setShowRewardedAd(false);
          addEvent(`Rewarded Ad closed (completed: ${completed})`);
        }}
        onClick={() => addEvent('Rewarded Ad clicked')}
      />
    </div>
  );
}

export const IntegratedDemo: Story = {
  render: () => <IntegratedDemoComponent />,
};
