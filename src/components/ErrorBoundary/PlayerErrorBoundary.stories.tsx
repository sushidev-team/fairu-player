import type { Meta, StoryObj } from '@storybook/react';
import { PlayerErrorBoundary } from './PlayerErrorBoundary';

function ErrorThrower(): never {
  throw new Error('Something went wrong in the player');
}

function ConditionalErrorThrower({ shouldError }: { shouldError: boolean }) {
  if (shouldError) {
    throw new Error('Something went wrong in the player');
  }
  return <div className="text-[var(--fp-color-text)] p-4">Player content is working fine</div>;
}

const meta: Meta<typeof PlayerErrorBoundary> = {
  title: 'Components/PlayerErrorBoundary',
  component: PlayerErrorBoundary,
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
      <div
        className="w-[500px]"
        style={{
          // Provide CSS variables for the glass/theme system
          ['--fp-color-background' as string]: '#121212',
          ['--fp-color-text' as string]: '#ffffff',
          ['--fp-color-text-secondary' as string]: '#a1a1aa',
          ['--fp-glass-bg' as string]: 'rgba(255,255,255,0.08)',
          ['--fp-glass-border' as string]: 'rgba(255,255,255,0.12)',
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PlayerErrorBoundary>;

export const DefaultFallback: Story = {
  render: () => (
    <PlayerErrorBoundary>
      <ErrorThrower />
    </PlayerErrorBoundary>
  ),
};

export const InlineFallback: Story = {
  render: () => (
    <PlayerErrorBoundary inline>
      <ErrorThrower />
    </PlayerErrorBoundary>
  ),
};

export const CustomFallback: Story = {
  render: () => (
    <PlayerErrorBoundary
      fallback={(error, reset) => (
        <div className="flex flex-col items-center gap-3 p-8 rounded-xl bg-red-950/30 border border-red-500/30 text-center">
          <span className="text-red-400 text-2xl">!</span>
          <p className="text-white font-medium">Custom Error UI</p>
          <p className="text-red-300/70 text-sm">{error.message}</p>
          <button
            onClick={reset}
            className="mt-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors"
          >
            Reset Player
          </button>
        </div>
      )}
    >
      <ErrorThrower />
    </PlayerErrorBoundary>
  ),
};

export const NoError: Story = {
  render: () => (
    <PlayerErrorBoundary>
      <ConditionalErrorThrower shouldError={false} />
    </PlayerErrorBoundary>
  ),
};

export const WithClassName: Story = {
  render: () => (
    <PlayerErrorBoundary className="aspect-video">
      <ErrorThrower />
    </PlayerErrorBoundary>
  ),
};
