import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { PlayButton } from './PlayButton';
import {
  EventLog,
  Matrix,
  Note,
  Panel,
  Segmented,
  Snippet,
  Stage,
  StateInspector,
  Toggle,
  useEventLog,
} from '@/stories/preview-kit';

const meta: Meta<typeof PlayButton> = {
  title: 'Controls/PlayButton',
  component: PlayButton,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    isPlaying: { control: 'boolean' },
    isLoading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    onClick: { table: { disable: true } },
    labels: { table: { disable: true } },
  },
  args: { isPlaying: false, size: 'md' },
};

export default meta;
type Story = StoryObj<typeof PlayButton>;

const SIZES = ['sm', 'md', 'lg'] as const;

const STATES = [
  { label: 'Idle', props: { isPlaying: false } },
  { label: 'Playing', props: { isPlaying: true } },
  { label: 'Loading', props: { isPlaying: false, isLoading: true } },
  { label: 'Loading (playing)', props: { isPlaying: true, isLoading: true } },
  { label: 'Disabled', props: { isPlaying: false, disabled: true } },
  { label: 'Disabled (playing)', props: { isPlaying: true, disabled: true } },
] as const;

/** Every state at every size, in one view. */
export const AllStates: Story = {
  render: () => (
    <Stage
      title="Every state"
      description="The button is the player's primary control, so its states have to read instantly. Loading replaces the glyph with a spinner rather than dimming it — a dimmed play icon is indistinguishable from disabled."
      aside={
        <Note>
          The accessible name flips between <code>play</code> and <code>pause</code> with the{' '}
          <code>isPlaying</code> prop, so screen readers announce the action rather than the state.
        </Note>
      }
    >
      <div className="flex w-full flex-col gap-6">
        {SIZES.map((size) => (
          <div key={size} className="flex flex-col gap-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--fp-color-text-muted)' }}
            >
              size = {size}
            </span>
            <Matrix
              items={STATES.map((s) => ({ ...s, size }))}
              columns={STATES.length}
              onVideo
              label={(item) => item.label}
              render={(item) => <PlayButton size={item.size} {...item.props} />}
            />
          </div>
        ))}
      </div>
    </Stage>
  ),
};

/** Live playground with a click log. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [disabled, setDisabled] = useState(false);
    const [size, setSize] = useState<'sm' | 'md' | 'lg'>('lg');

    return (
      <Stage
        title="Playground"
        description="Click the button and watch the handler fire. A disabled button still renders but emits nothing."
        aside={
          <>
            <Panel title="Props">
              <Toggle label="isPlaying" checked={isPlaying} onChange={setIsPlaying} />
              <Toggle
                label="isLoading"
                checked={isLoading}
                onChange={setIsLoading}
                hint="Shows a spinner instead of the glyph"
              />
              <Toggle label="disabled" checked={disabled} onChange={setDisabled} />
              <Segmented
                label="size"
                value={size}
                options={SIZES.map((s) => ({ value: s, label: s }))}
                onChange={setSize}
              />
            </Panel>

            <StateInspector
              state={{ isPlaying, isLoading, disabled, size }}
              highlight={['isPlaying']}
            />
            <EventLog entries={entries} counts={counts} onClear={clear} height={160} />
          </>
        }
      >
        <div className="rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 p-16">
          <PlayButton
            isPlaying={isPlaying}
            isLoading={isLoading}
            disabled={disabled}
            size={size}
            onClick={() => {
              setIsPlaying((value) => !value);
              log('onClick', isPlaying ? '→ paused' : '→ playing');
            }}
          />
        </div>
      </Stage>
    );
  },
};

/** Contrast check across themes. */
export const Themes: Story = {
  parameters: { compareThemes: true },
  args: { isPlaying: false, size: 'lg' },
};

/** Localised accessible names. */
export const Localised: Story = {
  render: () => (
    <Stage
      title="Localisation"
      description="Every control accepts a labels prop, so accessible names follow the host app's locale without pulling in a translation library."
      aside={
        <Snippet
          code={`<PlayButton
  isPlaying={false}
  labels={{ play: 'Abspielen', pause: 'Pause' }}
/>`}
        />
      }
    >
      <Matrix
        items={[
          { locale: 'en', labels: { play: 'Play', pause: 'Pause' } },
          { locale: 'de', labels: { play: 'Abspielen', pause: 'Pause' } },
          { locale: 'fr', labels: { play: 'Lecture', pause: 'Pause' } },
          { locale: 'ja', labels: { play: '再生', pause: '一時停止' } },
        ]}
        columns={4}
        onVideo
        label={(item) => `${item.locale} · "${item.labels.play}"`}
        render={(item) => <PlayButton isPlaying={false} size="md" labels={item.labels} />}
      />
    </Stage>
  ),
};
