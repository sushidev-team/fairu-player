import { describe, expect, it } from 'vitest';
import {
  buildSlides,
  checkAdCaps,
  interleaveSlides,
  planFrequencySlots,
  planVmapSlots,
  slotHasSource,
} from './reelsAdScheduler';
import { parseVmap } from './vast/parseVmap';
import type { Reel, ReelsAdConfig } from '@/types/reels';

const reels = (count: number): Reel[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `r${i + 1}`,
    src: `https://cdn.example.com/r${i + 1}.mp4`,
  }));

const adConfig = (overrides: Partial<ReelsAdConfig> = {}): ReelsAdConfig => ({
  enabled: true,
  tagUrl: 'https://ads.example.com/vast',
  ...overrides,
});

describe('planFrequencySlots', () => {
  it('places the first slot after `startAfter` reels, then every `frequency`', () => {
    const slots = planFrequencySlots(12, adConfig({ startAfter: 2, frequency: 4 }));
    expect(slots.map((s) => s.afterContentCount)).toEqual([2, 6, 10]);
  });

  it('supports a pre-roll slot at position 0', () => {
    const slots = planFrequencySlots(6, adConfig({ startAfter: 0, frequency: 3 }));
    expect(slots.map((s) => s.afterContentCount)).toEqual([0, 3]);
  });

  it('never plans a slot beyond the current content length', () => {
    const slots = planFrequencySlots(3, adConfig({ startAfter: 5, frequency: 2 }));
    expect(slots).toHaveLength(0);
  });

  it('cycles static ads so a short list covers a long feed', () => {
    const ads = [
      { id: 'a', src: 'a.mp4', duration: 6, skipOffset: null },
      { id: 'b', src: 'b.mp4', duration: 6, skipOffset: null },
    ];
    const slots = planFrequencySlots(
      12,
      { enabled: true, startAfter: 1, frequency: 2, ads }
    );

    expect(slots.map((s) => s.source.ad?.id)).toEqual([
      'a', 'b', 'a', 'b', 'a', 'b',
    ]);
  });

  it('leaves the slot tag-less when a tag URL waterfall is configured', () => {
    const slots = planFrequencySlots(6, adConfig({ startAfter: 1, frequency: 4 }));
    expect(slots[0].source.tagUrl).toBeUndefined();
    expect(slots[0].source.ad).toBeUndefined();
    // The resolver falls back to config.tagUrl, so the slot still has inventory.
    expect(slotHasSource(slots[0], adConfig())).toBe(true);
  });
});

describe('interleaveSlides', () => {
  it('assigns contiguous indices and stable keys', () => {
    const slots = planFrequencySlots(5, adConfig({ startAfter: 2, frequency: 2 }));
    const slides = interleaveSlides(reels(5), slots);

    expect(slides.map((s) => s.kind)).toEqual([
      'content', 'content', 'ad', 'content', 'content', 'ad', 'content',
    ]);
    expect(slides.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(slides[0].key).toBe('reel:r1');
    expect(slides[2].key).toMatch(/^ad:/);
  });

  it('keeps content indices independent of the ad slides between them', () => {
    const slots = planFrequencySlots(4, adConfig({ startAfter: 1, frequency: 2 }));
    const slides = interleaveSlides(reels(4), slots);

    const contentIndices = slides
      .filter((s): s is Extract<typeof s, { kind: 'content' }> => s.kind === 'content')
      .map((s) => s.contentIndex);

    expect(contentIndices).toEqual([0, 1, 2, 3]);
  });

  it('emits several slots targeting the same position back to back', () => {
    const slides = interleaveSlides(reels(2), [
      { id: 's1', afterContentCount: 1, source: {} },
      { id: 's2', afterContentCount: 1, source: {} },
    ]);

    expect(slides.map((s) => s.kind)).toEqual(['content', 'ad', 'ad', 'content']);
  });
});

describe('buildSlides', () => {
  it('returns pure content when ads are disabled', () => {
    const slides = buildSlides(reels(4), { enabled: false, frequency: 2 });
    expect(slides).toHaveLength(4);
    expect(slides.every((s) => s.kind === 'content')).toBe(true);
  });

  it('returns pure content when no ad config is supplied', () => {
    expect(buildSlides(reels(3), undefined)).toHaveLength(3);
  });

  it('keeps slide keys stable as the feed grows', () => {
    const config = adConfig({ startAfter: 2, frequency: 4 });

    const first = buildSlides(reels(6), config);
    const grown = buildSlides(reels(10), config);

    // Every key from the shorter feed must still be at the same index, or a
    // scrolling viewer would jump when the next page arrives.
    for (const slide of first) {
      expect(grown[slide.index]?.key).toBe(slide.key);
    }
  });
});

describe('planVmapSlots', () => {
  const VMAP = `<?xml version="1.0" encoding="UTF-8"?>
<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
  <vmap:AdBreak timeOffset="start" breakType="linear" breakId="pre">
    <vmap:AdSource id="pre-src" allowMultipleAds="false" followRedirects="true">
      <vmap:AdTagURI templateType="vast3"><![CDATA[https://ads.example.com/pre]]></vmap:AdTagURI>
    </vmap:AdSource>
  </vmap:AdBreak>
  <vmap:AdBreak timeOffset="position:4" breakType="linear" breakId="mid-1">
    <vmap:AdSource>
      <vmap:AdTagURI><![CDATA[https://ads.example.com/mid]]></vmap:AdTagURI>
    </vmap:AdSource>
  </vmap:AdBreak>
  <vmap:AdBreak timeOffset="50%" breakType="display" breakId="display-1">
    <vmap:AdSource><vmap:AdTagURI><![CDATA[https://ads.example.com/display]]></vmap:AdTagURI></vmap:AdSource>
  </vmap:AdBreak>
</vmap:VMAP>`;

  it('parses the document', () => {
    const parsed = parseVmap(VMAP);
    expect(parsed.version).toBe('1.0');
    expect(parsed.adBreaks).toHaveLength(3);
    expect(parsed.adBreaks[0].timeOffset).toMatchObject({ kind: 'start', value: 0 });
    expect(parsed.adBreaks[1].timeOffset).toMatchObject({ kind: 'position', value: 4 });
    expect(parsed.adBreaks[2].timeOffset).toMatchObject({ kind: 'percent', value: 0.5 });
  });

  it('ignores non-linear breaks, which have no place in a vertical feed', () => {
    const slots = planVmapSlots(10, parseVmap(VMAP).adBreaks, adConfig());
    expect(slots).toHaveLength(2);
    expect(slots.map((s) => s.vmapBreakId)).toEqual(['pre', 'mid-1']);
  });

  it('maps position offsets to 0-based content counts', () => {
    const slots = planVmapSlots(10, parseVmap(VMAP).adBreaks, adConfig());
    // `start` → before the first reel; `position:4` → after 3 reels.
    expect(slots.map((s) => s.afterContentCount)).toEqual([0, 3]);
  });

  it('carries the break AdTagURI onto the slot', () => {
    const slots = planVmapSlots(10, parseVmap(VMAP).adBreaks, adConfig());
    expect(slots[0].source.tagUrl).toBe('https://ads.example.com/pre');
    expect(slots[1].source.tagUrl).toBe('https://ads.example.com/mid');
  });

  it('inlines VASTAdData so it can go straight into the VAST parser', () => {
    const inlineVmap = `<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
      <vmap:AdBreak timeOffset="position:2" breakType="linear" breakId="house">
        <vmap:AdSource><vmap:VASTAdData>
          <VAST version="4.2"><Ad id="house-1"><InLine>
            <AdTitle>House ad</AdTitle>
            <Creatives><Creative><Linear>
              <Duration>00:00:10</Duration>
              <MediaFiles>
                <MediaFile type="video/mp4" bitrate="900" width="720" height="1280"><![CDATA[https://cdn.example.com/house.mp4]]></MediaFile>
              </MediaFiles>
            </Linear></Creative></Creatives>
          </InLine></Ad></VAST>
        </vmap:VASTAdData></vmap:AdSource>
      </vmap:AdBreak>
    </vmap:VMAP>`;

    const slots = planVmapSlots(6, parseVmap(inlineVmap).adBreaks, adConfig());
    expect(slots).toHaveLength(1);
    expect(slots[0].source.vastXml).toContain('house-1');
    expect(slots[0].source.vastXml).toMatch(/^<VAST/);
  });

  it('expands repeatAfter into recurring slots', () => {
    const repeating = `<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
      <vmap:AdBreak timeOffset="position:3" breakType="linear" breakId="rep" repeatAfter="00:00:45">
        <vmap:AdSource><vmap:AdTagURI><![CDATA[https://ads.example.com/rep]]></vmap:AdTagURI></vmap:AdSource>
      </vmap:AdBreak>
    </vmap:VMAP>`;

    const slots = planVmapSlots(12, parseVmap(repeating).adBreaks, adConfig());
    // 45s / 15s per reel = every 3 reels, starting after 2.
    expect(slots.map((s) => s.afterContentCount)).toEqual([2, 5, 8, 11]);
  });
});

describe('checkAdCaps', () => {
  it('allows a fill when nothing is capped', () => {
    expect(checkAdCaps({ enabled: true }, { adsShown: 0, lastAdStartedAt: 0 }, 1000)).toBeNull();
  });

  it('reports the session cap', () => {
    expect(
      checkAdCaps({ enabled: true, maxAdsPerSession: 2 }, { adsShown: 2, lastAdStartedAt: 0 }, 1000)
    ).toBe('session-cap');
  });

  it('reports pacing when the last ad was too recent', () => {
    const now = 100_000;
    expect(
      checkAdCaps(
        { enabled: true, minSecondsBetweenAds: 60 },
        { adsShown: 1, lastAdStartedAt: now - 30_000 },
        now
      )
    ).toBe('pacing');
  });

  it('allows a fill once the pacing window has elapsed', () => {
    const now = 100_000;
    expect(
      checkAdCaps(
        { enabled: true, minSecondsBetweenAds: 60 },
        { adsShown: 1, lastAdStartedAt: now - 61_000 },
        now
      )
    ).toBeNull();
  });

  it('does not apply pacing to the first ad of a session', () => {
    expect(
      checkAdCaps(
        { enabled: true, minSecondsBetweenAds: 300 },
        { adsShown: 0, lastAdStartedAt: 0 },
        1000
      )
    ).toBeNull();
  });
});

describe('slotHasSource', () => {
  it('is false when nothing at all is configured', () => {
    expect(slotHasSource({ id: 's', afterContentCount: 0, source: {} }, { enabled: true })).toBe(
      false
    );
  });

  it('is true for a slot-level tag', () => {
    expect(
      slotHasSource(
        { id: 's', afterContentCount: 0, source: { tagUrl: 'https://ads.example.com/x' } },
        { enabled: true }
      )
    ).toBe(true);
  });

  it('is true when the config carries a waterfall', () => {
    expect(
      slotHasSource(
        { id: 's', afterContentCount: 0, source: {} },
        { enabled: true, tagUrl: ['https://a.example.com', 'https://b.example.com'] }
      )
    ).toBe(true);
  });
});
