import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Rating } from './Rating';
import { LabelsProvider } from '@/context/LabelsContext';
import type { RatingValue, RatingState } from '@/types/stats';

const meta: Meta<typeof Rating> = {
  title: 'Components/Rating',
  component: Rating,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
  decorators: [
    (Story) => (
      <LabelsProvider>
        <div className="fp-dark p-8">
          <Story />
        </div>
      </LabelsProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Rating>;

/**
 * Default rating component
 */
export const Default: Story = {
  args: {
    initialState: {
      upCount: 42,
      downCount: 3,
    },
  },
};

/**
 * With user's existing rating (liked)
 */
export const UserLiked: Story = {
  args: {
    initialState: {
      userRating: 'up',
      upCount: 128,
      downCount: 12,
    },
  },
};

/**
 * With user's existing rating (disliked)
 */
export const UserDisliked: Story = {
  args: {
    initialState: {
      userRating: 'down',
      upCount: 56,
      downCount: 8,
    },
  },
};

/**
 * Show percentage instead of counts
 */
export const ShowPercentage: Story = {
  args: {
    initialState: {
      upCount: 85,
      downCount: 15,
    },
    showPercentage: true,
  },
};

/**
 * Without counts (icons only)
 */
export const NoCountsDisplay: Story = {
  args: {
    initialState: {
      upCount: 100,
      downCount: 10,
    },
    showCounts: false,
  },
};

/**
 * Small size variant
 */
export const SmallSize: Story = {
  args: {
    size: 'sm',
    initialState: {
      upCount: 42,
      downCount: 3,
    },
  },
};

/**
 * Large size variant
 */
export const LargeSize: Story = {
  args: {
    size: 'lg',
    initialState: {
      upCount: 1250,
      downCount: 48,
    },
  },
};

/**
 * Disabled state
 */
export const Disabled: Story = {
  args: {
    disabled: true,
    initialState: {
      upCount: 42,
      downCount: 3,
    },
  },
};

/**
 * Read-only (can't rate)
 */
export const ReadOnly: Story = {
  args: {
    initialState: {
      upCount: 42,
      downCount: 3,
      canRate: false,
    },
  },
};

/**
 * Interactive demo with callbacks
 */
function InteractiveDemo() {
  const [state, setState] = useState<RatingState>({
    userRating: null,
    upCount: 42,
    downCount: 3,
    enabled: true,
    canRate: true,
  });
  const [events, setEvents] = useState<string[]>([]);

  const addEvent = (event: string) => {
    setEvents((prev) => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${event}`]);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-white text-lg font-semibold mb-4">Interactive Rating Demo</h3>

        <div className="flex items-center gap-4">
          <Rating
            state={state}
            size="lg"
            onRateUp={() => {
              addEvent('Rated UP');
              setState((s) => ({
                ...s,
                userRating: s.userRating === 'up' ? null : 'up',
                upCount: s.userRating === 'up' ? s.upCount - 1 : s.userRating === 'down' ? s.upCount + 1 : s.upCount + 1,
                downCount: s.userRating === 'down' ? s.downCount - 1 : s.downCount,
              }));
            }}
            onRateDown={() => {
              addEvent('Rated DOWN');
              setState((s) => ({
                ...s,
                userRating: s.userRating === 'down' ? null : 'down',
                downCount: s.userRating === 'down' ? s.downCount - 1 : s.userRating === 'up' ? s.downCount + 1 : s.downCount + 1,
                upCount: s.userRating === 'up' ? s.upCount - 1 : s.upCount,
              }));
            }}
            onRateRemove={() => addEvent('Rating removed')}
            onRatingChange={(rating) => addEvent(`Rating changed to: ${rating ?? 'none'}`)}
          />

          <div className="text-gray-400 text-sm">
            Deine Bewertung: <span className="text-white font-medium">{state.userRating ?? 'Keine'}</span>
          </div>
        </div>
      </div>

      {/* Event Log */}
      <div className="bg-gray-900 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-2 text-gray-400">Event Log:</h4>
        <div className="space-y-1 text-xs font-mono text-gray-300">
          {events.length === 0 ? (
            <span className="text-gray-500">Klicke auf die Bewertungen...</span>
          ) : (
            events.map((event, i) => <div key={i}>{event}</div>)
          )}
        </div>
      </div>

      {/* Current State */}
      <div className="bg-gray-900 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-2 text-gray-400">Current State:</h4>
        <pre className="text-xs text-gray-300">{JSON.stringify(state, null, 2)}</pre>
      </div>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveDemo />,
};

/**
 * All sizes comparison
 */
function AllSizesDemo() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="text-gray-400 text-sm w-20">Small:</span>
        <Rating size="sm" initialState={{ upCount: 42, downCount: 3 }} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-gray-400 text-sm w-20">Medium:</span>
        <Rating size="md" initialState={{ upCount: 42, downCount: 3 }} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-gray-400 text-sm w-20">Large:</span>
        <Rating size="lg" initialState={{ upCount: 42, downCount: 3 }} />
      </div>
    </div>
  );
}

export const AllSizes: Story = {
  render: () => <AllSizesDemo />,
};
