import type { Meta, StoryObj } from '@storybook/react';
import { AdChoicesIcon } from './AdChoicesIcon';
import type { VastIcon } from '@/types/vast';
import { Matrix, Note, Snippet, Stage, Viewport } from '@/stories/preview-kit';

const ADCHOICES: VastIcon = {
  program: 'AdChoices',
  width: 16,
  height: 16,
  xPosition: 'right',
  yPosition: 'top',
  staticResource: 'https://placehold.co/32x32/ffffff/1e293b/png?text=i',
  staticResourceType: 'image/png',
  clickThroughUrl: 'https://example.test/privacy',
  clickTrackingUrls: ['https://example.test/track/icon-click'],
  viewTrackingUrls: ['https://example.test/track/icon-view'],
};

const OTHER_ICON: VastIcon = {
  program: 'SomethingElse',
  staticResource: 'https://placehold.co/32x32/ef4444/ffffff/png?text=X',
  clickTrackingUrls: [],
  viewTrackingUrls: [],
};

const meta: Meta<typeof AdChoicesIcon> = {
  title: 'Ads/AdChoicesIcon',
  component: AdChoicesIcon,
  tags: ['autodocs'],
  argTypes: {
    size: { control: { type: 'number', min: 12, max: 48 } },
    icons: { table: { disable: true } },
  },
  args: { icons: [ADCHOICES], adId: 'ad-1', size: 16 },
};

export default meta;
type Story = StoryObj<typeof AdChoicesIcon>;

/** The badge as it ships. */
export const Default: Story = {
  render: (args) => (
    <Stage
      title="The AdChoices badge"
      description="Not decoration. EU rules require advertising to be identifiable, and most demand partners require the badge to be rendered and its view pixel fired — an ad that drops it can be rejected."
      aside={
        <Note>
          The view pixel fires once per ad, keyed on <code>adId</code> rather than on the icon URL.
          Two ads in a pod normally carry the identical badge URL and each owes its own{' '}
          <code>IconViewTracking</code>, so the URL cannot be the dedupe key — and object identity
          cannot either, because a parent re-render produces a fresh ad object.
        </Note>
      }
    >
      <Viewport width={320}>
        <AdChoicesIcon {...args} />
      </Viewport>
    </Stage>
  ),
};

/** Sizes. */
export const Sizes: Story = {
  render: () => (
    <Stage
      title="Sizes"
      description="VAST icons declare their own width and height, typically 16×16. The size prop overrides that for surfaces where the declared size would be illegible."
    >
      <Matrix
        items={[12, 16, 24, 32]}
        columns={4}
        onVideo
        label={(size) => `${size}px`}
        render={(size) => <AdChoicesIcon icons={[ADCHOICES]} adId={`ad-${size}`} size={size} />}
      />
    </Stage>
  ),
};

/** Nothing to render. */
export const NoAdChoicesIcon: Story = {
  render: () => (
    <Stage
      title="No matching icon"
      description="The component picks the AdChoices entry out of the icon list. A creative with no icons, or only icons for other programs, renders nothing at all."
      aside={
        <Note tone="warn">
          Rendering a placeholder here would be worse than rendering nothing — a privacy badge that
          links nowhere is a compliance claim the ad has not earned.
        </Note>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <span className="text-[11px] uppercase" style={{ color: 'var(--fp-color-text-muted)' }}>
            icons = []
          </span>
          <AdChoicesIcon icons={[]} adId="ad-empty" />
        </div>
        <div>
          <span className="text-[11px] uppercase" style={{ color: 'var(--fp-color-text-muted)' }}>
            icons = [non-AdChoices]
          </span>
          <AdChoicesIcon icons={[OTHER_ICON]} adId="ad-other" />
        </div>
        <div>
          <span className="text-[11px] uppercase" style={{ color: 'var(--fp-color-text-muted)' }}>
            icons = undefined
          </span>
          <AdChoicesIcon adId="ad-undef" />
        </div>
      </div>
    </Stage>
  ),
};

/** Where the icons come from. */
export const Usage: Story = {
  render: () => (
    <Snippet
      title="From the parsed creative"
      code={`import { AdChoicesIcon, useVideoAds } from '@fairu/player';

function AdBadge() {
  const { state } = useVideoAds();
  if (!state.currentAd) return null;

  // \`icons\` is parsed straight out of the VAST <Icons> node.
  return <AdChoicesIcon icons={state.currentAd.icons} adId={state.currentAd.id} />;
}`}
    />
  ),
};
