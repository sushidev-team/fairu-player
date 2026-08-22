import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { QualitySelector } from './QualitySelector';
import type { VideoQuality } from '@/types/video';
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

const LADDER: VideoQuality[] = [
  { label: '1080p', src: 'https://example.test/1080.mp4', height: 1080, bitrate: 5_000_000 },
  { label: '720p', src: 'https://example.test/720.mp4', height: 720, bitrate: 2_800_000 },
  { label: '480p', src: 'https://example.test/480.mp4', height: 480, bitrate: 1_400_000 },
  { label: '360p', src: 'https://example.test/360.mp4', height: 360, bitrate: 800_000 },
];

const meta: Meta<typeof QualitySelector> = {
  title: 'Controls/QualitySelector',
  component: QualitySelector,
  tags: ['autodocs'],
  argTypes: {
    currentQuality: { control: 'text' },
    disabled: { control: 'boolean' },
    onQualityChange: { table: { disable: true } },
    labels: { table: { disable: true } },
    qualities: { table: { disable: true } },
  },
  args: { currentQuality: 'auto', qualities: LADDER },
};

export default meta;
type Story = StoryObj<typeof QualitySelector>;

/** The default: adaptive, with the ladder available behind it. */
export const Default: Story = {
  render: (args) => (
    <Stage
      title="Adaptive by default"
      description="'Auto' is the first entry and the shipping default. Pinning a level is an override for people who know their connection better than the algorithm does — usually to stop it climbing on metered data."
      aside={
        <Note>
          The ladder is not hard-coded. For HLS it comes from the levels hls.js parses out of the
          manifest; for progressive MP4 it comes from the <code>qualities</code> on the track. Both
          arrive as the same <code>VideoQuality[]</code>, so this component never learns which.
        </Note>
      }
    >
      <QualitySelector {...args} />
    </Stage>
  ),
};

/** A single-rendition source. */
export const SingleQuality: Story = {
  args: { qualities: [LADDER[1]], currentQuality: '720p' },
  render: (args) => (
    <Stage
      title="One rendition"
      description="A source with nothing to choose between. Worth checking deliberately — this is what every progressive MP4 without a quality ladder looks like."
    >
      <QualitySelector {...args} />
    </Stage>
  ),
};

/** Live pick with a change log. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();
    const [quality, setQuality] = useState('auto');
    const [disabled, setDisabled] = useState(false);

    return (
      <Stage
        title="Playground"
        description="Picking a level pins it. In the player that sets hls.currentLevel, which takes effect at the next segment boundary rather than instantly — a fixed cost of switching mid-stream."
        aside={
          <div className="flex flex-col gap-4">
            <Panel title="Controls">
              <Toggle label="Disabled" checked={disabled} onChange={setDisabled} />
            </Panel>
            <StateInspector state={{ currentQuality: quality }} highlight={['currentQuality']} />
            <EventLog entries={entries} onClear={clear} counts={counts} height={200} />
          </div>
        }
      >
        <QualitySelector
          currentQuality={quality}
          qualities={LADDER}
          disabled={disabled}
          onQualityChange={(q) => {
            log('onQualityChange', q);
            setQuality(q);
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
      code={`import { QualitySelector, useVideoPlayer } from '@fairu/player';

function Controls() {
  const { state, controls } = useVideoPlayer();

  return (
    <QualitySelector
      currentQuality={state.currentQuality}
      qualities={state.availableQualities}
      onQualityChange={controls.setQuality}
    />
  );
}`}
    />
  ),
};
