import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { TrackItem } from './TrackItem';
import type { Track } from '@/types/player';
import {
  EventLog,
  Note,
  Snippet,
  Stage,
  StateInspector,
  Viewport,
  useEventLog,
} from '@/stories/preview-kit';

const TRACKS: Track[] = [
  {
    id: 'ep-1',
    src: 'https://example.test/ep-1.mp3',
    title: 'Wie Streaming wirklich funktioniert',
    artist: 'Fairu Podcast',
    duration: 2732,
  },
  {
    id: 'ep-2',
    src: 'https://example.test/ep-2.mp3',
    title: 'Adaptive Bitraten und ihre Tücken',
    artist: 'Fairu Podcast',
    duration: 3184,
  },
  {
    id: 'ep-3',
    src: 'https://example.test/ep-3.mp3',
    title: 'Ein sehr langer Episodentitel, der zeigt, wie die Zeile bei knappem Platz umgeht',
    artist: 'Fairu Podcast',
    duration: 1890,
  },
  {
    id: 'ep-4',
    src: 'https://example.test/ep-4.mp3',
    title: 'Ohne Dauer',
  },
];

const meta: Meta<typeof TrackItem> = {
  title: 'Playlist/TrackItem',
  component: TrackItem,
  tags: ['autodocs'],
  argTypes: {
    isActive: { control: 'boolean' },
    isPlaying: { control: 'boolean' },
    onClick: { table: { disable: true } },
    track: { table: { disable: true } },
  },
  args: { track: TRACKS[0], index: 0, isActive: false, isPlaying: false },
};

export default meta;
type Story = StoryObj<typeof TrackItem>;

const STATES = [
  { label: 'Idle', isActive: false, isPlaying: false },
  { label: 'Active, paused', isActive: true, isPlaying: false },
  { label: 'Active, playing', isActive: true, isPlaying: true },
];

/** The three states a row can be in. */
export const States: Story = {
  render: () => (
    <Stage
      title="Row states"
      description="Active and playing are separate props on purpose. A row stays the active one while paused — losing the highlight on pause would make the queue look like it had forgotten its place."
      aside={
        <Note>
          Only the playing row animates. Running the indicator on the merely-active row would put
          motion on screen that does not correspond to anything happening.
        </Note>
      }
    >
      <Viewport width={620}>
        <div className="flex flex-col gap-2">
          {STATES.map((state, i) => (
            <div key={state.label} className="flex flex-col gap-1">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--fp-color-text-muted)' }}
              >
                {state.label}
              </span>
              <TrackItem
                track={TRACKS[i]}
                index={i}
                isActive={state.isActive}
                isPlaying={state.isPlaying}
              />
            </div>
          ))}
        </div>
      </Viewport>
    </Stage>
  ),
};

/** Content that does not fit the happy path. */
export const ContentEdgeCases: Story = {
  render: () => (
    <Stage
      title="Awkward content"
      description="Feed metadata is not under our control: titles run long and duration is frequently missing until the file is fetched."
      aside={
        <Note tone="warn">
          The last row has no <code>duration</code>. RSS feeds often omit it, and it must not
          collapse the layout or render as <code>NaN:NaN</code>.
        </Note>
      }
    >
      <Viewport width={620}>
        <div className="flex flex-col gap-2">
          <TrackItem track={TRACKS[2]} index={2} />
          <TrackItem track={TRACKS[3]} index={3} />
        </div>
      </Viewport>
    </Stage>
  ),
};

/** A selectable queue. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();
    const [activeIndex, setActiveIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);

    return (
      <Stage
        title="As a queue"
        description="Clicking a row is how the playlist changes track. The click hands back both the track and its index, because the caller usually needs the index to move the cursor."
        aside={
          <div className="flex flex-col gap-4">
            <StateInspector state={{ activeIndex, isPlaying }} highlight={['activeIndex']} />
            <EventLog entries={entries} onClear={clear} counts={counts} height={220} />
          </div>
        }
      >
        <Viewport width={620}>
          <div className="flex flex-col gap-2">
            {TRACKS.map((track, i) => (
              <TrackItem
                key={track.id}
                track={track}
                index={i}
                isActive={i === activeIndex}
                isPlaying={i === activeIndex && isPlaying}
                onClick={(clicked, index) => {
                  log('onClick', `${index} · ${clicked.id}`);
                  if (index === activeIndex) {
                    setIsPlaying((v) => !v);
                  } else {
                    setActiveIndex(index);
                    setIsPlaying(true);
                  }
                }}
              />
            ))}
          </div>
        </Viewport>
      </Stage>
    );
  },
};

/** Wiring it to the playlist state. */
export const Usage: Story = {
  render: () => (
    <Snippet
      title="With usePlayer"
      code={`import { TrackItem, usePlayer } from '@fairu/player';

function Queue() {
  const { state, playlistState, playlistControls } = usePlayer();

  return (
    <ul>
      {playlistState.tracks.map((track, index) => (
        <li key={track.id}>
          <TrackItem
            track={track}
            index={index}
            isActive={index === playlistState.currentIndex}
            isPlaying={index === playlistState.currentIndex && state.isPlaying}
            onClick={(_, i) => playlistControls.goToTrack(i)}
          />
        </li>
      ))}
    </ul>
  );
}`}
    />
  ),
};
