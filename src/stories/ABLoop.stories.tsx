import type { Meta, StoryObj } from '@storybook/react';
import { VideoProvider, useVideoPlayer } from '@/context/VideoContext';
import { useABLoop } from '@/hooks/useABLoop';
import { SAMPLE_VIDEOS } from '@/stories/fixtures';
import { Note, Panel, Snippet, Stage } from '@/stories/preview-kit';

const meta: Meta = {
  title: 'Hooks/A-B Loop',
  parameters: {
    docs: {
      description: {
        component:
          'Two points on the timeline and one rule: on reaching B, jump back to A. ' +
          'The rules are plain functions in `src/core/abLoop.ts`; `useABLoop` is the ' +
          'React binding over them.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const TRACK = {
  id: 'ab-loop-demo',
  src: SAMPLE_VIDEOS.tearsOfSteel,
  title: 'Tears of Steel',
};

const format = (seconds: number | null) =>
  seconds === null ? '—' : `${seconds.toFixed(1)}s`;

function ABLoopDemo() {
  const { state, controls, videoRef, containerRef } = useVideoPlayer();
  const { state: loop, controls: loopControls } = useABLoop({
    currentTime: state.currentTime,
    onSeek: controls.seek,
  });

  const duration = state.duration || 1;
  const asPercent = (time: number) => `${Math.min(100, (time / duration) * 100)}%`;

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className="relative overflow-hidden rounded-xl bg-black"
      >
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          className="aspect-video w-full"
          controls
          playsInline
        />
      </div>

      {/* The loop drawn over the timeline, so the span is visible rather than
          only readable as two numbers. */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/15">
        {loop.loopStart !== null && loop.loopEnd !== null && (
          <div
            className="absolute inset-y-0 rounded-full"
            style={{
              left: asPercent(loop.loopStart),
              width: `calc(${asPercent(loop.loopEnd - loop.loopStart)})`,
              background: 'var(--fp-color-accent)',
              opacity: loop.isLooping ? 1 : 0.4,
            }}
          />
        )}
        <div
          className="absolute inset-y-0 w-0.5 bg-white"
          style={{ left: asPercent(state.currentTime) }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => loopControls.setA()}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
        >
          Set A
        </button>
        <button
          type="button"
          onClick={() => loopControls.setB()}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
        >
          Set B
        </button>
        <button
          type="button"
          onClick={loopControls.clearLoop}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
        >
          Clear
        </button>
        <span className="ml-2 font-mono text-xs opacity-70">
          A {format(loop.loopStart)} · B {format(loop.loopEnd)} ·{' '}
          {loop.isLooping ? 'looping' : 'idle'}
        </span>
      </div>
    </div>
  );
}

/**
 * Play, press **Set A**, let it run a few seconds, press **Set B**. Playback
 * jumps back to A each time it reaches B.
 */
export const Interactive: Story = {
  render: () => (
    <Stage
      title="A-B repeat"
      description="Press Set A and Set B a few seconds apart while the clip plays. The bar underneath shows the span and the playhead."
      maxWidth={720}
      aside={
        <div className="flex flex-col gap-3">
          <Panel title="What to try">
            <ul className="list-disc space-y-1 pl-4 text-sm opacity-80">
              <li>Mark B <em>before</em> A — the points swap rather than refuse.</li>
              <li>Mark both at the same spot — both markers show, nothing loops.</li>
              <li>Scrub outside the loop — it picks up again on the next pass.</li>
            </ul>
          </Panel>
          <Note tone="tip">
            The seek fires once per lap, not once per <code>timeupdate</code>. The
            element does not move the instant it is told to, so the next few
            updates still read past B.
          </Note>
        </div>
      }
    >
      <VideoProvider config={{ track: TRACK }}>
        <ABLoopDemo />
      </VideoProvider>
    </Stage>
  ),
};

/** How it is wired up. */
export const Usage: Story = {
  render: () => (
    <Stage title="Usage" maxWidth={720}>
      <Snippet
        code={`import { useABLoop } from '@fairu/player';

function Player() {
  const { state, controls } = useVideoPlayer();

  const { state: loop, controls: loopControls } = useABLoop({
    currentTime: state.currentTime,
    onSeek: controls.seek,
  });

  return (
    <>
      <button onClick={() => loopControls.setA()}>Set A</button>
      <button onClick={() => loopControls.setB()}>Set B</button>
      {/* Enabled as soon as there is a marker to remove — a single point, or
          two on the same spot, are both states the viewer can get into. */}
      <button
        onClick={loopControls.clearLoop}
        disabled={loop.loopStart === null && loop.loopEnd === null}
      >
        Clear
      </button>
    </>
  );
}`}
      />
    </Stage>
  ),
};
