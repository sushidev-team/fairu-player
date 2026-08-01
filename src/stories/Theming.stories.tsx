import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { ProgressBar } from '@/components/controls/ProgressBar';
import { PlayButton } from '@/components/controls/PlayButton';
import { VolumeControl } from '@/components/controls/VolumeControl';
import { PlaybackSpeed } from '@/components/controls/PlaybackSpeed';
import { TimeDisplay } from '@/components/controls/TimeDisplay';
import { themeToCssVars } from '@/utils/theme';
import type { FairuTheme } from '@/types/theme';
import { Note, Panel, Snippet, Stage, Toggle } from '@/stories/preview-kit';

const meta: Meta = {
  title: 'Theming/Overview',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Every component styles itself from `--fp-*` custom properties. A theme sets those on a scoping element — so the stylesheet stays the default and a config only overrides what it names.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** A representative slice of the player, so a theme is visible at a glance. */
function Sampler({ label }: { label: string }) {
  const [time, setTime] = useState(95);
  return (
    <div
      className="flex w-full flex-col gap-3 p-4"
      style={{
        background: 'var(--fp-color-background-elevated)',
        border: '1px solid var(--fp-border-color)',
        borderRadius: 'var(--fp-border-radius)',
        fontFamily: 'var(--fp-font-family)',
      }}
    >
      <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
        {label}
      </span>
      <ProgressBar
        currentTime={time}
        duration={300}
        buffered={220}
        onSeek={setTime}
        tracks={[
          {
            id: 'ads',
            label: 'Ad breaks',
            color: '#f59e0b',
            actions: [{ id: 'a', time: 120, endTime: 150, label: 'Mid-Roll' }],
          },
        ]}
      />
      <div className="flex items-center gap-3">
        <PlayButton isPlaying={false} size="md" />
        <TimeDisplay currentTime={time} duration={300} />
        <span className="flex-1" />
        <PlaybackSpeed speed={1} />
        <VolumeControl volume={0.7} muted={false} orientation="horizontal" />
      </div>
    </div>
  );
}

const BRAND: FairuTheme = {
  colors: {
    accent: '#e11d48',
    accentHover: '#f43f5e',
    background: '#1a0b10',
    backgroundElevated: '#241016',
    surface: '#331722',
    text: '#fff5f7',
    textSecondary: '#e7c3cc',
    textMuted: '#a8808c',
  },
  progress: { background: '#4a2230', buffer: '#5f2c3d' },
  border: { color: 'rgba(255,255,255,0.12)', radius: '2px' },
  typography: { fontFamily: 'Georgia, serif' },
};

const SQUARE: FairuTheme = {
  border: { radius: '0', radiusSm: '0', radiusLg: '0', radiusFull: '0' },
};

/** Default vs. a couple of overrides, side by side. */
export const Presets: Story = {
  render: () => (
    <Stage
      title="Default and overrides"
      description="The left column is untouched — that is the stylesheet. Each of the others sets only a handful of values; everything unset keeps inheriting."
      aside={
        <>
          <Note>
            No component here knows anything about themes. They read{' '}
            <code>var(--fp-*)</code>; the provider sets those. That is the entire mechanism.
          </Note>
          <Snippet
            code={`<ThemeProvider theme={{ colors: { accent: '#e11d48' } }}>
  <VideoPlayer track={track} />
</ThemeProvider>

// or per player
<VideoPlayer track={track} theme={{ border: { radius: '0' } }} />`}
          />
        </>
      }
    >
      <div className="grid w-full gap-4 lg:grid-cols-2">
        <ThemeProvider>
          <Sampler label="Default (no theme)" />
        </ThemeProvider>
        <ThemeProvider theme={{ preset: 'light' }}>
          <Sampler label="preset: 'light'" />
        </ThemeProvider>
        <ThemeProvider theme={{ colors: { accent: '#e11d48' } }}>
          <Sampler label="Only colors.accent" />
        </ThemeProvider>
        <ThemeProvider theme={SQUARE}>
          <Sampler label="Only border.radius: 0" />
        </ThemeProvider>
        <ThemeProvider theme={BRAND}>
          <Sampler label="A full brand theme" />
        </ThemeProvider>
        <ThemeProvider theme={{ preset: 'high-contrast' }}>
          <Sampler label="preset: 'high-contrast'" />
        </ThemeProvider>
      </div>
    </Stage>
  ),
};

/** Live editor. */
export const Playground: Story = {
  render: function Render() {
    const [accent, setAccent] = useState('#00a99d');
    const [background, setBackground] = useState('#181818');
    const [surface, setSurface] = useState('#282828');
    const [text, setText] = useState('#ffffff');
    const [radius, setRadius] = useState('8px');
    const [borderColor, setBorderColor] = useState('rgba(255,255,255,0.1)');
    const [serif, setSerif] = useState(false);

    const theme: FairuTheme = {
      colors: { accent, backgroundElevated: background, surface, text },
      border: { radius, color: borderColor },
      ...(serif ? { typography: { fontFamily: 'Georgia, serif' } } : {}),
    };

    const field = (
      label: string,
      value: string,
      set: (v: string) => void,
      type: 'color' | 'text' = 'color'
    ) => (
      <label className="flex items-center justify-between gap-3 py-1">
        <span className="text-[12px]" style={{ color: 'var(--fp-color-text-secondary)' }}>
          {label}
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => set(e.target.value)}
          className="h-7 w-24 rounded border-0 bg-transparent"
          style={type === 'text' ? { background: 'var(--fp-color-surface)', color: 'var(--fp-color-text)', padding: '0 6px', fontSize: 12 } : undefined}
        />
      </label>
    );

    return (
      <Stage
        title="Theme playground"
        description="Change a value and watch it apply. The generated style object is exactly what ThemeProvider puts on its element."
        aside={
          <>
            <Panel title="Colors">
              {field('accent', accent, setAccent)}
              {field('backgroundElevated', background, setBackground)}
              {field('surface', surface, setSurface)}
              {field('text', text, setText)}
            </Panel>
            <Panel title="Shape & type">
              {field('border.radius', radius, setRadius, 'text')}
              {field('border.color', borderColor, setBorderColor, 'text')}
              <Toggle label="serif font" checked={serif} onChange={setSerif} />
            </Panel>
            <Panel title="Emitted variables">
              <pre
                className="m-0 overflow-x-auto text-[11px] leading-relaxed"
                style={{ fontFamily: 'var(--fp-font-family-mono)', color: 'var(--fp-color-text-secondary)' }}
              >
                {Object.entries(themeToCssVars(theme))
                  .map(([k, v]) => `${k}: ${v};`)
                  .join('\n')}
              </pre>
            </Panel>
          </>
        }
      >
        <ThemeProvider theme={theme} className="w-full">
          <Sampler label="Live" />
        </ThemeProvider>
      </Stage>
    );
  },
};

/** Nesting. */
export const Nesting: Story = {
  render: () => (
    <Stage
      title="Nesting"
      description="An inner provider refines the outer one leaf by leaf, so a page-level brand theme survives a per-player tweak."
    >
      <ThemeProvider theme={BRAND} className="w-full">
        <div className="grid w-full gap-4 lg:grid-cols-2">
          <Sampler label="Brand theme" />
          <ThemeProvider theme={{ colors: { accent: '#22c55e' } }}>
            <Sampler label="Brand theme + accent override" />
          </ThemeProvider>
        </div>
      </ThemeProvider>
    </Stage>
  ),
};
