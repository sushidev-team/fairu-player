import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { TimeDisplay } from './TimeDisplay';
import {
  Matrix,
  Note,
  Panel,
  Range,
  Snippet,
  Stage,
  StateInspector,
  Toggle,
} from '@/stories/preview-kit';

const meta: Meta<typeof TimeDisplay> = {
  title: 'Controls/TimeDisplay',
  component: TimeDisplay,
  tags: ['autodocs'],
  argTypes: {
    currentTime: { control: { type: 'number' } },
    duration: { control: { type: 'number' } },
    showRemaining: { control: 'boolean' },
    labels: { table: { disable: true } },
  },
  args: { currentTime: 90, duration: 600, showRemaining: false },
};

export default meta;
type Story = StoryObj<typeof TimeDisplay>;

const CASES = [
  { label: 'Short', props: { currentTime: 12, duration: 180 } },
  { label: 'Past an hour', props: { currentTime: 3723, duration: 7200 } },
  { label: 'At the start', props: { currentTime: 0, duration: 600 } },
  { label: 'At the end', props: { currentTime: 600, duration: 600 } },
  { label: 'Duration unknown', props: { currentTime: 42, duration: 0 } },
  { label: 'Remaining', props: { currentTime: 90, duration: 600, showRemaining: true } },
];

/** The formatting cases that actually differ. */
export const Formats: Story = {
  render: () => (
    <Stage
      title="Formatting"
      description="The clock grows a field only when it needs one: mm:ss below an hour, h:mm:ss above it. A podcast never shows a leading 0: for an hour it does not have."
      aside={
        <Note>
          &quot;Duration unknown&quot; is the live and pre-metadata case. Duration is <code>0</code>{' '}
          until <code>loadedmetadata</code> fires and <code>Infinity</code> for a live stream, so
          this component has to render something sane before it ever knows how long the media is.
        </Note>
      }
    >
      <Matrix
        items={CASES}
        columns={3}
        onVideo
        label={(item) => item.label}
        render={(item) => <TimeDisplay {...item.props} />}
      />
    </Stage>
  ),
};

/** Scrub the clock. */
export const Playground: Story = {
  render: function Render() {
    const [currentTime, setCurrentTime] = useState(90);
    const [duration, setDuration] = useState(600);
    const [showRemaining, setShowRemaining] = useState(false);

    return (
      <Stage
        title="Playground"
        description="Remaining mode counts down instead of up, which is what listeners reach for when deciding whether an episode fits the rest of a commute."
        aside={
          <div className="flex flex-col gap-4">
            <Panel title="Controls">
              <Range
                label="Current time"
                value={currentTime}
                min={0}
                max={duration || 600}
                onChange={setCurrentTime}
                format={(v) => `${v}s`}
              />
              <Range
                label="Duration"
                value={duration}
                min={0}
                max={7200}
                step={30}
                onChange={setDuration}
                format={(v) => `${v}s`}
              />
              <Toggle
                label="Show remaining"
                checked={showRemaining}
                onChange={setShowRemaining}
                hint="Counts down rather than up"
              />
            </Panel>
            <StateInspector state={{ currentTime, duration, showRemaining }} />
          </div>
        }
      >
        <TimeDisplay
          currentTime={currentTime}
          duration={duration}
          showRemaining={showRemaining}
        />
      </Stage>
    );
  },
};

/** Reading the values off the player. */
export const Usage: Story = {
  render: () => (
    <Snippet
      title="With usePlayer"
      code={`import { TimeDisplay, usePlayer } from '@fairu/player';

function Clock() {
  const { state } = usePlayer();

  return (
    <TimeDisplay
      currentTime={state.currentTime}
      duration={state.duration}
      showRemaining
    />
  );
}`}
    />
  ),
};
