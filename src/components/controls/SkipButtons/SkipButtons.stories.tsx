import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SkipButton, SkipButtons } from './SkipButtons';
import {
  EventLog,
  Matrix,
  Note,
  Panel,
  Range,
  Segmented,
  Snippet,
  Stage,
  StateInspector,
  Toggle,
  useEventLog,
} from '@/stories/preview-kit';

const meta: Meta<typeof SkipButtons> = {
  title: 'Controls/SkipButtons',
  component: SkipButtons,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    forwardSeconds: { control: { type: 'number', min: 1, max: 120 } },
    backwardSeconds: { control: { type: 'number', min: 1, max: 120 } },
    disabled: { control: 'boolean' },
    onSkipForward: { table: { disable: true } },
    onSkipBackward: { table: { disable: true } },
  },
  args: { forwardSeconds: 30, backwardSeconds: 10, size: 'md' },
};

export default meta;
type Story = StoryObj<typeof SkipButtons>;

/**
 * The common presets, side by side.
 *
 * Asymmetric skips are the norm in podcast players: forward is for cutting ads,
 * backward is for catching a missed sentence, and those need different sizes.
 */
export const Presets: Story = {
  render: () => (
    <Stage
      title="Skip presets"
      description="Asymmetric skip amounts are the norm: forward skips past ads (30s), backward re-hears a missed sentence (10–15s). Symmetric 10/10 suits video, where seeking is cheap."
      aside={
        <Note>
          The seconds are rendered inside the glyph, so a viewer never has to guess how far a tap
          will jump.
        </Note>
      }
    >
      <Matrix
        items={[
          { label: 'Podcast (30 / 10)', forward: 30, backward: 10 },
          { label: 'Video (10 / 10)', forward: 10, backward: 10 },
          { label: 'Audiobook (15 / 15)', forward: 15, backward: 15 },
          { label: 'Lecture (60 / 30)', forward: 60, backward: 30 },
          { label: 'Precise (5 / 5)', forward: 5, backward: 5 },
        ]}
        columns={5}
        onVideo
        label={(item) => item.label}
        render={(item) => (
          <SkipButtons forwardSeconds={item.forward} backwardSeconds={item.backward} />
        )}
      />
    </Stage>
  ),
};

/** Sizes and the disabled state. */
export const SizesAndStates: Story = {
  render: () => (
    <Stage title="Sizes and states" layout="columns">
      <Matrix
        items={[
          { label: "size='sm'", props: { size: 'sm' as const } },
          { label: "size='md'", props: { size: 'md' as const } },
          { label: 'disabled', props: { disabled: true } },
        ]}
        columns={3}
        onVideo
        label={(item) => item.label}
        render={(item) => <SkipButtons forwardSeconds={30} backwardSeconds={10} {...item.props} />}
      />
    </Stage>
  ),
};

/** The single-direction button, used when only one direction makes sense. */
export const SingleDirection: Story = {
  render: () => (
    <Stage
      title="SkipButton (single)"
      description="Exported separately so a compact control bar can show only the direction that matters — e.g. forward-only on an ad-supported stream where rewinding is disallowed."
      aside={
        <Snippet
          code={`import { SkipButton } from '@fairu/player';

<SkipButton direction="forward" seconds={30} onClick={skip} />`}
        />
      }
    >
      <Matrix
        items={[
          { label: 'forward · 30s · md', direction: 'forward' as const, seconds: 30, size: 'md' as const },
          { label: 'backward · 10s · md', direction: 'backward' as const, seconds: 10, size: 'md' as const },
          { label: 'forward · 15s · sm', direction: 'forward' as const, seconds: 15, size: 'sm' as const },
          { label: 'backward · 15s · sm', direction: 'backward' as const, seconds: 15, size: 'sm' as const },
        ]}
        columns={4}
        onVideo
        label={(item) => item.label}
        render={(item) => (
          <SkipButton direction={item.direction} seconds={item.seconds} size={item.size} />
        )}
      />
    </Stage>
  ),
};

/** Wired to a simulated playhead so the skips are visible. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();
    const [time, setTime] = useState(120);
    const [forward, setForward] = useState(30);
    const [backward, setBackward] = useState(10);
    const [size, setSize] = useState<'sm' | 'md'>('md');
    const [disabled, setDisabled] = useState(false);

    const duration = 600;
    const clamp = (value: number) => Math.max(0, Math.min(duration, value));
    const format = (seconds: number) =>
      `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

    return (
      <Stage
        title="Playground"
        description="The buttons drive a simulated playhead, clamped to the track length — so you can see the clamping behaviour at both ends."
        aside={
          <>
            <Panel title="Props">
              <Range
                label="forwardSeconds"
                value={forward}
                min={5}
                max={90}
                step={5}
                onChange={setForward}
                format={(v) => `${v}s`}
              />
              <Range
                label="backwardSeconds"
                value={backward}
                min={5}
                max={90}
                step={5}
                onChange={setBackward}
                format={(v) => `${v}s`}
              />
              <Segmented
                label="size"
                value={size}
                options={[
                  { value: 'sm', label: 'sm' },
                  { value: 'md', label: 'md' },
                ]}
                onChange={setSize}
              />
              <Toggle label="disabled" checked={disabled} onChange={setDisabled} />
            </Panel>

            <StateInspector
              state={{
                currentTime: format(time),
                duration: format(duration),
                atStart: time === 0,
                atEnd: time === duration,
              }}
              highlight={['currentTime']}
            />
            <EventLog entries={entries} counts={counts} onClear={clear} height={160} />
          </>
        }
      >
        <div className="flex flex-col items-center gap-6 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 p-10">
          <span className="font-mono text-3xl tabular-nums text-white">{format(time)}</span>

          <div className="h-1 w-64 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full bg-[var(--fp-color-accent)] transition-[width] duration-200"
              style={{ width: `${(time / duration) * 100}%` }}
            />
          </div>

          <SkipButtons
            forwardSeconds={forward}
            backwardSeconds={backward}
            size={size}
            disabled={disabled}
            onSkipForward={() => {
              setTime((t) => clamp(t + forward));
              log('onSkipForward', `+${forward}s`);
            }}
            onSkipBackward={() => {
              setTime((t) => clamp(t - backward));
              log('onSkipBackward', `−${backward}s`);
            }}
          />
        </div>
      </Stage>
    );
  },
};

export const Themes: Story = {
  parameters: { compareThemes: true },
  args: { forwardSeconds: 30, backwardSeconds: 10 },
};
