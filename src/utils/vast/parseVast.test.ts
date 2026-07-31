import { describe, expect, it } from 'vitest';
import {
  applyWrapperToAds,
  getLinearCreative,
  parseDuration,
  parseOffset,
  parseVast,
} from './parseVast';
import { selectMediaFile } from './mediaFile';
import { substituteMacros, formatPlayhead } from './macros';
import { vastAdToReelAd } from './toReelAd';
import { VastError } from '@/types/vast';

const INLINE_VAST = `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="4.2">
  <Ad id="ad-42" sequence="1">
    <InLine>
      <AdSystem>Fairu Test</AdSystem>
      <AdTitle>Vertical Hero Spot</AdTitle>
      <Description>A 15 second vertical creative</Description>
      <Advertiser>Acme</Advertiser>
      <Pricing model="CPM" currency="EUR">4.50</Pricing>
      <Impression><![CDATA[https://track.example.com/imp?cb=[CACHEBUSTING]]]></Impression>
      <Impression><![CDATA[https://track2.example.com/imp]]></Impression>
      <Error><![CDATA[https://track.example.com/err?code=[ERRORCODE]]]></Error>
      <ViewableImpression>
        <Viewable><![CDATA[https://track.example.com/viewable]]></Viewable>
        <NotViewable><![CDATA[https://track.example.com/notviewable]]></NotViewable>
      </ViewableImpression>
      <Creatives>
        <Creative id="c1">
          <Linear skipoffset="00:00:05">
            <Duration>00:00:15</Duration>
            <TrackingEvents>
              <Tracking event="start"><![CDATA[https://track.example.com/start]]></Tracking>
              <Tracking event="firstQuartile"><![CDATA[https://track.example.com/q1]]></Tracking>
              <Tracking event="midpoint"><![CDATA[https://track.example.com/q2]]></Tracking>
              <Tracking event="thirdQuartile"><![CDATA[https://track.example.com/q3]]></Tracking>
              <Tracking event="complete"><![CDATA[https://track.example.com/complete]]></Tracking>
              <Tracking event="skip"><![CDATA[https://track.example.com/skip]]></Tracking>
              <Tracking event="progress" offset="00:00:10"><![CDATA[https://track.example.com/p10]]></Tracking>
              <Tracking event="progress" offset="50%"><![CDATA[https://track.example.com/p50pct]]></Tracking>
            </TrackingEvents>
            <VideoClicks>
              <ClickThrough><![CDATA[https://acme.example.com/landing]]></ClickThrough>
              <ClickTracking><![CDATA[https://track.example.com/click]]></ClickTracking>
            </VideoClicks>
            <MediaFiles>
              <MediaFile delivery="progressive" type="video/mp4" bitrate="600" width="480" height="854">
                <![CDATA[https://cdn.example.com/ad-480.mp4]]>
              </MediaFile>
              <MediaFile delivery="progressive" type="video/mp4" bitrate="1800" width="720" height="1280">
                <![CDATA[https://cdn.example.com/ad-720.mp4]]>
              </MediaFile>
              <MediaFile delivery="progressive" type="video/mp4" bitrate="9000" width="1080" height="1920">
                <![CDATA[https://cdn.example.com/ad-1080.mp4]]>
              </MediaFile>
              <MediaFile delivery="progressive" type="application/javascript" apiFramework="VPAID" bitrate="0">
                <![CDATA[https://cdn.example.com/vpaid.js]]>
              </MediaFile>
            </MediaFiles>
            <Icons>
              <Icon program="AdChoices" width="16" height="16">
                <StaticResource creativeType="image/png"><![CDATA[https://cdn.example.com/adchoices.png]]></StaticResource>
                <IconClicks>
                  <IconClickThrough><![CDATA[https://privacy.example.com]]></IconClickThrough>
                </IconClicks>
              </Icon>
            </Icons>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`;

const WRAPPER_VAST = `<?xml version="1.0"?>
<VAST version="4.2">
  <Ad id="wrapper-1">
    <Wrapper followAdditionalWrappers="true" allowMultipleAds="false">
      <AdSystem>SSP</AdSystem>
      <VASTAdTagURI><![CDATA[https://ssp.example.com/vast2]]></VASTAdTagURI>
      <Impression><![CDATA[https://ssp.example.com/imp]]></Impression>
      <Error><![CDATA[https://ssp.example.com/err]]></Error>
      <TrackingEvents>
        <Tracking event="complete"><![CDATA[https://ssp.example.com/complete]]></Tracking>
      </TrackingEvents>
      <VideoClicks>
        <ClickTracking><![CDATA[https://ssp.example.com/click]]></ClickTracking>
      </VideoClicks>
    </Wrapper>
  </Ad>
</VAST>`;

const NO_ADS_VAST = `<?xml version="1.0"?>
<VAST version="4.2">
  <Error><![CDATA[https://exchange.example.com/noad?code=[ERRORCODE]]]></Error>
</VAST>`;

describe('parseDuration', () => {
  it('parses HH:MM:SS', () => {
    expect(parseDuration('00:00:15')).toBe(15);
    expect(parseDuration('00:01:30')).toBe(90);
    expect(parseDuration('01:00:00')).toBe(3600);
  });

  it('parses milliseconds', () => {
    expect(parseDuration('00:00:06.500')).toBeCloseTo(6.5);
  });

  it('accepts bare seconds, which some ad servers emit despite the spec', () => {
    expect(parseDuration('30')).toBe(30);
  });

  it('returns undefined for malformed input instead of NaN', () => {
    expect(parseDuration('not-a-duration')).toBeUndefined();
    expect(parseDuration('')).toBeUndefined();
    expect(parseDuration(undefined)).toBeUndefined();
  });
});

describe('parseOffset', () => {
  it('resolves percentages against the creative duration', () => {
    expect(parseOffset('25%', 60)).toBe(15);
  });

  it('cannot resolve a percentage without a duration', () => {
    expect(parseOffset('25%')).toBeUndefined();
  });

  it('resolves absolute offsets', () => {
    expect(parseOffset('00:00:05')).toBe(5);
  });
});

describe('parseVast — inline ad', () => {
  const response = parseVast(INLINE_VAST);

  it('reads the document version', () => {
    expect(response.version).toBe('4.2');
  });

  it('returns one inline ad and no wrappers', () => {
    expect(response.ads).toHaveLength(1);
    expect(response.wrappers).toHaveLength(0);
  });

  it('reads ad metadata', () => {
    const [ad] = response.ads;
    expect(ad.id).toBe('ad-42');
    expect(ad.sequence).toBe(1);
    expect(ad.adTitle).toBe('Vertical Hero Spot');
    expect(ad.advertiser).toBe('Acme');
    expect(ad.adSystem).toBe('Fairu Test');
    expect(ad.pricing).toEqual({ value: 4.5, model: 'CPM', currency: 'EUR' });
  });

  it('collects every impression and error pixel', () => {
    const [ad] = response.ads;
    expect(ad.impressionUrls).toHaveLength(2);
    expect(ad.errorUrls).toEqual(['https://track.example.com/err?code=[ERRORCODE]']);
    expect(ad.viewableUrls).toEqual(['https://track.example.com/viewable']);
    expect(ad.notViewableUrls).toEqual(['https://track.example.com/notviewable']);
  });

  it('parses the linear creative', () => {
    const linear = getLinearCreative(response.ads[0]);
    expect(linear).toBeDefined();
    expect(linear!.duration).toBe(15);
    expect(linear!.skipOffset).toBe(5);
    expect(linear!.mediaFiles).toHaveLength(4);
  });

  it('separates offset-based progress trackings from one-shot events', () => {
    const linear = getLinearCreative(response.ads[0])!;
    expect(Object.keys(linear.trackingEvents).sort()).toEqual([
      'complete',
      'firstQuartile',
      'midpoint',
      'skip',
      'start',
      'thirdQuartile',
    ]);
    // 50% of a 15s creative is 7.5s.
    expect(linear.progressTrackings.map((p) => p.offset).sort((a, b) => a - b)).toEqual([7.5, 10]);
  });

  it('parses video clicks', () => {
    const linear = getLinearCreative(response.ads[0])!;
    expect(linear.videoClicks.clickThroughUrl).toBe('https://acme.example.com/landing');
    expect(linear.videoClicks.clickTrackingUrls).toEqual(['https://track.example.com/click']);
  });

  it('parses the AdChoices icon', () => {
    const linear = getLinearCreative(response.ads[0])!;
    expect(linear.icons).toHaveLength(1);
    expect(linear.icons[0].program).toBe('AdChoices');
    expect(linear.icons[0].staticResource).toBe('https://cdn.example.com/adchoices.png');
    expect(linear.icons[0].clickThroughUrl).toBe('https://privacy.example.com');
  });
});

describe('parseVast — wrappers and empty responses', () => {
  it('returns wrappers unresolved with their inherited tracking', () => {
    const response = parseVast(WRAPPER_VAST);
    expect(response.ads).toHaveLength(0);
    expect(response.wrappers).toHaveLength(1);

    const [wrapper] = response.wrappers;
    expect(wrapper.tagUrl).toBe('https://ssp.example.com/vast2');
    expect(wrapper.followAdditionalWrappers).toBe(true);
    expect(wrapper.allowMultipleAds).toBe(false);
    expect(wrapper.impressionUrls).toEqual(['https://ssp.example.com/imp']);
    expect(wrapper.clickTrackingUrls).toEqual(['https://ssp.example.com/click']);
  });

  it('surfaces document-level error pixels for a no-ads response', () => {
    const response = parseVast(NO_ADS_VAST);
    expect(response.ads).toHaveLength(0);
    expect(response.errorUrls).toEqual(['https://exchange.example.com/noad?code=[ERRORCODE]']);
  });

  it('rejects a document whose root is not <VAST>', () => {
    expect(() => parseVast('<NotVast/>')).toThrow(VastError);
  });

  it('rejects malformed XML', () => {
    expect(() => parseVast('<VAST><Ad>')).toThrow(VastError);
  });
});

describe('applyWrapperToAds', () => {
  it('prepends wrapper pixels and merges tracking into the linear creative', () => {
    const wrapper = parseVast(WRAPPER_VAST).wrappers[0];
    const inline = parseVast(INLINE_VAST).ads;

    const [merged] = applyWrapperToAds(wrapper, inline);

    // Wrapper impressions fire first, then the in-line ad's own.
    expect(merged.impressionUrls[0]).toBe('https://ssp.example.com/imp');
    expect(merged.impressionUrls).toHaveLength(3);
    expect(merged.errorUrls).toContain('https://ssp.example.com/err');

    const linear = getLinearCreative(merged)!;
    expect(linear.trackingEvents.complete).toEqual([
      'https://track.example.com/complete',
      'https://ssp.example.com/complete',
    ]);
    expect(linear.videoClicks.clickTrackingUrls).toEqual([
      'https://track.example.com/click',
      'https://ssp.example.com/click',
    ]);
    expect(merged.wrapperDepth).toBe(1);
  });
});

describe('selectMediaFile', () => {
  const linear = getLinearCreative(parseVast(INLINE_VAST).ads[0])!;

  it('never returns an executable creative', () => {
    const selected = selectMediaFile(linear.mediaFiles, { height: 1920, maxBitrate: Infinity });
    expect(selected?.url).not.toContain('vpaid');
  });

  it('picks the rendition closest to the viewport height', () => {
    const selected = selectMediaFile(linear.mediaFiles, {
      height: 1280,
      pixelRatio: 1,
      maxBitrate: Infinity,
    });
    expect(selected?.height).toBe(1280);
  });

  it('prefers a smaller rendition over one exceeding the bitrate cap', () => {
    const selected = selectMediaFile(linear.mediaFiles, {
      height: 1920,
      pixelRatio: 1,
      maxBitrate: 2000,
    });
    expect(selected?.bitrate).toBeLessThanOrEqual(2000);
  });

  it('returns undefined when nothing is playable', () => {
    expect(
      selectMediaFile([
        { url: 'https://cdn.example.com/x.js', type: 'application/javascript', apiFramework: 'VPAID' },
      ])
    ).toBeUndefined();
  });
});

describe('vastAdToReelAd', () => {
  it('produces a playable ReelAd with tracking attached', () => {
    const ad = parseVast(INLINE_VAST).ads[0];
    const reelAd = vastAdToReelAd(ad, {
      mediaFileOptions: { height: 1280, pixelRatio: 1, maxBitrate: Infinity },
    });

    expect(reelAd.src).toBe('https://cdn.example.com/ad-720.mp4');
    expect(reelAd.duration).toBe(15);
    expect(reelAd.skipOffset).toBe(5);
    expect(reelAd.title).toBe('Vertical Hero Spot');
    expect(reelAd.advertiser).toBe('Acme');
    expect(reelAd.impressionUrls).toHaveLength(2);
    expect(reelAd.progressTrackings).toHaveLength(2);
    expect(reelAd.clickThroughUrl).toBe('https://acme.example.com/landing');
  });

  it('applies the player default when the creative declares no skipoffset', () => {
    const xml = INLINE_VAST.replace(' skipoffset="00:00:05"', '');
    const ad = parseVast(xml).ads[0];

    expect(vastAdToReelAd(ad, { defaultSkipOffset: 3 }).skipOffset).toBe(3);
    expect(vastAdToReelAd(ad, { defaultSkipOffset: null }).skipOffset).toBeNull();
  });

  it('keeps an explicit skipoffset of 0 rather than falling back', () => {
    const xml = INLINE_VAST.replace('skipoffset="00:00:05"', 'skipoffset="00:00:00"');
    const ad = parseVast(xml).ads[0];
    expect(vastAdToReelAd(ad, { defaultSkipOffset: 5 }).skipOffset).toBe(0);
  });

  it('throws VAST 403 when no media file is playable', () => {
    const vpaidOnly = `<VAST version="4.2">
      <Ad id="vpaid-only"><InLine>
        <AdTitle>VPAID only</AdTitle>
        <Creatives><Creative><Linear>
          <Duration>00:00:15</Duration>
          <MediaFiles>
            <MediaFile type="application/javascript" apiFramework="VPAID"><![CDATA[https://cdn.example.com/vpaid.js]]></MediaFile>
          </MediaFiles>
        </Linear></Creative></Creatives>
      </InLine></Ad>
    </VAST>`;

    const ad = parseVast(vpaidOnly).ads[0];
    expect(() => vastAdToReelAd(ad)).toThrow(/no playable media file/);
  });

  it('throws VAST 400 when the ad has no linear creative', () => {
    const companionOnly = `<VAST version="4.2">
      <Ad id="companion-only"><InLine>
        <AdTitle>Display only</AdTitle>
        <Creatives><Creative><CompanionAds>
          <Companion width="300" height="250">
            <StaticResource creativeType="image/png"><![CDATA[https://cdn.example.com/banner.png]]></StaticResource>
          </Companion>
        </CompanionAds></Creative></Creatives>
      </InLine></Ad>
    </VAST>`;

    const ad = parseVast(companionOnly).ads[0];
    expect(() => vastAdToReelAd(ad)).toThrow(/no linear creative/);
  });
});

describe('macros', () => {
  it('substitutes known macros and leaves unknown ones alone', () => {
    const result = substituteMacros(
      'https://t.example.com?cb=[CACHEBUSTING]&ph=[ADPLAYHEAD]&keep=[UNKNOWNMACRO]',
      { CACHEBUSTING: 12345678, ADPLAYHEAD: '00:00:07.500' }
    );

    expect(result).toContain('cb=12345678');
    expect(result).toContain('ph=00%3A00%3A07.500');
    expect(result).toContain('keep=[UNKNOWNMACRO]');
  });

  it('supports the legacy %%MACRO%% form', () => {
    expect(substituteMacros('https://t.example.com?cb=%%CACHEBUSTING%%', { CACHEBUSTING: 1 })).toBe(
      'https://t.example.com?cb=1'
    );
  });

  it('formats playheads as HH:MM:SS.mmm', () => {
    expect(formatPlayhead(7.5)).toBe('00:00:07.500');
    expect(formatPlayhead(3661.25)).toBe('01:01:01.250');
    expect(formatPlayhead(-1)).toBe('00:00:00.000');
  });
});
