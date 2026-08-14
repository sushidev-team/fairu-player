import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { LogoOverlay } from './LogoOverlay';
import type { LogoConfig, LogoPosition } from '@/types/logo';
import {
  EventLog,
  Matrix,
  Note,
  Panel,
  Range,
  Segmented,
  Snippet,
  Stage,
  StateInspector,
  Toggle,
  Viewport,
  useEventLog,
} from '@/stories/preview-kit';

const LOGO_SRC = 'https://placehold.co/240x80/ffffff/1e293b/png?text=BRAND';

/** A stand-in for the video surface the logo sits on. */
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

const POSITIONS: LogoPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

const BASE: LogoConfig = {
  src: LOGO_SRC,
  alt: 'Brand',
  width: 96,
  opacity: 0.8,
};

const meta: Meta<typeof LogoOverlay> = {
  title: 'Video/LogoOverlay',
  component: LogoOverlay,
  tags: ['autodocs'],
  argTypes: {
    visible: { control: 'boolean' },
    isPlaying: { control: 'boolean' },
    isFullscreen: { control: 'boolean' },
    config: { table: { disable: true } },
  },
  args: { config: BASE, visible: true, isPlaying: false },
};

export default meta;
type Story = StoryObj<typeof LogoOverlay>;

/** All four corners. */
export const Positions: Story = {
  render: () => (
    <Stage
      title="Corners"
      description="Bottom-right is the default. It is the corner least likely to collide with the control bar's left-aligned transport, and it is where broadcast watermarks have always sat."
      aside={
        <Note>
          <code>offsetX</code> and <code>offsetY</code> nudge the logo off the corner without
          leaving it. That is for players whose controls do not use the default layout, where the
          margin alone is not enough to clear them.
        </Note>
      }
    >
      <Viewport width={760}>
        <Matrix
          items={POSITIONS}
          columns={2}
          label={(position) => position}
          render={(position) => (
            <Surface>
              <LogoOverlay config={{ ...BASE, position }} visible />
            </Surface>
          )}
        />
      </Viewport>
    </Stage>
  ),
};

/** A React component instead of an image. */
export const CustomComponent: Story = {
  render: () => (
    <Stage
      title="Component instead of image"
      description="A config can carry a component rather than a src, which is how animated and Lottie logos get in without the player taking a dependency on an animation runtime."
      aside={
        <Note>
          The component receives the same playback state the overlay does, so a logo can react to
          play and pause — an animation that only runs while the video does.
        </Note>
      }
    >
      <Viewport width={640}>
        <Surface>
          <LogoOverlay
            config={{
              position: 'bottom-right',
              component: ({ isPlaying }) => (
                <div
                  className="rounded-md px-3 py-1.5 text-sm font-semibold"
                  style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    color: isPlaying ? '#22c55e' : '#94a3b8',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                  }}
                >
                  {isPlaying ? '● LIVE' : '○ PAUSED'}
                </div>
              ),
            }}
            visible
            isPlaying
          />
        </Surface>
      </Viewport>
    </Stage>
  ),
};

/** Live configuration. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();
    const [position, setPosition] = useState<LogoPosition>('bottom-right');
    const [opacity, setOpacity] = useState(0.8);
    const [width, setWidth] = useState(96);
    const [margin, setMargin] = useState(16);
    const [visible, setVisible] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);

    return (
      <Stage
        title="Playground"
        description="Opacity is the setting that matters most: a watermark has to stay legible without competing with the content underneath it. The 0.8 default is a compromise that survives both bright and dark footage."
        aside={
          <div className="flex flex-col gap-4">
            <Panel title="Config">
              <Segmented
                label="Position"
                value={position}
                options={POSITIONS.map((p) => ({ label: p, value: p }))}
                onChange={setPosition}
              />
              <Range
                label="Opacity"
                value={opacity}
                min={0}
                max={1}
                step={0.05}
                onChange={setOpacity}
                format={(v) => v.toFixed(2)}
              />
              <Range
                label="Width"
                value={width}
                min={32}
                max={200}
                onChange={setWidth}
                format={(v) => `${v}px`}
              />
              <Range
                label="Margin"
                value={margin}
                min={0}
                max={48}
                onChange={setMargin}
                format={(v) => `${v}px`}
              />
              <Toggle label="Visible" checked={visible} onChange={setVisible} />
              <Toggle label="Playing" checked={isPlaying} onChange={setIsPlaying} />
            </Panel>
            <StateInspector state={{ position, opacity, width, margin, visible }} />
            <EventLog entries={entries} onClear={clear} counts={counts} height={160} />
          </div>
        }
      >
        <Viewport width={640}>
          <Surface>
            <LogoOverlay
              config={{
                ...BASE,
                position,
                opacity,
                width,
                margin,
                onClick: () => log('onClick', 'logo'),
              }}
              visible={visible}
              isPlaying={isPlaying}
            />
          </Surface>
        </Viewport>
      </Stage>
    );
  },
};

/** Configuring it on the player. */
export const Usage: Story = {
  render: () => (
    <Snippet
      title="Via VideoConfig"
      code={`import { VideoPlayer } from '@fairu/player';

<VideoPlayer
  config={{
    track: { id: 'v1', src: 'https://example.test/video.m3u8' },
    logo: {
      src: '/brand.svg',
      alt: 'Brand',
      position: 'bottom-right',
      width: 96,
      opacity: 0.8,
      href: 'https://example.test',
      // Fades out with the control bar rather than sitting there permanently.
      hideWithControls: true,
    },
  }}
/>`}
    />
  ),
};
