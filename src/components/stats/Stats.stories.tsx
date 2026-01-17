import type { Meta, StoryObj } from '@storybook/react';
import { Stats, StatIcons } from './Stats';
import { Rating } from './Rating';
import { LabelsProvider } from '@/context/LabelsContext';
import { formatStatNumber, formatStatDate, createStatItem } from '@/types/stats';
import type { StatItem } from '@/types/stats';

const meta: Meta<typeof Stats> = {
  title: 'Components/Stats',
  component: Stats,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
  decorators: [
    (Story) => (
      <LabelsProvider>
        <div className="fp-dark p-8 w-[600px]">
          <Story />
        </div>
      </LabelsProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Stats>;

// Sample stat items
const podcastStats: StatItem[] = [
  { id: 'plays', label: 'Plays', value: formatStatNumber(12500), icon: StatIcons.plays },
  { id: 'likes', label: 'Likes', value: formatStatNumber(842), icon: StatIcons.likes },
  { id: 'comments', label: 'Comments', value: '56', icon: StatIcons.comments },
  { id: 'shares', label: 'Shares', value: '128', icon: StatIcons.shares },
];

/**
 * Default horizontal layout
 */
export const Default: Story = {
  args: {
    items: podcastStats,
    layout: 'horizontal',
  },
};

/**
 * Vertical layout
 */
export const VerticalLayout: Story = {
  args: {
    items: podcastStats,
    layout: 'vertical',
  },
};

/**
 * Grid layout
 */
export const GridLayout: Story = {
  args: {
    items: podcastStats,
    layout: 'grid',
    columns: 2,
  },
};

/**
 * With dividers
 */
export const WithDividers: Story = {
  args: {
    items: podcastStats,
    layout: 'horizontal',
    showDividers: true,
  },
};

/**
 * Compact mode
 */
export const Compact: Story = {
  args: {
    items: podcastStats,
    layout: 'horizontal',
    compact: true,
  },
};

/**
 * Extended podcast stats
 */
const extendedPodcastStats: StatItem[] = [
  { id: 'plays', label: 'Plays', value: formatStatNumber(125000), icon: StatIcons.plays, order: 1 },
  { id: 'duration', label: 'Duration', value: '45:32', icon: StatIcons.duration, order: 2 },
  { id: 'published', label: 'Published', value: formatStatDate(new Date('2024-01-15')), icon: StatIcons.calendar, order: 3 },
  { id: 'episodes', label: 'Episodes', value: '156', icon: StatIcons.episodes, order: 4 },
  { id: 'subscribers', label: 'Subscribers', value: formatStatNumber(8500), icon: StatIcons.subscribers, order: 5 },
  { id: 'downloads', label: 'Downloads', value: formatStatNumber(450000), icon: StatIcons.downloads, order: 6 },
];

export const ExtendedStats: Story = {
  args: {
    items: extendedPodcastStats,
    layout: 'grid',
    columns: 3,
  },
};

/**
 * Video stats example
 */
const videoStats: StatItem[] = [
  { id: 'views', label: 'Views', value: formatStatNumber(1250000), icon: StatIcons.views },
  { id: 'likes', label: 'Likes', value: formatStatNumber(45000), icon: StatIcons.likes },
  { id: 'comments', label: 'Comments', value: formatStatNumber(2300), icon: StatIcons.comments },
  { id: 'shares', label: 'Shares', value: formatStatNumber(890), icon: StatIcons.shares },
];

export const VideoStats: Story = {
  args: {
    items: videoStats,
    layout: 'horizontal',
    showDividers: true,
  },
};

/**
 * With clickable items
 */
const clickableStats: StatItem[] = [
  { id: 'plays', label: 'Plays', value: '12.5K', icon: StatIcons.plays },
  {
    id: 'comments',
    label: 'Comments',
    value: '56',
    icon: StatIcons.comments,
    onClick: () => alert('Opening comments...'),
    tooltip: 'Click to view comments',
  },
  {
    id: 'website',
    label: 'Website',
    value: 'fairu.app',
    href: 'https://fairu.app',
    tooltip: 'Visit website',
  },
];

export const ClickableItems: Story = {
  args: {
    items: clickableStats,
    layout: 'horizontal',
  },
};

/**
 * Dynamic stats - showing how to extend with custom items
 */
function DynamicStatsDemo() {
  // Create stats dynamically using helper function
  const dynamicStats = [
    createStatItem('plays', 'Total Plays', formatStatNumber(125000), { icon: StatIcons.plays, order: 1 }),
    createStatItem('unique', 'Unique Listeners', formatStatNumber(45000), { order: 2 }),
    createStatItem('avg-time', 'Avg. Listen Time', '32:15', { icon: StatIcons.duration, order: 3 }),
    createStatItem('completion', 'Completion Rate', '78%', { order: 4 }),
    createStatItem('rating', 'Avg. Rating', '4.8/5', { order: 5 }),
    // Custom stat without icon
    createStatItem('custom', 'Custom Metric', 'Any Value', { order: 6 }),
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-white text-lg font-semibold mb-4">Dynamic Stats with createStatItem()</h3>
        <Stats items={dynamicStats} layout="grid" columns={3} />
      </div>

      <div className="bg-gray-900 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-2 text-gray-400">Code:</h4>
        <pre className="text-xs text-green-300 overflow-x-auto">
{`import { createStatItem, formatStatNumber, StatIcons } from '@fairu/player';

const stats = [
  createStatItem('plays', 'Total Plays', formatStatNumber(125000), {
    icon: StatIcons.plays,
    order: 1,
  }),
  createStatItem('custom', 'Any Label', 'Any Value'),
];

<Stats items={stats} layout="grid" columns={3} />`}
        </pre>
      </div>
    </div>
  );
}

export const DynamicStats: Story = {
  render: () => <DynamicStatsDemo />,
};

/**
 * Combined Rating + Stats example
 */
function CombinedDemo() {
  return (
    <div className="space-y-6">
      {/* Podcast card example */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex gap-4">
          <img
            src="https://picsum.photos/120"
            alt="Podcast cover"
            className="w-24 h-24 rounded-lg object-cover"
          />
          <div className="flex-1">
            <h3 className="text-white text-lg font-semibold">Tech Talk Podcast</h3>
            <p className="text-gray-400 text-sm mb-3">Episode 42: The Future of AI</p>

            {/* Rating */}
            <div className="flex items-center gap-4 mb-3">
              <Rating
                initialState={{ upCount: 842, downCount: 23, userRating: null }}
                size="sm"
              />
            </div>

            {/* Stats */}
            <Stats
              items={[
                { id: 'plays', label: 'Plays', value: '12.5K', icon: StatIcons.plays },
                { id: 'duration', label: 'Duration', value: '45:32', icon: StatIcons.duration },
                { id: 'date', label: 'Published', value: '15. Jan 2024', icon: StatIcons.calendar },
              ]}
              layout="horizontal"
              compact
              showDividers
            />
          </div>
        </div>
      </div>

      {/* Video card example */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="aspect-video bg-gray-700 relative">
          <img
            src="https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg"
            alt="Video thumbnail"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-xs rounded">
            10:34
          </div>
        </div>
        <div className="p-4">
          <h3 className="text-white font-semibold mb-2">Big Buck Bunny</h3>

          <div className="flex items-center justify-between">
            {/* Stats on left */}
            <Stats
              items={[
                { id: 'views', label: 'Views', value: '1.2M' },
                { id: 'date', label: '', value: '2 weeks ago' },
              ]}
              layout="horizontal"
              compact
            />

            {/* Rating on right */}
            <Rating
              initialState={{ upCount: 45000, downCount: 1200 }}
              size="sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export const CombinedExample: Story = {
  render: () => <CombinedDemo />,
};

/**
 * All available stat icons
 */
function AllIconsDemo() {
  const iconItems: StatItem[] = Object.entries(StatIcons).map(([key, icon]) => ({
    id: key,
    label: key,
    value: '123',
    icon,
  }));

  return (
    <div className="space-y-4">
      <h3 className="text-white text-lg font-semibold">Available StatIcons</h3>
      <Stats items={iconItems} layout="grid" columns={3} />

      <div className="bg-gray-900 rounded-lg p-4 mt-4">
        <h4 className="text-sm font-semibold mb-2 text-gray-400">Usage:</h4>
        <pre className="text-xs text-green-300">
{`import { StatIcons } from '@fairu/player';

const stats = [
  { id: '1', label: 'Plays', value: '123', icon: StatIcons.plays },
  { id: '2', label: 'Views', value: '456', icon: StatIcons.views },
  // ... more icons: likes, comments, shares, downloads,
  //     duration, calendar, episodes, subscribers
];`}
        </pre>
      </div>
    </div>
  );
}

export const AvailableIcons: Story = {
  render: () => <AllIconsDemo />,
};
