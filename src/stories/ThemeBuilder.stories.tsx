import type { Meta, StoryObj } from '@storybook/react';
import { useMemo, useState } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { VideoPlayer } from '@/components/VideoPlayer';
import { AudioPlayer } from '@/components/AudioPlayer';
import { ReelsPlayer } from '@/components/Reels';
import { themeToCssVars } from '@/utils/theme';
import type { FairuTheme } from '@/types/theme';
import { SAMPLE_AUDIO, SAMPLE_VIDEOS, VIDEO_POOL, avatar, poster } from '@/stories/fixtures';
import { Button, Note, Panel, Segmented, Snippet, Stage } from '@/stories/preview-kit';

const meta: Meta = {
  title: 'Theming/Builder',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A full theme editor applied to the real players. Every field maps to one `--fp-*` custom property; unset fields keep the stylesheet default. Copy the result straight into your code.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/* -------------------------------------------------------------------------- */
/*                              Field definitions                             */
/* -------------------------------------------------------------------------- */

type FieldKind = 'color' | 'text';

interface Field {
  /** Dotted path into FairuTheme. */
  path: string;
  label: string;
  kind: FieldKind;
  /** Shown as the input placeholder — the stylesheet value. */
  fallback: string;
}

const GROUPS: Array<{ title: string; fields: Field[] }> = [
  {
    title: 'Colors',
    fields: [
      { path: 'colors.accent', label: 'accent', kind: 'color', fallback: '#00a99d' },
      { path: 'colors.accentHover', label: 'accentHover', kind: 'color', fallback: '#04c8b6' },
      { path: 'colors.accentGlow', label: 'accentGlow', kind: 'text', fallback: 'rgba(0,169,157,.4)' },
      { path: 'colors.background', label: 'background', kind: 'color', fallback: '#121212' },
      { path: 'colors.backgroundElevated', label: 'backgroundElevated', kind: 'color', fallback: '#181818' },
      { path: 'colors.surface', label: 'surface', kind: 'color', fallback: '#282828' },
      { path: 'colors.surfaceHover', label: 'surfaceHover', kind: 'color', fallback: '#333333' },
      { path: 'colors.text', label: 'text', kind: 'color', fallback: '#ffffff' },
      { path: 'colors.textSecondary', label: 'textSecondary', kind: 'color', fallback: '#b3b3b3' },
      { path: 'colors.textMuted', label: 'textMuted', kind: 'color', fallback: '#6a6a6a' },
    ],
  },
  {
    title: 'Progress',
    fields: [
      { path: 'progress.background', label: 'background', kind: 'color', fallback: '#4d4d4d' },
      { path: 'progress.fill', label: 'fill', kind: 'text', fallback: 'var(--fp-color-accent)' },
      { path: 'progress.buffer', label: 'buffer', kind: 'color', fallback: '#404040' },
    ],
  },
  {
    title: 'Border & radius',
    fields: [
      { path: 'border.color', label: 'color', kind: 'text', fallback: 'rgba(255,255,255,.1)' },
      { path: 'border.radius', label: 'radius', kind: 'text', fallback: '8px' },
      { path: 'border.radiusSm', label: 'radiusSm', kind: 'text', fallback: '4px' },
      { path: 'border.radiusLg', label: 'radiusLg', kind: 'text', fallback: '12px' },
      { path: 'border.radiusFull', label: 'radiusFull', kind: 'text', fallback: '9999px' },
    ],
  },
  {
    title: 'Typography',
    fields: [
      { path: 'typography.fontFamily', label: 'fontFamily', kind: 'text', fallback: "'Figtree', system-ui, sans-serif" },
      { path: 'typography.fontFamilyMono', label: 'fontFamilyMono', kind: 'text', fallback: 'ui-monospace, Menlo, monospace' },
    ],
  },
  {
    title: 'Glass & shadow',
    fields: [
      { path: 'glass.background', label: 'glass.background', kind: 'text', fallback: 'rgba(18,18,18,.85)' },
      { path: 'glass.border', label: 'glass.border', kind: 'text', fallback: 'rgba(255,255,255,.1)' },
      { path: 'shadows.md', label: 'shadows.md', kind: 'text', fallback: '0 4px 12px rgb(0 0 0 / .4)' },
      { path: 'shadows.glow', label: 'shadows.glow', kind: 'text', fallback: '0 0 20px var(--fp-color-accent-glow)' },
    ],
  },
  {
    title: 'Transitions',
    fields: [
      { path: 'transitions.fast', label: 'fast', kind: 'text', fallback: '150ms ease' },
      { path: 'transitions.normal', label: 'normal', kind: 'text', fallback: '200ms ease' },
      { path: 'transitions.morph', label: 'morph', kind: 'text', fallback: '300ms cubic-bezier(.4,0,.2,1)' },
    ],
  },
];

/** Font stacks worth trying without typing one out. */
const FONT_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'Default', value: '' },
  { label: 'System', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Mono', value: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  { label: 'Rounded', value: '"Nunito", "Quicksand", system-ui, sans-serif' },
  { label: 'Condensed', value: '"Oswald", "Arial Narrow", system-ui, sans-serif' },
];

/** Starting points. */
const STARTERS: Record<string, FairuTheme> = {
  Default: {},
  Crimson: {
    colors: { accent: '#e11d48', accentHover: '#f43f5e', background: '#1a0b10', backgroundElevated: '#241016', surface: '#331722' },
    progress: { background: '#4a2230', buffer: '#5f2c3d' },
  },
  Square: { border: { radius: '0', radiusSm: '0', radiusLg: '0', radiusFull: '0' } },
  Editorial: {
    preset: 'light',
    colors: { accent: '#111111', accentHover: '#333333', text: '#111111' },
    border: { radius: '2px', color: '#dddddd' },
    typography: { fontFamily: 'Georgia, "Times New Roman", serif' },
  },
};

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function setPath(theme: FairuTheme, path: string, value: string): FairuTheme {
  const [group, key] = path.split('.') as [keyof FairuTheme, string];
  const section = { ...((theme[group] as Record<string, string> | undefined) ?? {}) };

  // An empty field means "unset", which must remove the key entirely — leaving
  // an empty string would emit a declaration and override the stylesheet.
  if (value === '') delete section[key];
  else section[key] = value;

  const next = { ...theme };
  if (Object.keys(section).length === 0) delete next[group];
  else (next[group] as Record<string, string>) = section;
  return next;
}

function getPath(theme: FairuTheme, path: string): string {
  const [group, key] = path.split('.') as [keyof FairuTheme, string];
  return ((theme[group] as Record<string, string> | undefined)?.[key]) ?? '';
}

/** Pretty-print the theme as source you can paste. */
function toSource(theme: FairuTheme): string {
  if (Object.keys(theme).length === 0) {
    return '// Nothing overridden — this is the stylesheet default.\nconst theme = {};';
  }
  return `import type { FairuTheme } from '@fairu/player';

const theme: FairuTheme = ${JSON.stringify(theme, null, 2)};

<VideoPlayer track={track} theme={theme} />`;
}

/* -------------------------------------------------------------------------- */
/*                                  Fixtures                                  */
/* -------------------------------------------------------------------------- */

const VIDEO_TRACK = {
  id: 'theme-demo',
  src: SAMPLE_VIDEOS.bigBuckBunny,
  title: 'Design-Check',
  artist: 'Fairu',
  poster: poster('theme-video', 1280, 720),
};

const AUDIO_TRACK = {
  id: 'theme-audio',
  src: SAMPLE_AUDIO.tRex,
  title: 'Folge 12 — Theming',
  artist: 'Fairu Devcast',
  artwork: poster('theme-audio', 400, 400),
  duration: 2,
};

const REELS = VIDEO_POOL.slice(0, 4).map((src, i) => ({
  id: `r${i}`,
  src,
  poster: poster(`theme-reel-${i}`),
  caption: 'Theming im Vertical Feed',
  author: { name: '@fairu.dev', avatar: avatar(12), verified: true },
  stats: { likes: 12400, comments: 310, shares: 88 },
}));

/* -------------------------------------------------------------------------- */
/*                                   Story                                    */
/* -------------------------------------------------------------------------- */

/**
 * The one to use for checking a custom design.
 *
 * Every theme group is editable and applied to the actual players — not to a
 * mock-up — so what you see is what ships.
 */
export const Builder: Story = {
  render: function Render() {
    const [theme, setTheme] = useState<FairuTheme>({});
    const [surface, setSurface] = useState<'video' | 'audio' | 'reels'>('video');
    const [preset, setPreset] = useState<'none' | 'dark' | 'light' | 'high-contrast'>('none');

    const applied = useMemo<FairuTheme>(
      () => (preset === 'none' ? theme : { ...theme, preset }),
      [theme, preset]
    );

    const vars = useMemo(() => themeToCssVars(applied), [applied]);
    const overrideCount = Object.keys(vars).length;

    const update = (path: string, value: string) => setTheme((t) => setPath(t, path, value));

    return (
      <Stage
        title="Theme builder"
        description="Change anything on the right and watch the real player update. Empty a field to fall back to the stylesheet — that is what makes the current look the default rather than a starting copy."
        aside={
          <>
            <Panel title="Start from" meta={`${overrideCount} override${overrideCount === 1 ? '' : 's'}`}>
              <div className="flex flex-wrap gap-1">
                {Object.entries(STARTERS).map(([name, starter]) => (
                  <Button
                    key={name}
                    size="sm"
                    onClick={() => {
                      setTheme(starter);
                      setPreset(starter.preset ?? 'none');
                    }}
                  >
                    {name}
                  </Button>
                ))}
              </div>
              <div className="mt-2">
                <Segmented
                  label="preset"
                  value={preset}
                  options={[
                    { value: 'none', label: 'none' },
                    { value: 'dark', label: 'dark' },
                    { value: 'light', label: 'light' },
                    { value: 'high-contrast', label: 'contrast' },
                  ]}
                  onChange={setPreset}
                />
              </div>
            </Panel>

            <Panel title="Font presets">
              <div className="flex flex-wrap gap-1">
                {FONT_PRESETS.map((font) => (
                  <Button
                    key={font.label}
                    size="sm"
                    variant={
                      getPath(theme, 'typography.fontFamily') === font.value ? 'primary' : 'secondary'
                    }
                    onClick={() => update('typography.fontFamily', font.value)}
                  >
                    {font.label}
                  </Button>
                ))}
              </div>
              <p className="mt-2 text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
                Any CSS font stack works. Load the webfont yourself — the player only sets
                <code> font-family</code>.
              </p>
            </Panel>

            {GROUPS.map((group) => (
              <Panel key={group.title} title={group.title}>
                {group.fields.map((field) => {
                  const value = getPath(theme, field.path);
                  return (
                    <label key={field.path} className="flex items-center justify-between gap-2 py-1">
                      <span
                        className="truncate text-[12px]"
                        style={{ color: value ? 'var(--fp-color-accent)' : 'var(--fp-color-text-secondary)' }}
                        title={field.path}
                      >
                        {field.label}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {field.kind === 'color' && (
                          <input
                            type="color"
                            value={value || field.fallback}
                            onChange={(e) => update(field.path, e.target.value)}
                            className="h-6 w-8 rounded border-0 bg-transparent p-0"
                          />
                        )}
                        <input
                          type="text"
                          value={value}
                          placeholder={field.fallback}
                          onChange={(e) => update(field.path, e.target.value)}
                          className="w-28 rounded px-1.5 py-0.5 text-[11px]"
                          style={{
                            background: 'var(--fp-color-surface)',
                            color: 'var(--fp-color-text)',
                            fontFamily: 'var(--fp-font-family-mono)',
                          }}
                        />
                        {value && (
                          <button
                            type="button"
                            onClick={() => update(field.path, '')}
                            title="Reset to default"
                            className="px-1 text-[11px]"
                            style={{ color: 'var(--fp-color-text-muted)' }}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    </label>
                  );
                })}
              </Panel>
            ))}

            <Snippet title="Your theme" code={toSource(applied)} />

            <Panel title="Emitted CSS">
              <pre
                className="m-0 max-h-48 overflow-auto text-[11px] leading-relaxed"
                style={{
                  fontFamily: 'var(--fp-font-family-mono)',
                  color: 'var(--fp-color-text-secondary)',
                }}
              >
                {overrideCount === 0
                  ? '/* nothing — the stylesheet default applies */'
                  : Object.entries(vars)
                      .map(([k, v]) => `${k}: ${v};`)
                      .join('\n')}
              </pre>
            </Panel>

            <Note>
              Only the properties listed above are written. Everything else keeps inheriting from
              <code> variables.css</code>, which is why a two-line theme is a legitimate theme.
            </Note>
          </>
        }
      >
        <div className="flex w-full flex-col gap-3">
          <Segmented
            value={surface}
            options={[
              { value: 'video', label: 'VideoPlayer' },
              { value: 'audio', label: 'AudioPlayer' },
              { value: 'reels', label: 'ReelsPlayer' },
            ]}
            onChange={setSurface}
          />

          {/* The real components, not a mock-up. */}
          {surface === 'video' && (
            <VideoPlayer
              key="video"
              track={VIDEO_TRACK}
              theme={applied}
              config={{ features: { qualitySelector: true } }}
            />
          )}

          {surface === 'audio' && (
            <AudioPlayer key="audio" track={AUDIO_TRACK} theme={applied} showChapters />
          )}

          {surface === 'reels' && (
            <div className="mx-auto w-[280px]">
              <ReelsPlayer
                key="reels"
                reels={REELS}
                theme={applied}
                config={{ features: { counter: true } }}
              />
            </div>
          )}

          {/* A themed panel, so surfaces and borders are visible too. */}
          <ThemeProvider theme={applied}>
            <div
              className="flex flex-wrap items-center gap-3 p-4"
              style={{
                background: 'var(--fp-color-background-elevated)',
                border: '1px solid var(--fp-border-color)',
                borderRadius: 'var(--fp-border-radius)',
                color: 'var(--fp-color-text)',
                boxShadow: 'var(--fp-shadow)',
              }}
            >
              <span className="text-sm font-semibold">Überschrift</span>
              <span className="text-sm" style={{ color: 'var(--fp-color-text-secondary)' }}>
                Sekundärtext
              </span>
              <span className="text-sm" style={{ color: 'var(--fp-color-text-muted)' }}>
                Gedämpft
              </span>
              <span
                className="rounded px-2 py-1 text-xs font-semibold"
                style={{
                  background: 'var(--fp-color-accent)',
                  color: '#000',
                  borderRadius: 'var(--fp-border-radius-sm)',
                }}
              >
                Akzent
              </span>
              <span
                className="px-2 py-1 text-xs tabular-nums"
                style={{
                  fontFamily: 'var(--fp-font-family-mono)',
                  background: 'var(--fp-color-surface)',
                  borderRadius: 'var(--fp-border-radius-sm)',
                }}
              >
                00:00 / 12:34
              </span>
            </div>
          </ThemeProvider>
        </div>
      </Stage>
    );
  },
};

/** Proof that the typeface reaches every player, not just the audio one. */
export const Fonts: Story = {
  render: function Render() {
    const [font, setFont] = useState(FONT_PRESETS[2].value);
    const theme: FairuTheme = { typography: { fontFamily: font } };

    return (
      <Stage
        title="Fonts"
        description="typography.fontFamily maps to --fp-font-family. It reaches all three players — which it did not before: the variable was only applied by .fairu-player, so the video player and the reels feed silently inherited the host page's font."
        aside={
          <>
            <Panel title="Stack">
              <div className="flex flex-wrap gap-1">
                {FONT_PRESETS.filter((f) => f.value).map((f) => (
                  <Button
                    key={f.label}
                    size="sm"
                    variant={font === f.value ? 'primary' : 'secondary'}
                    onClick={() => setFont(f.value)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            </Panel>
            <Note tone="warn">
              The player sets <code>font-family</code> and nothing else. Loading the webfont —{' '}
              <code>@font-face</code>, a <code>&lt;link&gt;</code>, or your bundler — remains yours.
            </Note>
            <Snippet
              code={`<VideoPlayer
  track={track}
  theme={{ typography: { fontFamily: '"Inter", system-ui, sans-serif' } }}
/>`}
            />
          </>
        }
      >
        <div className="grid w-full gap-4 lg:grid-cols-2">
          <VideoPlayer track={VIDEO_TRACK} theme={theme} />
          <AudioPlayer track={AUDIO_TRACK} theme={theme} />
        </div>
      </Stage>
    );
  },
};
