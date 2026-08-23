/**
 * The feed controller.
 *
 * `useReelsFeed.consent.test.ts` covers the privacy gate on slot resolution.
 * This covers what the feed does once slides exist: navigation and its clamps,
 * the viewer interactions, and the ad gate — the part that decides whether a
 * swipe is allowed to leave an advert, and where the feed lands when one
 * finishes, fails or is skipped.
 *
 * Driven through `renderHook` rather than the component: the gate is a state
 * machine, and asserting it through rendered markup would test the markup.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useReelsFeed } from './useReelsFeed';
import type { Reel, ReelAd, ReelsAdConfig, ReelAdSlot } from '@/types/reels';

const reels = (count: number): Reel[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `r${i + 1}`,
    src: `https://cdn.example.com/r${i + 1}.mp4`,
    stats: { likes: 10, comments: 1, shares: 1 },
  }));

const ad = (id: string): ReelAd => ({
  id,
  src: `https://cdn.example.com/${id}.mp4`,
  duration: 10,
  skipOffset: 3,
});

/** A feed with one ad slot right after the first reel. */
function feedWithAd(overrides: Partial<ReelsAdConfig> = {}) {
  // Stable identities: the hook re-derives its slide list when `reels` changes,
  // so a fresh array per render would make every effect re-run and mask what is
  // actually being asserted.
  const feed = reels(5);
  const ads: ReelsAdConfig = {
    enabled: true,
    startAfter: 1,
    frequency: 10,
    ads: [ad('a1')],
    ...overrides,
  };
  const config = { ads };
  return renderHook(() => useReelsFeed({ reels: feed, config }));
}

/** The slot the feed planned, once it exists. */
function firstSlot(result: { current: ReturnType<typeof useReelsFeed> }): ReelAdSlot {
  const slide = result.current.state.slides.find((s) => s.kind === 'ad');
  if (!slide || slide.kind !== 'ad') throw new Error('no ad slide was planned');
  return slide.slot;
}

describe('useReelsFeed', () => {
  describe('navigation', () => {
    it('advances and goes back', () => {
      const { result } = renderHook(() => useReelsFeed({ reels: reels(4) }));

      act(() => result.current.controls.next());
      expect(result.current.state.activeIndex).toBe(1);

      act(() => result.current.controls.previous());
      expect(result.current.state.activeIndex).toBe(0);
    });

    it('stops at the last slide', () => {
      const { result } = renderHook(() => useReelsFeed({ reels: reels(3) }));

      act(() => {
        result.current.controls.goTo(2);
      });
      act(() => result.current.controls.next());

      // Wrapping would be worse: a feed that silently restarts reads as a bug
      // and hides the fact that there is nothing more to load.
      expect(result.current.state.activeIndex).toBe(2);
    });

    it('stops at the first slide', () => {
      const { result } = renderHook(() => useReelsFeed({ reels: reels(3) }));

      act(() => result.current.controls.previous());

      expect(result.current.state.activeIndex).toBe(0);
    });

    it('clamps a jump beyond either end', () => {
      const { result } = renderHook(() => useReelsFeed({ reels: reels(3) }));

      act(() => result.current.controls.goTo(99));
      expect(result.current.state.activeIndex).toBe(2);

      act(() => result.current.controls.goTo(-5));
      expect(result.current.state.activeIndex).toBe(0);
    });

    it('jumps to a reel by id', () => {
      const { result } = renderHook(() => useReelsFeed({ reels: reels(5) }));

      act(() => result.current.controls.goToReel('r4'));

      expect(result.current.state.activeSlide).toMatchObject({
        kind: 'content',
        reel: { id: 'r4' },
      });
    });

    it('ignores a reel id it does not have', () => {
      const { result } = renderHook(() => useReelsFeed({ reels: reels(5) }));

      act(() => result.current.controls.goToReel('nope'));

      expect(result.current.state.activeIndex).toBe(0);
    });

    it('honours the initial index', () => {
      const { result } = renderHook(() =>
        useReelsFeed({ reels: reels(5), initialIndex: 3 })
      );

      expect(result.current.state.activeIndex).toBe(3);
    });
  });

  describe('playback and sound', () => {
    it('plays, pauses and toggles', () => {
      const { result } = renderHook(() => useReelsFeed({ reels: reels(2) }));

      act(() => result.current.controls.pause());
      expect(result.current.state.playing).toBe(false);

      act(() => result.current.controls.togglePlay());
      expect(result.current.state.playing).toBe(true);

      act(() => result.current.controls.pause());
      act(() => result.current.controls.play());
      expect(result.current.state.playing).toBe(true);
    });

    it('reports mute changes to the host', () => {
      const onMuteChange = vi.fn();
      const { result } = renderHook(() =>
        useReelsFeed({ reels: reels(2), onMuteChange })
      );

      act(() => result.current.controls.toggleMuted());

      // One switch for the whole feed, so the host can mirror it elsewhere.
      expect(onMuteChange).toHaveBeenCalledWith(result.current.state.muted);
    });

    it('sets mute directly', () => {
      const { result } = renderHook(() => useReelsFeed({ reels: reels(2) }));

      act(() => result.current.controls.setMuted(false));

      expect(result.current.state.muted).toBe(false);
    });
  });

  describe('interactions', () => {
    it('likes and un-likes, keeping the count honest', () => {
      const onLike = vi.fn();
      const { result } = renderHook(() => useReelsFeed({ reels: reels(3), onLike }));

      act(() => result.current.controls.toggleLike('r1'));
      expect(result.current.state.interactions.r1).toMatchObject({
        liked: true,
        likeDelta: 1,
      });
      expect(onLike).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }), true);

      act(() => result.current.controls.toggleLike('r1'));
      // Back where it started — the delta is applied on top of the server count,
      // so a like followed by an un-like has to net to zero.
      expect(result.current.state.interactions.r1).toMatchObject({
        liked: false,
        likeDelta: 0,
      });
    });

    it('saves and follows', () => {
      const onSave = vi.fn();
      const onFollow = vi.fn();
      const { result } = renderHook(() =>
        useReelsFeed({ reels: reels(3), onSave, onFollow })
      );

      act(() => result.current.controls.toggleSave('r2'));
      act(() => result.current.controls.toggleFollow('r2'));

      expect(result.current.state.interactions.r2).toMatchObject({
        saved: true,
        following: true,
      });
      expect(onSave).toHaveBeenCalled();
      expect(onFollow).toHaveBeenCalled();
    });

    it('ignores an interaction with a reel that is not in the feed', () => {
      const onLike = vi.fn();
      const { result } = renderHook(() => useReelsFeed({ reels: reels(2), onLike }));

      act(() => result.current.controls.toggleLike('ghost'));

      expect(onLike).not.toHaveBeenCalled();
      expect(result.current.state.interactions.ghost).toBeUndefined();
    });
  });

  describe('the ad gate', () => {
    it('lets the viewer swipe past an ad by default', () => {
      const { result } = feedWithAd();

      act(() => result.current.controls.next());

      // Shorts and Reels both allow it, and blocking hurts retention — so the
      // default has to stay permissive.
      expect(result.current.state.isAdActive).toBe(true);
      expect(result.current.state.advanceBlocked).toBe(false);
    });

    it('blocks the swipe when the host asks it to', async () => {
      const { result } = feedWithAd({ blockAdvanceUntilComplete: true });

      act(() => result.current.controls.next());
      // The slot fills asynchronously, and the gate only closes on a *filled*
      // slot — an unresolved one must stay passable so a slow auction cannot
      // strand the viewer.
      await waitFor(() => expect(result.current.state.advanceBlocked).toBe(true));

      const stuck = result.current.state.activeIndex;
      act(() => result.current.controls.next());

      expect(result.current.state.activeIndex).toBe(stuck);
    });

    it('never blocks going back', async () => {
      const { result } = feedWithAd({ blockAdvanceUntilComplete: true });

      act(() => result.current.controls.next());
      await waitFor(() => expect(result.current.state.advanceBlocked).toBe(true));
      act(() => result.current.controls.previous());

      // Gating is about not skipping the advert, not about trapping the viewer.
      expect(result.current.state.activeIndex).toBe(0);
    });

    it('releases the gate and advances on a skip', async () => {
      const { result } = feedWithAd({ blockAdvanceUntilComplete: true });

      act(() => result.current.controls.next());
      await waitFor(() => expect(result.current.state.advanceBlocked).toBe(true));
      const adIndex = result.current.state.activeIndex;

      act(() => result.current.controls.skipAd());

      expect(result.current.state.advanceBlocked).toBe(false);
      expect(result.current.state.activeIndex).toBe(adIndex + 1);
    });

    it('keeps the gate open for a host that renders an inline reel array', async () => {
      // What a host actually writes. A fresh array every render re-derives the
      // slide list, so the gating effect runs on every commit — and an
      // imperative release that is not part of that derivation is undone
      // before the caller sees it.
      const config = {
        ads: {
          enabled: true,
          startAfter: 1,
          frequency: 10,
          blockAdvanceUntilComplete: true,
          ads: [ad('a1')],
        },
      };
      const { result } = renderHook(() =>
        useReelsFeed({ reels: reels(4), config })
      );

      act(() => result.current.controls.next());
      await waitFor(() => expect(result.current.state.advanceBlocked).toBe(true));

      act(() => result.current.adPlayback.releaseGate());
      expect(result.current.state.advanceBlocked).toBe(false);

      act(() => result.current.controls.setMuted(false));
      expect(result.current.state.advanceBlocked).toBe(false);
    });

    it('closes the gate again for the next ad', async () => {
      const { result } = feedWithAd({
        blockAdvanceUntilComplete: true,
        frequency: 2,
        ads: [ad('a1'), ad('a2')],
      });

      const adIndices = result.current.state.slides.flatMap((slide, index) =>
        slide.kind === 'ad' ? [index] : []
      );
      expect(adIndices.length).toBeGreaterThan(1);

      act(() => result.current.controls.goTo(adIndices[0]));
      await waitFor(() => expect(result.current.state.advanceBlocked).toBe(true));
      act(() => result.current.adPlayback.releaseGate());
      expect(result.current.state.advanceBlocked).toBe(false);

      act(() => result.current.controls.goTo(adIndices[1]));

      // The release names one slot, so it expires by itself rather than
      // disabling gating for the rest of the session.
      await waitFor(() => expect(result.current.state.advanceBlocked).toBe(true));
    });

    it('releases the gate on request', async () => {
      const { result } = feedWithAd({ blockAdvanceUntilComplete: true });

      act(() => result.current.controls.next());
      await waitFor(() => expect(result.current.state.advanceBlocked).toBe(true));
      act(() => result.current.adPlayback.releaseGate());

      expect(result.current.state.advanceBlocked).toBe(false);
    });
  });

  describe('an ad on the final slide', () => {
    /*
      The one place the gate cannot rely on the index moving. `clampIndex` pins
      the last slide, so `activeSlide` never changes and the gating effect
      re-derives a closed gate on an advert that already finished. A VMAP
      `timeOffset="end"` break lands exactly there.

      The inline `reels` array is not incidental either: it is what makes the
      effect re-run at all, and it is what a host writes.
    */
    const VMAP = `<?xml version="1.0"?>
<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
  <vmap:AdBreak timeOffset="end" breakType="linear" breakId="post"></vmap:AdBreak>
</vmap:VMAP>`;

    const config = {
      ads: {
        enabled: true,
        vmapXml: VMAP,
        blockAdvanceUntilComplete: true,
        ads: [ad('a1')],
      } as ReelsAdConfig,
    };

    async function onTheLastAd() {
      const { result } = renderHook(() =>
        useReelsFeed({
          reels: [
            { id: 'r1', src: 'https://cdn.example.com/r1.mp4' },
            { id: 'r2', src: 'https://cdn.example.com/r2.mp4' },
            { id: 'r3', src: 'https://cdn.example.com/r3.mp4' },
          ],
          config,
        })
      );

      const slides = result.current.state.slides;
      const adIndex = slides.findIndex((slide) => slide.kind === 'ad');
      expect(adIndex).toBe(slides.length - 1);

      act(() => result.current.controls.goTo(adIndex));
      await waitFor(() => expect(result.current.state.advanceBlocked).toBe(true));

      const slide = result.current.state.activeSlide;
      if (slide?.kind !== 'ad') throw new Error('expected to be on the ad');
      return { result, slot: slide.slot };
    }

    it('opens the gate when the ad completes', async () => {
      const { result, slot } = await onTheLastAd();

      act(() => result.current.adPlayback.onAdComplete(ad('a1'), slot));
      expect(result.current.state.advanceBlocked).toBe(false);

      act(() => result.current.controls.setMuted(false));
      expect(result.current.state.advanceBlocked).toBe(false);
    });

    it('opens the gate when the ad fails', async () => {
      const { result, slot } = await onTheLastAd();

      act(() => result.current.adPlayback.onAdError(new Error('broken'), ad('a1'), slot));
      act(() => result.current.controls.setMuted(false));

      expect(result.current.state.advanceBlocked).toBe(false);
    });

    it('opens the gate when the viewer skips', async () => {
      const { result } = await onTheLastAd();

      act(() => result.current.controls.skipAd());
      act(() => result.current.controls.setMuted(false));

      expect(result.current.state.advanceBlocked).toBe(false);
    });
  });

  describe('ad playback', () => {
    it('counts an ad against the session', () => {
      const onAdStart = vi.fn();
      const { result } = feedWithAd({ onAdStart });
      const slot = firstSlot(result);

      act(() => result.current.adPlayback.onAdStart(ad('a1'), slot));

      expect(result.current.state.adsShown).toBe(1);
      expect(onAdStart).toHaveBeenCalled();
    });

    it('forwards progress to the host', () => {
      const onAdProgress = vi.fn();
      const { result } = feedWithAd({ onAdProgress });

      act(() => result.current.adPlayback.onAdProgress(ad('a1'), 4, 10));

      expect(onAdProgress).toHaveBeenCalledWith(expect.anything(), 4, 10);
    });

    it('moves on when the ad completes', () => {
      const onAdComplete = vi.fn();
      const { result } = feedWithAd({ onAdComplete });

      act(() => result.current.controls.next());
      const adIndex = result.current.state.activeIndex;
      const slot = firstSlot(result);

      act(() => result.current.adPlayback.onAdComplete(ad('a1'), slot));

      expect(result.current.state.activeIndex).toBe(adIndex + 1);
      expect(onAdComplete).toHaveBeenCalled();
    });

    it('moves on when the ad fails', () => {
      const onAdError = vi.fn();
      const { result } = feedWithAd({ onAdError });

      act(() => result.current.controls.next());
      const adIndex = result.current.state.activeIndex;
      const slot = firstSlot(result);

      act(() =>
        result.current.adPlayback.onAdError(new Error('media failed'), ad('a1'), slot)
      );

      // A broken creative must not become a dead end in the feed.
      expect(result.current.state.activeIndex).toBe(adIndex + 1);
      expect(result.current.state.advanceBlocked).toBe(false);
      expect(onAdError).toHaveBeenCalled();
    });
  });
});
