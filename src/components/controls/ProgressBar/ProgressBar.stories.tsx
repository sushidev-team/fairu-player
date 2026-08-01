import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useRef, useState } from 'react';
import { ProgressBar } from './ProgressBar';
import { formatTime } from '@/utils';
import type { Chapter } from '@/types/player';
import type { TimelineAction, TimelineMarker, TimelineTrack } from '@/types/markers';
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

/**
 * The bar as a place markers are made, not only read.
 *
 * Authoring is opt-in: the handlers are what switch it on, so a player that
 * passes none behaves exactly as it always has. Seeking is deliberately left
 * alone — a single click still scrubs, which is why adding is bound to a double
 * click and to `M` rather than to the gesture the bar already had.
 */
export const Editing: Story = {
  render: () => {
    const { entries, log } = useEventLog();
    const [markers, setMarkers] = useState<TimelineMarker[]>(MARKERS);
    const [currentTime, setCurrentTime] = useState(90);

    const add = (time: number) => {
      const marker: TimelineMarker = {
        id: `m${Date.now()}`,
        time: Math.round(time),
        title: `Marker at ${formatTime(time)}`,
        color: '#f59e0b',
      };
      setMarkers((all) => [...all, marker].sort((a, b) => a.time - b.time));
      log(`add → ${formatTime(time)}`);
    };

    const move = (id: string, time: number) => {
      setMarkers((all) => all.map((m) => (m.id === id ? { ...m, time: Math.round(time) } : m)));
    };

    return (
      <Stage
        title="Editing"
        description="Double click the track to add a marker there, press M to add one at the playhead, and drag any dot to move it. A single click still seeks."
        maxWidth={640}
        aside={
          <Note>
            The bar is a player control first. Adding is on the double click because the single one
            was already taken — and the first click of the pair seeks, which puts the playhead at the
            marker being made.
          </Note>
        }
      >
        <div className="flex w-full flex-col gap-6">
          <Track label="Editable (click the bar first, then press M)">
            <ProgressBar
              currentTime={currentTime}
              duration={300}
              buffered={180}
              markers={markers}
              onSeek={setCurrentTime}
              onMarkerAdd={add}
              onMarkerMove={move}
              onMarkerSelect={(marker) => log(`select → ${marker.title ?? marker.id}`)}
            />
          </Track>

          <Track label="Read only (no handlers, dots do not take the pointer)">
            <ProgressBar currentTime={currentTime} duration={300} buffered={180} markers={markers} />
          </Track>

          <Panel title="Markers">
            <StateInspector
              state={{
                count: markers.length,
                times: markers.map((m) => formatTime(m.time)).join(', '),
                playhead: formatTime(currentTime),
              }}
            />
          </Panel>

          <div className="flex gap-2">
            <Button onClick={() => setMarkers(MARKERS)}>Reset</Button>
            <Button onClick={() => setMarkers([])}>Clear</Button>
          </div>

          <EventLog entries={entries} />
        </div>
      </Stage>
    );
  },
};

/* -------------------------------------------------------------------------- */
/*                              Action tracks                                 */
/* -------------------------------------------------------------------------- */

/**
 * A separate lane below the bar, carrying custom actions.
 *
 * The reason this is its own surface rather than more dots on the bar: markers
 * on the seek track have to fight the scrub gesture. Here a single click can
 * select, empty space can add, and a drag moves the action — none of which is
 * possible on a surface whose job is to seek.
 */
export const ActionTracks: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog(40);
    const duration = 300;

    const [time, setTime] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [cues, setCues] = useState<TimelineAction[]>([
      { id: 'c1', time: 20, label: 'Kapitelwechsel', color: '#00a99d' },
      { id: 'c2', time: 140, label: 'Zitat', color: '#8b5cf6' },
    ]);
    const [segments, setSegments] = useState<TimelineAction[]>([
      { id: 's1', time: 45, endTime: 75, label: 'Sponsor', color: '#f59e0b' },
      { id: 's2', time: 200, endTime: 235, label: 'Eigenwerbung', color: '#f59e0b' },
    ]);

    const nextId = useRef(0);

    const tracks: TimelineTrack[] = [
      {
        id: 'cues',
        label: 'Cues',
        actions: cues,
        editable: true,
        movable: true,
        height: 10,
      },
      {
        id: 'segments',
        label: 'Segmente',
        actions: segments,
        movable: true,
        resizable: true,
        height: 14,
        color: '#f59e0b',
      },
    ];

    const update = (trackId: string, fn: (list: TimelineAction[]) => TimelineAction[]) =>
      trackId === 'cues' ? setCues(fn) : setSegments(fn);

    return (
      <Stage
        title="Action tracks"
        description="Two lanes: point cues (click empty space to add, drag to move) and ranges (drag the body to move, the edges to resize). Neither ever moves the playhead — that is what the separate surface buys you."
        maxWidth={720}
        aside={
          <>
            <Note tone="tip">
              Ranges are only possible in a lane. A dot on the seek bar cannot express a
              <em> length</em>, which is what a sponsor segment or a skip-intro region is.
            </Note>
            <StateInspector
              state={{
                currentTime: formatTime(time),
                selected: selected ?? '—',
                cues: cues.length,
                segments: segments.length,
              }}
              highlight={['selected']}
            />
            <EventLog entries={entries} counts={counts} onClear={clear} height={200} />
            <Snippet
              code={`const tracks: TimelineTrack[] = [
  {
    id: 'cues',
    label: 'Cues',
    actions: cues,          // { id, time, label, color }
    editable: true,         // click empty space to add
    movable: true,          // drag to move
  },
  {
    id: 'segments',
    label: 'Segmente',
    actions: segments,      // { id, time, endTime, ... } = a range
    movable: true,
    resizable: true,        // edge handles
  },
];

<ProgressBar
  currentTime={time}
  duration={duration}
  tracks={tracks}
  selectedActionId={selected}
  onSeek={setTime}
  onActionSelect={(action, track) => setSelected(action.id)}
  onActionAdd={(at, track) => addCue(at)}
  onActionMove={(action, at, track) => moveAction(track.id, action.id, at)}
  onActionResize={(action, start, end, track) => resize(track.id, action.id, start, end)}
/>`}
            />
          </>
        }
      >
        <div className="flex w-full flex-col gap-3">
          <ProgressBar
            currentTime={time}
            duration={duration}
            buffered={duration}
            tracks={tracks}
            selectedActionId={selected}
            onSeek={setTime}
            onActionSelect={(action, track) => {
              setSelected(action.id);
              log('onActionSelect', `${track.id} · ${action.label}`, 'success');
            }}
            onActionAdd={(at, track) => {
              nextId.current += 1;
              const action: TimelineAction = {
                id: `new-${nextId.current}`,
                time: at,
                label: `Cue ${nextId.current}`,
                color: '#22c55e',
              };
              update(track.id, (list) => [...list, action]);
              log('onActionAdd', `${track.id} @ ${formatTime(at)}`, 'ad');
            }}
            onActionMove={(action, at, track) => {
              update(track.id, (list) =>
                list.map((a) =>
                  a.id === action.id
                    ? {
                        ...a,
                        time: at,
                        ...(a.endTime !== undefined
                          ? { endTime: at + (a.endTime - a.time) }
                          : {}),
                      }
                    : a
                )
              );
            }}
            onActionResize={(action, start, end, track) => {
              update(track.id, (list) =>
                list.map((a) => (a.id === action.id ? { ...a, time: start, endTime: end } : a))
              );
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setCues([])}>
              Cues leeren
            </Button>
            <Button size="sm" onClick={() => setSelected(null)}>
              Auswahl aufheben
            </Button>
            <Button size="sm" variant="primary" onClick={() => setTime(0)}>
              Zum Anfang
            </Button>
          </div>
        </div>
      </Stage>
    );
  },
};

/** A read-only lane — the common case for showing ad breaks or highlights. */
export const ReadOnlyTrack: Story = {
  render: () => (
    <Stage
      title="Read-only lane"
      description="Without editable/movable/resizable a lane is purely informational. Actions still seek when clicked, which makes it a navigation strip."
      maxWidth={640}
    >
      <ProgressBar
        currentTime={95}
        duration={300}
        buffered={300}
        tracks={[
          {
            id: 'ads',
            label: 'Ad breaks',
            color: '#f59e0b',
            actions: [
              { id: 'pre', time: 0, endTime: 15, label: 'Pre-Roll' },
              { id: 'mid', time: 140, endTime: 170, label: 'Mid-Roll' },
              { id: 'post', time: 285, endTime: 300, label: 'Post-Roll' },
            ],
          },
          {
            id: 'highlights',
            label: 'Highlights',
            color: '#22c55e',
            actions: [
              { id: 'h1', time: 60, label: 'Kernaussage' },
              { id: 'h2', time: 210, label: 'Demo' },
            ],
          },
        ]}
      />
    </Stage>
  ),
};

/** Custom rendering for a lane. */
export const CustomActionRendering: Story = {
  render: () => (
    <Stage
      title="Custom renderer"
      description="renderAction replaces the default entirely — for labels inside the range, icons, or a shape that matches your own design system."
      maxWidth={640}
    >
      <ProgressBar
        currentTime={120}
        duration={300}
        buffered={300}
        tracks={[
          {
            id: 'custom',
            label: 'Kapitel',
            height: 18,
            actions: [
              { id: 'k1', time: 0, endTime: 90, label: 'Intro' },
              { id: 'k2', time: 90, endTime: 200, label: 'Hauptteil' },
              { id: 'k3', time: 200, endTime: 300, label: 'Fazit' },
            ],
            renderAction: (action, ctx) => (
              <div
                className="flex h-full items-center justify-center overflow-hidden rounded-sm px-1 text-[9px] font-medium"
                style={{
                  background: ctx.active ? 'var(--fp-color-accent)' : 'var(--fp-color-surface)',
                  color: ctx.active ? '#000' : 'var(--fp-color-text-secondary)',
                  border: '1px solid var(--fp-border-color)',
                }}
                title={action.label}
              >
                {action.label}
              </div>
            ),
          },
        ]}
      />
    </Stage>
  ),
};
