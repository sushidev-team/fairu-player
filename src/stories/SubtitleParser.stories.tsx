import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SubtitleDisplay } from '@/components/VideoPlayer/SubtitleDisplay';
import { useSubtitleParser } from '@/hooks/useSubtitleParser';
import { useSubtitleStyling } from '@/hooks/useSubtitleStyling';
import { SubtitleSettings } from '@/components/controls/SubtitleSettings';
import { Note, Panel, Snippet, Stage } from '@/stories/preview-kit';

const meta: Meta = {
  title: 'Hooks/Subtitle Parser',
  parameters: {
    docs: {
      description: {
        component:
          'Captions parsed and drawn by the player instead of the browser — for ' +
          'when they need to sit above the controls bar, or be styled past what ' +
          '`::cue` reaches.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const VTT = `WEBVTT

1
00:00:00.000 --> 00:00:03.000
Der Player zeichnet diese Zeile selbst.

2
00:00:03.000 --> 00:00:06.000
<v Anna>Und hier steht, wer spricht.

3
00:00:06.000 --> 00:00:10.000
Zwei Zeilen —
ohne dass Markup ins DOM wandert.
`;

const VTT_URL = `data:text/vtt,${encodeURIComponent(VTT)}`;

function Demo() {
  const [currentTime, setCurrentTime] = useState(1);
  const subtitles = useSubtitleParser({ src: VTT_URL, currentTime });
  const styling = useSubtitleStyling({ persist: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-neutral-800">
        <div className="absolute inset-0 flex items-center justify-center text-sm opacity-30">
          Videofläche
        </div>
        <SubtitleDisplay
          text={subtitles.activeText}
          speaker={subtitles.activeCue?.speaker}
          style={styling.style}
        />
      </div>

      <label className="flex items-center gap-3 text-xs">
        <span className="w-20 tabular-nums opacity-70">{currentTime.toFixed(1)}s</span>
        <input
          type="range"
          min={0}
          max={10}
          step={0.1}
          value={currentTime}
          onChange={(event) => setCurrentTime(Number(event.target.value))}
          className="flex-1 accent-[var(--fp-color-accent)]"
        />
      </label>

      <div className="flex items-center gap-3">
        <SubtitleSettings
          style={styling.style}
          onStyleChange={styling.updateStyle}
          onPresetSelect={styling.applyPreset}
          onReset={styling.resetStyle}
          presets={styling.presets}
        />
        <span className="text-xs opacity-70">
          {subtitles.cues.length} Cues · {subtitles.isLoaded ? 'geladen' : 'lädt'}
        </span>
      </div>
    </div>
  );
}

/** Drag the slider across the timeline; the cue follows. */
export const Interactive: Story = {
  render: () => (
    <Stage
      title="Selbst gezeichnete Untertitel"
      description="Der Regler steht für den Playhead. Die Darstellung teilt sich die Einstellungen mit dem ::cue-Styling."
      maxWidth={640}
      aside={
        <div className="flex flex-col gap-3">
          <Panel title="Warum selbst zeichnen">
            <p className="text-sm opacity-80">
              Native Cues zeichnet der Browser dorthin, wo er will — regelmäßig
              hinter die Bedienleiste. Und <code>::cue</code> erreicht Position
              nicht.
            </p>
          </Panel>
          <Note tone="warn">
            Eine Untertiteldatei kommt von dem, der das Video geliefert hat. Die
            Vorlage reichte den Cue-Text an{' '}
            <code>dangerouslySetInnerHTML</code> — für einen Zeilenumbruch.
          </Note>
        </div>
      }
    >
      <Demo />
    </Stage>
  ),
};

/** How it is wired up. */
export const Usage: Story = {
  render: () => (
    <Stage title="Usage" maxWidth={640}>
      <Snippet
        code={`import { useSubtitleParser, SubtitleDisplay, useSubtitleStyling } from '@fairu/player';

function Player({ subtitleSrc }) {
  const { state } = useVideoPlayer();
  const subtitles = useSubtitleParser({ src: subtitleSrc, currentTime: state.currentTime });
  const styling = useSubtitleStyling();

  return (
    <div className="relative">
      <video … />

      <SubtitleDisplay
        text={subtitles.activeText}
        speaker={subtitles.activeCue?.speaker}
        style={styling.style}
      />
    </div>
  );
}`}
      />
    </Stage>
  ),
};
