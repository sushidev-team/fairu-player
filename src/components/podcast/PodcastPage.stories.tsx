import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { PodcastPage, PodcastHeader, EpisodeList, EpisodeItem, StickyPlayer } from './index';
import { LabelsProvider } from '@/context/LabelsContext';
import { Stats, StatIcons } from '@/components/stats/Stats';
import { formatStatNumber } from '@/types/stats';
import type { Podcast, Episode } from '@/types/podcast';

// Sample podcast data
const samplePodcast: Podcast = {
  id: 'podcast-1',
  title: 'Tech Talk Podcast',
  author: 'Jane Smith & Team',
  description: 'A weekly podcast about technology, startups, and the future of innovation. Join us as we explore the latest trends in AI, web development, and digital transformation.',
  artwork: 'https://picsum.photos/seed/podcast1/400/400',
  categories: ['Technology', 'Business', 'AI'],
  websiteUrl: 'https://example.com/podcast',
  feedUrl: 'https://example.com/podcast/feed.xml',
};

// Generate sample episodes
const generateEpisodes = (count: number): Episode[] => {
  const episodes: Episode[] = [];
  const baseDate = new Date('2024-01-15');

  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() - i * 7); // Weekly episodes

    episodes.push({
      id: `episode-${i + 1}`,
      src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      title: `Episode ${count - i}: ${getRandomTitle()}`,
      artist: samplePodcast.author,
      artwork: `https://picsum.photos/seed/ep${i}/200/200`,
      duration: 1800 + Math.random() * 1800, // 30-60 minutes
      description: getRandomDescription(),
      publishedAt: date.toISOString(),
      episodeNumber: count - i,
      seasonNumber: Math.ceil((count - i) / 12),
    });
  }

  return episodes;
};

function getRandomTitle(): string {
  const titles = [
    'The Future of AI in 2024',
    'Building Scalable Systems',
    'Interview with a Tech Leader',
    'Web Development Trends',
    'Security Best Practices',
    'The Rise of Edge Computing',
    'Mobile-First Design',
    'DevOps Deep Dive',
    'Cloud Architecture Patterns',
    'Open Source Success Stories',
  ];
  return titles[Math.floor(Math.random() * titles.length)];
}

function getRandomDescription(): string {
  const descriptions = [
    'In this episode, we dive deep into the latest developments in artificial intelligence and what they mean for developers and businesses alike.',
    'Join us as we explore best practices for building systems that can scale to millions of users while maintaining performance and reliability.',
    'We sit down with an industry leader to discuss their journey, challenges, and insights on where technology is heading.',
    'A comprehensive look at the newest trends in web development, from frameworks to deployment strategies.',
    'Security is more important than ever. Learn how to protect your applications and data from emerging threats.',
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

const sampleEpisodes = generateEpisodes(24);

const meta: Meta<typeof PodcastPage> = {
  title: 'Components/Podcast/PodcastPage',
  component: PodcastPage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  decorators: [
    (Story) => (
      <div className="fp-dark min-h-screen bg-gray-900">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PodcastPage>;

/**
 * Full podcast page with all features
 */
export const Default: Story = {
  args: {
    podcast: samplePodcast,
    episodes: sampleEpisodes,
    rating: {
      initialState: {
        upCount: 842,
        downCount: 23,
        userRating: null,
        enabled: true,
        canRate: true,
      },
    },
    stats: [
      { id: 'plays', label: 'Total Plays', value: formatStatNumber(125000), icon: StatIcons.plays },
      { id: 'subscribers', label: 'Subscribers', value: formatStatNumber(8500), icon: StatIcons.subscribers },
      { id: 'episodes', label: 'Episodes', value: '24', icon: StatIcons.episodes },
      { id: 'downloads', label: 'Downloads', value: formatStatNumber(450000), icon: StatIcons.downloads },
    ],
    onSubscribe: () => alert('Subscribe clicked!'),
    onEpisodeSelect: (episode, index) => console.log('Episode selected:', episode.title, index),
  },
};

/**
 * Minimal podcast page without stats or subscribe
 */
export const Minimal: Story = {
  args: {
    podcast: samplePodcast,
    episodes: sampleEpisodes.slice(0, 10),
  },
};

/**
 * Podcast with few episodes
 */
export const FewEpisodes: Story = {
  args: {
    podcast: {
      ...samplePodcast,
      title: 'New Podcast Show',
      description: 'We just launched! Stay tuned for more episodes.',
    },
    episodes: sampleEpisodes.slice(0, 3),
    rating: {
      initialState: {
        upCount: 15,
        downCount: 0,
        userRating: null,
        enabled: true,
        canRate: true,
      },
    },
    onSubscribe: () => alert('Subscribe clicked!'),
  },
};

/**
 * Individual components demo
 */
function ComponentsDemo() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  return (
    <LabelsProvider>
      <div className="fp-dark p-8 space-y-12">
        {/* Header */}
        <section>
          <h2 className="text-xl font-bold text-white mb-4">PodcastHeader</h2>
          <div className="bg-gray-800 p-6 rounded-xl">
            <PodcastHeader
              podcast={samplePodcast}
              rating={{
                initialState: { upCount: 842, downCount: 23, userRating: null, enabled: true, canRate: true },
              }}
              onSubscribe={() => alert('Subscribe!')}
            />
          </div>
        </section>

        {/* Stats */}
        <section>
          <h2 className="text-xl font-bold text-white mb-4">Stats</h2>
          <div className="bg-gray-800 p-6 rounded-xl">
            <Stats
              items={[
                { id: 'plays', label: 'Total Plays', value: '125K', icon: StatIcons.plays },
                { id: 'subs', label: 'Subscribers', value: '8.5K', icon: StatIcons.subscribers },
                { id: 'episodes', label: 'Episodes', value: '24', icon: StatIcons.episodes },
                { id: 'downloads', label: 'Downloads', value: '450K', icon: StatIcons.downloads },
              ]}
              layout="horizontal"
              showDividers
            />
          </div>
        </section>

        {/* Episode List */}
        <section>
          <h2 className="text-xl font-bold text-white mb-4">EpisodeList</h2>
          <div className="bg-gray-800 p-6 rounded-xl">
            <EpisodeList
              episodes={sampleEpisodes.slice(0, 5)}
              currentIndex={currentIndex}
              isPlaying={isPlaying}
              onEpisodeClick={(_, index) => {
                setCurrentIndex(index);
                setIsPlaying(true);
              }}
            />
          </div>
        </section>

        {/* Single Episode Item */}
        <section>
          <h2 className="text-xl font-bold text-white mb-4">EpisodeItem</h2>
          <div className="bg-gray-800 p-6 rounded-xl space-y-2">
            <EpisodeItem
              episode={sampleEpisodes[0]}
              index={0}
              isActive
              isPlaying
              onClick={() => {}}
            />
            <EpisodeItem
              episode={sampleEpisodes[1]}
              index={1}
              onClick={() => {}}
            />
          </div>
        </section>

        {/* Sticky Player Preview */}
        <section>
          <h2 className="text-xl font-bold text-white mb-4">StickyPlayer (Preview)</h2>
          <div className="bg-gray-800 p-6 rounded-xl">
            <div className="relative h-24 border border-gray-600 rounded-lg overflow-hidden">
              <StickyPlayer
                episode={sampleEpisodes[currentIndex]}
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={sampleEpisodes[currentIndex].duration || 2700}
                onTogglePlay={() => setIsPlaying(!isPlaying)}
                onSeek={(time) => setCurrentTime(time)}
                onClose={() => alert('Close player')}
                className="!relative !bottom-auto"
              />
            </div>
          </div>
        </section>
      </div>
    </LabelsProvider>
  );
}

export const Components: Story = {
  render: () => <ComponentsDemo />,
};

/**
 * Interactive demo with working player
 */
function InteractiveDemo() {
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'popular'>('newest');

  return (
    <PodcastPage
      podcast={samplePodcast}
      episodes={sampleEpisodes}
      sortOrder={sortOrder}
      onSortChange={setSortOrder}
      rating={{
        initialState: {
          upCount: 842,
          downCount: 23,
          userRating: null,
          enabled: true,
          canRate: true,
        },
        onRateUp: () => console.log('Rated up'),
        onRateDown: () => console.log('Rated down'),
      }}
      stats={[
        { id: 'plays', label: 'Total Plays', value: formatStatNumber(125000), icon: StatIcons.plays },
        { id: 'subscribers', label: 'Subscribers', value: formatStatNumber(8500), icon: StatIcons.subscribers },
        { id: 'episodes', label: 'Episodes', value: '24', icon: StatIcons.episodes },
      ]}
      onSubscribe={() => alert('Subscribed!')}
      onEpisodeSelect={(episode) => console.log('Playing:', episode.title)}
    />
  );
}

export const Interactive: Story = {
  render: () => <InteractiveDemo />,
};
