import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { PlaylistView } from './PlaylistView';
import { PlaylistControls } from '@/components/playlist/PlaylistControls';
import type { RepeatMode, Track } from '@/types/player';
import {
  Button,
  EventLog,
  Note,
  Panel,
  Snippet,
  Stage,
  StateInspector,
  Toggle,
  useEventLog,
} from '@/stories/preview-kit';

const TRACKS: Track[] = [
  {
    id: '1',
    src: 'https://example.com/1.mp3',
    title: 'Warum wir scroll-snap rausgeworfen haben',
    artist: 'Fairu Devcast',
    artwork: 'https://picsum.photos/seed/pl1/120/120',
    duration: 1800,
  },
  {
    id: '2',
    src: 'https://example.com/2.mp3',
    title: 'VAST, VPAID und VMAP — endlich verständlich',
    artist: 'Fairu Devcast',
    artwork: 'https://picsum.photos/seed/pl2/120/120',
    duration: 2100,
  },
  {
    id: '3',
    src: 'https://example.com/3.mp3',
    title: 'Ein Decoder pro Video: die 6-Element-Grenze auf iOS',
    artist: 'Fairu Devcast',
    artwork: 'https://picsum.photos/seed/pl3/120/120',
    duration: 1650,
  },
  {
    id: '4',
    src: 'https://example.com/4.mp3',
    title: 'Quartile-Tracking richtig machen',
    artist: 'Fairu Devcast',
    artwork: 'https://picsum.photos/seed/pl4/120/120',
    duration: 1920,
  },
  {
    id: '5',
    src: 'https://example.com/5.mp3',
    title: 'Adaptive Bitrate ohne Kopfschmerzen',
    artist: 'Fairu Devcast',
    artwork: 'https://picsum.photos/seed/pl5/120/120',
    duration: 2040,
  },
];

const meta: Meta<typeof PlaylistView> = {
  title: 'Playlist/PlaylistView',
  component: PlaylistView,
  tags: ['autodocs'],
  argTypes: {
    currentIndex: { control: { type: 'number', min: 0, max: 4 } },
    isPlaying: { control: 'boolean' },
    maxHeight: { control: 'text' },
    onTrackClick: { table: { disable: true } },
  },
  args: { tracks: TRACKS, currentIndex: 1, isPlaying: true },
};

export default meta;
type Story = StoryObj<typeof PlaylistView>;

/** The states a queue can be in. */
export const States: Story = {
  render: () => (
    <Stage
      title="Queue states"
      description="The active row carries the playing indicator, so a paused queue still shows where the listener left off rather than looking like nothing is selected."
      aside={
        <Note>
          <code>maxHeight</code> turns the list into its own scroll container. Without it a 200-episode
          feed pushes the player controls off screen.
        </Note>
      }
    >
      <div className="grid w-full gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
            Playing
          </span>
          <PlaylistView tracks={TRACKS} currentIndex={1} isPlaying />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
            Paused
          </span>
          <PlaylistView tracks={TRACKS} currentIndex={1} isPlaying={false} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
            Scroll-capped (maxHeight)
          </span>
          <PlaylistView
            tracks={[
              ...TRACKS,
              ...TRACKS.map((t, i) => ({ ...t, id: `${t.id}-b${i}`, title: `${t.title} (Wiederholung)` })),
            ]}
            currentIndex={3}
            isPlaying
            maxHeight="220px"
          />
        </div>
      </div>
    </Stage>
  ),
};

/** The queue wired to the transport controls. */
export const WithControls: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog(40);
    const [index, setIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [shuffle, setShuffle] = useState(false);
    const [repeat, setRepeat] = useState<RepeatMode>('none');

    const goTo = (next: number, reason: string) => {
      const clamped = Math.max(0, Math.min(TRACKS.length - 1, next));
      setIndex(clamped);
      setIsPlaying(true);
      log(reason, TRACKS[clamped].title);
    };

    return (
      <Stage
        title="Queue + transport"
        description="PlaylistView is presentational — next/previous/shuffle/repeat live in usePlaylist. This wires them together so the interaction is real."
        aside={
          <>
            <Panel title="State">
              <Toggle label="isPlaying" checked={isPlaying} onChange={setIsPlaying} />
              <Toggle label="shuffle" checked={shuffle} onChange={setShuffle} />
              <div className="mt-2 flex gap-1">
                {(['none', 'one', 'all'] as RepeatMode[]).map((mode) => (
                  <Button
                    key={mode}
                    size="sm"
                    variant={repeat === mode ? 'primary' : 'secondary'}
                    onClick={() => setRepeat(mode)}
                  >
                    repeat: {mode}
                  </Button>
                ))}
              </div>
            </Panel>

            <StateInspector
              state={{
                currentIndex: index,
                currentTrack: TRACKS[index].title,
                isPlaying,
                shuffle,
                repeat,
                queueLength: TRACKS.length,
              }}
              highlight={['currentIndex', 'currentTrack']}
            />
            <EventLog entries={entries} counts={counts} onClear={clear} height={170} />
          </>
        }
      >
        <div className="flex w-full max-w-md flex-col gap-4">
          <PlaylistView
            tracks={TRACKS}
            currentIndex={index}
            isPlaying={isPlaying}
            onTrackClick={(track, i) => {
              setIndex(i);
              setIsPlaying(true);
              log('onTrackClick', `#${i} · ${track.title}`);
            }}
          />

          <div
            className="flex items-center justify-center rounded-lg p-3"
            style={{ background: 'var(--fp-color-surface)' }}
          >
            <PlaylistControls
              hasPrevious={index > 0 || repeat === 'all'}
              hasNext={index < TRACKS.length - 1 || repeat === 'all'}
              shuffle={shuffle}
              repeat={repeat}
              onPrevious={() => goTo(index - 1, 'onPrevious')}
              onNext={() => goTo(index + 1, 'onNext')}
              onShuffleToggle={() => {
                setShuffle((v) => !v);
                log('onShuffleToggle', String(!shuffle));
              }}
              onRepeatChange={(mode) => {
                setRepeat(mode);
                log('onRepeatChange', mode);
              }}
            />
          </div>
        </div>
      </Stage>
    );
  },
};

/** Content shapes that stress the row layout. */
export const EdgeCases: Story = {
  render: () => (
    <Stage title="Edge cases">
      <div className="grid w-full gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
            Empty queue
          </span>
          <PlaylistView tracks={[]} currentIndex={0} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
            No artwork, no duration
          </span>
          <PlaylistView
            tracks={TRACKS.map(({ artwork: _a, duration: _d, ...rest }) => rest)}
            currentIndex={0}
            isPlaying
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
            Long titles
          </span>
          <PlaylistView
            tracks={[
              {
                id: 'x',
                src: '',
                title:
                  'Ein extrem langer Episodentitel der garantiert nicht in eine Zeile passt und deshalb sauber abgeschnitten werden muss',
                artist: 'Ein ebenfalls sehr langer Podcast-Name der Platz braucht',
                duration: 3600,
              },
              ...TRACKS.slice(0, 2),
            ]}
            currentIndex={0}
            isPlaying
          />
        </div>
      </div>
    </Stage>
  ),
};

export const Themes: Story = {
  parameters: { compareThemes: true },
  render: () => <PlaylistView tracks={TRACKS.slice(0, 3)} currentIndex={1} isPlaying />,
};

export const Usage: Story = {
  render: () => (
    <Stage title="Usage" maxWidth={640}>
      <Snippet
        code={`import { PlaylistView, usePlaylist } from '@fairu/player';

const { state, controls } = usePlaylist({ tracks, repeat: 'all' });

<PlaylistView
  tracks={state.tracks}
  currentIndex={state.currentIndex}
  isPlaying={playerState.isPlaying}
  maxHeight="320px"
  onTrackClick={(_track, index) => controls.goToTrack(index)}
/>`}
      />
    </Stage>
  ),
};
