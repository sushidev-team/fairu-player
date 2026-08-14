import type { Meta, StoryObj } from '@storybook/react';
import { CompanionAd } from './CompanionAd';
import type { CompanionCapableAd } from './CompanionAd';
import { AdSkipButton } from '../AdSkipButton';
import {
  EventLog,
  Note,
  Snippet,
  Stage,
  Viewport,
  useEventLog,
} from '@/stories/preview-kit';

const COVER = 'https://placehold.co/600x600/1e293b/94a3b8/png?text=Episode+Cover';
const BANNER = 'https://placehold.co/600x600/312e81/c7d2fe/png?text=Companion';

const WITH_COMPANION: CompanionCapableAd = {
  id: 'ad-1',
  title: 'Beispielkampagne',
  companion: {
    imageUrl: BANNER,
    clickUrl: 'https://example.test/landing',
    width: 600,
    height: 600,
    clickTrackingUrls: ['https://example.test/track/click'],
  },
};

const WITHOUT_COMPANION: CompanionCapableAd = {
  id: 'ad-2',
  title: 'Kampagne ohne Companion',
};

const meta: Meta<typeof CompanionAd> = {
  title: 'Ads/CompanionAd',
  component: CompanionAd,
  tags: ['autodocs'],
  argTypes: {
    ad: { table: { disable: true } },
    onClick: { table: { disable: true } },
    children: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof CompanionAd>;

/** The creative the advertiser supplied. */
export const WithCompanion: Story = {
  args: { ad: WITH_COMPANION, fallbackArtwork: COVER },
  render: (args) => (
    <Stage
      title="Companion creative"
      description="In an audio player this is the only visual an advertiser gets. Beside a video it is separately sold inventory that survives a muted autoplay, which is why it is worth rendering properly rather than as an afterthought."
      aside={
        <Note>
          The click sends the VAST <code>CompanionClickTracking</code> pixels before navigating.
          Firing them after the navigation loses the ones the browser cancels on unload.
        </Note>
      }
    >
      <Viewport width={360}>
        <CompanionAd {...args} />
      </Viewport>
    </Stage>
  ),
};

/** No companion on the creative — the common case. */
export const FallsBackToArtwork: Story = {
  args: { ad: WITHOUT_COMPANION, fallbackArtwork: COVER, fallbackAlt: 'Episode cover' },
  render: (args) => (
    <Stage
      title="Fallback to the cover"
      description="Most VAST creatives carry no companion at all. The slot shows the episode artwork instead of collapsing, so the layout does not jump the moment an ad starts."
      aside={
        <Note tone="warn">
          A collapsing slot is worse than a boring one: it reflows everything below it twice per ad
          break, once in and once out.
        </Note>
      }
    >
      <Viewport width={360}>
        <CompanionAd {...args} />
      </Viewport>
    </Stage>
  ),
};

/** With a control layered over it. */
export const WithOverlaidControl: Story = {
  render: () => (
    <Stage
      title="With a skip control"
      description="Children render over the artwork. In the audio player that is where the skip button lives during a break, since there is no video surface to put it on."
    >
      <Viewport width={360}>
        <CompanionAd ad={WITH_COMPANION} fallbackArtwork={COVER}>
          <div className="flex h-full w-full items-end justify-end p-3">
            <AdSkipButton canSkip countdown={0} />
          </div>
        </CompanionAd>
      </Viewport>
    </Stage>
  ),
};

/** Click handling. */
export const Playground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();

    return (
      <Stage
        title="Click tracking"
        description="onClick runs after the pixels have been queued, so a handler here can safely assume the advertiser has been billed for the click."
        aside={<EventLog entries={entries} onClear={clear} counts={counts} height={220} />}
      >
        <Viewport width={360}>
          <CompanionAd
            ad={WITH_COMPANION}
            fallbackArtwork={COVER}
            onClick={(ad) => log('onClick', ad.id, 'ad')}
          />
        </Viewport>
      </Stage>
    );
  },
};

/** Placing it in an audio player. */
export const Usage: Story = {
  render: () => (
    <Snippet
      title="In the cover slot"
      code={`import { CompanionAd, useAds, usePlayer } from '@fairu/player';

function CoverSlot() {
  const { state } = useAds();
  const { playlistState } = usePlayer();
  const cover = playlistState.currentTrack?.artwork;

  // Outside an ad break the slot is just the cover.
  if (!state.currentAd) return <img src={cover} alt="" />;

  return <CompanionAd ad={state.currentAd} fallbackArtwork={cover} />;
}`}
    />
  ),
};
