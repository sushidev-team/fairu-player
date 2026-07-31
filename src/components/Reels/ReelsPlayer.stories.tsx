import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useMemo, useState } from 'react';
import { ReelsPlayer } from './ReelsPlayer';
import { parseVast } from '@/utils/vast/parseVast';
import { vastAdToReelAd } from '@/utils/vast/toReelAd';
import type { Reel, ReelAd, ReelsAdConfig, ReelSlide } from '@/types/reels';
import { SAMPLE_VIDEOS, VIDEO_POOL, avatar, poster } from '@/stories/fixtures';
import {
  Button,
  EventLog,
  Note,
  Panel,
  PhoneFrame,
  Range,
  Snippet,
  Stage,
  StateInspector,
  Toggle,
  useEventLog,
} from '@/stories/preview-kit';

/* -------------------------------------------------------------------------- */
/*                                  Fixtures                                  */
/* -------------------------------------------------------------------------- */

/**
 * Demo clips from `@/stories/fixtures`.
 *
 * They are landscape, which is deliberate — `object-cover` cropping to 9:16 is
 * exactly what a real feed does with a mis-sized upload, so the preview shows
 * the honest result.
 */
const CLIPS = VIDEO_POOL;

const CAPTIONS = [
  'Wie wir den Player in 4 Wochen von 0 auf 1.2 gebracht haben 🚀 #devlog',
  'Der HLS-Trick, den niemand erklärt — Adaptive Bitrate in 60 Sekunden',
  'POV: du debuggst Autoplay-Policies um 2 Uhr nachts und es funktioniert plötzlich',
  'Drei Zeilen CSS, die deinen Vertical Feed sofort besser aussehen lassen',
  'Warum wir scroll-snap rausgeworfen und durch translate3d ersetzt haben',
  'VAST in 90 Sekunden erklärt — Wrapper, Pods und warum Impressions doppelt zählen',
  'Ein Decoder pro Video: warum iOS Safari nach 6 Reels aufgibt',
  'Vom Podcast-Player zum Short-Form-Feed — unsere Architektur',
  'Quartile-Tracking richtig machen (und die Fehler, die alle machen)',
  'Skip-Buttons: 5 Sekunden oder gar nicht?',
  'So testest du Ad-Integrationen ohne echten Ad Server',
  'Der Unterschied zwischen VAST, VPAID und VMAP — endlich verständlich',
];

const AUTHORS = [
  { name: '@fairu.dev', avatar: avatar(12), verified: true },
  { name: '@sushidev', avatar: avatar(32), verified: true },
  { name: '@videoengineering', avatar: avatar(45) },
  { name: '@adtech.weekly', avatar: avatar(58), verified: false },
];

const SOUNDS = [
  { title: 'Original audio', artist: 'fairu.dev' },
  { title: 'Lo-fi Beat #4', artist: 'Studio Session' },
  { title: 'Ambient Drift', artist: 'Nightcall' },
  { title: 'Original audio', artist: 'sushidev' },
];

/** Deterministic pseudo-random so previews look identical on every reload. */
function seeded(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function makeReels(count: number, offset = 0): Reel[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + offset;
    const rand = seeded(n + 1);

    return {
      id: `reel-${n + 1}`,
      src: CLIPS[n % CLIPS.length],
      poster: poster(`reel-${n}`),
      caption: CAPTIONS[n % CAPTIONS.length],
      author: AUTHORS[n % AUTHORS.length],
      audio: SOUNDS[n % SOUNDS.length],
      stats: {
        likes: Math.round(1_200 + rand * 480_000),
        comments: Math.round(40 + rand * 9_000),
        shares: Math.round(10 + rand * 3_400),
        views: Math.round(20_000 + rand * 2_400_000),
      },
      ...(n % 5 === 3
        ? { cta: { label: 'Zum Blogpost', url: 'https://example.com/blog' } }
        : {}),
    } satisfies Reel;
  });
}

const REELS = makeReels(12);

/* -------------------------------------------------------------------------- */
/*                                  Ad fixtures                               */
/* -------------------------------------------------------------------------- */

/**
 * A complete VAST 4.2 document served inline.
 *
 * Inline XML is the only way to demo a VAST integration without a live ad
 * server — it exercises the exact same parse → select media file → track
 * pipeline as a real tag URL, minus the network.
 */
function inlineVast(options: {
  id: string;
  title: string;
  advertiser: string;
  clip: string;
  duration: string;
  skipOffset?: string;
}): string {
  const skip = options.skipOffset ? ` skipoffset="${options.skipOffset}"` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="4.2">
  <Ad id="${options.id}">
    <InLine>
      <AdSystem version="1.0">Fairu Storybook</AdSystem>
      <AdTitle>${options.title}</AdTitle>
      <Description>Demo-Creative aus dem Storybook — kein echter Ad Server im Spiel.</Description>
      <Advertiser>${options.advertiser}</Advertiser>
      <Pricing model="CPM" currency="EUR">6.20</Pricing>
      <Impression><![CDATA[https://tracking.invalid/imp?cb=[CACHEBUSTING]&ph=[ADPLAYHEAD]]]></Impression>
      <Error><![CDATA[https://tracking.invalid/error?code=[ERRORCODE]]]></Error>
      <ViewableImpression>
        <Viewable><![CDATA[https://tracking.invalid/viewable]]></Viewable>
      </ViewableImpression>
      <Creatives>
        <Creative id="${options.id}-c1" sequence="1">
          <Linear${skip}>
            <Duration>${options.duration}</Duration>
            <TrackingEvents>
              <Tracking event="creativeView"><![CDATA[https://tracking.invalid/creativeView]]></Tracking>
              <Tracking event="start"><![CDATA[https://tracking.invalid/start]]></Tracking>
              <Tracking event="firstQuartile"><![CDATA[https://tracking.invalid/q1]]></Tracking>
              <Tracking event="midpoint"><![CDATA[https://tracking.invalid/q2]]></Tracking>
              <Tracking event="thirdQuartile"><![CDATA[https://tracking.invalid/q3]]></Tracking>
              <Tracking event="complete"><![CDATA[https://tracking.invalid/complete]]></Tracking>
              <Tracking event="skip"><![CDATA[https://tracking.invalid/skip]]></Tracking>
              <Tracking event="mute"><![CDATA[https://tracking.invalid/mute]]></Tracking>
              <Tracking event="unmute"><![CDATA[https://tracking.invalid/unmute]]></Tracking>
              <Tracking event="progress" offset="00:00:03"><![CDATA[https://tracking.invalid/p3]]></Tracking>
              <Tracking event="progress" offset="75%"><![CDATA[https://tracking.invalid/p75pct]]></Tracking>
            </TrackingEvents>
            <VideoClicks>
              <ClickThrough><![CDATA[https://example.com/landing?utm_source=reels]]></ClickThrough>
              <ClickTracking><![CDATA[https://tracking.invalid/click]]></ClickTracking>
            </VideoClicks>
            <MediaFiles>
              <MediaFile delivery="progressive" type="video/mp4" bitrate="500" width="480" height="854">
                <![CDATA[${options.clip}]]>
              </MediaFile>
              <MediaFile delivery="progressive" type="video/mp4" bitrate="1600" width="720" height="1280">
                <![CDATA[${options.clip}]]>
              </MediaFile>
              <MediaFile delivery="progressive" type="application/javascript" apiFramework="VPAID" bitrate="0">
                <![CDATA[https://tracking.invalid/should-never-be-selected.js]]>
              </MediaFile>
            </MediaFiles>
            <Icons>
              <Icon program="AdChoices" width="16" height="16" xPosition="right" yPosition="top">
                <StaticResource creativeType="image/svg+xml">
                  <![CDATA[data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='7' fill='%23000'/><text x='8' y='12' font-size='11' fill='%23fff' text-anchor='middle'>i</text></svg>]]>
                </StaticResource>
                <IconClicks>
                  <IconClickThrough><![CDATA[https://example.com/privacy]]></IconClickThrough>
                </IconClicks>
              </Icon>
            </Icons>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`;
}

const SKIPPABLE_VAST = inlineVast({
  id: 'fairu-demo-skippable',
  title: 'Acme Cloud — jetzt 3 Monate gratis',
  advertiser: 'Acme Cloud',
  clip: SAMPLE_VIDEOS.bigBuckBunny,
  duration: '00:00:10',
  skipOffset: '00:00:05',
});

const BUMPER_VAST = inlineVast({
  id: 'fairu-demo-bumper',
  title: 'Nordwind Kaffee',
  advertiser: 'Nordwind',
  clip: SAMPLE_VIDEOS.jellyfish,
  duration: '00:00:10',
});

/**
 * A VMAP document that describes *placement only* — where ads go, with the
 * creatives supplied inline per break.
 */
const VMAP = `<?xml version="1.0" encoding="UTF-8"?>
<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
  <vmap:AdBreak timeOffset="position:3" breakType="linear" breakId="feed-slot-1">
    <vmap:AdSource id="src-1" allowMultipleAds="false" followRedirects="true">
      <vmap:VASTAdData>${SKIPPABLE_VAST.replace(/<\?xml[^>]*\?>/, '')}</vmap:VASTAdData>
    </vmap:AdSource>
  </vmap:AdBreak>
  <vmap:AdBreak timeOffset="position:7" breakType="linear" breakId="feed-slot-2">
    <vmap:AdSource id="src-2" allowMultipleAds="false" followRedirects="true">
      <vmap:VASTAdData>${BUMPER_VAST.replace(/<\?xml[^>]*\?>/, '')}</vmap:VASTAdData>
    </vmap:AdSource>
  </vmap:AdBreak>
  <vmap:AdBreak timeOffset="50%" breakType="display" breakId="ignored-display-break">
    <vmap:AdSource><vmap:AdTagURI><![CDATA[https://tracking.invalid/display]]></vmap:AdTagURI></vmap:AdSource>
  </vmap:AdBreak>
</vmap:VMAP>`;

/**
 * Parse an inline VAST document into a {@link ReelAd} once, at module load.
 *
 * The player does this itself for `tagUrl` / `vastXml` slots. Pre-resolving here
 * keeps every preview free of network access, and proves the parser and the
 * media-file selector work on a realistic document.
 */
function buildAdFromXml(xml: string): ReelAd {
  return vastAdToReelAd(parseVast(xml).ads[0], {
    mediaFileOptions: { height: 1280, pixelRatio: 1, maxBitrate: 3000 },
    defaultSkipOffset: 5,
  });
}

const SKIPPABLE_AD = buildAdFromXml(SKIPPABLE_VAST);
const BUMPER_AD = buildAdFromXml(BUMPER_VAST);

/** Pre-resolved house ads — no VAST pipeline at all. */
const HOUSE_ADS: ReelAd[] = [
  {
    id: 'house-1',
    src: SAMPLE_VIDEOS.friday,
    duration: 6,
    skipOffset: 3,
    title: 'Fairu Player 1.2 ist da',
    advertiser: 'Fairu',
    description: 'Reels, VAST-Ads und Cast-Support in einem Paket.',
    ctaLabel: 'Changelog lesen',
    clickThroughUrl: 'https://github.com/sushidev-team/fairu-player/releases',
  },
  {
    id: 'house-2',
    src: SAMPLE_VIDEOS.flower,
    duration: 5,
    skipOffset: null,
    title: 'Wir suchen Video-Engineers',
    advertiser: 'sushidev',
    description: 'Remote, Wien oder hybrid.',
    ctaLabel: 'Jobs ansehen',
    clickThroughUrl: 'https://example.com/jobs',
  },
];

/* -------------------------------------------------------------------------- */
/*                                    Meta                                    */
/* -------------------------------------------------------------------------- */

const meta: Meta<typeof ReelsPlayer> = {
  title: 'Reels/ReelsPlayer',
  component: ReelsPlayer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
A vertical short-form feed — the YouTube Shorts / Instagram Reels interaction model.

**Navigation:** swipe, mouse wheel, arrow keys, \`Home\`/\`End\`, or the on-screen chevrons.
**Playback:** tap to pause, press and hold to pause, double-tap to like, \`m\` to mute.

Only the active slide plays and only \`windowSize\` neighbours are mounted — mobile
Safari caps concurrent media elements, so an unbounded feed stops playing after a
handful of swipes.

Ads are real VAST: the same parse → media-file selection → quartile-tracking
pipeline that a live ad server would drive.
        `.trim(),
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ReelsPlayer>;

/* -------------------------------------------------------------------------- */
/*                                   Stories                                  */
/* -------------------------------------------------------------------------- */

/** The plain feed: 12 reels, no ads. */
export const Default: Story = {
  render: () => (
    <Stage
      title="Vertical feed"
      description="Swipe, scroll or use the arrow keys. Tap to pause, hold to pause, double-tap to like. Audio starts muted because no browser allows unmuted autoplay without a gesture."
      aside={
        <>
          <Note tone="tip">
            Press <kbd>m</kbd> to unmute, <kbd>space</kbd> to pause, <kbd>Home</kbd>/<kbd>End</kbd>{' '}
            to jump to the ends.
          </Note>
          <Snippet
            code={`import { ReelsPlayer } from '@fairu/player';

<ReelsPlayer reels={reels} />`}
          />
        </>
      }
    >
      <PhoneFrame label="Reels feed">
        <ReelsPlayer reels={REELS} config={{ layout: 'fill', features: { counter: true } }} />
      </PhoneFrame>
    </Stage>
  ),
};

/**
 * Every callback wired to a live console, so you can watch the feed emit
 * `onReelChange`, `onReelComplete`, likes and mute changes in real time.
 */
export const WithEventLog: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();
    const [active, setActive] = useState<{ index: number; kind: string }>({
      index: 0,
      kind: 'content',
    });

    return (
      <Stage
        title="Instrumented feed"
        description="Every ReelsPlayer callback is piped into the console on the right."
        aside={
          <>
            <StateInspector
              state={{
                activeIndex: active.index,
                slideKind: active.kind,
                reels: REELS.length,
              }}
              highlight={['activeIndex']}
            />
            <EventLog entries={entries} counts={counts} onClear={clear} />
          </>
        }
      >
        <PhoneFrame>
          <ReelsPlayer
            reels={REELS}
            config={{
              layout: 'fill',
               features: { counter: true } }}
            onSlideChange={(slide: ReelSlide, index: number) => {
              setActive({ index, kind: slide.kind });
              log('onSlideChange', `#${index} (${slide.kind})`);
            }}
            onReelChange={(reel, contentIndex) =>
              log('onReelChange', `${reel.id} · content #${contentIndex}`)
            }
            onReelComplete={(reel) => log('onReelComplete', reel.id, 'success')}
            onLike={(reel, liked) =>
              log('onLike', `${reel.id} → ${liked}`, liked ? 'success' : 'info')
            }
            onSave={(reel, saved) => log('onSave', `${reel.id} → ${saved}`)}
            onFollow={(reel, following) => log('onFollow', `${reel.author?.name} → ${following}`)}
            onComment={(reel) => log('onComment', reel.id)}
            onShare={(reel) => log('onShare', reel.id)}
            onCtaClick={(reel) => log('onCtaClick', reel.cta?.url ?? reel.id)}
            onMuteChange={(muted) => log('onMuteChange', String(muted))}
            onError={(error) => log('onError', error.message, 'error')}
          />
        </PhoneFrame>
      </Stage>
    );
  },
};

/**
 * The main ad story: skippable VAST creatives every 3 reels, with every
 * tracking beacon surfaced.
 */
export const WithVastAdReels: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog(120);

    const adConfig = useMemo<ReelsAdConfig>(
      () => ({
        enabled: true,
        frequency: 3,
        startAfter: 2,
        defaultSkipOffset: 5,
        prefetch: 1,
        // Two creatives, cycled across the slots. A production feed would set
        // `tagUrl` instead and let the exchange decide per slot.
        ads: [SKIPPABLE_AD, BUMPER_AD],
        onSlotFilled: (slot, ads) =>
          log('slot:filled', `${slot.id} → ${ads.length} ad(s): ${ads[0]?.title}`, 'ad'),
        onSlotEmpty: (slot) => log('slot:empty', slot.id, 'warn'),
        onSlotError: (slot, error) => log('slot:error', `${slot.id}: ${error.message}`, 'error'),
        onAdStart: (ad) => log('ad:start', `${ad.title} (${ad.duration}s)`, 'ad'),
        onAdComplete: (ad) => log('ad:complete', ad.title ?? ad.id, 'success'),
        onAdSkip: (ad, _slot, atTime) =>
          log('ad:skip', `${ad.title} at ${atTime.toFixed(1)}s`, 'warn'),
        onAdClick: (ad) => log('ad:click', ad.clickThroughUrl ?? ad.id, 'ad'),
        onAdError: (error) => log('ad:error', error.message, 'error'),
      }),
      [log]
    );

    return (
      <Stage
        title="VAST ad reels"
        description="An ad slide appears after reel 2, then every 3 reels. The creative is a real VAST 4.2 document parsed by the player — including skipoffset, quartile tracking, AdChoices icon and click-through."
        aside={
          <>
            <Note>
              Tracking pixels point at <code>tracking.invalid</code>, so the requests fail
              harmlessly. The console shows what <em>would</em> be sent, in order.
            </Note>
            <EventLog entries={entries} counts={counts} onClear={clear} height={320} />
            <Snippet
              code={`<ReelsPlayer
  reels={reels}
  config={{
    ads: {
      enabled: true,
      frequency: 3,
      startAfter: 2,
      defaultSkipOffset: 5,
      tagUrl: 'https://ads.example.com/vast?cb=[CACHEBUSTING]',
    },
  }}
/>`}
            />
          </>
        }
      >
        <PhoneFrame>
          <ReelsPlayer
            reels={REELS}
            config={{
              layout: 'fill',
               features: { counter: true }, ads: adConfig }}
          />
        </PhoneFrame>
      </Stage>
    );
  },
};

/** Placement driven by a VMAP 1.0 document instead of a frequency rule. */
export const VmapDrivenPlacement: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog(80);

    return (
      <Stage
        title="VMAP placement"
        description="The VMAP declares breaks at position:3 and position:7 plus one display break. The display break is ignored — there is nowhere to render a banner in a full-bleed vertical feed."
        aside={
          <>
            <Note>
              Ad slides land at index 2 and index 7 of the <em>content</em> stream, exactly where the
              VMAP asked for them.
            </Note>
            <EventLog entries={entries} counts={counts} onClear={clear} />
            <Snippet
              language="xml"
              title="VMAP"
              code={`<vmap:VMAP version="1.0">
  <vmap:AdBreak timeOffset="position:3" breakType="linear" breakId="feed-slot-1">
    <vmap:AdSource>
      <vmap:VASTAdData><VAST version="4.2">…</VAST></vmap:VASTAdData>
    </vmap:AdSource>
  </vmap:AdBreak>
  <vmap:AdBreak timeOffset="position:7" breakType="linear" breakId="feed-slot-2">…</vmap:AdBreak>
  <!-- ignored: no place for a banner in a vertical feed -->
  <vmap:AdBreak timeOffset="50%" breakType="display">…</vmap:AdBreak>
</vmap:VMAP>`}
            />
          </>
        }
      >
        <PhoneFrame>
          <ReelsPlayer
            reels={REELS}
            config={{
              layout: 'fill',
              
              features: { counter: true },
              ads: {
                enabled: true,
                vmapXml: VMAP,
                defaultSkipOffset: 5,
                onSlotFilled: (slot, ads) =>
                  log('slot:filled', `${slot.vmapBreakId} → ${ads[0]?.title}`, 'ad'),
                onSlotEmpty: (slot) => log('slot:empty', slot.vmapBreakId ?? slot.id, 'warn'),
                onAdStart: (ad) => log('ad:start', ad.title ?? ad.id, 'ad'),
                onAdComplete: (ad) => log('ad:complete', ad.title ?? ad.id, 'success'),
                onAdSkip: (ad) => log('ad:skip', ad.title ?? ad.id, 'warn'),
              },
            }}
          />
        </PhoneFrame>
      </Stage>
    );
  },
};

/** Pre-resolved house ads, one of them non-skippable. */
export const HouseAdsWithoutVast: Story = {
  render: () => (
    <Stage
      title="House ads"
      description="A ReelAd can be supplied directly, bypassing the VAST pipeline entirely. Useful for self-promotion, offline builds and tests. The second house ad has skipOffset: null and is therefore non-skippable."
      aside={
        <Snippet
          code={`const houseAds: ReelAd[] = [
  {
    id: 'house-1',
    src: '/promo.mp4',
    duration: 15,
    skipOffset: 3,          // skippable after 3s
    title: 'Fairu Player 1.2 ist da',
    advertiser: 'Fairu',
    ctaLabel: 'Changelog lesen',
    clickThroughUrl: 'https://…',
  },
  { id: 'house-2', /* … */ skipOffset: null },  // non-skippable
];

<ReelsPlayer
  reels={reels}
  config={{ ads: { enabled: true, frequency: 3, startAfter: 1, ads: houseAds } }}
/>`}
        />
      }
    >
      <PhoneFrame>
        <ReelsPlayer
          reels={REELS}
          config={{
            layout: 'fill',
            features: { counter: true },
            ads: { enabled: true, frequency: 3, startAfter: 1, ads: HOUSE_ADS },
          }}
        />
      </PhoneFrame>
    </Stage>
  ),
};

/** Ad pacing knobs, live. */
export const AdPacingPlayground: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog(80);

    const [frequency, setFrequency] = useState(3);
    const [startAfter, setStartAfter] = useState(2);
    const [maxAds, setMaxAds] = useState(3);
    const [minGap, setMinGap] = useState(0);
    const [skipOffset, setSkipOffset] = useState(5);
    const [gated, setGated] = useState(false);

    // Remounting on a config change is intentional: pacing is a session
    // property, so a new setting means a new session.
    const key = `${frequency}-${startAfter}-${maxAds}-${minGap}-${skipOffset}-${gated}`;

    return (
      <Stage
        title="Ad pacing playground"
        description="Change the pacing rules and watch which slots fill and which get burned. A capped slot is not removed from the feed — it resolves to `empty` and the player scrolls straight through it, exactly like an unfilled auction."
        aside={
          <>
            <Panel title="Placement">
              <Range
                label="frequency"
                value={frequency}
                min={1}
                max={8}
                onChange={setFrequency}
                format={(v) => `every ${v} reels`}
              />
              <Range
                label="startAfter"
                value={startAfter}
                min={0}
                max={6}
                onChange={setStartAfter}
                format={(v) => (v === 0 ? 'pre-roll' : `after ${v}`)}
              />
            </Panel>

            <Panel title="Capping">
              <Range
                label="maxAdsPerSession"
                value={maxAds}
                min={1}
                max={10}
                onChange={setMaxAds}
              />
              <Range
                label="minSecondsBetweenAds"
                value={minGap}
                min={0}
                max={120}
                step={10}
                onChange={setMinGap}
                format={(v) => (v === 0 ? 'off' : `${v}s`)}
              />
            </Panel>

            <Panel title="Playback">
              <Range
                label="defaultSkipOffset"
                value={skipOffset}
                min={0}
                max={15}
                onChange={setSkipOffset}
                format={(v) => `${v}s`}
              />
              <Toggle
                label="blockAdvanceUntilComplete"
                checked={gated}
                onChange={setGated}
                hint="Off by default — blocking hurts retention"
              />
            </Panel>

            <EventLog entries={entries} counts={counts} onClear={clear} height={200} />
          </>
        }
      >
        <PhoneFrame key={key}>
          <ReelsPlayer
            reels={REELS}
            config={{
              layout: 'fill',
              
              features: { counter: true },
              ads: {
                enabled: true,
                frequency,
                startAfter,
                maxAdsPerSession: maxAds,
                minSecondsBetweenAds: minGap,
                defaultSkipOffset: skipOffset,
                blockAdvanceUntilComplete: gated,
                ads: [SKIPPABLE_AD, BUMPER_AD],
                onSlotFilled: (slot) => log('slot:filled', slot.id, 'ad'),
                onSlotEmpty: (slot) => log('slot:empty', `${slot.id} — capped or dry`, 'warn'),
                onAdStart: (ad) => log('ad:start', ad.title ?? ad.id, 'ad'),
                onAdComplete: (ad) => log('ad:complete', ad.title ?? ad.id, 'success'),
                onAdSkip: (ad, _s, at) => log('ad:skip', `${ad.id} @ ${at.toFixed(1)}s`, 'warn'),
              },
            }}
          />
        </PhoneFrame>
      </Stage>
    );
  },
};

/** Infinite feed with a paged loader. */
export const InfiniteFeed: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();
    const [reels, setReels] = useState(() => makeReels(5));
    const [pages, setPages] = useState(1);

    const loadMore = useCallback(async () => {
      log('onLoadMore', `page ${pages + 1} requested`);
      // Simulate a paged API.
      await new Promise((resolve) => setTimeout(resolve, 700));
      setReels((prev) => [...prev, ...makeReels(5, prev.length)]);
      setPages((p) => p + 1);
      log('onLoadMore', `page ${pages + 1} appended`, 'success');
    }, [log, pages]);

    return (
      <Stage
        title="Infinite feed"
        description="onLoadMore fires when fewer than loadMoreThreshold content reels remain ahead. Slide keys stay stable as pages arrive, so appending never jumps the viewer."
        aside={
          <>
            <StateInspector
              state={{ reels: reels.length, pages, threshold: 3 }}
              highlight={['reels']}
            />
            <EventLog entries={entries} counts={counts} onClear={clear} />
          </>
        }
      >
        <PhoneFrame>
          <ReelsPlayer
            reels={reels}
            config={{
              layout: 'fill',
               loadMoreThreshold: 3, features: { counter: true } }}
            onLoadMore={loadMore}
            onReelChange={(reel, index) => log('onReelChange', `${reel.id} @ ${index}`)}
          />
        </PhoneFrame>
      </Stage>
    );
  },
};

/** Every overlay feature toggled independently. */
export const FeatureToggles: Story = {
  render: function Render() {
    const [features, setFeatures] = useState({
      progressBar: true,
      scrubbing: true,
      actionRail: true,
      like: true,
      comment: true,
      share: true,
      save: true,
      follow: true,
      muteToggle: true,
      caption: true,
      audioTicker: true,
      doubleTapLike: true,
      holdToPause: true,
      counter: true,
      navArrows: true,
    });

    const set = (key: keyof typeof features) => (value: boolean) =>
      setFeatures((prev) => ({ ...prev, [key]: value }));

    return (
      <Stage
        title="Feature toggles"
        description="Every overlay affordance can be switched off independently — a licensed-content feed with no download or share, a kiosk feed with no interactions, an ad-only feed with no rail."
        aside={
          <>
            <Panel title="Overlay" meta={`${Object.values(features).filter(Boolean).length}/15`}>
              {(Object.keys(features) as Array<keyof typeof features>).map((key) => (
                <Toggle key={key} label={key} checked={features[key]} onChange={set(key)} />
              ))}
            </Panel>
            <Button
              variant="secondary"
              onClick={() =>
                setFeatures(
                  (prev) =>
                    Object.fromEntries(
                      Object.keys(prev).map((k) => [k, false])
                    ) as typeof features
                )
              }
            >
              Turn everything off
            </Button>
          </>
        }
      >
        <PhoneFrame>
          <ReelsPlayer reels={REELS} config={{ layout: 'fill', features }} />
        </PhoneFrame>
      </Stage>
    );
  },
};

/** Windowing and preload behaviour, made visible. */
export const WindowingAndPreload: Story = {
  render: function Render() {
    const [windowSize, setWindowSize] = useState(1);
    const [preloadCount, setPreloadCount] = useState(1);
    const [activeIndex, setActiveIndex] = useState(0);

    const mounted = useMemo(() => {
      const out: number[] = [];
      for (let o = -windowSize; o <= windowSize; o += 1) {
        const i = activeIndex + o;
        if (i >= 0 && i < REELS.length) out.push(i);
      }
      return out;
    }, [activeIndex, windowSize]);

    return (
      <Stage
        title="Windowing"
        description="Only mounted slides hold a <video> element. Mobile Safari refuses to decode more than a handful at once, so an unbounded feed of mounted videos simply stops playing after a few swipes."
        aside={
          <>
            <Panel title="Tuning">
              <Range
                label="windowSize"
                value={windowSize}
                min={0}
                max={4}
                onChange={setWindowSize}
                format={(v) => `±${v} neighbours`}
              />
              <Range
                label="preloadCount"
                value={preloadCount}
                min={0}
                max={3}
                onChange={setPreloadCount}
                format={(v) => `${v} eager`}
              />
            </Panel>

            <Panel title="Mounted slides" meta={`${mounted.length} of ${REELS.length}`}>
              <div className="flex flex-wrap gap-1">
                {REELS.map((reel, index) => {
                  const isMounted = mounted.includes(index);
                  const isActive = index === activeIndex;
                  return (
                    <span
                      key={reel.id}
                      className="flex h-7 w-7 items-center justify-center rounded text-[11px] tabular-nums"
                      style={{
                        background: isActive
                          ? 'var(--fp-color-accent)'
                          : isMounted
                            ? 'var(--fp-color-surface)'
                            : 'transparent',
                        color: isActive ? '#000' : isMounted ? 'var(--fp-color-text-primary)' : 'var(--fp-color-text-muted)',
                        border: '1px solid var(--fp-border-color)',
                      }}
                      title={isActive ? 'active' : isMounted ? 'mounted' : 'unmounted'}
                    >
                      {index}
                    </span>
                  );
                })}
              </div>
            </Panel>

            <Note tone="warn">
              <code>windowSize: 0</code> mounts only the active slide — the lightest option, but a
              swipe then starts from a cold decoder and shows the poster for a beat.
            </Note>
          </>
        }
      >
        <PhoneFrame key={`${windowSize}-${preloadCount}`}>
          <ReelsPlayer
            reels={REELS}
            config={{
              layout: 'fill',
               windowSize, preloadCount, features: { counter: true } }}
            onSlideChange={(_slide, index) => setActiveIndex(index)}
          />
        </PhoneFrame>
      </Stage>
    );
  },
};

/** A gated, non-skippable ad. */
export const GatedNonSkippableAd: Story = {
  render: function Render() {
    const { entries, log, clear, counts } = useEventLog();

    return (
      <Stage
        title="Gated ad"
        description="With blockAdvanceUntilComplete the viewer cannot swipe past the ad; the drag rubber-bands instead. Combined with skipOffset: null this is the most aggressive configuration the player allows — and the one most likely to cost you session length."
        aside={
          <>
            <Note tone="warn">
              Neither Shorts nor Reels gate their in-feed ads. This exists for contractual cases
              (compliance clips, sponsored mandatory viewing), not for revenue optimisation.
            </Note>
            <EventLog entries={entries} counts={counts} onClear={clear} />
          </>
        }
      >
        <PhoneFrame>
          <ReelsPlayer
            reels={REELS.slice(0, 6)}
            config={{
              layout: 'fill',
              
              features: { counter: true },
              ads: {
                enabled: true,
                frequency: 3,
                startAfter: 1,
                blockAdvanceUntilComplete: true,
                defaultSkipOffset: null,
                ads: [{ ...HOUSE_ADS[1], duration: 5 }],
                onAdStart: (ad) => log('ad:start', `${ad.id} — gated`, 'ad'),
                onAdComplete: (ad) => log('ad:complete', `${ad.id} — gate released`, 'success'),
              },
            }}
          />
        </PhoneFrame>
      </Stage>
    );
  },
};

/**
 * The phone bezel is Storybook decoration, not part of the component.
 *
 * This story shows the feed without it, in the four shapes it actually ships in.
 */
export const WithoutPhoneFrame: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <Stage
      title="No bezel — the four real shapes"
      description="PhoneFrame only exists in these stories. The component itself renders bare. `layout: 'portrait'` (the default) makes the feed own its size; `layout: 'fill'` makes it take the parent's box, which is the escape hatch for full-screen and fixed-height embeds."
      aside={
        <>
          <Note tone="tip">
            Prefer <code>layout: 'fill'</code> over passing sizing classes. In{' '}
            <code>portrait</code> the component emits <code>max-h-[100dvh]</code>, and
            tailwind-merge v2 cannot dedupe that against <code>max-h-none</code> — so the cap
            would survive your override.
          </Note>
          <Snippet
            code={`// 1. Default — card in a normal page, sizes itself
<ReelsPlayer reels={reels} />

// 2. Fixed-width column (Shorts on desktop)
<div className="w-[360px]">
  <ReelsPlayer reels={reels} />
</div>

// 3. Full screen — parent owns the box
<div className="h-dvh w-screen">
  <ReelsPlayer reels={reels} config={{ layout: 'fill' }} />
</div>

// 4. Fixed height, any aspect
<div className="h-[520px] w-full max-w-2xl">
  <ReelsPlayer reels={reels} config={{ layout: 'fill' }} />
</div>`}
          />
        </>
      }
    >
      <div className="flex w-full flex-col gap-8">
        <div className="flex flex-wrap items-start gap-8">
          <div className="flex flex-col items-center gap-2">
            <div className="w-[240px]">
              <ReelsPlayer
                reels={REELS.slice(0, 4)}
                config={{ features: { navArrows: false, counter: true } }}
              />
            </div>
            <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
              1 · default portrait, 240px column
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="w-[360px]">
              <ReelsPlayer
                reels={REELS.slice(0, 4)}
                className="rounded-xl"
                config={{ features: { counter: true } }}
              />
            </div>
            <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
              2 · portrait, 360px column, rounded
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            {/* `fill` + a fixed-height parent: any aspect the host wants. */}
            <div className="h-[420px] w-[520px]">
              <ReelsPlayer
                reels={REELS.slice(0, 4)}
                config={{ layout: 'fill', features: { counter: true } }}
              />
            </div>
            <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
              4 · fill, 520×420 landscape box
            </span>
          </div>
        </div>

        <Note>
          A landscape box crops the portrait video via <code>object-cover</code> rather than
          letterboxing it — the same thing a real feed does with a mis-sized upload. If you need
          the whole frame visible, keep a portrait container.
        </Note>
      </div>
    </Stage>
  ),
};

/**
 * A genuinely full-screen feed. This is the shape a dedicated
 * `/shorts` route would use.
 */
export const FullScreen: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    // `layout: 'fill'` emits no sizing, so the parent's `h-dvh` is uncontested.
    <div className="h-dvh w-full bg-black">
      <ReelsPlayer
        reels={REELS}
        config={{
          layout: 'fill',
          features: { counter: true },
          ads: { enabled: true, frequency: 4, startAfter: 2, ads: [SKIPPABLE_AD, BUMPER_AD] },
        }}
      />
    </div>
  ),
};

/** The bezel without the notch and home indicator, for cleaner screenshots. */
export const FrameWithoutChrome: Story = {
  render: () => (
    <Stage
      title="Bezel without chrome"
      description="If you want the device outline for a screenshot but not the notch, PhoneFrame takes chrome={false}. Purely a Storybook helper — it is not exported from the package."
      layout="columns"
    >
      <div className="flex flex-wrap items-start gap-8">
        <PhoneFrame height={520} chrome label="chrome (default)">
          <ReelsPlayer reels={REELS.slice(0, 3)} config={{ layout: 'fill' }} />
        </PhoneFrame>
        <PhoneFrame height={520} chrome={false} label="chrome={false}">
          <ReelsPlayer reels={REELS.slice(0, 3)} config={{ layout: 'fill' }} />
        </PhoneFrame>
      </div>
    </Stage>
  ),
};

/** Custom overlay slot. */
export const CustomOverlay: Story = {
  render: () => (
    <Stage
      title="Custom overlay"
      description="renderOverlay draws above the active slide only — for debug HUDs, region badges, A/B labels or a house watermark."
      aside={
        <Snippet
          code={`<ReelsPlayer
  reels={reels}
  renderOverlay={(slide, index) => (
    <div className="absolute left-3 top-3 z-40 …">
      {slide.kind === 'ad' ? 'AD SLOT' : \`#\${index}\`}
    </div>
  )}
/>`}
        />
      }
    >
      <PhoneFrame>
        <ReelsPlayer
          reels={REELS}
          config={{ layout: 'fill', ads: { enabled: true, frequency: 3, startAfter: 1, ads: HOUSE_ADS } }}
          renderOverlay={(slide, index) => (
            <div className="pointer-events-none absolute left-3 top-3 z-40 flex flex-col gap-1">
              <span className="rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm">
                slide {index} · {slide.kind}
              </span>
              <span className="rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white/70 backdrop-blur-sm">
                {slide.key}
              </span>
            </div>
          )}
        />
      </PhoneFrame>
    </Stage>
  ),
};

