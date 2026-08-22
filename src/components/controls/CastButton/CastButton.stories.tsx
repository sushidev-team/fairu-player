import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { CastButton } from './CastButton';
import {
  EventLog,
  Matrix,
  Note,
  Panel,
  Snippet,
  Stage,
  StateInspector,
  Toggle,
  useEventLog,
} from '@/stories/preview-kit';

const meta: Meta<typeof CastButton> = {
  title: 'Controls/CastButton',
  component: CastButton,
  tags: ['autodocs'],
  argTypes: {
    isCasting: { control: 'boolean' },
    disabled: { control: 'boolean' },
    onClick: { table: { disable: true } },
    labels: { table: { disable: true } },
  },
  args: { isCasting: false },
};

export default meta;
type Story = StoryObj<typeof CastButton>;

const STATES = [
  { label: 'Idle', props: { isCasting: false } },
  { label: 'Casting', props: { isCasting: true } },
  { label: 'Disabled', props: { isCasting: false, disabled: true } },
];

/** Both states plus the unavailable case. */
export const AllStates: Story = {
  render: () => (
    <Stage
      title="Every state"
      description="While casting, the button stays lit: playback has moved to another device and the page is now a remote control, which is a state the viewer needs to see at a glance."
      aside={
        <Note>
          One button, two protocols. <code>useCast</code> drives AirPlay through WebKit&apos;s{' '}
          <code>webkitShowPlaybackTargetPicker</code> on Safari and Chromecast through the Remote
          Playback API elsewhere. Both open a device picker the browser owns, so nothing here can
          be styled or previewed — which is exactly why the button&apos;s own states have to be
          unambiguous.
        </Note>
      }
    >
      <Matrix
        items={STATES}
        columns={STATES.length}
        onVideo
        label={(item) => item.label}
        render={(item) => <CastButton {...item.props} />}
      />
    </Stage>
  ),
};

/** Live toggle with a click log. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();
    const [isCasting, setIsCasting] = useState(false);
    const [disabled, setDisabled] = useState(false);

    return (
      <Stage
        title="Playground"
        description="A real click opens the OS device picker, and the session can also end from the receiver's side — so casting state is driven by the remote-playback connect/disconnect events, not by this click."
        aside={
          <div className="flex flex-col gap-4">
            <Panel title="Controls">
              <Toggle label="Casting" checked={isCasting} onChange={setIsCasting} />
              <Toggle label="Disabled" checked={disabled} onChange={setDisabled} />
            </Panel>
            <StateInspector state={{ isCasting, disabled }} highlight={['isCasting']} />
            <EventLog entries={entries} onClear={clear} counts={counts} height={160} />
          </div>
        }
      >
        <CastButton
          isCasting={isCasting}
          disabled={disabled}
          onClick={() => {
            log('click', `→ ${!isCasting}`);
            setIsCasting((v) => !v);
          }}
        />
      </Stage>
    );
  },
};

/** Wiring it to the real hook. */
export const Usage: Story = {
  render: () => (
    <Snippet
      title="With useCast"
      code={`import { CastButton, useCast } from '@fairu/player';

function Controls({ videoRef }) {
  const { isCasting, toggleCast, isSupported } = useCast(videoRef, {
    onChange: (casting) => console.log('cast session', casting),
  });

  if (!isSupported) return null;

  return <CastButton isCasting={isCasting} onClick={toggleCast} />;
}`}
    />
  ),
};
