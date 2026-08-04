import { describe, expect, it } from 'vitest';
import { parseVast } from './parseVast';
import { getNonLinears, vastAdToOverlayAds, vastAdsToOverlayAds } from './toOverlayAd';

/** A VAST document whose only creative is a non-linear banner. */
function nonLinearVast(inner: string, impression = 'https://t.example.com/imp'): string {
  return `<VAST version="4.2"><Ad id="nl-1"><InLine>
    <AdSystem>Test</AdSystem>
    <AdTitle>Banner spot</AdTitle>
    <Impression><![CDATA[${impression}]]></Impression>
    <Creatives><Creative><NonLinearAds>
      ${inner}
    </NonLinearAds></Creative></Creatives>
  </InLine></Ad></VAST>`;
}

const STATIC_BANNER = `
  <NonLinear width="480" height="70" minSuggestedDuration="00:00:20">
    <StaticResource creativeType="image/png"><![CDATA[https://cdn.example.com/banner.png]]></StaticResource>
    <NonLinearClickThrough><![CDATA[https://advertiser.example.com]]></NonLinearClickThrough>
    <NonLinearClickTracking><![CDATA[https://t.example.com/click]]></NonLinearClickTracking>
  </NonLinear>
  <TrackingEvents>
    <Tracking event="creativeView"><![CDATA[https://t.example.com/creativeView]]></Tracking>
    <Tracking event="close"><![CDATA[https://t.example.com/close]]></Tracking>
  </TrackingEvents>`;

const firstAd = (xml: string) => parseVast(xml).ads[0];

describe('getNonLinears', () => {
  it('returns creatives the player can render', () => {
    expect(getNonLinears(firstAd(nonLinearVast(STATIC_BANNER)))).toHaveLength(1);
  });

  it('skips iframe and HTML resources', () => {
    // Rendering third-party markup needs a sandboxed frame with its own
    // security model — a separate decision from "show a banner".
    const markup = `<NonLinear width="480" height="70">
      <IFrameResource><![CDATA[https://cdn.example.com/banner.html]]></IFrameResource>
    </NonLinear>`;

    expect(getNonLinears(firstAd(nonLinearVast(markup)))).toHaveLength(0);
  });
});

describe('vastAdToOverlayAds', () => {
  it('converts a static banner into an OverlayAd', () => {
    const [overlay] = vastAdToOverlayAds(firstAd(nonLinearVast(STATIC_BANNER)));

    expect(overlay).toMatchObject({
      id: 'nl-1',
      imageUrl: 'https://cdn.example.com/banner.png',
      clickThroughUrl: 'https://advertiser.example.com',
      altText: 'Banner spot',
      displayAt: 0,
      position: 'bottom',
      closeable: true,
    });
  });

  it('honours minSuggestedDuration over the default', () => {
    const [overlay] = vastAdToOverlayAds(firstAd(nonLinearVast(STATIC_BANNER)));
    expect(overlay.duration).toBe(20);
  });

  it('falls back to the default duration when the creative suggests none', () => {
    const noDuration = STATIC_BANNER.replace(' minSuggestedDuration="00:00:20"', '');
    const [overlay] = vastAdToOverlayAds(firstAd(nonLinearVast(noDuration)), {
      defaultDuration: 8,
    });

    expect(overlay.duration).toBe(8);
  });

  it('combines the ad impression with the creative view pixel', () => {
    // The creative can be trafficked into several slots, and only creativeView
    // says which one was actually shown.
    const [overlay] = vastAdToOverlayAds(firstAd(nonLinearVast(STATIC_BANNER)));

    expect(overlay.trackingUrls?.impression).toEqual([
      'https://t.example.com/imp',
      'https://t.example.com/creativeView',
    ]);
  });

  it('maps click and close tracking', () => {
    const [overlay] = vastAdToOverlayAds(firstAd(nonLinearVast(STATIC_BANNER)));

    expect(overlay.trackingUrls?.click).toEqual(['https://t.example.com/click']);
    expect(overlay.trackingUrls?.close).toEqual(['https://t.example.com/close']);
  });

  it('treats acceptInvitation as a click', () => {
    const withInvite = STATIC_BANNER.replace(
      '<Tracking event="close">',
      '<Tracking event="acceptInvitation"><![CDATA[https://t.example.com/accept]]></Tracking><Tracking event="close">'
    );
    const [overlay] = vastAdToOverlayAds(firstAd(nonLinearVast(withInvite)));

    expect(overlay.trackingUrls?.click).toContain('https://t.example.com/accept');
  });

  it('omits trackingUrls entirely when the creative declares none', () => {
    const bare = `<NonLinear width="480" height="70">
      <StaticResource creativeType="image/png"><![CDATA[https://cdn.example.com/b.png]]></StaticResource>
    </NonLinear>`;
    const xml = nonLinearVast(bare, '').replace('<Impression><![CDATA[]]></Impression>', '');

    const [overlay] = vastAdToOverlayAds(firstAd(xml));
    expect(overlay.trackingUrls).toBeUndefined();
  });

  it('gives each banner of a multi-creative ad a distinct id', () => {
    const two = `${STATIC_BANNER}
      <NonLinear width="300" height="50">
        <StaticResource creativeType="image/png"><![CDATA[https://cdn.example.com/second.png]]></StaticResource>
      </NonLinear>`;

    const overlays = vastAdToOverlayAds(firstAd(nonLinearVast(two)));
    expect(overlays.map((o) => o.id)).toEqual(['nl-1', 'nl-1-nonlinear-1']);
  });

  it('returns nothing for a linear-only ad', () => {
    const linearOnly = `<VAST version="4.2"><Ad id="lin"><InLine>
      <AdSystem>Test</AdSystem><AdTitle>Spot</AdTitle>
      <Creatives><Creative><Linear>
        <Duration>00:00:15</Duration>
        <MediaFiles><MediaFile type="video/mp4"><![CDATA[https://cdn.example.com/a.mp4]]></MediaFile></MediaFiles>
      </Linear></Creative></Creatives>
    </InLine></Ad></VAST>`;

    expect(vastAdToOverlayAds(firstAd(linearOnly))).toEqual([]);
  });

  it('applies caller-chosen placement', () => {
    // VAST says nothing about when a non-linear ad appears — that is the
    // player's decision, so the caller owns it.
    const [overlay] = vastAdToOverlayAds(firstAd(nonLinearVast(STATIC_BANNER)), {
      displayAt: 45,
      position: 'top',
      closeable: false,
    });

    expect(overlay).toMatchObject({ displayAt: 45, position: 'top', closeable: false });
  });
});

describe('vastAdsToOverlayAds', () => {
  it('flattens several ads and skips the ones with nothing renderable', () => {
    const ads = [
      ...parseVast(nonLinearVast(STATIC_BANNER)).ads,
      ...parseVast(
        `<VAST version="4.2"><Ad id="empty"><InLine><AdSystem>T</AdSystem><AdTitle>x</AdTitle>
          <Creatives><Creative><NonLinearAds>
            <NonLinear><HTMLResource><![CDATA[<b>hi</b>]]></HTMLResource></NonLinear>
          </NonLinearAds></Creative></Creatives>
        </InLine></Ad></VAST>`
      ).ads,
    ];

    expect(vastAdsToOverlayAds(ads).map((o) => o.id)).toEqual(['nl-1']);
  });
});
