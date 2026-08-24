import type { Meta, StoryObj } from '@storybook/react';
import { useMemo, useState } from 'react';
import { ProgressBar } from '@/components/controls/ProgressBar';
import { ThumbnailPreview } from '@/components/controls/ThumbnailPreview';
import { useThumbnails } from '@/hooks/useThumbnails';
import { poster } from '@/stories/fixtures';
import { Note, Panel, Snippet, Stage } from '@/stories/preview-kit';

const meta: Meta = {
  title: 'Hooks/Scrub Thumbnails',
  parameters: {
    docs: {
      description: {
        component:
          'The frames a viewer sees while dragging the bar. Loaded from a thumbnail ' +
          'WebVTT or a sprite sheet, parsed in `src/core/thumbnails.ts`.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const DURATION = 300;
const TILE = { width: 160, height: 90, columns: 5, rows: 2 };

/**
 * A sprite sheet drawn on the spot, so the story needs no fixture upload and
 * every tile is unmistakably a different frame.
 */
function makeSpriteSheet(): string {
  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  canvas.width = TILE.width * TILE.columns;
  canvas.height = TILE.height * TILE.rows;
  const context = canvas.getContext('2d');
  if (!context) return '';

  const total = TILE.columns * TILE.rows;
  for (let i = 0; i < total; i += 1) {
    const x = (i % TILE.columns) * TILE.width;
    const y = Math.floor(i / TILE.columns) * TILE.height;

    context.fillStyle = `hsl(${(i * 360) / total}, 55%, 42%)`;
    context.fillRect(x, y, TILE.width, TILE.height);
    context.fillStyle = 'rgba(255,255,255,0.9)';
    context.font = 'bold 28px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`${i * 30}s`, x + TILE.width / 2, y + TILE.height / 2);
  }

  return canvas.toDataURL('image/png');
}

function ScrubBar({ vttUrl, spriteUrl }: { vttUrl?: string; spriteUrl?: string }) {
  const [currentTime, setCurrentTime] = useState(0);

  const config = useMemo(
    () =>
      vttUrl
        ? { vttUrl }
        : {
            spriteUrl,
            spriteColumns: TILE.columns,
            spriteRows: TILE.rows,
            thumbWidth: TILE.width,
            thumbHeight: TILE.height,
            duration: DURATION,
          },
    [vttUrl, spriteUrl]
  );

  const frames = useThumbnails(config);

  return (
    <div className="flex flex-col gap-3 py-10">
      <ProgressBar
        currentTime={currentTime}
        duration={DURATION}
        onSeek={setCurrentTime}
        renderPreview={(time) => (
          <ThumbnailPreview cue={frames.cueAt(time)} width={160} height={90} />
        )}
      />
      <div className="text-xs opacity-70">
        {frames.ready ? `${frames.cues.length} Frames geladen` : 'noch nichts geladen'}
      </div>
    </div>
  );
}

/**
 * Hover the bar. Each tile is labelled with the second it covers, so the frame
 * under the pointer is checkable rather than merely plausible.
 */
export const SpriteSheet: Story = {
  render: () => {
    const sprite = makeSpriteSheet();

    return (
      <Stage
        title="Sprite sheet"
        description="One image for the whole timeline, cropped per frame. Hover along the bar."
        maxWidth={720}
        aside={
          <div className="flex flex-col gap-3">
            <Panel title="Why a sheet">
              <p className="text-sm opacity-80">
                One request instead of hundreds. The crop comes from a{' '}
                <code>#xywh=</code> fragment in the VTT, or from the sheet
                geometry when there is no VTT.
              </p>
            </Panel>
            <Note tone="tip">
              The lookup is a binary search. A two-hour film at five-second shots
              is 1,440 cues, and walking all of them on every pointer move is
              felt.
            </Note>
          </div>
        }
      >
        <ScrubBar spriteUrl={sprite} />
      </Stage>
    );
  },
};

/** Individual images, addressed by a thumbnail WebVTT. */
export const VttManifest: Story = {
  render: () => {
    const vttUrl = useMemo(() => {
      const cues = Array.from({ length: 10 }, (_, i) => {
        const start = i * 30;
        const end = (i + 1) * 30;
        return `${clock(start)} --> ${clock(end)}\n${poster(`shot-${i}`, 160, 90)}`;
      });

      // A `data:` URL rather than an object URL. Both work in a browser, but the
      // story is also rendered by the smoke test under jsdom, where a `blob:`
      // fetch reaches undici — which cannot read one, and crashes on its own
      // abort path when the render is torn down.
      return `data:text/vtt,${encodeURIComponent(`WEBVTT\n\n${cues.join('\n\n')}\n`)}`;
    }, []);

    return (
      <Stage
        title="VTT manifest"
        description="A cue per frame, each pointing at its own image. Relative URLs resolve against the manifest."
        maxWidth={720}
        aside={
          <Note tone="warn">
            A thumbnail VTT is third-party content whose payload ends up in a{' '}
            <code>background-image</code>. Cue URLs are resolved against the
            manifest and checked for scheme before anything renders.
          </Note>
        }
      >
        <ScrubBar vttUrl={vttUrl} />
      </Stage>
    );
  },
};

/** How it is wired up. */
export const Usage: Story = {
  render: () => (
    <Stage title="Usage" maxWidth={720}>
      <Snippet
        code={`import { useThumbnails, ThumbnailPreview, ProgressBar } from '@fairu/player';

function Scrubber() {
  const frames = useThumbnails({ vttUrl: '/thumbs/index.vtt' });

  return (
    <ProgressBar
      currentTime={currentTime}
      duration={duration}
      onSeek={seek}
      // A slot rather than a thumbnails config: the bar ships in the audio
      // bundle, and wiring it in there would make every audio player carry a
      // video-only feature.
      renderPreview={(time) => (
        <ThumbnailPreview cue={frames.cueAt(time)} width={160} height={90} />
      )}
    />
  );
}`}
      />
    </Stage>
  ),
};

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `00:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}.000`;
}
