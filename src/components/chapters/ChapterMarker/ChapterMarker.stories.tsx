import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ChapterMarker } from './ChapterMarker';
import type { Chapter } from '@/types/player';
import {
  EventLog,
  Note,
  Snippet,
  Stage,
  StateInspector,
  Viewport,
  useEventLog,
} from '@/stories/preview-kit';

const DURATION = 2400;

const CHAPTERS: Chapter[] = [
  { id: 'c1', title: 'Intro', startTime: 0, endTime: 180 },
  { id: 'c2', title: 'Wie ABR wirklich entscheidet', startTime: 180, endTime: 900 },
  { id: 'c3', title: 'Pufferstrategien', startTime: 900, endTime: 1650 },
  { id: 'c4', title: 'Fragen aus der Community', startTime: 1650, endTime: 2280 },
  { id: 'c5', title: 'Outro', startTime: 2280, endTime: DURATION },
];

/** A stand-in for the progress bar these markers sit on. */
function Rail({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative h-2 w-full rounded-full"
      style={{ background: 'var(--fp-color-surface-raised, #334155)' }}
    >
      {children}
    </div>
  );
}

const meta: Meta<typeof ChapterMarker> = {
  title: 'Chapters/ChapterMarker',
  component: ChapterMarker,
  tags: ['autodocs'],
  argTypes: {
    isActive: { control: 'boolean' },
    chapter: { table: { disable: true } },
    onClick: { table: { disable: true } },
  },
  args: { chapter: CHAPTERS[1], duration: DURATION, isActive: false },
};

export default meta;
type Story = StoryObj<typeof ChapterMarker>;

/** Markers positioned along a rail. */
export const OnTheRail: Story = {
  render: () => (
    <Stage
      title="Positioned by time"
      description="Each marker places itself at startTime / duration. It is a percentage rather than a pixel offset, so the rail can be any width and the markers stay correct without a resize observer."
      aside={
        <Note>
          The first chapter is almost always at <code>0</code>, which puts a marker exactly on the
          left edge. It is deliberately not hidden — chapter one being marked is what tells the
          viewer the whole bar is chaptered.
        </Note>
      }
    >
      <Viewport width={680}>
        <Rail>
          {CHAPTERS.map((chapter) => (
            <ChapterMarker key={chapter.id} chapter={chapter} duration={DURATION} />
          ))}
        </Rail>
      </Viewport>
    </Stage>
  ),
};

/** The active chapter. */
export const Active: Story = {
  render: () => (
    <Stage
      title="Active chapter"
      description="The marker for the chapter currently playing is emphasised, so the position on the bar and the chapter list agree at a glance."
    >
      <Viewport width={680}>
        <Rail>
          {CHAPTERS.map((chapter, i) => (
            <ChapterMarker
              key={chapter.id}
              chapter={chapter}
              duration={DURATION}
              isActive={i === 2}
            />
          ))}
        </Rail>
      </Viewport>
    </Stage>
  ),
};

/** Click to seek. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();
    const [activeId, setActiveId] = useState(CHAPTERS[0].id);

    return (
      <Stage
        title="Click to seek"
        description="Clicking a marker hands back the whole chapter, not just a time, so the caller can update its own chapter state without looking the entry up again."
        aside={
          <div className="flex flex-col gap-4">
            <StateInspector state={{ activeId }} highlight={['activeId']} />
            <EventLog entries={entries} onClear={clear} counts={counts} height={220} />
          </div>
        }
      >
        <Viewport width={680}>
          <Rail>
            {CHAPTERS.map((chapter) => (
              <ChapterMarker
                key={chapter.id}
                chapter={chapter}
                duration={DURATION}
                isActive={chapter.id === activeId}
                onClick={(clicked) => {
                  log('onClick', `${clicked.title} @ ${clicked.startTime}s`);
                  setActiveId(clicked.id);
                }}
              />
            ))}
          </Rail>
        </Viewport>
      </Stage>
    );
  },
};

/** Wiring it to the chapter state. */
export const Usage: Story = {
  render: () => (
    <Snippet
      title="With useChapters"
      code={`import { ChapterMarker, useChapters, usePlayer } from '@fairu/player';

function ChapteredRail() {
  const { state, controls, playlistState } = usePlayer();
  const chapters = playlistState.currentTrack?.chapters ?? [];
  const { currentChapter } = useChapters(chapters, state.currentTime);

  return (
    <div className="relative h-2 w-full rounded-full bg-slate-700">
      {chapters.map((chapter) => (
        <ChapterMarker
          key={chapter.id}
          chapter={chapter}
          duration={state.duration}
          isActive={chapter.id === currentChapter?.id}
          onClick={(c) => controls.seek(c.startTime)}
        />
      ))}
    </div>
  );
}`}
    />
  ),
};
