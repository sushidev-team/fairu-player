import type { Meta, StoryObj } from '@storybook/react';
import { useRef } from 'react';
import { SleepTimer } from '@/components/controls/SleepTimer';
import { useSleepTimer } from '@/hooks/useSleepTimer';
import { Note, Panel, Snippet, Stage } from '@/stories/preview-kit';
import { SAMPLE_AUDIO } from '@/stories/fixtures';

const meta: Meta = {
  title: 'Hooks/Sleep Timer',
  parameters: {
    docs: {
      description: {
        component:
          'Stop playback after a while. The countdown is derived from a stored ' +
          'deadline rather than counted, because browsers throttle timers in ' +
          'background tabs — which is exactly where a sleep timer lives.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

function Demo({ fadeOut }: { fadeOut?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timer = useSleepTimer({
    mediaRef: audioRef,
    fadeOut,
    // Short enough to watch happen.
    fadeOutDuration: 10,
  });

  return (
    <div className="flex flex-col gap-4">
      <audio
        ref={audioRef}
        src={SAMPLE_AUDIO.horse}
        controls
        className="w-full"
      />

      <div className="flex items-center gap-3">
        <SleepTimer
          isActive={timer.state.isActive}
          remainingTime={timer.state.remainingTime}
          selectedDuration={timer.state.selectedDuration}
          onStart={timer.controls.startTimer}
          onCancel={timer.controls.stopTimer}
        />
        {timer.state.isActive && (
          <button
            type="button"
            onClick={() => timer.controls.extendTimer(5)}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
          >
            +5 min
          </button>
        )}
        <span className="text-xs opacity-70">
          {timer.state.isFadingOut ? 'wird leiser…' : timer.state.isActive ? 'läuft' : 'aus'}
        </span>
      </div>
    </div>
  );
}

/**
 * Pick a duration, then switch to another tab for a while. The countdown is
 * right when you come back — it is read from the clock, not counted.
 */
export const Interactive: Story = {
  render: () => (
    <Stage
      title="Sleep timer"
      description="Start playback, set a timer, and try leaving the tab. Extending adds to what is left, not to the original duration."
      maxWidth={640}
      aside={
        <div className="flex flex-col gap-3">
          <Panel title="Why not count seconds">
            <p className="text-sm opacity-80">
              Browsers throttle <code>setInterval</code> in background tabs and
              stop it outright when a phone sleeps — the situation this feature
              exists for. A 45-minute timer that counts ticks silently becomes an
              hour, or never fires.
            </p>
          </Panel>
          <Note tone="tip">
            Two modes on two clocks: a duration is wall-clock, and{' '}
            <em>end of track</em> follows the playhead, so pausing a podcast does
            not eat into it.
          </Note>
        </div>
      }
    >
      <Demo />
    </Stage>
  ),
};

/** With the volume easing down over the last ten seconds. */
export const WithFadeOut: Story = {
  render: () => (
    <Stage
      title="Fading out"
      description="Set the shortest preset and let it run out. The volume is restored afterwards, so the next play is not mysteriously quiet."
      maxWidth={640}
    >
      <Demo fadeOut />
    </Stage>
  ),
};

/** How it is wired up. */
export const Usage: Story = {
  render: () => (
    <Stage title="Usage" maxWidth={640}>
      <Snippet
        code={`import { useRef } from 'react';
import { useSleepTimer, SleepTimer } from '@fairu/player';

function Player() {
  const audioRef = useRef<HTMLAudioElement>(null);

  const timer = useSleepTimer({
    mediaRef: audioRef,
    fadeOut: true,
  });

  return (
    <>
      <audio ref={audioRef} src={src} />

      <SleepTimer
        isActive={timer.state.isActive}
        remainingTime={timer.state.remainingTime}
        selectedDuration={timer.state.selectedDuration}
        onStart={timer.controls.startTimer}
        onCancel={timer.controls.stopTimer}
      />
    </>
  );
}`}
      />
    </Stage>
  ),
};
