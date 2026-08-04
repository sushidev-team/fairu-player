/**
 * The consent gate on the reels feed.
 *
 * The feed resolves ad slots lazily, so the gate has to sit inside `resolveSlot`
 * rather than at plan time — and a suppressed slot has to become `empty` rather
 * than disappear, or every index behind it shifts under a scrolling viewer.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReelsFeed } from './useReelsFeed';
import type { Reel, ReelsAdConfig } from '@/types/reels';

const TAG = 'https://ads.example.com/reels';

const INLINE_VAST = `<VAST version="4.2"><Ad id="r1"><InLine>
  <AdSystem>Test</AdSystem><AdTitle>Reel spot</AdTitle>
  <Impression><![CDATA[https://t.example.com/imp]]></Impression>
  <Creatives><Creative><Linear>
    <Duration>00:00:15</Duration>
    <MediaFiles>
      <MediaFile type="video/mp4" width="1080" height="1920"><![CDATA[https://cdn.example.com/ad.mp4]]></MediaFile>
    </MediaFiles>
  </Linear></Creative></Creatives>
</InLine></Ad></VAST>`;

const reels: Reel[] = Array.from({ length: 6 }, (_, i) => ({
  id: `reel-${i}`,
  src: `https://cdn.example.com/reel-${i}.mp4`,
}));

let calls: string[];

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return { ok: true, status: 200, text: async () => INLINE_VAST } as Response;
    })
  );
});

afterEach(() => vi.unstubAllGlobals());

/** Mount the feed with an ad slot immediately after the first reel. */
const mount = (ads: Partial<ReelsAdConfig>) =>
  renderHook(() =>
    useReelsFeed({
      reels,
      config: {
        ads: { enabled: true, tagUrl: TAG, startAfter: 1, frequency: 3, ...ads },
      },
    })
  );

describe('useReelsFeed consent gate', () => {
  it('requests nothing when GDPR applies and no consent string exists', async () => {
    const onConsentBlocked = vi.fn();
    const { result } = mount({ consent: { gdprApplies: true }, onConsentBlocked });

    await waitFor(() => expect(onConsentBlocked).toHaveBeenCalledWith({ gdprApplies: true }));
    expect(calls).toHaveLength(0);
    expect(result.current.state.slides.length).toBeGreaterThan(reels.length);
  });

  it('keeps the suppressed slot in the feed rather than removing it', async () => {
    const { result } = mount({ consent: { gdprApplies: true } });

    await waitFor(() => {
      const slot = result.current.state.slides.find((s) => s.kind === 'ad');
      expect(slot).toBeDefined();
    });

    // Removing it would shift every index behind it — the feed is virtualised
    // by index, so a slot that vanishes moves content under the viewer.
    const adSlides = result.current.state.slides.filter((s) => s.kind === 'ad');
    expect(adSlides.length).toBeGreaterThan(0);
  });

  it('requests once a consent string is present', async () => {
    mount({ consent: { gdprApplies: true, tcString: 'CPtc' } });
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls[0]).toContain(TAG);
  });

  it('leaves a feed with no CMP alone', async () => {
    // Silence is not refusal, and this is the shape of every existing
    // integration: no consent option at all.
    mount({});
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
  });

  it('can be turned off explicitly', async () => {
    mount({ consent: { gdprApplies: true }, requireConsent: false });
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
  });

  it('does not fetch the VMAP document either', async () => {
    // VMAP is an ad request too.
    mount({
      tagUrl: undefined,
      vmapUrl: 'https://ads.example.com/vmap',
      consent: { gdprApplies: true },
    });

    // Give the VMAP effect a chance to run before asserting the absence.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toHaveLength(0);
  });
});
