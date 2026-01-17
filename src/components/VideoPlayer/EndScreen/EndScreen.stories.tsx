import type { Meta, StoryObj } from '@storybook/react';
import { useState, useEffect } from 'react';
import { EndScreen } from './EndScreen';
import { RecommendedCard } from './RecommendedCard';
import { AutoPlayCountdown } from './AutoPlayCountdown';
import type { EndScreenConfig, RecommendedVideo } from '@/types/video';

const meta: Meta<typeof EndScreen> = {
  title: 'VideoPlayer/EndScreen',
  component: EndScreen,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#000' }],
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="relative w-[800px] h-[450px] bg-black rounded-xl overflow-hidden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof EndScreen>;

const sampleVideos: RecommendedVideo[] = [
  {
    id: '1',
    title: 'Introduction to TypeScript - Complete Guide 2024',
    thumbnail: 'https://placehold.co/320x180/1a1a2e/ffffff?text=TypeScript',
    duration: 1245,
    views: '1.2M views',
    channel: 'Code Academy',
    channelAvatar: 'https://placehold.co/32x32/2d5a27/ffffff?text=CA',
  },
  {
    id: '2',
    title: 'React Best Practices You Need to Know',
    thumbnail: 'https://placehold.co/320x180/2d5a27/ffffff?text=React',
    duration: 845,
    views: '856K views',
    channel: 'Frontend Masters',
    channelAvatar: 'https://placehold.co/32x32/5a272d/ffffff?text=FM',
  },
  {
    id: '3',
    title: 'Building a Video Player from Scratch',
    thumbnail: 'https://placehold.co/320x180/5a272d/ffffff?text=Video+Player',
    duration: 2100,
    views: '432K views',
    channel: 'Dev Tutorials',
    channelAvatar: 'https://placehold.co/32x32/1a1a2e/ffffff?text=DT',
  },
  {
    id: '4',
    title: 'CSS Grid Layout - Master Guide',
    thumbnail: 'https://placehold.co/320x180/3d1a5a/ffffff?text=CSS+Grid',
    duration: 1560,
    views: '678K views',
    channel: 'CSS Wizards',
  },
  {
    id: '5',
    title: 'Node.js Performance Optimization',
    thumbnail: 'https://placehold.co/320x180/5a4a1a/ffffff?text=Node.js',
    duration: 1890,
    views: '234K views',
    channel: 'Backend Pro',
  },
  {
    id: '6',
    title: 'Database Design Fundamentals',
    thumbnail: 'https://placehold.co/320x180/1a4a5a/ffffff?text=Database',
    duration: 2400,
    views: '567K views',
    channel: 'Data School',
  },
];

const defaultConfig: EndScreenConfig = {
  enabled: true,
  showAt: 10,
  recommendations: sampleVideos,
  layout: 'grid',
  columns: 3,
  autoPlayNext: false,
  showReplay: true,
  title: 'Recommended Videos',
};

export const Default: Story = {
  args: {
    config: defaultConfig,
    currentTime: 55,
    duration: 60,
    isEnded: true,
  },
};

export const TwoColumns: Story = {
  args: {
    config: {
      ...defaultConfig,
      columns: 2,
    },
    currentTime: 55,
    duration: 60,
    isEnded: true,
  },
};

export const FourColumns: Story = {
  args: {
    config: {
      ...defaultConfig,
      columns: 4,
      recommendations: sampleVideos.slice(0, 4),
    },
    currentTime: 55,
    duration: 60,
    isEnded: true,
  },
};

export const CarouselLayout: Story = {
  args: {
    config: {
      ...defaultConfig,
      layout: 'carousel',
    },
    currentTime: 55,
    duration: 60,
    isEnded: true,
  },
};

export const WithAutoPlay: Story = {
  args: {
    config: {
      ...defaultConfig,
      autoPlayNext: true,
      autoPlayDelay: 5,
    },
    currentTime: 55,
    duration: 60,
    isEnded: true,
  },
};

export const NoReplayButton: Story = {
  args: {
    config: {
      ...defaultConfig,
      showReplay: false,
    },
    currentTime: 55,
    duration: 60,
    isEnded: true,
  },
};

export const CustomTitle: Story = {
  args: {
    config: {
      ...defaultConfig,
      title: 'Up Next: More Videos Like This',
    },
    currentTime: 55,
    duration: 60,
    isEnded: true,
  },
};

// RecommendedCard component story
export const RecommendedCardStory: Story = {
  render: () => (
    <div className="p-4 grid grid-cols-3 gap-4">
      <RecommendedCard
        video={sampleVideos[0]}
        onSelect={(v) => console.log('Selected:', v.title)}
      />
      <RecommendedCard
        video={sampleVideos[1]}
        onSelect={(v) => console.log('Selected:', v.title)}
        isUpNext
      />
      <RecommendedCard
        video={sampleVideos[2]}
        onSelect={(v) => console.log('Selected:', v.title)}
      />
    </div>
  ),
};

// AutoPlayCountdown component story
export const AutoPlayCountdownStory: Story = {
  render: function CountdownDemo() {
    const [active, setActive] = useState(true);

    return (
      <div className="p-4">
        <AutoPlayCountdown
          video={sampleVideos[0]}
          duration={5}
          active={active}
          onComplete={(v) => {
            alert(`Auto-playing: ${v.title}`);
            setActive(false);
          }}
          onCancel={() => {
            console.log('Cancelled');
            setActive(false);
          }}
        />

        {!active && (
          <button
            onClick={() => setActive(true)}
            className="mt-4 px-4 py-2 bg-white text-black rounded"
          >
            Restart Countdown
          </button>
        )}
      </div>
    );
  },
};

// Interactive end screen with video simulation
export const Interactive: Story = {
  render: function InteractiveEndScreen() {
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isEnded, setIsEnded] = useState(false);
    const duration = 30;

    const config: EndScreenConfig = {
      enabled: true,
      showAt: 10,
      recommendations: sampleVideos,
      layout: 'grid',
      columns: 3,
      autoPlayNext: true,
      autoPlayDelay: 5,
      showReplay: true,
    };

    useEffect(() => {
      if (!isPlaying || isEnded) return;

      const interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false);
            setIsEnded(true);
            return duration;
          }
          return prev + 0.1;
        });
      }, 100);

      return () => clearInterval(interval);
    }, [isPlaying, isEnded]);

    const handleReplay = () => {
      setCurrentTime(0);
      setIsEnded(false);
      setIsPlaying(true);
    };

    const handleVideoSelect = (video: RecommendedVideo) => {
      alert(`Playing: ${video.title}`);
      setCurrentTime(0);
      setIsEnded(false);
      setIsPlaying(true);
    };

    const showEndScreen = isEnded || (duration - currentTime <= config.showAt!);

    return (
      <div className="relative w-full h-full">
        {/* Video simulation */}
        {!showEndScreen && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="text-white/50 text-sm">
              Time: {currentTime.toFixed(1)}s / {duration}s
            </div>
            <div className="text-white/30 text-xs">
              End screen shows at {duration - config.showAt!}s ({config.showAt}s before end)
            </div>
            <button
              onClick={() => {
                setIsPlaying(!isPlaying);
                if (!isPlaying) {
                  setIsEnded(false);
                }
              }}
              className="px-4 py-2 bg-white text-black rounded font-medium"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>
        )}

        {/* End Screen */}
        <EndScreen
          config={config}
          currentTime={currentTime}
          duration={duration}
          isEnded={isEnded}
          onVideoSelect={handleVideoSelect}
          onReplay={handleReplay}
        />
      </div>
    );
  },
};
