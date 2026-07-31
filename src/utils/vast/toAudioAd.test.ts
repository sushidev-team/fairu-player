import { describe, expect, it } from 'vitest';
import { parseVast } from './parseVast';
import { vastAdToAudioAd, vastAdsToAudioAds, selectCompanion, getCompanions } from './toAudioAd';
import { vastAdToVideoAd } from './toVideoAd';
import { selectMediaFile, audioAdMediaOptions } from './mediaFile';
import { VastError } from '@/types/vast';

/** An audio VAST document, as an audio ad server returns it. */
const AUDIO_VAST = `<VAST version="4.2">
  <Ad id="audio-1"><InLine>
    <AdSystem>Audio SSP</AdSystem>
    <AdTitle>Nordwind Kaffee — 30s Spot</AdTitle>
    <Advertiser>Nordwind</Advertiser>
    <Impression><![CDATA[https://t.example.com/imp]]></Impression>
    <Creatives>
      <Creative>
        <Linear skipoffset="00:00:05">
          <Duration>00:00:30</Duration>
          <TrackingEvents>
            <Tracking event="complete"><![CDATA[https://t.example.com/complete]]></Tracking>
          </TrackingEvents>
          <VideoClicks>
            <ClickThrough><![CDATA[https://nordwind.example.com]]></ClickThrough>
            <ClickTracking><![CDATA[https://t.example.com/click]]></ClickTracking>
          </VideoClicks>
          <MediaFiles>
            <MediaFile type="audio/mpeg" bitrate="128"><![CDATA[https://cdn.example.com/spot-128.mp3]]></MediaFile>
            <MediaFile type="audio/mpeg" bitrate="64"><![CDATA[https://cdn.example.com/spot-64.mp3]]></MediaFile>
            <MediaFile type="audio/mp4" bitrate="96"><![CDATA[https://cdn.example.com/spot.m4a]]></MediaFile>
          </MediaFiles>
        </Linear>
      </Creative>
      <Creative>
        <CompanionAds>
          <Companion width="300" height="250">
            <StaticResource creativeType="image/png"><![CDATA[https://cdn.example.com/banner-300x250.png]]></StaticResource>
            <CompanionClickThrough><![CDATA[https://nordwind.example.com/promo]]></CompanionClickThrough>
            <CompanionClickTracking><![CDATA[https://t.example.com/companion-click]]></CompanionClickTracking>
          </Companion>
          <Companion width="640" height="640">
            <StaticResource creativeType="image/jpeg"><![CDATA[https://cdn.example.com/square-640.jpg]]></StaticResource>
            <CompanionClickThrough><![CDATA[https://nordwind.example.com/square]]></CompanionClickThrough>
          </Companion>
        </CompanionAds>
      </Creative>
    </Creatives>
  </InLine></Ad>
</VAST>`;

describe('audio media-file selection', () => {
  const linear = parseVast(AUDIO_VAST).ads[0].creatives[0];
  const files = linear.type === 'linear' ? linear.mediaFiles : [];

  it('rejects audio when the video defaults are used', () => {
    // The regression this guards: before audio types were allow-listed, every
    // podcast creative failed selection and reported VAST 403.
    expect(selectMediaFile(files)).toBeUndefined();
  });

  it('accepts audio with audioAdMediaOptions', () => {
    const chosen = selectMediaFile(files, audioAdMediaOptions());
    expect(chosen).toBeDefined();
    expect(chosen!.type).toMatch(/^audio\//);
  });

  it('prefers mpeg over mp4 and then the lower bitrate', () => {
    // mp3 is first in the audio preference list; among equal types the smaller
    // rendition wins because there is no pixel budget to trade against.
    const chosen = selectMediaFile(files, audioAdMediaOptions());
    expect(chosen!.url).toBe('https://cdn.example.com/spot-64.mp3');
  });

  it('rejects a video creative in audio-only mode', () => {
    // Playing the audio track of an MP4 while the listener sees nothing is worse
    // than reporting no fill.
    const videoOnly = [{ url: 'https://cdn.example.com/spot.mp4', type: 'video/mp4' }];
    expect(selectMediaFile(videoOnly, audioAdMediaOptions())).toBeUndefined();
    expect(selectMediaFile(videoOnly)).toBeDefined();
  });

  it('infers audio types from the extension when the server omits them', () => {
    const untyped = [{ url: 'https://cdn.example.com/spot.mp3' }];
    expect(selectMediaFile(untyped, audioAdMediaOptions())?.url).toContain('.mp3');
  });
});

describe('vastAdToAudioAd', () => {
  const ad = vastAdToAudioAd(parseVast(AUDIO_VAST).ads[0]);

  it('produces a playable audio Ad', () => {
    expect(ad.id).toBe('audio-1');
    expect(ad.src).toMatch(/\.mp3$/);
    expect(ad.duration).toBe(30);
    expect(ad.skipAfterSeconds).toBe(5);
    expect(ad.title).toBe('Nordwind Kaffee — 30s Spot');
    expect(ad.clickThroughUrl).toBe('https://nordwind.example.com');
  });

  it('keeps tracking as lists', () => {
    expect(ad.trackingUrls?.impression).toEqual(['https://t.example.com/imp']);
    expect(ad.trackingUrls?.complete).toEqual(['https://t.example.com/complete']);
    expect(ad.trackingUrls?.click).toEqual(['https://t.example.com/click']);
  });

  it('attaches the square companion, not the largest one', () => {
    // A podcast artwork slot is square; a 300×250 banner has fewer pixels than
    // 640×640 but the aspect is what matters.
    expect(ad.companion?.imageUrl).toBe('https://cdn.example.com/square-640.jpg');
    expect(ad.companion?.width).toBe(640);
    expect(ad.companion?.clickUrl).toBe('https://nordwind.example.com/square');
  });

  it('falls back to the linear click-through when the companion has none', () => {
    const noClick = AUDIO_VAST.replace(
      '<CompanionClickThrough><![CDATA[https://nordwind.example.com/square]]></CompanionClickThrough>',
      ''
    );
    const converted = vastAdToAudioAd(parseVast(noClick).ads[0]);
    expect(converted.companion?.clickUrl).toBe('https://nordwind.example.com');
  });

  it('omits the companion when the ad has none', () => {
    const noCompanion = AUDIO_VAST.replace(/<Creative>\s*<CompanionAds>[\s\S]*?<\/Creative>/, '');
    expect(vastAdToAudioAd(parseVast(noCompanion).ads[0]).companion).toBeUndefined();
  });

  it('throws 403 when only video renditions exist', () => {
    const videoOnly = AUDIO_VAST.replace(/type="audio\/[a-z0-9]+"/g, 'type="video/mp4"');
    expect(() => vastAdToAudioAd(parseVast(videoOnly).ads[0])).toThrow(/no playable audio media file/);
  });

  it('drops unplayable ads individually', () => {
    const videoOnly = AUDIO_VAST.replace(/type="audio\/[a-z0-9]+"/g, 'type="video/mp4"');
    const { ads, errors } = vastAdsToAudioAds([
      parseVast(AUDIO_VAST).ads[0],
      parseVast(videoOnly).ads[0],
    ]);

    expect(ads).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(VastError);
  });

  it('the same document also converts for video, with a video rendition', () => {
    // One VAST document can legitimately carry both; the two bridges pick
    // different media files from it.
    const mixed = AUDIO_VAST.replace(
      '</MediaFiles>',
      '<MediaFile type="video/mp4" bitrate="1200" width="1280" height="720"><![CDATA[https://cdn.example.com/spot.mp4]]></MediaFile></MediaFiles>'
    );
    const parsed = parseVast(mixed).ads[0];

    expect(vastAdToAudioAd(parsed).src).toMatch(/\.mp3$/);
    expect(vastAdToVideoAd(parsed).src).toMatch(/\.mp4$/);
  });
});

describe('companion selection', () => {
  const companions = getCompanions(parseVast(AUDIO_VAST).ads[0]);

  it('finds every companion, largest first', () => {
    expect(companions).toHaveLength(2);
    expect(companions[0].width).toBe(640);
  });

  it('picks the closest aspect to the target', () => {
    expect(selectCompanion(companions, 1)?.width).toBe(640); // square slot
    expect(selectCompanion(companions, 300 / 250)?.width).toBe(300); // banner slot
  });

  it('ignores companions with no renderable resource', () => {
    expect(
      selectCompanion([{ type: 'companion', width: 300, height: 250, clickTrackingUrls: [], trackingEvents: {} }])
    ).toBeUndefined();
  });

  it('returns undefined for an empty list', () => {
    expect(selectCompanion([])).toBeUndefined();
  });
});
