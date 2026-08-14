import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { FullscreenButton } from './FullscreenButton';
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

const meta: Meta<typeof FullscreenButton> = {
  title: 'Controls/FullscreenButton',
  component: FullscreenButton,
  tags: ['autodocs'],
  argTypes: {
    isFullscreen: { control: 'boolean' },
    disabled: { control: 'boolean' },
    onClick: { table: { disable: true } },
    labels: { table: { disable: true } },
  },
  args: { isFullscreen: false },
};

export default meta;
type Story = StoryObj<typeof FullscreenButton>;

const STATES = [
  { label: 'Windowed', props: { isFullscreen: false } },
  { label: 'Fullscreen', props: { isFullscreen: true } },
  { label: 'Disabled', props: { isFullscreen: false, disabled: true } },
];

/** Both states plus the unavailable case. */
export const AllStates: Story = {
  render: () => (
    <Stage
      title="Every state"
      description="The glyph shows the action, not the state: arrows point outward to mean 'expand' while windowed, and inward to mean 'collapse' while fullscreen."
      aside={
        <Note>
          Disabled is a real case, not a theoretical one — the Fullscreen API is unavailable in
          some embedded webviews, and on iPhone it is unavailable for <code>&lt;video&gt;</code>{' '}
          outside the native player. The button is hidden or disabled rather than left to fail
          silently on click.
        </Note>
      }
    >
      <Matrix
        items={STATES}
        columns={STATES.length}
        onVideo
        label={(item) => item.label}
        render={(item) => <FullscreenButton {...item.props} />}
      />
    </Stage>
  ),
};

/** Live toggle with a click log. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [disabled, setDisabled] = useState(false);

    return (
      <Stage
        title="Playground"
        description="Toggling here only flips the prop. In the player the same click calls requestFullscreen(), which needs a user gesture — which is why this is a button and never an automatic call."
        aside={
          <div className="flex flex-col gap-4">
            <Panel title="Controls">
              <Toggle label="Fullscreen" checked={isFullscreen} onChange={setIsFullscreen} />
              <Toggle label="Disabled" checked={disabled} onChange={setDisabled} />
            </Panel>
            <StateInspector state={{ isFullscreen, disabled }} highlight={['isFullscreen']} />
            <EventLog entries={entries} onClear={clear} counts={counts} height={160} />
          </div>
        }
      >
        <FullscreenButton
          isFullscreen={isFullscreen}
          disabled={disabled}
          onClick={() => {
            log('click', `→ ${!isFullscreen}`);
            setIsFullscreen((v) => !v);
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
      title="With useFullscreen"
      code={`import { FullscreenButton, useFullscreen } from '@fairu/player';

function Controls({ containerRef }) {
  const { isFullscreen, toggleFullscreen, isSupported } = useFullscreen(containerRef);

  // Hide rather than disable when the API is missing entirely: a control that
  // can never work is noise.
  if (!isSupported) return null;

  return (
    <FullscreenButton
      isFullscreen={isFullscreen}
      onClick={() => toggleFullscreen()}
    />
  );
}`}
    />
  ),
};
