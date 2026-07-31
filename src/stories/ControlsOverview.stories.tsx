import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import {
  CastButton,
  FullscreenButton,
  PictureInPictureButton,
  PlayButton,
  PlaybackSpeed,
  ProgressBar,
  QualitySelector,
  SkipButtons,
  SubtitleSelector,
  TimeDisplay,
  VolumeControl,
} from '@/components/controls';
import { NowPlayingIndicator } from '@/components/controls/NowPlayingIndicator';
import { PlaylistControls } from '@/components/playlist/PlaylistControls';
import type { RepeatMode } from '@/types/player';
import type { Subtitle, VideoQuality } from '@/types/video';
import { Note, Panel, Snippet, Stage, StateInspector, Toggle } from '@/stories/preview-kit';

/**
 * A single page that shows every control the library exports.
 *
 * The per-component stories cover states and edge cases; this page answers the
 * question they cannot — do these all look like they belong together? Spacing,
 * icon weight, hit-target size and focus ring have to match across the set, and
 * that is only visible with the whole set on screen at once.
 */
const meta: Meta = {
  title: 'Controls/Overview',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Every exported control in one place, for checking visual consistency across the set.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const QUALITIES: VideoQuality[] = [
  { label: 'Auto', src: '' },
  { label: '1080p', src: '', width: 1920, height: 1080, bitrate: 4500 },
  { label: '720p', src: '', width: 1280, height: 720, bitrate: 2500 },
  { label: '480p', src: '', width: 854, height: 480, bitrate: 1200 },
  { label: '360p', src: '', width: 640, height: 360, bitrate: 700 },
];

const SUBTITLES: Subtitle[] = [
  { id: 'de', label: 'Deutsch', language: 'de', src: '', default: true },
  { id: 'en', label: 'English', language: 'en', src: '' },
  { id: 'fr', label: 'Français', language: 'fr', src: '' },
];

interface CellProps {
  name: string;
  note?: string;
  children: React.ReactNode;
}

function Cell({ name, note, children }: CellProps) {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg p-4"
      style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2b2b2b 100%)',
        border: '1px solid var(--fp-border-color)',
      }}
    >
      <div className="flex min-h-[56px] items-center justify-center">{children}</div>
      <div className="flex flex-col gap-0.5 text-center">
        <code className="text-[11px] font-semibold text-white/80">{name}</code>
        {note && <span className="text-[10px] leading-tight text-white/40">{note}</span>}
      </div>
    </div>
  );
}

/** The whole exported control set, on a video-like surface. */
export const Gallery: Story = {
  render: function Render() {
    const [disabled, setDisabled] = useState(false);
    const [playing, setPlaying] = useState(true);

    return (
      <Stage
        title="Every control"
        description="All of these render on dark surfaces in production, so the gallery uses one. Check icon weight, hit-target size and the focus ring — tab through the page to see the last one."
        aside={
          <>
            <Panel title="Global">
              <Toggle
                label="disabled"
                checked={disabled}
                onChange={setDisabled}
                hint="Applies to every control that supports it"
              />
              <Toggle label="isPlaying" checked={playing} onChange={setPlaying} />
            </Panel>
            <Note tone="tip">
              Every control takes an optional <code>labels</code> prop and inherits from{' '}
              <code>LabelsProvider</code> when rendered inside a player.
            </Note>
          </>
        }
      >
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Cell name="PlayButton" note="sm · md · lg">
            <div className="flex items-center gap-3">
              <PlayButton isPlaying={playing} size="sm" disabled={disabled} />
              <PlayButton isPlaying={playing} size="md" disabled={disabled} />
              <PlayButton isPlaying={playing} size="lg" disabled={disabled} />
            </div>
          </Cell>

          <Cell name="SkipButtons" note="asymmetric 30 / 10">
            <SkipButtons forwardSeconds={30} backwardSeconds={10} disabled={disabled} />
          </Cell>

          <Cell name="PlaylistControls" note="prev · next · shuffle · repeat">
            <PlaylistControls hasPrevious hasNext disabled={disabled} />
          </Cell>

          <Cell name="NowPlayingIndicator" note="animates while playing">
            <NowPlayingIndicator isPlaying={playing} size="md" />
          </Cell>

          <Cell name="VolumeControl" note="vertical (overlay)">
            <VolumeControl volume={0.7} muted={false} disabled={disabled} orientation="vertical" />
          </Cell>

          <Cell name="VolumeControl" note="horizontal (inline)">
            <VolumeControl volume={0.7} muted={false} disabled={disabled} orientation="horizontal" />
          </Cell>

          <Cell name="PlaybackSpeed" note="menu trigger shows active rate">
            <PlaybackSpeed speed={1.5} disabled={disabled} />
          </Cell>

          <Cell name="TimeDisplay" note="elapsed / total">
            <TimeDisplay currentTime={95} duration={1830} />
          </Cell>

          <Cell name="TimeDisplay" note="showRemaining">
            <TimeDisplay currentTime={95} duration={1830} showRemaining />
          </Cell>

          <Cell name="QualitySelector" note="HLS levels or renditions">
            <QualitySelector currentQuality="720p" qualities={QUALITIES} disabled={disabled} />
          </Cell>

          <Cell name="SubtitleSelector" note="null = off">
            <SubtitleSelector currentSubtitle="de" subtitles={SUBTITLES} disabled={disabled} />
          </Cell>

          <Cell name="FullscreenButton">
            <div className="flex items-center gap-3">
              <FullscreenButton isFullscreen={false} disabled={disabled} />
              <FullscreenButton isFullscreen disabled={disabled} />
            </div>
          </Cell>

          <Cell name="PictureInPictureButton">
            <div className="flex items-center gap-3">
              <PictureInPictureButton isPictureInPicture={false} disabled={disabled} />
              <PictureInPictureButton isPictureInPicture disabled={disabled} />
            </div>
          </Cell>

          <Cell name="CastButton" note="idle vs casting">
            <div className="flex items-center gap-3">
              <CastButton isCasting={false} disabled={disabled} />
              <CastButton isCasting disabled={disabled} />
            </div>
          </Cell>

          <Cell name="ProgressBar" note="played · buffered · markers">
            <div className="w-full px-2">
              <ProgressBar
                currentTime={95}
                duration={300}
                buffered={180}
                disabled={disabled}
                markers={[
                  { id: 'a', time: 60, title: 'Sponsor', color: '#f59e0b' },
                  { id: 'b', time: 200, title: 'Highlight', color: '#22c55e' },
                ]}
              />
            </div>
          </Cell>
        </div>
      </Stage>
    );
  },
};

/**
 * The controls assembled into the two bars they actually ship in.
 *
 * Individually correct controls can still compose badly — this is where
 * inconsistent gaps and misaligned baselines become obvious.
 */
export const AssembledBars: Story = {
  render: function Render() {
    const [time, setTime] = useState(95);
    const [playing, setPlaying] = useState(false);
    const [volume, setVolume] = useState(0.8);
    const [muted, setMuted] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [quality, setQuality] = useState('720p');
    const [subtitle, setSubtitle] = useState<string | null>('de');
    const [fullscreen, setFullscreen] = useState(false);
    const [pip, setPip] = useState(false);
    const [casting, setCasting] = useState(false);
    const [shuffle, setShuffle] = useState(false);
    const [repeat, setRepeat] = useState<RepeatMode>('none');

    const duration = 1830;

    return (
      <Stage
        title="Assembled bars"
        description="The same controls composed into a video control bar and an audio transport row. Every control here is live."
        aside={
          <StateInspector
            state={{ playing, currentTime: time, volume, muted, speed, quality, subtitle, fullscreen, pip, casting }}
            highlight={['playing', 'currentTime']}
          />
        }
      >
        <div className="flex w-full flex-col gap-8">
          {/* Video control bar */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium" style={{ color: 'var(--fp-color-text-muted)' }}>
              Video control bar
            </span>
            <div
              className="rounded-xl p-4"
              style={{ background: 'linear-gradient(to top, #000 0%, #1c1c1c 100%)' }}
            >
              <ProgressBar
                currentTime={time}
                duration={duration}
                buffered={Math.min(duration, time + 240)}
                markers={[{ id: 'a', time: 300, title: 'Sponsor', color: '#f59e0b' }]}
                onSeek={setTime}
              />

              <div className="mt-3 flex items-center gap-2">
                <PlayButton isPlaying={playing} size="md" onClick={() => setPlaying((v) => !v)} />
                <SkipButtons
                  forwardSeconds={30}
                  backwardSeconds={10}
                  size="sm"
                  onSkipForward={() => setTime((t) => Math.min(duration, t + 30))}
                  onSkipBackward={() => setTime((t) => Math.max(0, t - 10))}
                />
                <VolumeControl
                  volume={volume}
                  muted={muted}
                  orientation="vertical"
                  onVolumeChange={setVolume}
                  onMuteToggle={() => setMuted((v) => !v)}
                />
                <TimeDisplay currentTime={time} duration={duration} />

                <span className="flex-1" />

                <PlaybackSpeed speed={speed} onSpeedChange={setSpeed} />
                <SubtitleSelector
                  currentSubtitle={subtitle}
                  subtitles={SUBTITLES}
                  onSubtitleChange={setSubtitle}
                />
                <QualitySelector
                  currentQuality={quality}
                  qualities={QUALITIES}
                  onQualityChange={setQuality}
                />
                <CastButton isCasting={casting} onClick={() => setCasting((v) => !v)} />
                <PictureInPictureButton
                  isPictureInPicture={pip}
                  onClick={() => setPip((v) => !v)}
                />
                <FullscreenButton
                  isFullscreen={fullscreen}
                  onClick={() => setFullscreen((v) => !v)}
                />
              </div>
            </div>
          </div>

          {/* Audio transport */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium" style={{ color: 'var(--fp-color-text-muted)' }}>
              Audio transport
            </span>
            <div
              className="flex flex-col gap-3 rounded-xl p-4"
              style={{ background: 'var(--fp-color-surface)' }}
            >
              <div className="flex items-center gap-3">
                <NowPlayingIndicator isPlaying={playing} size="sm" />
                <span
                  className="min-w-0 flex-1 truncate text-[13px] font-medium"
                  style={{ color: 'var(--fp-color-text-primary)' }}
                >
                  VAST, VPAID und VMAP — endlich verständlich
                </span>
                <TimeDisplay currentTime={time} duration={duration} showRemaining />
              </div>

              <ProgressBar currentTime={time} duration={duration} onSeek={setTime} />

              <div className="flex items-center justify-between gap-3">
                <PlaybackSpeed speed={speed} onSpeedChange={setSpeed} />

                <div className="flex items-center gap-2">
                  <PlaylistControls
                    hasPrevious
                    hasNext
                    shuffle={shuffle}
                    repeat={repeat}
                    onShuffleToggle={() => setShuffle((v) => !v)}
                    onRepeatChange={setRepeat}
                  />
                  <PlayButton isPlaying={playing} size="md" onClick={() => setPlaying((v) => !v)} />
                </div>

                <VolumeControl
                  volume={volume}
                  muted={muted}
                  orientation="horizontal"
                  onVolumeChange={setVolume}
                  onMuteToggle={() => setMuted((v) => !v)}
                />
              </div>
            </div>
          </div>
        </div>
      </Stage>
    );
  },
};

/** Focus-visible check across the set. */
export const KeyboardFocus: Story = {
  render: () => (
    <Stage
      title="Keyboard focus"
      description="Tab through the row. Every control must show a visible focus ring — the player sets it once via `.fairu-player *:focus-visible`, so a control that renders outside that scope loses it silently."
      aside={
        <Snippet
          title="base.css"
          code={`.fairu-player *:focus-visible {
  outline: 2px solid var(--fp-color-primary);
  outline-offset: 2px;
}`}
        />
      }
    >
      <div
        className="fairu-player flex flex-wrap items-center gap-3 rounded-xl p-6"
        style={{ background: 'linear-gradient(135deg,#1a1a1a,#2b2b2b)' }}
      >
        <PlayButton isPlaying={false} size="md" />
        <SkipButtons forwardSeconds={30} backwardSeconds={10} size="sm" />
        <VolumeControl volume={0.7} muted={false} orientation="horizontal" />
        <PlaybackSpeed speed={1} />
        <SubtitleSelector currentSubtitle={null} subtitles={SUBTITLES} />
        <QualitySelector currentQuality="Auto" qualities={QUALITIES} />
        <CastButton isCasting={false} />
        <PictureInPictureButton isPictureInPicture={false} />
        <FullscreenButton isFullscreen={false} />
      </div>
    </Stage>
  ),
};

/** All three themes at once. */
export const Themes: Story = {
  parameters: { compareThemes: true },
  render: () => (
    <div className="flex flex-col gap-3">
      <ProgressBar currentTime={95} duration={300} buffered={180} />
      <div className="flex flex-wrap items-center gap-2">
        <PlayButton isPlaying={false} size="md" />
        <SkipButtons forwardSeconds={30} backwardSeconds={10} size="sm" />
        <TimeDisplay currentTime={95} duration={300} />
        <VolumeControl volume={0.7} muted={false} orientation="horizontal" />
        <PlaybackSpeed speed={1} />
      </div>
    </div>
  ),
};
