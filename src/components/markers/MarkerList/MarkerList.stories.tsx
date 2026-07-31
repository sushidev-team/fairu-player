import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { MarkerList } from './MarkerList';
import { ProgressBar } from '@/components/controls/ProgressBar';
import type { TimelineMarker } from '@/types/markers';
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

const DURATION = 300;

/**
 * Markers carry a colour, which is what separates them from chapters: a chapter
 * is a segment of the timeline, a marker is a labelled *point* with a category.
 */
const MARKERS: TimelineMarker[] = [
  {
    id: 'm1',
    time: 15,
    title: 'Sponsor-Segment',
    previewImage: 'https://picsum.photos/seed/mk1/160/90',
    color: '#f59e0b',
  },
  {
    id: 'm2',
    time: 65,
    title: 'Hauptthema beginnt',
    previewImage: 'https://picsum.photos/seed/mk2/160/90',
    color: '#00a99d',
  },
  {
    id: 'm3',
    time: 142,
    title: 'Kernargument',
    previewImage: 'https://picsum.photos/seed/mk3/160/90',
    color: '#22c55e',
  },
  {
    id: 'm4',
    time: 230,
    title: 'Zusammenfassung',
    previewImage: 'https://picsum.photos/seed/mk4/160/90',
    color: '#8b5cf6',
  },
];

const meta: Meta<typeof MarkerList> = {
  title: 'Markers/MarkerList',
  component: MarkerList,
  tags: ['autodocs'],
  argTypes: {
    showPreviewImage: { control: 'boolean' },
    currentTime: { control: { type: 'range', min: 0, max: DURATION, step: 5 } },
    activeMarkerIndex: { control: { type: 'number', min: -1, max: 3 } },
    onMarkerClick: { table: { disable: true } },
  },
  args: {
    markers: MARKERS,
    currentTime: 70,
    duration: DURATION,
    activeMarkerIndex: 1,
  },
};

export default meta;
type Story = StoryObj<typeof MarkerList>;

/** With and without thumbnails. */
export const Variants: Story = {
  render: () => (
    <Stage
      title="Variants"
      description="Thumbnails make a marker list scannable but cost a request each. The text-only variant is the right default for audio, where a frame grab would be meaningless."
      aside={
        <Note>
          Use <code>createFairuMarkers()</code> to fill <code>previewImage</code> automatically from
          Fairu-hosted video — it derives a thumbnail URL per marker timestamp.
        </Note>
      }
    >
      <div className="grid w-full gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
            With preview thumbnails
          </span>
          <MarkerList markers={MARKERS} currentTime={70} duration={DURATION} activeMarkerIndex={1} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
            Text only (audio)
          </span>
          <MarkerList
            markers={MARKERS.map(({ previewImage: _ignored, ...rest }) => rest)}
            currentTime={70}
            duration={DURATION}
            activeMarkerIndex={1}
            showPreviewImage={false}
          />
        </div>
      </div>
    </Stage>
  ),
};

/** The list and the timeline, wired to the same state. */
export const WithTimeline: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog(30);
    const [time, setTime] = useState(70);
    const [showPreview, setShowPreview] = useState(true);

    // The nearest marker at or before the playhead is the "active" one.
    const activeIndex = MARKERS.reduce(
      (found, marker, index) => (time >= marker.time ? index : found),
      -1
    );
    const format = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

    return (
      <Stage
        title="List + timeline"
        description="Markers appear in both places: as ticks on the progress bar for orientation, and as a list for navigation. Click either — they share one seek handler."
        aside={
          <>
            <Panel title="Controls">
              <Toggle label="showPreviewImage" checked={showPreview} onChange={setShowPreview} />
            </Panel>
            <StateInspector
              state={{
                currentTime: format(time),
                activeMarkerIndex: activeIndex,
                activeMarker: MARKERS[activeIndex]?.title ?? '—',
                nextMarker: MARKERS[activeIndex + 1]?.title ?? '—',
              }}
              highlight={['activeMarkerIndex', 'activeMarker']}
            />
            <EventLog entries={entries} counts={counts} onClear={clear} height={150} />
          </>
        }
      >
        <div className="flex w-full max-w-sm flex-col gap-4">
          <ProgressBar
            currentTime={time}
            duration={DURATION}
            buffered={DURATION}
            markers={MARKERS}
            onSeek={setTime}
          />
          <MarkerList
            markers={MARKERS}
            currentTime={time}
            duration={DURATION}
            activeMarkerIndex={activeIndex}
            showPreviewImage={showPreview}
            onMarkerClick={(marker, index) => {
              setTime(marker.time);
              log('onMarkerClick', `#${index} · ${marker.title} @ ${format(marker.time)}`);
            }}
          />
        </div>
      </Stage>
    );
  },
};

/** Colour as a category signal. */
export const ColourCoding: Story = {
  render: () => (
    <Stage
      title="Colour as category"
      description="A marker's colour is the cheapest way to carry a category through both the list and the timeline ticks — ad segments in amber, highlights in green, chapters in teal."
      aside={
        <Snippet
          code={`const markers: TimelineMarker[] = [
  { id: 'ad-in',  time: 15,  title: 'Sponsor beginnt', color: '#f59e0b' },
  { id: 'ad-out', time: 55,  title: 'Sponsor endet',   color: '#f59e0b' },
  { id: 'peak',   time: 142, title: 'Kernargument',    color: '#22c55e' },
];`}
        />
      }
    >
      <div className="w-full max-w-sm">
        <MarkerList
          markers={[
            { id: 'a', time: 10, title: 'Sponsor beginnt', color: '#f59e0b' },
            { id: 'b', time: 45, title: 'Sponsor endet', color: '#f59e0b' },
            { id: 'c', time: 90, title: 'Highlight', color: '#22c55e' },
            { id: 'd', time: 140, title: 'Kapitelwechsel', color: '#00a99d' },
            { id: 'e', time: 200, title: 'Q&A', color: '#8b5cf6' },
            { id: 'f', time: 260, title: 'Ohne Farbe (Default)' },
          ]}
          currentTime={95}
          duration={DURATION}
          activeMarkerIndex={2}
          showPreviewImage={false}
        />
      </div>
    </Stage>
  ),
};

/** Empty and dense lists. */
export const EdgeCases: Story = {
  render: () => (
    <Stage title="Edge cases">
      <div className="grid w-full gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
            Empty list
          </span>
          <MarkerList markers={[]} currentTime={0} duration={DURATION} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
            No marker reached yet (activeMarkerIndex = -1)
          </span>
          <MarkerList
            markers={MARKERS}
            currentTime={5}
            duration={DURATION}
            activeMarkerIndex={-1}
            showPreviewImage={false}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
            Dense (30 markers, scrolls)
          </span>
          <div className="max-h-64 overflow-y-auto">
            <MarkerList
              markers={Array.from({ length: 30 }, (_, i) => ({
                id: String(i),
                time: i * 10,
                title: `Marker ${i + 1}`,
              }))}
              currentTime={95}
              duration={DURATION}
              activeMarkerIndex={9}
              showPreviewImage={false}
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
    <MarkerList
      markers={MARKERS.slice(0, 3)}
      currentTime={70}
      duration={DURATION}
      activeMarkerIndex={1}
      showPreviewImage={false}
    />
  ),
};
