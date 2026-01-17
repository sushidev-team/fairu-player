import type { Meta, StoryObj } from '@storybook/react';
import { useState, useEffect } from 'react';
import { InfoCard } from './InfoCard';
import { InfoCardIcon } from './InfoCardIcon';
import type { InfoCard as InfoCardType } from '@/types/video';

const meta: Meta<typeof InfoCard> = {
  title: 'Ads/InfoCard',
  component: InfoCard,
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
      <div className="relative w-[640px] h-[400px] bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">
          Video Content Area
        </div>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof InfoCard>;

const productCard: InfoCardType = {
  id: 'card-product',
  type: 'product',
  title: 'Wireless Headphones Pro',
  description: 'Premium noise-cancelling headphones with 30-hour battery life.',
  thumbnail: 'https://placehold.co/300x200/1a1a2e/ffffff?text=Product+Image',
  url: 'https://example.com/product',
  displayAt: 0,
  duration: 30,
  position: 'top-right',
  price: '$299.99',
};

const videoCard: InfoCardType = {
  id: 'card-video',
  type: 'video',
  title: 'Watch the Full Tutorial',
  description: 'Learn advanced techniques in this extended video.',
  thumbnail: 'https://placehold.co/300x200/2d5a27/ffffff?text=Video+Thumbnail',
  url: 'https://example.com/video',
  displayAt: 0,
  position: 'top-right',
  videoId: 'abc123',
};

const linkCard: InfoCardType = {
  id: 'card-link',
  type: 'link',
  title: 'Read Our Blog Post',
  description: 'Deep dive into the topics discussed in this video.',
  thumbnail: 'https://placehold.co/300x200/5a272d/ffffff?text=Blog+Post',
  url: 'https://example.com/blog',
  displayAt: 0,
  position: 'top-right',
};

export const ProductCard: Story = {
  args: {
    card: productCard,
    currentTime: 5,
    duration: 60,
    expanded: true,
  },
};

export const VideoCard: Story = {
  args: {
    card: videoCard,
    currentTime: 5,
    duration: 60,
    expanded: true,
  },
};

export const LinkCard: Story = {
  args: {
    card: linkCard,
    currentTime: 5,
    duration: 60,
    expanded: true,
  },
};

export const LeftPosition: Story = {
  args: {
    card: {
      ...productCard,
      position: 'top-left',
    },
    currentTime: 5,
    duration: 60,
    expanded: true,
  },
};

// Interactive story showing icon + card interaction
export const Interactive: Story = {
  render: function InteractiveInfoCard() {
    const [expanded, setExpanded] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const cards: InfoCardType[] = [
      {
        id: 'card-1',
        type: 'product',
        title: 'Featured Product',
        description: 'Check out this amazing product mentioned in the video.',
        thumbnail: 'https://placehold.co/300x200/1a1a2e/ffffff?text=Product',
        url: 'https://example.com',
        displayAt: 2,
        duration: 15,
        price: '$49.99',
        position: 'top-right',
      },
      {
        id: 'card-2',
        type: 'video',
        title: 'Related Video',
        description: 'Watch a related video for more info.',
        thumbnail: 'https://placehold.co/300x200/2d5a27/ffffff?text=Video',
        url: 'https://example.com',
        displayAt: 10,
        duration: 10,
        position: 'top-right',
      },
    ];

    // Get active cards based on time
    const activeCards = cards.filter((card) => {
      const cardDuration = card.duration ?? 30;
      return currentTime >= card.displayAt && currentTime < card.displayAt + cardDuration;
    });

    useEffect(() => {
      if (!isPlaying) return;

      const interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= 25) {
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
            Time: {currentTime.toFixed(1)}s | Active Cards: {activeCards.length}
          </div>
          <button
            onClick={() => {
              setIsPlaying(!isPlaying);
              if (!isPlaying) {
                setCurrentTime(0);
                setExpanded(false);
              }
            }}
            className="px-4 py-2 bg-white text-black rounded font-medium"
          >
            {isPlaying ? 'Stop' : 'Play Video'}
          </button>
        </div>

        {/* Info Card Icon */}
        <InfoCardIcon
          hasActiveCards={activeCards.length > 0}
          cardCount={activeCards.length}
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
        />

        {/* Info Cards */}
        {activeCards.map((card) => (
          <InfoCard
            key={card.id}
            card={card}
            currentTime={currentTime}
            duration={25}
            expanded={expanded}
            onDismiss={(c) => console.log('Dismissed:', c.id)}
            onSelect={(c) => alert(`Selected: ${c.title}`)}
          />
        ))}
      </div>
    );
  },
};

// InfoCardIcon component story
export const InfoCardIconStory: Story = {
  render: function IconDemo() {
    const [expanded, setExpanded] = useState(false);

    return (
      <div className="relative w-full h-full">
        <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
          Click the info icon in the corner
        </div>

        <InfoCardIcon
          hasActiveCards={true}
          cardCount={3}
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
        />

        {expanded && (
          <div className="absolute top-12 right-3 bg-black/80 text-white text-xs p-2 rounded">
            Cards are now visible
          </div>
        )}
      </div>
    );
  },
};
