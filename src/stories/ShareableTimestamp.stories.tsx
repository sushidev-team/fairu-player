import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { VideoProvider, useVideoPlayer } from '@/context/VideoContext';
import { useShareableTimestamp } from '@/hooks/useShareableTimestamp';
import { formatTimestamp, parseTimestamp } from '@/core/timestamp';
import { SAMPLE_VIDEOS } from '@/stories/fixtures';
import { Note, Panel, Snippet, Stage } from '@/stories/preview-kit';

const meta: Meta = {
  title: 'Hooks/Shareable Timestamps',
  parameters: {
    docs: {
      description: {
        component:
          'Links that point into a video — `?t=1m30s`. The format lives in ' +
          '`src/core/timestamp.ts`; `useShareableTimestamp` reads the address bar ' +
          'and drives the player.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const TRACK = {
  id: 'timestamp-demo',
  src: SAMPLE_VIDEOS.tearsOfSteel,
  title: 'Tears of Steel',
};

function ShareDemo() {
  const { state, controls, videoRef, containerRef } = useVideoPlayer();
  const share = useShareableTimestamp({
    currentTime: state.currentTime,
    duration: state.duration,
    onSeek: controls.seek,
  });

  const [copied, setCopied] = useState<boolean | null>(null);

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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            void share.copyShareUrl().then(setCopied);
          }}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
        >
          Copy link at {formatTimestamp(state.currentTime)}
        </button>
        {copied !== null && (
          <span className="text-xs opacity-70">
            {copied ? 'Copied.' : 'The clipboard refused — not a secure context?'}
          </span>
        )}
      </div>

      <code className="block overflow-x-auto rounded-lg bg-black/40 px-3 py-2 font-mono text-xs opacity-80">
        {share.getShareUrl() || '—'}
      </code>

      {share.hasUrlTimestamp && (
        <Note tone="tip">
          This page was opened at{' '}
          <strong>{formatTimestamp(share.urlTimestamp ?? 0)}</strong>.{' '}
          {share.pendingSeek
            ? 'Waiting for the media to report its duration before jumping.'
            : 'The player has jumped there.'}
        </Note>
      )}
    </div>
  );
}

/**
 * Copy a link, then paste it into the address bar. The player opens at that
 * position — but only once the media reports a duration, which is the whole
 * reason the seek is deferred.
 */
export const Interactive: Story = {
  render: () => (
    <Stage
      title="Shareable timestamps"
      description="Copy a link at some position, then open it. Storybook keeps the query string, so the ?t= parameter survives a reload."
      maxWidth={720}
      aside={
        <div className="flex flex-col gap-3">
          <Panel title="Why the seek waits">
            <p className="text-sm opacity-80">
              A seek is clamped against the element&apos;s duration, and that is{' '}
              <code>0</code> until <code>loadedmetadata</code>. Applying{' '}
              <code>?t=1m30s</code> on mount therefore lands at <code>0</code> —
              the link appears to work and does nothing.
            </p>
          </Panel>
          <Note tone="warn">
            The parser refuses <code>Infinity</code>, hex and exponent notation.
            A query parameter is whatever the sender typed, and a non-finite
            seek leaves the element unplayable.
          </Note>
        </div>
      }
    >
      <VideoProvider config={{ track: TRACK }}>
        <ShareDemo />
      </VideoProvider>
    </Stage>
  ),
};

/** What the format accepts, and what it turns down. */
export const Format: Story = {
  render: () => {
    const accepted = ['90', '90.5', '45s', '1m30s', '1h2m3s', '1h', '1:30', '1:02:03'];
    const refused = ['Infinity', '1e400', '9'.repeat(400), '0x10', '-30', '1:', 'soon'];

    return (
      <Stage title="The format" maxWidth={720}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Panel title="Read" meta={`${accepted.length}`}>
            <table className="w-full font-mono text-xs">
              <tbody>
                {accepted.map((input) => (
                  <tr key={input}>
                    <td className="py-0.5 opacity-70">{input}</td>
                    <td className="py-0.5 text-right">{parseTimestamp(input)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel title="Refused" meta={`${refused.length}`}>
            <table className="w-full font-mono text-xs">
              <tbody>
                {refused.map((input) => (
                  <tr key={input}>
                    <td className="py-0.5 opacity-70">
                      {input.length > 14 ? `${input.slice(0, 12)}… (400 Ziffern)` : input}
                    </td>
                    <td className="py-0.5 text-right opacity-50">null</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      </Stage>
    );
  },
};

/** How it is wired up. */
export const Usage: Story = {
  render: () => (
    <Stage title="Usage" maxWidth={720}>
      <Snippet
        code={`import { useShareableTimestamp } from '@fairu/player';

function Player() {
  const { state, controls } = useVideoPlayer();

  const share = useShareableTimestamp({
    currentTime: state.currentTime,
    // The seek waits for this: a seek before loadedmetadata is clamped to 0.
    duration: state.duration,
    onSeek: controls.seek,
  });

  return (
    <button onClick={() => share.copyShareUrl()}>
      Copy link at this moment
    </button>
  );
}`}
      />
    </Stage>
  ),
};
