import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { NowPlayingIndicator } from './NowPlayingIndicator';
import {
  Matrix,
  Note,
  Panel,
  Range,
  Segmented,
  Snippet,
  Stage,
  Toggle,
} from '@/stories/preview-kit';

const meta: Meta<typeof NowPlayingIndicator> = {
  title: 'Controls/NowPlayingIndicator',
  component: NowPlayingIndicator,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    bars: { control: { type: 'range', min: 2, max: 6, step: 1 } },
    isPlaying: { control: 'boolean' },
  },
  args: { isPlaying: true, size: 'md' },
};

export default meta;
type Story = StoryObj<typeof NowPlayingIndicator>;

const SIZES = ['sm', 'md', 'lg'] as const;

/** Sizes × bar counts, animating. */
export const Variants: Story = {
  render: () => (
    <Stage
      title="Sizes and bar counts"
      description="The bars animate while playing and freeze mid-height when paused, so a paused row still reads as 'this is the current track' rather than looking broken."
      aside={
        <Note tone="tip">
          The animation respects <code>prefers-reduced-motion</code>: the bars hold a static shape
          instead of pulsing.
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
              items={[2, 3, 4, 5, 6]}
              columns={5}
              onVideo
              label={(bars) => `${bars} bars`}
              render={(bars) => <NowPlayingIndicator isPlaying size={size} bars={bars} />}
            />
          </div>
        ))}
      </div>
    </Stage>
  ),
};

/** Playing vs paused, side by side. */
export const PlayingVsPaused: Story = {
  render: () => (
    <Stage title="Playing vs paused" layout="columns">
      <Matrix
        items={[
          { label: 'isPlaying = true', isPlaying: true },
          { label: 'isPlaying = false', isPlaying: false },
        ]}
        columns={2}
        onVideo
        label={(item) => item.label}
        render={(item) => <NowPlayingIndicator isPlaying={item.isPlaying} size="lg" />}
      />
    </Stage>
  ),
};

/** In its real context: a playlist row. */
export const InPlaylistContext: Story = {
  render: function Render() {
    const [playingId, setPlayingId] = useState('2');
    const [isPlaying, setIsPlaying] = useState(true);

    const tracks = [
      { id: '1', title: 'Warum wir scroll-snap rausgeworfen haben', duration: '24:10' },
      { id: '2', title: 'VAST in 90 Sekunden erklärt', duration: '18:42' },
      { id: '3', title: 'Ein Decoder pro Video', duration: '31:05' },
      { id: '4', title: 'Quartile-Tracking richtig machen', duration: '27:33' },
    ];

    return (
      <Stage
        title="In context"
        description="This is where the indicator actually lives: replacing the track number on the currently playing row. Click a row to move it."
        aside={
          <>
            <Panel title="Controls">
              <Toggle label="isPlaying" checked={isPlaying} onChange={setIsPlaying} />
            </Panel>
            <Snippet
              code={`{tracks.map((track) => (
  <li key={track.id}>
    {track.id === currentId
      ? <NowPlayingIndicator isPlaying={isPlaying} size="sm" />
      : <span>{index + 1}</span>}
    <span>{track.title}</span>
  </li>
))}`}
            />
          </>
        }
      >
        <ul
          className="m-0 w-full max-w-lg list-none overflow-hidden rounded-lg p-0"
          style={{ background: 'var(--fp-color-surface)' }}
        >
          {tracks.map((track, index) => {
            const active = track.id === playingId;
            return (
              <li key={track.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (active) setIsPlaying((value) => !value);
                    else {
                      setPlayingId(track.id);
                      setIsPlaying(true);
                    }
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
                  style={{
                    background: active ? 'var(--fp-color-surface-hover)' : 'transparent',
                    borderBottom: index < tracks.length - 1 ? '1px solid var(--fp-border-color)' : 'none',
                  }}
                >
                  <span className="flex w-6 shrink-0 items-center justify-center">
                    {active ? (
                      <NowPlayingIndicator isPlaying={isPlaying} size="sm" />
                    ) : (
                      <span
                        className="text-[12px] tabular-nums"
                        style={{ color: 'var(--fp-color-text-muted)' }}
                      >
                        {index + 1}
                      </span>
                    )}
                  </span>

                  <span
                    className="min-w-0 flex-1 truncate text-[13px]"
                    style={{
                      color: active ? 'var(--fp-color-accent)' : 'var(--fp-color-text-primary)',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {track.title}
                  </span>

                  <span
                    className="shrink-0 text-[12px] tabular-nums"
                    style={{ color: 'var(--fp-color-text-muted)' }}
                  >
                    {track.duration}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Stage>
    );
  },
};

/** Live tuning. */
export const Playground: Story = {
  render: function Render() {
    const [isPlaying, setIsPlaying] = useState(true);
    const [bars, setBars] = useState(4);
    const [size, setSize] = useState<'sm' | 'md' | 'lg'>('lg');

    return (
      <Stage
        title="Playground"
        aside={
          <Panel title="Props">
            <Toggle label="isPlaying" checked={isPlaying} onChange={setIsPlaying} />
            <Range label="bars" value={bars} min={2} max={6} onChange={setBars} />
            <Segmented
              label="size"
              value={size}
              options={SIZES.map((s) => ({ value: s, label: s }))}
              onChange={setSize}
            />
          </Panel>
        }
      >
        <div className="rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 p-16">
          <NowPlayingIndicator isPlaying={isPlaying} bars={bars} size={size} />
        </div>
      </Stage>
    );
  },
};

export const Themes: Story = {
  parameters: { compareThemes: true },
  args: { isPlaying: true, size: 'lg' },
};
