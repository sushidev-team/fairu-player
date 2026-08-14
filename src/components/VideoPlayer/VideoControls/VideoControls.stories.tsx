import type { Meta, StoryObj } from '@storybook/react';
import { useMemo, useState } from 'react';
import { VideoControls } from './VideoControls';
import {
  initialVideoState,
  type Subtitle,
  type VideoFeatures,
  type VideoQuality,
  type VideoState,
  type VideoControls as VideoControlsType,
} from '@/types/video';
import type { PlaylistState, PlaylistControls, Track } from '@/types/player';
import {
  EventLog,
  Note,
  Panel,
  Range,
  Snippet,
  Stage,
  StateInspector,
  Toggle,
  Viewport,
  useEventLog,
} from '@/stories/preview-kit';

const QUALITIES: VideoQuality[] = [
  { label: '1080p', src: '', height: 1080 },
  { label: '720p', src: '', height: 720 },
  { label: '480p', src: '', height: 480 },
];

const SUBTITLES: Subtitle[] = [
  { id: 'de', label: 'Deutsch', language: 'de', src: '' },
  { id: 'en', label: 'English', language: 'en', src: '' },
];

const TRACKS: Track[] = [
  { id: 'v1', src: '', title: 'Folge 1' },
  { id: 'v2', src: '', title: 'Folge 2' },
  { id: 'v3', src: '', title: 'Folge 3' },
];

const PLAYLIST_STATE: PlaylistState = {
  tracks: TRACKS,
  currentIndex: 1,
  currentTrack: TRACKS[1],
  shuffle: false,
  repeat: 'none',
  queue: [],
  history: [],
};

/**
 * Stand-in controls.
 *
 * The bar is presentational — it renders whatever state it is handed and calls
 * back. Feeding it a real player would make these stories depend on network and
 * on codec support, and would test the player rather than the bar.
 */
function makeControls(log: (event: string, detail?: string) => void): VideoControlsType {
  const noop = async () => {};
  return {
    play: async () => log('play'),
    pause: () => log('pause'),
    toggle: async () => log('toggle'),
    stop: () => log('stop'),
    seek: (time) => log('seek', `${Math.round(time)}s`),
    seekTo: (pct) => log('seekTo', `${Math.round(pct)}%`),
    skipForward: (s) => log('skipForward', `${s ?? 10}s`),
    skipBackward: (s) => log('skipBackward', `${s ?? 10}s`),
    setVolume: (v) => log('setVolume', v.toFixed(2)),
    toggleMute: () => log('toggleMute'),
    setPlaybackRate: (r) => log('setPlaybackRate', `${r}x`),
    enterFullscreen: noop,
    exitFullscreen: noop,
    toggleFullscreen: async () => log('toggleFullscreen'),
    enterPictureInPicture: noop,
    exitPictureInPicture: noop,
    togglePictureInPicture: async () => log('togglePictureInPicture'),
    toggleCast: async () => log('toggleCast'),
    setQuality: (q) => log('setQuality', q),
    setSubtitle: (id) => log('setSubtitle', id ?? 'null (off)'),
    showControls: () => {},
    hideControls: () => {},
    setAutoQuality: (auto) => log('setAutoQuality', String(auto)),
  };
}

const PLAYING_STATE: VideoState = {
  ...initialVideoState,
  isPlaying: true,
  isPaused: false,
  isLoading: false,
  currentTime: 312,
  duration: 1840,
  buffered: 620,
  availableQualities: QUALITIES,
  currentQuality: 'auto',
};

const ALL_FEATURES: VideoFeatures = {
  chapters: true,
  volumeControl: true,
  playbackSpeed: true,
  skipButtons: true,
  progressBar: true,
  timeDisplay: true,
  playlistView: true,
  fullscreen: true,
  qualitySelector: true,
  subtitles: true,
  pictureInPicture: true,
  autoHideControls: true,
};

/** A stand-in for the video surface the bar sits over. */
function Surface({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex aspect-video w-full items-end overflow-hidden rounded-lg"
      style={{
        background:
          'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%)',
      }}
    >
      {children}
    </div>
  );
}

const meta: Meta<typeof VideoControls> = {
  title: 'Video/VideoControls',
  component: VideoControls,
  tags: ['autodocs'],
  argTypes: {
    visible: { control: 'boolean' },
    disabled: { control: 'boolean' },
    state: { table: { disable: true } },
    controls: { table: { disable: true } },
    features: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof VideoControls>;

/** Everything switched on. */
export const AllFeatures: Story = {
  render: function Render() {
    const { log } = useEventLog();
    const controls = useMemo(() => makeControls(log), [log]);

    return (
      <Stage
        title="Every feature enabled"
        description="The full bar: transport, skip, progress with buffer, clock, volume, speed, subtitles, quality, PiP and fullscreen."
        aside={
          <Note>
            Features are opt-out rather than opt-in, except Picture-in-Picture. PiP defaults to off
            because its availability varies so much across browsers that shipping it on by default
            would show a broken control to a meaningful share of viewers.
          </Note>
        }
      >
        <Viewport width={860}>
          <Surface>
            <VideoControls
              visible
              state={PLAYING_STATE}
              controls={controls}
              features={ALL_FEATURES}
              subtitles={SUBTITLES}
              playlistState={PLAYLIST_STATE}
            />
          </Surface>
        </Viewport>
      </Stage>
    );
  },
};

/** The minimal bar. */
export const Minimal: Story = {
  render: function Render() {
    const { log } = useEventLog();
    const controls = useMemo(() => makeControls(log), [log]);

    return (
      <Stage
        title="Minimal"
        description="Progress and play only. This is the shape an embed takes on a narrow surface, where every extra control costs more than it earns."
      >
        <Viewport width={520}>
          <Surface>
            <VideoControls
              visible
              state={PLAYING_STATE}
              controls={controls}
              features={{
                progressBar: true,
                timeDisplay: true,
                volumeControl: false,
                playbackSpeed: false,
                skipButtons: false,
                fullscreen: false,
                qualitySelector: false,
                subtitles: false,
                pictureInPicture: false,
              }}
            />
          </Surface>
        </Viewport>
      </Stage>
    );
  },
};

/** Live state with an event log. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();
    const controls = useMemo(() => makeControls(log), [log]);

    const [visible, setVisible] = useState(true);
    const [disabled, setDisabled] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [currentTime, setCurrentTime] = useState(312);
    const [isMuted, setIsMuted] = useState(false);

    const state: VideoState = {
      ...PLAYING_STATE,
      isPlaying,
      isPaused: !isPlaying,
      isMuted,
      currentTime,
    };

    const playlistControls: PlaylistControls = {
      next: () => log('playlist.next'),
      previous: () => log('playlist.previous'),
      goToTrack: (i) => log('playlist.goToTrack', String(i)),
      setRepeat: (m) => log('playlist.setRepeat', m),
      toggleShuffle: () => log('playlist.toggleShuffle'),
      addToQueue: () => {},
      removeFromQueue: () => {},
      clearQueue: () => {},
    };

    return (
      <Stage
        title="Playground"
        description="Every control reports through the callbacks rather than owning state, which is what lets the same bar drive a plain <video>, an HLS stream and a Cast session without knowing which."
        aside={
          <div className="flex flex-col gap-4">
            <Panel title="State">
              <Toggle label="Visible" checked={visible} onChange={setVisible} />
              <Toggle label="Playing" checked={isPlaying} onChange={setIsPlaying} />
              <Toggle label="Muted" checked={isMuted} onChange={setIsMuted} />
              <Toggle label="Disabled" checked={disabled} onChange={setDisabled} />
              <Range
                label="Current time"
                value={currentTime}
                min={0}
                max={1840}
                onChange={setCurrentTime}
                format={(v) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`}
              />
            </Panel>
            <StateInspector
              state={{ visible, isPlaying, isMuted, currentTime }}
              highlight={['isPlaying']}
            />
            <EventLog entries={entries} onClear={clear} counts={counts} height={240} />
          </div>
        }
      >
        <Viewport width={860}>
          <Surface>
            <VideoControls
              visible={visible}
              disabled={disabled}
              state={state}
              controls={controls}
              features={ALL_FEATURES}
              subtitles={SUBTITLES}
              playlistState={PLAYLIST_STATE}
              playlistControls={playlistControls}
              onFullscreenClick={() => log('onFullscreenClick')}
              onQualityChange={(q) => log('onQualityChange', q)}
            />
          </Surface>
        </Viewport>
      </Stage>
    );
  },
};

/** Where the state comes from in a real player. */
export const Usage: Story = {
  render: () => (
    <Snippet
      title="With useVideoPlayer"
      code={`import { VideoControls, useVideoPlayer } from '@fairu/player';

function Bar() {
  const { state, controls, config, playlistState, playlistControls, currentTrack } =
    useVideoPlayer();

  return (
    <VideoControls
      visible={state.controlsVisible}
      state={state}
      controls={controls}
      features={config.features}
      subtitles={currentTrack?.subtitles}
      playlistState={playlistState}
      playlistControls={playlistControls}
    />
  );
}`}
    />
  ),
};
