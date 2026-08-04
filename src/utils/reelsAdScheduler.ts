/**
 * Ad-slot placement for the reels feed.
 *
 * Placement is a *pure* function of the content list and the config. That
 * matters: the feed is virtualised by index, so a slot must never move once the
 * viewer has scrolled past it. Frequency capping is therefore not expressed by
 * removing slots — a capped slot stays in the list and simply resolves to
 * `empty`, which the player scrolls straight through. This is also how real
 * exchanges behave: the slot exists, the auction just does not fill it.
 */

import type {
  Reel,
  ReelAdSlot,
  ReelContentSlide,
  ReelAdSlideEntry,
  ReelSlide,
  ReelsAdConfig,
} from '@/types/reels';
import type { VmapAdBreak } from '@/types/vast';
import { isLinearBreak, offsetToContentCount } from './vast/parseVmap';
import { checkAdCaps, type AdCapReason, type AdSessionState } from './adCaps';

const DEFAULT_FREQUENCY = 4;
const DEFAULT_START_AFTER = 2;

/** Normalise the tag URL config into a waterfall list. */
export function adTagUrls(config: ReelsAdConfig | undefined): string[] {
  if (!config?.tagUrl) return [];
  return Array.isArray(config.tagUrl) ? config.tagUrl.filter(Boolean) : [config.tagUrl];
}

/**
 * Plan the ad slots for a feed of `contentCount` reels using the
 * `startAfter` / `frequency` pacing model.
 */
export function planFrequencySlots(
  contentCount: number,
  config: ReelsAdConfig
): ReelAdSlot[] {
  const frequency = Math.max(1, Math.floor(config.frequency ?? DEFAULT_FREQUENCY));
  const startAfter = Math.max(0, Math.floor(config.startAfter ?? DEFAULT_START_AFTER));

  const slots: ReelAdSlot[] = [];
  for (let after = startAfter; after < contentCount; after += frequency) {
    slots.push(makeSlot(after, config, slots.length));
  }

  return slots;
}

/**
 * Plan the ad slots from a parsed VMAP document.
 *
 * Only `linear` breaks produce ad reels — `nonlinear` and `display` breaks have
 * no place in a full-bleed vertical feed and are ignored.
 */
export function planVmapSlots(
  contentCount: number,
  breaks: VmapAdBreak[],
  config: ReelsAdConfig
): ReelAdSlot[] {
  const slots: ReelAdSlot[] = [];

  for (const adBreak of breaks) {
    if (!isLinearBreak(adBreak)) continue;

    const after = offsetToContentCount(adBreak.timeOffset, contentCount);
    if (after === null) continue;

    const source = adBreak.adSource;
    const hasVmapSource = Boolean(source?.adTagUrl || source?.vastAdData);

    slots.push({
      id: `slot-${adBreak.id}`,
      afterContentCount: after,
      vmapBreakId: adBreak.id,
      source: {
        tagUrl: source?.adTagUrl,
        vastXml: source?.vastAdData,
        // A break with no AdSource of its own falls back to the configured
        // static inventory, so a VMAP that only describes *placement* still works.
        ad: hasVmapSource ? undefined : config.ads?.[slots.length],
      },
    });

    // `repeatAfter` turns one break into a recurring one. Mapped onto the feed
    // with the same ~15 s-per-reel assumption used by `offsetToContentCount`.
    if (adBreak.repeatAfter && adBreak.repeatAfter > 0) {
      const step = Math.max(1, Math.round(adBreak.repeatAfter / 15));
      for (let next = after + step; next < contentCount; next += step) {
        slots.push({
          id: `slot-${adBreak.id}-r${next}`,
          afterContentCount: next,
          vmapBreakId: adBreak.id,
          source: {
            tagUrl: source?.adTagUrl,
            vastXml: source?.vastAdData,
          },
        });
      }
    }
  }

  return slots.sort((a, b) => a.afterContentCount - b.afterContentCount);
}

function makeSlot(
  afterContentCount: number,
  config: ReelsAdConfig,
  ordinal: number
): ReelAdSlot {
  const tags = adTagUrls(config);
  const staticAds = config.ads ?? [];

  // A slot built from the frequency model carries no tag of its own — the
  // resolver walks `config.tagUrl` as a waterfall instead, so a failing tag can
  // fall through to the next one. Static ads are the house-ad / offline
  // fallback and cycle so a short list keeps working on a long feed.
  return {
    id: `slot-${afterContentCount}-${ordinal}`,
    afterContentCount,
    source: {
      ad:
        tags.length === 0 && staticAds.length > 0
          ? staticAds[ordinal % staticAds.length]
          : undefined,
    },
  };
}

/**
 * Build the full slide list by interleaving ad slots into the content reels.
 *
 * `slots` are placed by `afterContentCount`; several slots targeting the same
 * position are emitted back to back (a pod split across slides).
 */
export function interleaveSlides(reels: Reel[], slots: ReelAdSlot[]): ReelSlide[] {
  const slides: ReelSlide[] = [];
  const byPosition = new Map<number, ReelAdSlot[]>();

  for (const slot of slots) {
    const list = byPosition.get(slot.afterContentCount);
    if (list) list.push(slot);
    else byPosition.set(slot.afterContentCount, [slot]);
  }

  const pushSlots = (position: number) => {
    for (const slot of byPosition.get(position) ?? []) {
      slides.push({
        kind: 'ad',
        key: `ad:${slot.id}`,
        index: slides.length,
        slot,
      } satisfies ReelAdSlideEntry);
    }
  };

  for (const [contentIndex, reel] of reels.entries()) {
    pushSlots(contentIndex);
    slides.push({
      kind: 'content',
      key: `reel:${reel.id}`,
      index: slides.length,
      contentIndex,
      reel,
    } satisfies ReelContentSlide);
  }

  // Slots positioned at or past the end of the current content. In an infinite
  // feed these become reachable as more reels arrive, so they are only emitted
  // once they are genuinely at the tail.
  pushSlots(reels.length);

  return slides;
}

/**
 * Build the slide list for a feed.
 *
 * @param reels - the content reels
 * @param config - ad configuration; ads are omitted entirely when disabled
 * @param vmapBreaks - parsed VMAP breaks; when present they replace the
 * `frequency` model
 */
export function buildSlides(
  reels: Reel[],
  config: ReelsAdConfig | undefined,
  vmapBreaks?: VmapAdBreak[]
): ReelSlide[] {
  if (!config?.enabled || reels.length === 0) {
    return reels.map((reel, contentIndex) => ({
      kind: 'content',
      key: `reel:${reel.id}`,
      index: contentIndex,
      contentIndex,
      reel,
    }));
  }

  const slots =
    vmapBreaks && vmapBreaks.length > 0
      ? planVmapSlots(reels.length, vmapBreaks, config)
      : planFrequencySlots(reels.length, config);

  return interleaveSlides(reels, slots);
}

/**
 * Reason a slot was not filled.
 *
 * `no-inventory` is specific to the feed: a slot exists in the list but has no
 * ad source behind it. The capping reasons themselves are shared with the audio
 * and video players — see {@link import('./adCaps').checkAdCaps}, which is the
 * one implementation all three use.
 */
export type ReelsAdCapReason = AdCapReason | 'no-inventory';

export { checkAdCaps };
export type { AdCapReason, AdSessionState };

/** Whether a slot has any inventory source configured at all. */
export function slotHasSource(slot: ReelAdSlot, config: ReelsAdConfig): boolean {
  return Boolean(
    slot.source.ad ||
      slot.source.vastXml ||
      slot.source.tagUrl ||
      adTagUrls(config).length > 0 ||
      (config.ads?.length ?? 0) > 0
  );
}
