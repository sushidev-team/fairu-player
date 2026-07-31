import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { PlaybackSpeed } from './PlaybackSpeed';
import {
  EventLog,
  Matrix,
  Note,
  Panel,
  Snippet,
  Stage,
  StateInspector,
  Toggle,
  useEventLog,
} from '@/stories/preview-kit';

const meta: Meta<typeof PlaybackSpeed> = {
  title: 'Controls/PlaybackSpeed',
  component: PlaybackSpeed,
  tags: ['autodocs'],
  argTypes: {
    speed: { control: { type: 'number', min: 0.25, max: 4, step: 0.25 } },
    disabled: { control: 'boolean' },
    onSpeedChange: { table: { disable: true } },
  },
  args: { speed: 1 },
};

export default meta;
type Story = StoryObj<typeof PlaybackSpeed>;

/**
 * Speed sets tuned to different content.
 *
 * Speech stays intelligible up to about 2×; music does not, which is why a music
 * player exposes a narrow range and a podcast player a wide one.
 */
const SPEED_SETS = [
  { label: 'Default', speeds: undefined, speed: 1 },
  { label: 'Podcast (wide)', speeds: [0.75, 1, 1.25, 1.5, 1.75, 2], speed: 1.5 },
  { label: 'Audiobook (fine)', speeds: [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.5], speed: 1.1 },
  { label: 'Study (extreme)', speeds: [0.5, 1, 1.5, 2, 2.5, 3], speed: 2 },
  { label: 'Music (narrow)', speeds: [0.9, 1, 1.1], speed: 1 },
];

/** The rendered trigger at every speed. */
export const SpeedStates: Story = {
  render: () => (
    <Stage
      title="Speed states"
      description="The trigger always shows the active rate, so the current speed is readable without opening the menu. Click any of these to see its option list."
      aside={
        <Note>
          <code>1×</code> renders without a decimal while fractional rates keep theirs — a menu of
          <code> 1.00×</code> entries reads as noise.
        </Note>
      }
    >
      <Matrix
        items={[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3]}
        columns={8}
        onVideo
        label={(speed) => `speed = ${speed}`}
        render={(speed) => <PlaybackSpeed speed={speed} />}
      />
    </Stage>
  ),
};

/** Different speed ladders for different content. */
export const SpeedSets: Story = {
  render: () => (
    <Stage
      title="Speed ladders"
      description="Speech stays intelligible to roughly 2×; music does not. Give a podcast a wide ladder and a music player a narrow one — the control is identical, only the `speeds` array changes."
      aside={
        <Snippet
          code={`// Podcast
<PlaybackSpeed speed={1.5} speeds={[0.75, 1, 1.25, 1.5, 1.75, 2]} />

// Music — pitch artefacts make anything wider unusable
<PlaybackSpeed speed={1} speeds={[0.9, 1, 1.1]} />`}
        />
      }
    >
      <Matrix
        items={SPEED_SETS}
        columns={5}
        onVideo
        label={(item) => (
          <>
            {item.label}
            <br />
            <span style={{ opacity: 0.6 }}>{item.speeds ? `${item.speeds.length} steps` : 'built-in'}</span>
          </>
        )}
        render={(item) => <PlaybackSpeed speed={item.speed} speeds={item.speeds} />}
      />
    </Stage>
  ),
};

/** Live control with a change log. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();
    const [speed, setSpeed] = useState(1);
    const [setIndex, setSetIndex] = useState(1);
    const [disabled, setDisabled] = useState(false);

    const speeds = SPEED_SETS[setIndex].speeds;
    const baseDuration = 3600;

    return (
      <Stage
        title="Playground"
        description="Changing the rate rescales the remaining listening time — the reason people reach for this control in the first place."
        aside={
          <>
            <Panel title="Props">
              <div className="flex flex-col gap-1 py-1.5">
                <span className="text-[13px]" style={{ color: 'var(--fp-color-text-primary)' }}>
                  speeds
                </span>
                {SPEED_SETS.map((set, index) => (
                  <button
                    key={set.label}
                    type="button"
                    onClick={() => {
                      setSetIndex(index);
                      setSpeed(set.speed);
                    }}
                    className="rounded-md px-2 py-1 text-left text-[12px]"
                    style={{
                      background:
                        setIndex === index ? 'var(--fp-color-accent)' : 'var(--fp-color-surface)',
                      color: setIndex === index ? '#000' : 'var(--fp-color-text-secondary)',
                    }}
                  >
                    {set.label}
                  </button>
                ))}
              </div>
              <Toggle label="disabled" checked={disabled} onChange={setDisabled} />
            </Panel>

            <StateInspector
              state={{
                speed,
                trackDuration: '60:00',
                effectiveDuration: `${Math.floor(baseDuration / speed / 60)}:${String(
                  Math.round((baseDuration / speed) % 60)
                ).padStart(2, '0')}`,
                timeSaved: `${Math.round(baseDuration - baseDuration / speed)}s`,
              }}
              highlight={['speed', 'effectiveDuration']}
            />
            <EventLog entries={entries} counts={counts} onClear={clear} height={160} />
          </>
        }
      >
        <div className="flex flex-col items-center gap-4 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 p-12">
          <PlaybackSpeed
            speed={speed}
            speeds={speeds}
            disabled={disabled}
            onSpeedChange={(value) => {
              setSpeed(value);
              log('onSpeedChange', `${value}×`);
            }}
          />
          <p className="m-0 text-center text-[12px] text-white/50">
            A 60-minute episode finishes in{' '}
            <strong className="text-white/80">
              {Math.floor(baseDuration / speed / 60)}m{' '}
              {String(Math.round((baseDuration / speed) % 60)).padStart(2, '0')}s
            </strong>
          </p>
        </div>
      </Stage>
    );
  },
};

export const Themes: Story = {
  parameters: { compareThemes: true },
  args: { speed: 1.5 },
};
