import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { PlaylistControls } from './PlaylistControls';
import type { RepeatMode } from '@/types/player';
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

const meta: Meta<typeof PlaylistControls> = {
  title: 'Playlist/PlaylistControls',
  component: PlaylistControls,
  tags: ['autodocs'],
  argTypes: {
    repeat: { control: 'inline-radio', options: ['none', 'one', 'all'] },
    shuffle: { control: 'boolean' },
    hasPrevious: { control: 'boolean' },
    hasNext: { control: 'boolean' },
    disabled: { control: 'boolean' },
    onPrevious: { table: { disable: true } },
    onNext: { table: { disable: true } },
    onShuffleToggle: { table: { disable: true } },
    onRepeatChange: { table: { disable: true } },
  },
  args: {
    hasPrevious: true,
    hasNext: true,
    shuffle: false,
    repeat: 'none',
  },
};

export default meta;
type Story = StoryObj<typeof PlaylistControls>;

const REPEAT_MODES: RepeatMode[] = ['none', 'one', 'all'];

const POSITIONS = [
  { label: 'Middle of queue', props: { hasPrevious: true, hasNext: true } },
  { label: 'First track', props: { hasPrevious: false, hasNext: true } },
  { label: 'Last track', props: { hasPrevious: true, hasNext: false } },
  { label: 'Single track', props: { hasPrevious: false, hasNext: false } },
];

/** Every repeat mode. */
export const RepeatModes: Story = {
  render: () => (
    <Stage
      title="Repeat modes"
      description="Three modes rather than a toggle: off, repeat-one, repeat-all. The glyph carries a '1' badge in repeat-one, because the difference between looping a track and looping a queue is invisible until the track ends."
      aside={
        <Note>
          Repeat interacts with <code>autoPlayNext</code>. In <code>one</code>, the playlist does
          not advance at all — the same track restarts — so repeat is checked before the
          auto-advance path in <code>usePlaylist</code>.
        </Note>
      }
    >
      <Matrix
        items={REPEAT_MODES}
        columns={3}
        onVideo
        label={(mode) => `repeat = ${mode}`}
        render={(mode) => <PlaylistControls repeat={mode} hasPrevious hasNext />}
      />
    </Stage>
  ),
};

/** Where in the queue the cursor sits. */
export const QueuePositions: Story = {
  render: () => (
    <Stage
      title="Queue position"
      description="Previous and next disable at the ends of the queue rather than disappearing, so the control row keeps its shape as the cursor moves."
      aside={
        <Note>
          With <code>repeat: &apos;all&apos;</code> the ends stop being ends — the caller passes{' '}
          <code>hasNext</code> as true on the last track, because next wraps around.
        </Note>
      }
    >
      <Matrix
        items={POSITIONS}
        columns={2}
        onVideo
        label={(item) => item.label}
        render={(item) => <PlaylistControls {...item.props} />}
      />
    </Stage>
  ),
};

/** Live controls with an event log. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();
    const [shuffle, setShuffle] = useState(false);
    const [repeat, setRepeat] = useState<RepeatMode>('none');
    const [hasPrevious, setHasPrevious] = useState(true);
    const [hasNext, setHasNext] = useState(true);
    const [disabled, setDisabled] = useState(false);

    return (
      <Stage
        title="Playground"
        description="Shuffle is a toggle, repeat cycles. Both report through callbacks rather than owning state, so the playlist stays the single source of truth."
        aside={
          <div className="flex flex-col gap-4">
            <Panel title="Controls">
              <Toggle label="Has previous" checked={hasPrevious} onChange={setHasPrevious} />
              <Toggle label="Has next" checked={hasNext} onChange={setHasNext} />
              <Toggle label="Disabled" checked={disabled} onChange={setDisabled} />
              <Segmented
                label="Repeat"
                value={repeat}
                options={REPEAT_MODES.map((m) => ({ label: m, value: m }))}
                onChange={setRepeat}
              />
            </Panel>
            <StateInspector
              state={{ shuffle, repeat, hasPrevious, hasNext }}
              highlight={['shuffle', 'repeat']}
            />
            <EventLog entries={entries} onClear={clear} counts={counts} height={200} />
          </div>
        }
      >
        <PlaylistControls
          hasPrevious={hasPrevious}
          hasNext={hasNext}
          shuffle={shuffle}
          repeat={repeat}
          disabled={disabled}
          onPrevious={() => log('onPrevious')}
          onNext={() => log('onNext')}
          onShuffleToggle={() => {
            log('onShuffleToggle', `→ ${!shuffle}`);
            setShuffle((v) => !v);
          }}
          onRepeatChange={(mode) => {
            log('onRepeatChange', mode);
            setRepeat(mode);
          }}
        />
      </Stage>
    );
  },
};

/** Wiring it to the playlist state. */
export const Usage: Story = {
  render: () => (
    <Snippet
      title="With usePlayer"
      code={`import { PlaylistControls, usePlayer } from '@fairu/player';

function Transport() {
  const { playlistState, playlistControls } = usePlayer();
  const { currentIndex, tracks, shuffle, repeat } = playlistState;

  return (
    <PlaylistControls
      hasPrevious={currentIndex > 0 || repeat === 'all'}
      hasNext={currentIndex < tracks.length - 1 || repeat === 'all'}
      shuffle={shuffle}
      repeat={repeat}
      onPrevious={playlistControls.previous}
      onNext={playlistControls.next}
      onShuffleToggle={playlistControls.toggleShuffle}
      onRepeatChange={playlistControls.setRepeat}
    />
  );
}`}
    />
  ),
};
