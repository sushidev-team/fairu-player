import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useMemo, useState } from 'react';
import { ChapterList } from './ChapterList';
import { ProgressBar } from '@/components/controls/ProgressBar';
import type { Chapter } from '@/types/player';
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

const CHAPTERS: Chapter[] = [
  { id: '1', title: 'Intro & Begrüßung', startTime: 0, image: 'https://picsum.photos/seed/c1/160/160' },
  { id: '2', title: 'Warum Vertical Video alles verändert hat', startTime: 120, image: 'https://picsum.photos/seed/c2/160/160' },
  { id: '3', title: 'Deep Dive: HLS, Decoder und die 6-Element-Grenze', startTime: 300, image: 'https://picsum.photos/seed/c3/160/160' },
  { id: '4', title: 'Q&A aus der Community', startTime: 480, image: 'https://picsum.photos/seed/c4/160/160' },
  { id: '5', title: 'Fazit & Ausblick', startTime: 600, image: 'https://picsum.photos/seed/c5/160/160' },
];

const DURATION = 720;

const meta: Meta<typeof ChapterList> = {
  title: 'Chapters/ChapterList',
  component: ChapterList,
  tags: ['autodocs'],
  argTypes: {
    showDuration: { control: 'boolean' },
    showImage: { control: 'boolean' },
    currentTime: { control: { type: 'range', min: 0, max: DURATION, step: 5 } },
    onChapterClick: { table: { disable: true } },
  },
  args: {
    chapters: CHAPTERS,
    currentChapterIndex: 1,
    currentTime: 150,
    duration: DURATION,
  },
};

export default meta;
type Story = StoryObj<typeof ChapterList>;

/** Resolve the active chapter from a playhead. */
function chapterIndexAt(time: number, chapters: Chapter[]): number {
  for (let i = chapters.length - 1; i >= 0; i -= 1) {
    if (time >= chapters[i].startTime) return i;
  }
  return 0;
}

/** The layout variants, side by side. */
export const Variants: Story = {
  render: () => (
    <Stage
      title="Layout variants"
      description="Chapter art costs a request per row and only earns its place when the images are actually distinct. Drop it for a talk-show format where every chapter would show the same studio shot."
      aside={
        <Note>
          The row shows the chapter's own <em>length</em>, not its start offset — "how long is this
          section" is the question a listener deciding whether to skip is actually asking.
        </Note>
      }
    >
      <div className="grid w-full gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium" style={{ color: 'var(--fp-color-text-muted)' }}>
            Full (images + durations)
          </span>
          <ChapterList
            chapters={CHAPTERS}
            currentChapterIndex={1}
            currentTime={150}
            duration={DURATION}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium" style={{ color: 'var(--fp-color-text-muted)' }}>
            No images
          </span>
          <ChapterList
            chapters={CHAPTERS}
            currentChapterIndex={2}
            currentTime={350}
            duration={DURATION}
            showImage={false}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium" style={{ color: 'var(--fp-color-text-muted)' }}>
            No durations
          </span>
          <ChapterList
            chapters={CHAPTERS}
            currentChapterIndex={0}
            currentTime={30}
            duration={DURATION}
            showDuration={false}
          />
        </div>
      </div>
    </Stage>
  ),
};

/** A live playhead driving the active row, wired to a progress bar. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog(30);
    const [time, setTime] = useState(150);
    const [playing, setPlaying] = useState(false);
    const [showImage, setShowImage] = useState(true);
    const [showDuration, setShowDuration] = useState(true);

    useEffect(() => {
      if (!playing) return;
      const id = setInterval(() => setTime((t) => (t + 5 > DURATION ? 0 : t + 5)), 200);
      return () => clearInterval(id);
    }, [playing]);

    const index = useMemo(() => chapterIndexAt(time, CHAPTERS), [time]);
    const current = CHAPTERS[index];
    const next = CHAPTERS[index + 1];
    const format = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

    return (
      <Stage
        title="Playground"
        description="Scrub the bar or hit play and watch the active row track the playhead. Clicking a chapter seeks to its start."
        aside={
          <>
            <Panel title="Controls">
              <Toggle label="playing (4× speed)" checked={playing} onChange={setPlaying} />
              <Toggle label="showImage" checked={showImage} onChange={setShowImage} />
              <Toggle label="showDuration" checked={showDuration} onChange={setShowDuration} />
            </Panel>

            <StateInspector
              state={{
                currentTime: format(time),
                currentChapterIndex: index,
                chapter: current.title,
                startsAt: format(current.startTime),
                endsAt: format(next?.startTime ?? DURATION),
                remaining: format((next?.startTime ?? DURATION) - time),
              }}
              highlight={['currentChapterIndex', 'chapter']}
            />
            <EventLog entries={entries} counts={counts} onClear={clear} height={150} />
          </>
        }
      >
        <div className="flex w-full max-w-md flex-col gap-4">
          <ProgressBar
            currentTime={time}
            duration={DURATION}
            buffered={Math.min(DURATION, time + 90)}
            chapters={CHAPTERS}
            onSeek={setTime}
          />

          <ChapterList
            chapters={CHAPTERS}
            currentChapterIndex={index}
            currentTime={time}
            duration={DURATION}
            showImage={showImage}
            showDuration={showDuration}
            onChapterClick={(chapter, i) => {
              setTime(chapter.startTime);
              log('onChapterClick', `#${i} · ${chapter.title}`);
            }}
          />
        </div>
      </Stage>
    );
  },
};

/** Content shapes that stress the layout. */
export const EdgeCases: Story = {
  render: () => (
    <Stage
      title="Edge cases"
      description="Chapter titles come from RSS feeds and CMS fields, so they arrive at every length. These are the shapes that break a naive row layout."
    >
      <div className="grid w-full gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
            Very long titles
          </span>
          <ChapterList
            chapters={[
              {
                id: '1',
                title:
                  'Ein außergewöhnlich langer Kapiteltitel, der mehrere Zeilen benötigt und trotzdem lesbar bleiben muss',
                startTime: 0,
              },
              { id: '2', title: 'Kurz', startTime: 300 },
            ]}
            currentChapterIndex={0}
            currentTime={10}
            duration={600}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
            Single chapter
          </span>
          <ChapterList
            chapters={[{ id: '1', title: 'Ganze Folge', startTime: 0 }]}
            currentChapterIndex={0}
            currentTime={120}
            duration={600}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
            Many short chapters
          </span>
          <div className="max-h-72 overflow-y-auto">
            <ChapterList
              chapters={Array.from({ length: 20 }, (_, i) => ({
                id: String(i),
                title: `Kapitel ${i + 1}`,
                startTime: i * 30,
              }))}
              currentChapterIndex={5}
              currentTime={165}
              duration={600}
            />
          </div>
        </div>
      </div>
    </Stage>
  ),
};

export const Themes: Story = {
  parameters: { compareThemes: true },
  render: () => (
    <ChapterList
      chapters={CHAPTERS.slice(0, 3)}
      currentChapterIndex={1}
      currentTime={150}
      duration={DURATION}
    />
  ),
};

export const Usage: Story = {
  render: () => (
    <Stage title="Usage" maxWidth={640}>
      <Snippet
        code={`import { ChapterList, useChapters } from '@fairu/player';

const { state, controls } = useChapters({
  chapters: track.chapters,
  currentTime: playerState.currentTime,
});

<ChapterList
  chapters={track.chapters}
  currentChapterIndex={state.currentChapterIndex}
  currentTime={playerState.currentTime}
  duration={playerState.duration}
  onChapterClick={(chapter) => playerControls.seek(chapter.startTime)}
/>`}
      />
    </Stage>
  ),
};
