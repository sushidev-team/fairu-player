import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { VideoOverlay } from './VideoOverlay';
import {
  EventLog,
  Matrix,
  Note,
  Panel,
  Snippet,
  Stage,
  StateInspector,
  Toggle,
  Viewport,
  useEventLog,
} from '@/stories/preview-kit';

/** A stand-in for the video surface the overlay covers. */
function Surface({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-lg"
      style={{
        background:
          'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%)',
      }}
    >
      {children}
    </div>
  );
}

const meta: Meta<typeof VideoOverlay> = {
  title: 'Video/VideoOverlay',
  component: VideoOverlay,
  tags: ['autodocs'],
  argTypes: {
    isPlaying: { control: 'boolean' },
    isLoading: { control: 'boolean' },
    visible: { control: 'boolean' },
    onClick: { table: { disable: true } },
    labels: { table: { disable: true } },
  },
  args: { isPlaying: false, isLoading: false, visible: true },
};

export default meta;
type Story = StoryObj<typeof VideoOverlay>;

const STATES = [
  { label: 'Paused', props: { isPlaying: false, isLoading: false } },
  { label: 'Loading', props: { isPlaying: false, isLoading: true } },
  { label: 'Playing', props: { isPlaying: true, isLoading: false } },
  { label: 'Buffering mid-play', props: { isPlaying: true, isLoading: true } },
];

/** Every state over the video surface. */
export const AllStates: Story = {
  render: () => (
    <Stage
      title="Every state"
      description="The overlay is the whole-surface click target that starts playback, plus the spinner while the source is not ready. While playing it gets out of the way entirely."
      aside={
        <Note>
          Loading and playing are independent, which is why the fourth cell exists. Mid-playback
          rebuffering has to show the spinner without bringing the big play button back — that
          would read as 'paused' when the player is anything but.
        </Note>
      }
    >
      <Viewport width={760}>
        <Matrix
          items={STATES}
          columns={2}
          label={(item) => item.label}
          render={(item) => (
            <Surface>
              <VideoOverlay {...item.props} />
            </Surface>
          )}
        />
      </Viewport>
    </Stage>
  ),
};

/** Live states with a click log. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [visible, setVisible] = useState(true);

    return (
      <Stage
        title="Playground"
        description="A click on the surface toggles playback. That gesture is the reason autoplay-blocked video still starts on the first tap: the click is the user gesture the browser was waiting for."
        aside={
          <div className="flex flex-col gap-4">
            <Panel title="Controls">
              <Toggle label="Playing" checked={isPlaying} onChange={setIsPlaying} />
              <Toggle label="Loading" checked={isLoading} onChange={setIsLoading} />
              <Toggle
                label="Visible"
                checked={visible}
                onChange={setVisible}
                hint="Follows the auto-hide timer in the player"
              />
            </Panel>
            <StateInspector
              state={{ isPlaying, isLoading, visible }}
              highlight={['isPlaying', 'isLoading']}
            />
            <EventLog entries={entries} onClear={clear} counts={counts} height={180} />
          </div>
        }
      >
        <Viewport width={640}>
          <Surface>
            <VideoOverlay
              isPlaying={isPlaying}
              isLoading={isLoading}
              visible={visible}
              onClick={() => {
                log('onClick', isPlaying ? 'pause' : 'play');
                setIsPlaying((v) => !v);
              }}
            />
          </Surface>
        </Viewport>
      </Stage>
    );
  },
};

/** Wiring it to the video state. */
export const Usage: Story = {
  render: () => (
    <Snippet
      title="With useVideoPlayer"
      code={`import { VideoOverlay, useVideoPlayer } from '@fairu/player';

function Surface() {
  const { state, controls } = useVideoPlayer();

  return (
    <VideoOverlay
      isPlaying={state.isPlaying}
      isLoading={state.isLoading || state.isBuffering}
      onClick={controls.toggle}
    />
  );
}`}
    />
  ),
};
