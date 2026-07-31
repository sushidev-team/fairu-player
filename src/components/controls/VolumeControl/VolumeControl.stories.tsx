import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { VolumeControl } from './VolumeControl';
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

const meta: Meta<typeof VolumeControl> = {
  title: 'Controls/VolumeControl',
  component: VolumeControl,
  tags: ['autodocs'],
  argTypes: {
    volume: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    muted: { control: 'boolean' },
    disabled: { control: 'boolean' },
    orientation: { control: 'inline-radio', options: ['vertical', 'horizontal'] },
    onVolumeChange: { table: { disable: true } },
    onMuteToggle: { table: { disable: true } },
  },
  args: { volume: 0.75, muted: false, orientation: 'vertical' },
};

export default meta;
type Story = StoryObj<typeof VolumeControl>;

const LEVELS = [
  { label: '0% (silent)', volume: 0, muted: false },
  { label: '15%', volume: 0.15, muted: false },
  { label: '50%', volume: 0.5, muted: false },
  { label: '100%', volume: 1, muted: false },
  { label: 'muted @ 75%', volume: 0.75, muted: true },
  { label: 'disabled', volume: 0.5, muted: false, disabled: true },
];

/**
 * The glyph changes with the level, which is what makes the control readable at
 * a glance without opening the slider.
 */
export const Levels: Story = {
  render: () => (
    <Stage
      title="Volume levels"
      description="The speaker glyph steps with the level so the state is legible before the slider is even opened. Muting at 75% keeps the level, so unmuting restores it rather than jumping to full."
      aside={
        <Note>
          <code>volume=0</code> and <code>muted=true</code> are distinct states. Collapsing them
          loses the level a viewer will want back when they unmute.
        </Note>
      }
    >
      <Matrix
        items={LEVELS}
        columns={6}
        onVideo
        label={(item) => item.label}
        render={(item) => (
          <VolumeControl volume={item.volume} muted={item.muted} disabled={item.disabled} />
        )}
      />
    </Stage>
  ),
};

/** The two layouts, and where each belongs. */
export const Orientations: Story = {
  render: () => (
    <Stage
      title="Orientations"
      description="Vertical opens the slider as an overlay above the button — the right choice in a dense video control bar. Horizontal keeps it inline, which suits a wide audio player where there is room to spare."
      layout="columns"
      aside={
        <Snippet
          code={`// Video control bar — overlay, saves horizontal space
<VolumeControl orientation="vertical" volume={0.8} muted={false} />

// Audio player — inline slider, always visible
<VolumeControl orientation="horizontal" volume={0.8} muted={false} />`}
        />
      }
    >
      <div className="flex w-full flex-wrap items-start gap-8">
        <div
          className="flex flex-col items-center gap-3 rounded-lg p-8"
          style={{ background: 'linear-gradient(135deg,#1a1a1a,#2d2d2d)' }}
        >
          <VolumeControl volume={0.8} muted={false} orientation="vertical" />
          <span className="text-[11px] text-white/50">vertical (hover / click)</span>
        </div>

        <div
          className="flex flex-col items-center gap-3 rounded-lg p-8"
          style={{ background: 'linear-gradient(135deg,#1a1a1a,#2d2d2d)' }}
        >
          <VolumeControl volume={0.8} muted={false} orientation="horizontal" />
          <span className="text-[11px] text-white/50">horizontal (inline)</span>
        </div>
      </div>
    </Stage>
  ),
};

/** Live control with an event log. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog(40);
    const [volume, setVolume] = useState(0.75);
    const [muted, setMuted] = useState(false);
    const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('horizontal');
    const [disabled, setDisabled] = useState(false);

    // What the media element would actually output.
    const effective = muted ? 0 : volume;

    return (
      <Stage
        title="Playground"
        description="Drag the slider and toggle mute. The effective output is what the media element would actually play — mute is a gate on top of the level, not a replacement for it."
        aside={
          <>
            <Panel title="Props">
              <Range
                label="volume"
                value={volume}
                min={0}
                max={1}
                step={0.05}
                onChange={(value) => {
                  setVolume(value);
                  log('onVolumeChange', `${Math.round(value * 100)}%`);
                }}
                format={(v) => `${Math.round(v * 100)}%`}
              />
              <Toggle label="muted" checked={muted} onChange={setMuted} />
              <Toggle label="disabled" checked={disabled} onChange={setDisabled} />
              <Segmented
                label="orientation"
                value={orientation}
                options={[
                  { value: 'horizontal', label: 'horizontal' },
                  { value: 'vertical', label: 'vertical' },
                ]}
                onChange={setOrientation}
              />
            </Panel>

            <StateInspector
              state={{
                volume,
                muted,
                effectiveOutput: effective,
                percent: `${Math.round(effective * 100)}%`,
              }}
              highlight={['effectiveOutput']}
            />
            <EventLog entries={entries} counts={counts} onClear={clear} height={160} />
          </>
        }
      >
        <div className="flex flex-col items-center gap-6 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 p-12">
          <VolumeControl
            volume={volume}
            muted={muted}
            disabled={disabled}
            orientation={orientation}
            onVolumeChange={(value) => {
              setVolume(value);
              log('onVolumeChange', `${Math.round(value * 100)}%`);
            }}
            onMuteToggle={() => {
              setMuted((value) => !value);
              log('onMuteToggle', muted ? '→ unmuted' : '→ muted');
            }}
          />

          {/* A crude level meter so the effective output is visible. */}
          <div className="flex h-10 items-end gap-1">
            {Array.from({ length: 16 }, (_, i) => (
              <span
                key={i}
                className="w-1.5 rounded-sm transition-all duration-150"
                style={{
                  height: `${8 + i * 2}px`,
                  background:
                    i / 16 < effective ? 'var(--fp-color-accent)' : 'rgba(255,255,255,0.12)',
                }}
              />
            ))}
          </div>
        </div>
      </Stage>
    );
  },
};

export const Themes: Story = {
  parameters: { compareThemes: true },
  args: { volume: 0.6, muted: false, orientation: 'horizontal' },
};
