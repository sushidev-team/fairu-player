import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useRef, useState } from 'react';
import { ProgressBar } from './ProgressBar';
import type { Chapter } from '@/types/player';
import type { TimelineMarker } from '@/types/markers';
import {
  Button,
  EventLog,
  Note,
  Panel,
  Range,
  Snippet,
  Stage,
  StateInspector,
  Toggle,
  useEventLog,
} from '@/stories/preview-kit';

const meta: Meta<typeof ProgressBar> = {
  title: 'Controls/ProgressBar',
  component: ProgressBar,
  tags: ['autodocs'],
  argTypes: {
    currentTime: { control: { type: 'range', min: 0, max: 300, step: 1 } },
    duration: { control: { type: 'number', min: 1 } },
    buffered: { control: { type: 'range', min: 0, max: 300, step: 1 } },
    showTooltip: { control: 'boolean' },
    disabled: { control: 'boolean' },
    onSeek: { table: { disable: true } },
    onSeekStart: { table: { disable: true } },
    onSeekEnd: { table: { disable: true } },
  },
  args: { currentTime: 60, duration: 300, buffered: 120, showTooltip: true },
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

const CHAPTERS: Chapter[] = [
  { id: '1', title: 'Intro', startTime: 0 },
  { id: '2', title: 'Der eigentliche Trick', startTime: 60 },
  { id: '3', title: 'Live-Demo', startTime: 180 },
  { id: '4', title: 'Fazit', startTime: 270 },
];

const MARKERS: TimelineMarker[] = [
  { id: 'm1', time: 30, title: 'Sponsor beginnt', color: '#f59e0b' },
  { id: 'm2', time: 55, title: 'Sponsor endet', color: '#f59e0b' },
  { id: 'm3', time: 150, title: 'Wichtige Stelle', color: '#22c55e' },
  { id: 'm4', time: 240, title: 'Q&A', color: '#8b5cf6' },
];

const MARKERS_WITH_PREVIEW: TimelineMarker[] = MARKERS.map((marker, i) => ({
  ...marker,
  previewImage: `https://picsum.photos/seed/pb${i}/160/90`,
}));

const Track = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <div className="flex w-full flex-col gap-1.5">
    <span className="text-[11px] font-medium" style={{ color: 'var(--fp-color-text-muted)' }}>
      {label}
    </span>
    {children}
  </div>
);

/** Everything the bar can render, stacked so the layers are comparable. */
export const Layers: Story = {
  render: () => (
    <Stage
      title="Layers"
      description="The bar composes four independent layers: played, buffered, chapter gaps and markers. Hover any of them to see the tooltip resolve to the nearest marker or timestamp."
      maxWidth={640}
      aside={
        <Note>
          Buffered is drawn behind played, never in front — a buffer ahead of the playhead that
          covers it would read as "already watched".
        </Note>
      }
    >
      <div className="flex w-full flex-col gap-6">
        <Track label="Plain">
          <ProgressBar currentTime={90} duration={300} />
        </Track>
        <Track label="With buffer">
          <ProgressBar currentTime={90} duration={300} buffered={180} />
        </Track>
        <Track label="With chapters">
          <ProgressBar currentTime={90} duration={300} buffered={180} chapters={CHAPTERS} />
        </Track>
        <Track label="With markers">
          <ProgressBar currentTime={90} duration={300} buffered={180} markers={MARKERS} />
        </Track>
        <Track label="Chapters + markers">
          <ProgressBar
            currentTime={90}
            duration={300}
            buffered={180}
            chapters={CHAPTERS}
            markers={MARKERS}
          />
        </Track>
        <Track label="Markers with preview thumbnails (hover a marker)">
          <ProgressBar
            currentTime={90}
            duration={300}
            buffered={180}
            markers={MARKERS_WITH_PREVIEW}
          />
        </Track>
        <Track label="Disabled (seeking blocked)">
          <ProgressBar currentTime={90} duration={300} buffered={180} disabled />
        </Track>
        <Track label="No tooltip">
          <ProgressBar currentTime={90} duration={300} buffered={180} showTooltip={false} />
        </Track>
      </div>
    </Stage>
  ),
};

/** Edge positions that commonly break progress bars. */
export const EdgeCases: Story = {
  render: () => (
    <Stage
      title="Edge cases"
      description="The positions that break naive implementations: a zero duration (metadata not loaded yet), a playhead at exactly 0 or exactly the end, and a buffer that has overrun the duration."
      maxWidth={640}
    >
      <div className="flex w-full flex-col gap-6">
        <Track label="duration = 0 (metadata pending)">
          <ProgressBar currentTime={0} duration={0} />
        </Track>
        <Track label="currentTime = 0">
          <ProgressBar currentTime={0} duration={300} buffered={40} />
        </Track>
        <Track label="currentTime = duration (ended)">
          <ProgressBar currentTime={300} duration={300} buffered={300} />
        </Track>
        <Track label="buffered > duration (over-reported)">
          <ProgressBar currentTime={150} duration={300} buffered={400} />
        </Track>
        <Track label="currentTime > duration (clock drift)">
          <ProgressBar currentTime={340} duration={300} buffered={300} />
        </Track>
        <Track label="Very short track (8s)">
          <ProgressBar
            currentTime={3}
            duration={8}
            buffered={8}
            markers={[{ id: 'x', time: 4, title: 'Mitte' }]}
          />
        </Track>
      </div>
    </Stage>
  ),
};

/** A running playhead with full seek instrumentation. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog(40);

    const duration = 300;
    const [time, setTime] = useState(45);
    const [playing, setPlaying] = useState(true);
    const [seeking, setSeeking] = useState(false);
    const [showChapters, setShowChapters] = useState(true);
    const [showMarkers, setShowMarkers] = useState(true);
    const [showTooltip, setShowTooltip] = useState(true);
    const [disabled, setDisabled] = useState(false);
    const [bufferAhead, setBufferAhead] = useState(60);

    // A simulated playhead — the bar is a pure component, so a story has to
    // supply the ticking itself.
    const rafRef = useRef<number | null>(null);
    useEffect(() => {
      if (!playing || seeking) return;

      let last = performance.now();
      const tick = (now: number) => {
        const delta = (now - last) / 1000;
        last = now;
        setTime((t) => (t + delta >= duration ? 0 : t + delta));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, [playing, seeking, duration]);

    const format = (seconds: number) =>
      `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

    const activeChapter = [...CHAPTERS].reverse().find((c) => time >= c.startTime);

    return (
      <Stage
        title="Playground"
        description="A live playhead. Drag to scrub and watch onSeekStart / onSeek / onSeekEnd fire in order — that sequence is what a real player uses to pause during a scrub and resume after."
        maxWidth={640}
        aside={
          <>
            <Panel title="Playback">
              <Toggle label="playing" checked={playing} onChange={setPlaying} />
              <Range
                label="buffer ahead"
                value={bufferAhead}
                min={0}
                max={240}
                step={10}
                onChange={setBufferAhead}
                format={(v) => `+${v}s`}
              />
              <Button size="sm" onClick={() => setTime(0)}>
                Reset to start
              </Button>
            </Panel>

            <Panel title="Layers">
              <Toggle label="chapters" checked={showChapters} onChange={setShowChapters} />
              <Toggle label="markers" checked={showMarkers} onChange={setShowMarkers} />
              <Toggle label="showTooltip" checked={showTooltip} onChange={setShowTooltip} />
              <Toggle label="disabled" checked={disabled} onChange={setDisabled} />
            </Panel>

            <StateInspector
              state={{
                currentTime: format(time),
                duration: format(duration),
                percent: `${Math.round((time / duration) * 100)}%`,
                buffered: format(Math.min(duration, time + bufferAhead)),
                chapter: activeChapter?.title ?? '—',
                seeking,
              }}
              highlight={['currentTime', 'chapter']}
            />
            <EventLog entries={entries} counts={counts} onClear={clear} height={180} />
          </>
        }
      >
        <div className="flex w-full flex-col gap-3">
          <ProgressBar
            currentTime={time}
            duration={duration}
            buffered={Math.min(duration, time + bufferAhead)}
            chapters={showChapters ? CHAPTERS : undefined}
            markers={showMarkers ? MARKERS_WITH_PREVIEW : undefined}
            showTooltip={showTooltip}
            disabled={disabled}
            onSeekStart={() => {
              setSeeking(true);
              log('onSeekStart', undefined, 'warn');
            }}
            onSeek={(value) => {
              setTime(value);
              log('onSeek', format(value));
            }}
            onSeekEnd={() => {
              setSeeking(false);
              log('onSeekEnd', undefined, 'success');
            }}
          />

          <div
            className="flex justify-between text-[12px] tabular-nums"
            style={{ color: 'var(--fp-color-text-secondary)' }}
          >
            <span>{format(time)}</span>
            <span style={{ color: 'var(--fp-color-accent)' }}>{activeChapter?.title}</span>
            <span>{format(duration)}</span>
          </div>
        </div>
      </Stage>
    );
  },
};

export const Themes: Story = {
  parameters: { compareThemes: true },
  render: () => (
    <div style={{ width: '100%' }}>
      <ProgressBar currentTime={90} duration={300} buffered={180} chapters={CHAPTERS} markers={MARKERS} />
    </div>
  ),
};

/** How the layers map onto player state. */
export const Usage: Story = {
  render: () => (
    <Stage title="Usage" maxWidth={640}>
      <Snippet
        code={`const { state, controls } = useVideoPlayer();

<ProgressBar
  currentTime={state.currentTime}
  duration={state.duration}
  buffered={state.buffered}
  chapters={track.chapters}
  markers={track.markers}
  // Pause while scrubbing so the audio does not stutter, then resume.
  onSeekStart={controls.pause}
  onSeek={controls.seek}
  onSeekEnd={controls.play}
  // Live streams and compliance videos disable seeking entirely.
  disabled={config.features?.seekingDisabled}
/>`}
      />
    </Stage>
  ),
};
