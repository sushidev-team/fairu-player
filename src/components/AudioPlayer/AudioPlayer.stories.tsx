import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { AudioPlayer } from './AudioPlayer';
import { useVastAdBreaks } from '@/hooks/useVastAdBreaks';
import { audioAdMediaOptions, vastAdsToAudioAds, parseVast } from '@/utils/vast';
import { SAMPLE_AUDIO, poster } from '@/stories/fixtures';
import type { Ad, AdBreak } from '@/types/ads';
import type { Track } from '@/types/player';
import { Note, Panel, Snippet, Stage } from '@/stories/preview-kit';

const meta: Meta<typeof AudioPlayer> = {
  title: 'Components/AudioPlayer',
  component: AudioPlayer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The audio counterpart to \`VideoPlayer\`: composes the providers, drives
pre/mid/post-roll breaks and renders the \`<Companion>\` artwork.

**A note on podcasts.** Most podcast advertising is stitched into the audio
server-side, because listeners are in Apple Podcasts, Spotify or Overcast, which
never run this code. Client-side ads only reach surfaces you own — your embed,
your app, your website.
        `.trim(),
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AudioPlayer>;

/** Public CC0 audio. */
const EPISODE: Track = {
  id: 'ep-1',
  src: SAMPLE_AUDIO.tRex,
  title: 'Warum wir scroll-snap rausgeworfen haben',
  artist: 'Fairu Devcast',
  artwork: poster('devcast-cover', 400, 400),
  duration: 2,
};

/**
 * An audio VAST document. Note the `audio/mpeg` media files and the square
 * `<Companion>` — the two things that separate a podcast spot from a video one.
 */
const AUDIO_VAST = `<VAST version="4.2">
  <Ad id="nordwind-30"><InLine>
    <AdSystem>Fairu Storybook</AdSystem>
    <AdTitle>Nordwind Kaffee</AdTitle>
    <Description>Frisch geröstet, direkt gehandelt.</Description>
    <Advertiser>Nordwind</Advertiser>
    <Impression><![CDATA[https://tracking.invalid/imp?cb=[CACHEBUSTING]]]></Impression>
    <Error><![CDATA[https://tracking.invalid/err?code=[ERRORCODE]]]></Error>
    <Creatives>
      <Creative>
        <Linear skipoffset="00:00:02">
          <Duration>00:00:05</Duration>
          <TrackingEvents>
            <Tracking event="start"><![CDATA[https://tracking.invalid/start]]></Tracking>
            <Tracking event="firstQuartile"><![CDATA[https://tracking.invalid/q1]]></Tracking>
            <Tracking event="midpoint"><![CDATA[https://tracking.invalid/q2]]></Tracking>
            <Tracking event="thirdQuartile"><![CDATA[https://tracking.invalid/q3]]></Tracking>
            <Tracking event="complete"><![CDATA[https://tracking.invalid/complete]]></Tracking>
          </TrackingEvents>
          <VideoClicks>
            <ClickThrough><![CDATA[https://example.com/nordwind]]></ClickThrough>
            <ClickTracking><![CDATA[https://tracking.invalid/click]]></ClickTracking>
          </VideoClicks>
          <MediaFiles>
            <MediaFile type="audio/mpeg" bitrate="128"><![CDATA[${SAMPLE_AUDIO.horse}]]></MediaFile>
            <MediaFile type="video/mp4" bitrate="1200" width="1280" height="720"><![CDATA[https://tracking.invalid/never-selected.mp4]]></MediaFile>
          </MediaFiles>
        </Linear>
      </Creative>
      <Creative>
        <CompanionAds>
          <Companion width="640" height="640">
            <StaticResource creativeType="image/jpeg"><![CDATA[${poster('nordwind-companion', 640, 640)}]]></StaticResource>
            <CompanionClickThrough><![CDATA[https://example.com/nordwind]]></CompanionClickThrough>
            <CompanionClickTracking><![CDATA[https://tracking.invalid/companion-click]]></CompanionClickTracking>
            <TrackingEvents>
              <Tracking event="creativeView"><![CDATA[https://tracking.invalid/companion-view]]></Tracking>
            </TrackingEvents>
          </Companion>
          <Companion width="300" height="250">
            <StaticResource creativeType="image/jpeg"><![CDATA[${poster('nordwind-banner', 300, 250)}]]></StaticResource>
          </Companion>
        </CompanionAds>
      </Creative>
    </Creatives>
  </InLine></Ad>
</VAST>`;

/** Pre-resolve so the preview needs no network for the ad request itself. */
const AUDIO_ADS: Ad[] = vastAdsToAudioAds(parseVast(AUDIO_VAST).ads, {
  mediaFileOptions: audioAdMediaOptions(),
}).ads;

const PRE_ROLL: AdBreak = { id: 'pre', position: 'pre-roll', ads: AUDIO_ADS };

/** The player with no ads at all. */
export const Default: Story = {
  render: () => (
    <Stage title="Podcast player" description="No ad config — the plain listening experience.">
      <div className="w-full max-w-xl">
        <AudioPlayer track={EPISODE} showChapters />
      </div>
    </Stage>
  ),
};

/** A VAST audio pre-roll with its companion artwork. */
export const WithAudioVastPreRoll: Story = {
  render: function Render() {
    const [log, setLog] = useState<string[]>([]);
    const push = (line: string) => setLog((prev) => [line, ...prev].slice(0, 16));

    return (
      <Stage
        title="Audio VAST pre-roll"
        description={
          <>
            <strong>Press play.</strong> The spot is parsed from a real VAST document — the same
            pipeline as video, only the media-file selection differs. The cover is replaced by
            the ad&apos;s <code>&lt;Companion&gt;</code> for the duration.
          </>
        }
        aside={
          <>
            <Note>
              The document also carries a <code>video/mp4</code> rendition. In audio-only mode it is
              rejected rather than played invisibly — check that the selected source is the mp3.
            </Note>
            <Panel title="Ad lifecycle" meta={log.length ? String(log.length) : undefined}>
              <pre
                className="m-0 max-h-56 overflow-y-auto text-[11px] leading-relaxed"
                style={{
                  fontFamily: 'var(--fp-font-family-mono)',
                  color: 'var(--fp-color-text-secondary)',
                }}
              >
                {log.join('\n') || 'Nothing yet — press play.'}
              </pre>
            </Panel>
            <Snippet
              code={`const { adBreaks } = useVastAdBreaks({
  preRoll: 'https://ads.example.com/vast?pos=pre',
  midRolls: [{ at: 600, tagUrl: 'https://ads.example.com/vast?pos=mid' }],
  // Without this the audio creative fails selection with VAST 403.
  mediaFileOptions: audioAdMediaOptions(),
});

<AudioPlayer track={episode} adConfig={{ enabled: true, adBreaks }} />`}
            />
          </>
        }
      >
        <div className="w-full max-w-xl">
          <AudioPlayer
            track={EPISODE}
            adConfig={{
              enabled: true,
              adBreaks: [PRE_ROLL],
              onAdStart: (ad) => push(`ad:start         ${ad.title}`),
              onFirstQuartile: (ad) => push(`ad:firstQuartile ${ad.id}`),
              onMidpoint: (ad) => push(`ad:midpoint      ${ad.id}`),
              onThirdQuartile: (ad) => push(`ad:thirdQuartile ${ad.id}`),
              onAdComplete: (ad) => push(`ad:complete      ${ad.id}`),
              onAdSkip: (ad) => push(`ad:skip          ${ad.id}`),
              onAdClick: (ad) => push(`ad:click         ${ad.id}`),
            }}
          />
        </div>
      </Stage>
    );
  },
};

/** Companion hidden — for hosts whose layout has no artwork slot. */
export const WithoutCompanion: Story = {
  render: () => (
    <Stage
      title="No companion slot"
      description="showCompanion={false} keeps the linear audio ad but drops the artwork swap. The impression and quartile pixels are unaffected."
    >
      <div className="w-full max-w-xl">
        <AudioPlayer
          track={EPISODE}
          showCompanion={false}
          adConfig={{ enabled: true, adBreaks: [PRE_ROLL] }}
        />
      </div>
    </Stage>
  ),
};

/** Tags fetched live through the hook. */
export const FromVastTag: Story = {
  render: function Render() {
    const { adBreaks, loading, error } = useVastAdBreaks({
      // Inline here so the preview needs no ad server; a live integration
      // passes a tag URL string instead.
      preRoll: { xml: AUDIO_VAST },
      mediaFileOptions: audioAdMediaOptions(),
      defaultSkipOffset: 2,
    });

    return (
      <Stage
        title="useVastAdBreaks for audio"
        description="The same hook the video player uses. Only mediaFileOptions changes — everything else, including wrapper resolution and the tracking pipeline, is shared."
        aside={
          <Panel title="Resolved breaks" meta={loading ? '…' : String(adBreaks.length)}>
            <p className="m-0 text-[12px]" style={{ color: 'var(--fp-color-text-secondary)' }}>
              {loading
                ? 'Resolving…'
                : error
                  ? error.message
                  : adBreaks.map((b) => `${b.position} · ${b.ads[0]?.src.split('/').pop()}`).join(', ') ||
                    'none'}
            </p>
          </Panel>
        }
      >
        <div className="w-full max-w-xl">
          <AudioPlayer track={EPISODE} adConfig={{ enabled: adBreaks.length > 0, adBreaks }} />
        </div>
      </Stage>
    );
  },
};
