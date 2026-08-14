import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { PictureInPictureButton } from './PictureInPictureButton';
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

const meta: Meta<typeof PictureInPictureButton> = {
  title: 'Controls/PictureInPictureButton',
  component: PictureInPictureButton,
  tags: ['autodocs'],
  argTypes: {
    isPictureInPicture: { control: 'boolean' },
    disabled: { control: 'boolean' },
    onClick: { table: { disable: true } },
    labels: { table: { disable: true } },
  },
  args: { isPictureInPicture: false },
};

export default meta;
type Story = StoryObj<typeof PictureInPictureButton>;

const STATES = [
  { label: 'Inline', props: { isPictureInPicture: false } },
  { label: 'In PiP', props: { isPictureInPicture: true } },
  { label: 'Disabled', props: { isPictureInPicture: false, disabled: true } },
];

/** Both states plus the unavailable case. */
export const AllStates: Story = {
  render: () => (
    <Stage
      title="Every state"
      description="Picture-in-Picture pops the video into a floating window the OS owns. The button reflects whether the video has left the page, not whether it is playing."
      aside={
        <Note>
          PiP is off by default in <code>VideoFeatures</code>. Firefox drives it through its own
          browser-native control rather than the JS API, and several webviews omit it entirely, so
          the button is rendered only once <code>usePictureInPicture</code> reports support.
        </Note>
      }
    >
      <Matrix
        items={STATES}
        columns={STATES.length}
        onVideo
        label={(item) => item.label}
        render={(item) => <PictureInPictureButton {...item.props} />}
      />
    </Stage>
  ),
};

/** Live toggle with a click log. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();
    const [isPip, setIsPip] = useState(false);
    const [disabled, setDisabled] = useState(false);

    return (
      <Stage
        title="Playground"
        description="In the player, leaving PiP can also be triggered from the OS window itself, so the state has to come from the pagehide/leavepictureinpicture events rather than from this click alone."
        aside={
          <div className="flex flex-col gap-4">
            <Panel title="Controls">
              <Toggle label="In Picture-in-Picture" checked={isPip} onChange={setIsPip} />
              <Toggle label="Disabled" checked={disabled} onChange={setDisabled} />
            </Panel>
            <StateInspector
              state={{ isPictureInPicture: isPip, disabled }}
              highlight={['isPictureInPicture']}
            />
            <EventLog entries={entries} onClear={clear} counts={counts} height={160} />
          </div>
        }
      >
        <PictureInPictureButton
          isPictureInPicture={isPip}
          disabled={disabled}
          onClick={() => {
            log('click', `→ ${!isPip}`);
            setIsPip((v) => !v);
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
      title="With usePictureInPicture"
      code={`import { PictureInPictureButton, usePictureInPicture } from '@fairu/player';

function Controls({ videoRef }) {
  const { isPictureInPicture, togglePictureInPicture, isSupported } =
    usePictureInPicture(videoRef);

  if (!isSupported) return null;

  return (
    <PictureInPictureButton
      isPictureInPicture={isPictureInPicture}
      onClick={togglePictureInPicture}
    />
  );
}`}
    />
  ),
};
