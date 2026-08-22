import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SubtitleSelector } from './SubtitleSelector';
import type { Subtitle } from '@/types/video';
import {
  EventLog,
  Note,
  Panel,
  Snippet,
  Stage,
  StateInspector,
  Toggle,
  useEventLog,
} from '@/stories/preview-kit';

const SUBTITLES: Subtitle[] = [
  { id: 'de', label: 'Deutsch', language: 'de', src: 'https://example.test/de.vtt', default: true },
  { id: 'en', label: 'English', language: 'en', src: 'https://example.test/en.vtt' },
  { id: 'fr', label: 'Français', language: 'fr', src: 'https://example.test/fr.vtt' },
];

const meta: Meta<typeof SubtitleSelector> = {
  title: 'Controls/SubtitleSelector',
  component: SubtitleSelector,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    onSubtitleChange: { table: { disable: true } },
    labels: { table: { disable: true } },
    subtitles: { table: { disable: true } },
  },
  args: { currentSubtitle: null, subtitles: SUBTITLES },
};

export default meta;
type Story = StoryObj<typeof SubtitleSelector>;

/** Off, which is the default state. */
export const Off: Story = {
  render: (args) => (
    <Stage
      title="Off by default"
      description="'Off' is a first-class entry rather than a way to deselect. Turning captions off has to be as reachable as turning them on, and a toggle that only unselects is easy to get stuck in."
      aside={
        <Note>
          <code>currentSubtitle</code> is <code>string | null</code> — <code>null</code> means off.
          That distinction matters for persistence: a viewer who deliberately turned captions off
          expects them to stay off on the next episode, which is different from never having
          chosen.
        </Note>
      }
    >
      <SubtitleSelector {...args} />
    </Stage>
  ),
};

/** A track selected. */
export const Selected: Story = {
  args: { currentSubtitle: 'de' },
  render: (args) => (
    <Stage
      title="Track selected"
      description="The active track is marked in the list and the trigger reflects that captions are on."
    >
      <SubtitleSelector {...args} />
    </Stage>
  ),
};

/** No subtitles on the source. */
export const NoSubtitles: Story = {
  args: { subtitles: [] },
  render: (args) => (
    <Stage
      title="Nothing to select"
      description="Most sources carry no caption tracks at all, so this is the common case rather than the edge one."
      aside={
        <Note tone="warn">
          The player hides the control entirely when the list is empty. Rendering an empty menu
          would promise something the source cannot deliver.
        </Note>
      }
    >
      <SubtitleSelector {...args} />
    </Stage>
  ),
};

/** Live pick with a change log. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();
    const [current, setCurrent] = useState<string | null>(null);
    const [disabled, setDisabled] = useState(false);

    return (
      <Stage
        title="Playground"
        description="Watch the null in the log: turning captions off emits null, not an empty string, which is what the persistence layer stores to tell 'off' from 'never chosen'."
        aside={
          <div className="flex flex-col gap-4">
            <Panel title="Controls">
              <Toggle label="Disabled" checked={disabled} onChange={setDisabled} />
            </Panel>
            <StateInspector
              state={{ currentSubtitle: current }}
              highlight={['currentSubtitle']}
            />
            <EventLog entries={entries} onClear={clear} counts={counts} height={200} />
          </div>
        }
      >
        <SubtitleSelector
          currentSubtitle={current}
          subtitles={SUBTITLES}
          disabled={disabled}
          onSubtitleChange={(id) => {
            log('onSubtitleChange', id === null ? 'null (off)' : id);
            setCurrent(id);
          }}
        />
      </Stage>
    );
  },
};

/** Wiring it to the video context. */
export const Usage: Story = {
  render: () => (
    <Snippet
      title="With useVideoPlayer"
      code={`import { SubtitleSelector, useVideoPlayer } from '@fairu/player';

function Controls() {
  const { state, controls, currentTrack } = useVideoPlayer();
  const subtitles = currentTrack?.subtitles ?? [];

  if (subtitles.length === 0) return null;

  return (
    <SubtitleSelector
      currentSubtitle={state.currentSubtitle}
      subtitles={subtitles}
      onSubtitleChange={controls.setSubtitle}
    />
  );
}`}
    />
  ),
};
