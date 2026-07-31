import { describe, expect, it } from 'vitest';
import { parseVast, applyWrapperToAds } from './parseVast';
import { vastAdToVideoAd, vastAdsToVideoAds, videoAdToTrackable } from './toVideoAd';
import { VastTracker } from './VastTracker';
import { toUrlList } from '@/types/ads';
import type { VideoAd } from '@/types/video';

const INLINE = `<VAST version="4.2">
  <Ad id="dsp-ad">
    <InLine>
      <AdSystem>DSP</AdSystem>
      <AdTitle>Acme Spot</AdTitle>
      <Description>15s spot</Description>
      <Impression><![CDATA[https://dsp.example.com/imp?cb=[CACHEBUSTING]]]></Impression>
      <Error><![CDATA[https://dsp.example.com/err?code=[ERRORCODE]]]></Error>
      <Creatives><Creative><Linear skipoffset="00:00:05">
        <Duration>00:00:15</Duration>
        <TrackingEvents>
          <Tracking event="start"><![CDATA[https://dsp.example.com/start]]></Tracking>
          <Tracking event="firstQuartile"><![CDATA[https://dsp.example.com/q1]]></Tracking>
          <Tracking event="midpoint"><![CDATA[https://dsp.example.com/q2]]></Tracking>
          <Tracking event="thirdQuartile"><![CDATA[https://dsp.example.com/q3]]></Tracking>
          <Tracking event="complete"><![CDATA[https://dsp.example.com/complete]]></Tracking>
          <Tracking event="progress" offset="00:00:07"><![CDATA[https://dsp.example.com/p7]]></Tracking>
        </TrackingEvents>
        <VideoClicks>
          <ClickThrough><![CDATA[https://acme.example.com/landing]]></ClickThrough>
          <ClickTracking><![CDATA[https://dsp.example.com/click]]></ClickTracking>
        </VideoClicks>
        <MediaFiles>
          <MediaFile type="video/mp4" bitrate="800" width="640" height="360"><![CDATA[https://cdn.example.com/360.mp4]]></MediaFile>
          <MediaFile type="video/mp4" bitrate="2500" width="1280" height="720"><![CDATA[https://cdn.example.com/720.mp4]]></MediaFile>
        </MediaFiles>
      </Linear></Creative></Creatives>
    </InLine>
  </Ad>
</VAST>`;

const WRAPPER = `<VAST version="4.2">
  <Ad id="ssp-wrapper">
    <Wrapper>
      <AdSystem>SSP</AdSystem>
      <VASTAdTagURI><![CDATA[https://dsp.example.com/vast]]></VASTAdTagURI>
      <Impression><![CDATA[https://ssp.example.com/imp]]></Impression>
      <Error><![CDATA[https://ssp.example.com/err]]></Error>
      <TrackingEvents>
        <Tracking event="complete"><![CDATA[https://ssp.example.com/complete]]></Tracking>
      </TrackingEvents>
      <VideoClicks><ClickTracking><![CDATA[https://ssp.example.com/click]]></ClickTracking></VideoClicks>
    </Wrapper>
  </Ad>
</VAST>`;

const MEDIA_720 = { height: 720, pixelRatio: 1, maxBitrate: Infinity };

describe('vastAdToVideoAd', () => {
  const ad = vastAdToVideoAd(parseVast(INLINE).ads[0], { mediaFileOptions: MEDIA_720 });

  it('maps the creative onto VideoAd', () => {
    expect(ad.id).toBe('dsp-ad');
    expect(ad.src).toBe('https://cdn.example.com/720.mp4');
    expect(ad.duration).toBe(15);
    expect(ad.skipAfterSeconds).toBe(5);
    expect(ad.title).toBe('Acme Spot');
    expect(ad.clickThroughUrl).toBe('https://acme.example.com/landing');
  });

  it('keeps tracking as lists', () => {
    expect(ad.trackingUrls?.impression).toEqual(['https://dsp.example.com/imp?cb=[CACHEBUSTING]']);
    expect(ad.trackingUrls?.complete).toEqual(['https://dsp.example.com/complete']);
    expect(ad.trackingUrls?.progress).toEqual([
      { offset: 7, url: 'https://dsp.example.com/p7' },
    ]);
  });

  it('applies defaultSkipOffset only when the creative declares none', () => {
    const noSkip = parseVast(INLINE.replace(' skipoffset="00:00:05"', '')).ads[0];
    expect(vastAdToVideoAd(noSkip, { defaultSkipOffset: 3 }).skipAfterSeconds).toBe(3);
    expect(vastAdToVideoAd(noSkip, { defaultSkipOffset: null }).skipAfterSeconds).toBeNull();
    // An explicit offset always wins.
    expect(vastAdToVideoAd(parseVast(INLINE).ads[0], { defaultSkipOffset: 9 }).skipAfterSeconds).toBe(5);
  });

  it('marks a short non-skippable spot as a bumper', () => {
    const bumper = parseVast(
      INLINE.replace(' skipoffset="00:00:05"', '').replace('00:00:15', '00:00:06')
    ).ads[0];
    expect(vastAdToVideoAd(bumper, { defaultSkipOffset: null }).type).toBe('bumper');
    expect(ad.type).toBe('standard');
  });

  it('drops unplayable creatives individually rather than failing the pod', () => {
    const broken = parseVast(
      `<VAST version="4.2"><Ad id="bad"><InLine><AdTitle>bad</AdTitle>
        <Creatives><Creative><Linear><Duration>00:00:10</Duration><MediaFiles>
          <MediaFile type="application/javascript" apiFramework="VPAID"><![CDATA[https://x/x.js]]></MediaFile>
        </MediaFiles></Linear></Creative></Creatives></InLine></Ad></VAST>`
    ).ads[0];

    const { ads, errors } = vastAdsToVideoAds([parseVast(INLINE).ads[0], broken], {
      mediaFileOptions: MEDIA_720,
    });

    expect(ads).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe(403);
  });
});

describe('wrapper pixels survive the conversion', () => {
  // This is the regression the whole widening exists for: before
  // `AdTrackingUrls` accepted lists, the SSP's impression was silently dropped.
  const merged = applyWrapperToAds(parseVast(WRAPPER).wrappers[0], parseVast(INLINE).ads)[0];
  const ad = vastAdToVideoAd(merged, { mediaFileOptions: MEDIA_720 });

  it('carries both impression pixels', () => {
    expect(toUrlList(ad.trackingUrls?.impression)).toEqual([
      'https://ssp.example.com/imp',
      'https://dsp.example.com/imp?cb=[CACHEBUSTING]',
    ]);
  });

  it('carries both complete pixels', () => {
    expect(toUrlList(ad.trackingUrls?.complete)).toEqual([
      'https://dsp.example.com/complete',
      'https://ssp.example.com/complete',
    ]);
  });

  it('carries both click-tracking pixels and both error pixels', () => {
    expect(toUrlList(ad.trackingUrls?.click)).toHaveLength(2);
    expect(toUrlList(ad.trackingUrls?.error)).toHaveLength(2);
  });

  it('actually fires every one of them', () => {
    const sent: string[] = [];
    const tracker = new VastTracker(videoAdToTrackable(ad), { send: (u) => sent.push(u) });

    tracker.impression();
    expect(sent.filter((u) => u.includes('/imp')).length).toBe(2);

    tracker.complete(15);
    expect(sent.filter((u) => u.includes('/complete')).length).toBe(2);
  });
});

describe('videoAdToTrackable', () => {
  it('accepts a hand-authored ad with single-string tracking', () => {
    const legacy: VideoAd = {
      id: 'legacy',
      src: 'https://cdn.example.com/a.mp4',
      duration: 20,
      trackingUrls: {
        impression: 'https://t.example.com/imp',
        complete: 'https://t.example.com/complete',
      },
    };

    const trackable = videoAdToTrackable(legacy);
    expect(trackable.impressionUrls).toEqual(['https://t.example.com/imp']);
    expect(trackable.trackingEvents?.complete).toEqual(['https://t.example.com/complete']);
  });

  it('substitutes macros a hand-authored ad would otherwise send verbatim', () => {
    // The old implementation fired the raw string, so ad servers saw the literal
    // "[CACHEBUSTING]".
    const sent: string[] = [];
    const ad: VideoAd = {
      id: 'macro',
      src: 'https://cdn.example.com/a.mp4',
      duration: 10,
      trackingUrls: { impression: 'https://t.example.com/imp?cb=[CACHEBUSTING]' },
    };

    new VastTracker(videoAdToTrackable(ad), { send: (u) => sent.push(u) }).impression();

    expect(sent[0]).toMatch(/cb=\d{8}$/);
    expect(sent[0]).not.toContain('[CACHEBUSTING]');
  });

  it('handles an ad with no tracking at all', () => {
    const bare: VideoAd = { id: 'bare', src: 'x.mp4', duration: 5 };
    const trackable = videoAdToTrackable(bare);

    expect(trackable.impressionUrls).toEqual([]);
    expect(trackable.trackingEvents).toEqual({});

    const sent: string[] = [];
    const tracker = new VastTracker(trackable, { send: (u) => sent.push(u) });
    tracker.impression();
    tracker.progress(3, 5);
    tracker.complete();
    expect(sent).toHaveLength(0);
  });

  it('still fires lifecycle callbacks when the ad declares no pixels', () => {
    // `onEvent` must not depend on a URL existing — otherwise a creative without
    // a midpoint pixel would never fire onMidpoint.
    const events: string[] = [];
    const bare: VideoAd = { id: 'bare', src: 'x.mp4', duration: 10 };

    const tracker = new VastTracker(videoAdToTrackable(bare), {
      send: () => {},
      onEvent: (e) => events.push(e),
    });

    tracker.progress(6, 10);

    expect(events).toContain('start');
    expect(events).toContain('firstQuartile');
    expect(events).toContain('midpoint');
    expect(events).not.toContain('thirdQuartile');
  });
});

describe('toUrlList', () => {
  it('normalises both forms', () => {
    expect(toUrlList('https://a')).toEqual(['https://a']);
    expect(toUrlList(['https://a', 'https://b'])).toEqual(['https://a', 'https://b']);
    expect(toUrlList(undefined)).toEqual([]);
    expect(toUrlList([])).toEqual([]);
  });
});
