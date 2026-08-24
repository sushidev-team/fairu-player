import type { Meta, StoryObj } from '@storybook/react';
import { VideoProvider, useVideoPlayer } from '@/context/VideoContext';
import { useSubtitleStyling } from '@/hooks/useSubtitleStyling';
import { SubtitleSettings } from '@/components/controls/SubtitleSettings';
import { SAMPLE_VIDEOS } from '@/stories/fixtures';
import { Note, Panel, Snippet, Stage } from '@/stories/preview-kit';

const meta: Meta = {
  title: 'Hooks/Subtitle Styling',
  parameters: {
    docs: {
      description: {
        component:
          'Size, colour, backing box and position for subtitles. The player renders ' +
          'cues natively, so the style is delivered as a scoped `::cue` rule rather ' +
          'than a React style object.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const VTT = `WEBVTT

00:00:00.500 --> 00:00:04.000
Untertitel sind hier echt — der Browser zeichnet sie.

00:00:04.000 --> 00:00:08.000
Größe, Farbe und Kasten kommen aus einer ::cue-Regel.

00:00:08.000 --> 00:00:20.000
Die Position sitzt auf dem Cue selbst, nicht im CSS.
`;

const subtitleUrl =
  typeof window === 'undefined'
    ? ''
    : URL.createObjectURL(new Blob([VTT], { type: 'text/vtt' }));

const TRACK = {
  id: 'subtitle-style-demo',
  src: SAMPLE_VIDEOS.tearsOfSteel,
  title: 'Tears of Steel',
  subtitles: [
    { id: 'de', label: 'Deutsch', language: 'de', src: subtitleUrl, default: true },
  ],
};

function StylingDemo() {
  const { videoRef, containerRef, currentTrack } = useVideoPlayer();

  const subtitles = useSubtitleStyling({
    videoRef: videoRef as React.RefObject<HTMLMediaElement | null>,
  });

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        {...subtitles.scopeProps}
        className="relative overflow-hidden rounded-xl bg-black"
      >
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          className="aspect-video w-full"
          controls
          playsInline
          crossOrigin="anonymous"
        >
          {currentTrack?.subtitles?.map((subtitle) => (
            <track
              key={subtitle.id}
              kind="subtitles"
              label={subtitle.id}
              srcLang={subtitle.language}
              src={subtitle.src}
              default={subtitle.default}
            />
          ))}
        </video>
      </div>

      <div className="flex items-center gap-3">
        <SubtitleSettings
          style={subtitles.style}
          onStyleChange={subtitles.updateStyle}
          onPresetSelect={subtitles.applyPreset}
          onReset={subtitles.resetStyle}
          presets={subtitles.presets}
        />
        <span className="text-xs opacity-70">
          {subtitles.style.fontSize}px · Kasten{' '}
          {Math.round(subtitles.style.backgroundOpacity * 100)}% ·{' '}
          {subtitles.style.position}
        </span>
      </div>
    </div>
  );
}

/**
 * Play the clip, open the settings button and change the style. The subtitles
 * are real cues drawn by the browser — the panel rewrites a `::cue` rule.
 */
export const Interactive: Story = {
  render: () => (
    <Stage
      title="Subtitle appearance"
      description="Turn subtitles on in the native controls, then open the settings button below the player."
      maxWidth={720}
      aside={
        <div className="flex flex-col gap-3">
          <Panel title="Why ::cue">
            <p className="text-sm opacity-80">
              The player renders subtitles the way the platform does — a{' '}
              <code>&lt;track&gt;</code> element and{' '}
              <code>textTrack.mode = &apos;showing&apos;</code>. The browser draws
              the cues, so there is no element of ours to put a style object on.
            </p>
          </Panel>
          <Note tone="tip">
            Position is the exception: a cue&apos;s placement is a property on the
            cue object, which CSS cannot reach. The hook writes it to the cues
            themselves, and re-applies when a track loads late.
          </Note>
          <Note tone="warn">
            Stored preferences outlive the schema that wrote them, so every field
            is validated on the way in. One bad value falls back on its own
            rather than discarding the whole preference.
          </Note>
        </div>
      }
    >
      <VideoProvider config={{ track: TRACK }}>
        <StylingDemo />
      </VideoProvider>
    </Stage>
  ),
};

/** How it is wired up. */
export const Usage: Story = {
  render: () => (
    <Stage title="Usage" maxWidth={720}>
      <Snippet
        code={`import { useSubtitleStyling, SubtitleSettings } from '@fairu/player';

function Player() {
  const { videoRef } = useVideoPlayer();
  const subtitles = useSubtitleStyling({ videoRef });

  return (
    // The scope ties the generated ::cue rule to this player and no other.
    <div {...subtitles.scopeProps}>
      <video ref={videoRef}>…</video>

      <SubtitleSettings
        style={subtitles.style}
        onStyleChange={subtitles.updateStyle}
        onPresetSelect={subtitles.applyPreset}
        onReset={subtitles.resetStyle}
        presets={subtitles.presets}
      />
    </div>
  );
}`}
      />
    </Stage>
  ),
};
