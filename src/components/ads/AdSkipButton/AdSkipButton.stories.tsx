import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { AdSkipButton } from './AdSkipButton';
import {
  Button,
  EventLog,
  Matrix,
  Note,
  Panel,
  Snippet,
  Stage,
  StateInspector,
  useEventLog,
} from '@/stories/preview-kit';

const meta: Meta<typeof AdSkipButton> = {
  title: 'Ads/AdSkipButton',
  component: AdSkipButton,
  tags: ['autodocs'],
  argTypes: {
    canSkip: { control: 'boolean' },
    countdown: { control: { type: 'number', min: 0, max: 30 } },
    onClick: { table: { disable: true } },
  },
  args: { canSkip: false, countdown: 5 },
};

export default meta;
type Story = StoryObj<typeof AdSkipButton>;

const STATES = [
  { label: 'Counting down (5s)', props: { canSkip: false, countdown: 5 } },
  { label: 'Counting down (1s)', props: { canSkip: false, countdown: 1 } },
  { label: 'Skippable', props: { canSkip: true, countdown: 0 } },
];

/** The countdown and the skippable state. */
export const States: Story = {
  render: () => (
    <Stage
      title="Countdown, then skip"
      description="The same control does both jobs. It is a label while counting down and a button once the offer is live, so the skip lands exactly where the viewer was already looking."
      aside={
        <Note>
          The countdown is shown even while it is not actionable. Hiding it and popping a button in
          at zero is worse: the viewer cannot tell whether the ad is skippable at all, which is the
          single thing they want to know.
        </Note>
      }
    >
      <Matrix
        items={STATES}
        columns={3}
        onVideo
        label={(item) => item.label}
        render={(item) => <AdSkipButton {...item.props} />}
      />
    </Stage>
  ),
};

/** A running countdown. */
export const LiveCountdown: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();
    const [countdown, setCountdown] = useState(5);
    const [skipped, setSkipped] = useState(false);
    const [runId, setRunId] = useState(0);

    useEffect(() => {
      if (skipped || countdown <= 0) return;
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }, [countdown, skipped, runId]);

    const canSkip = countdown <= 0;

    return (
      <Stage
        title="Live countdown"
        description="The real thing ticks off the ad's own currentTime rather than a timer, so a stalled or buffering ad does not become skippable early."
        aside={
          <div className="flex flex-col gap-4">
            <Panel title="Controls">
              <Button
                onClick={() => {
                  setCountdown(5);
                  setSkipped(false);
                  setRunId((r) => r + 1);
                  log('restart');
                }}
              >
                Restart
              </Button>
            </Panel>
            <StateInspector
              state={{ countdown, canSkip, skipped }}
              highlight={['canSkip', 'skipped']}
            />
            <EventLog entries={entries} onClear={clear} counts={counts} height={200} />
          </div>
        }
      >
        {skipped ? (
          <span style={{ color: 'var(--fp-color-text-muted)' }}>Ad skipped</span>
        ) : (
          <AdSkipButton
            canSkip={canSkip}
            countdown={countdown}
            onClick={() => {
              log('onClick', 'skip', 'ad');
              setSkipped(true);
            }}
          />
        )}
      </Stage>
    );
  },
};

/** Where the values come from. */
export const Usage: Story = {
  render: () => (
    <Snippet
      title="With the ad context"
      code={`import { AdSkipButton, useVideoAds } from '@fairu/player';

function AdControls() {
  const { state, controls } = useVideoAds();

  // VAST marks an ad skippable with <Linear skipoffset="...">. An ad without
  // one is not skippable at all, so the control must not be rendered.
  if (!state.currentAd?.skipOffset) return null;

  return (
    <AdSkipButton
      canSkip={state.canSkip}
      countdown={state.skipCountdown}
      onClick={controls.skipAd}
    />
  );
}`}
    />
  ),
};
