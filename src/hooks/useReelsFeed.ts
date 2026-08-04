import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createReelInteraction,
  type Reel,
  type ReelAd,
  type ReelAdSlot,
  type ReelAdSlotState,
  type ReelInteraction,
  type ReelsAdConfig,
  type ReelsCallbacks,
  type ReelsConfig,
  type ReelsControls,
  type ReelsState,
} from '@/types/reels';
import type { VmapAdBreak } from '@/types/vast';
import { VastError, VastErrorCode } from '@/types/vast';
import {
  adTagUrls,
  buildSlides,
  checkAdCaps,
  slotHasSource,
} from '@/utils/reelsAdScheduler';
import {
  consentMacros,
  defaultMacroContext,
  parseVmap,
  readConsentFromCmp,
  requestWaterfall,
  sendBeacon,
  substituteMacros,
  VastClient,
  vastAdsToReelAds,
  verticalFeedMediaOptions,
  type VastMacroContext,
} from '@/utils/vast';
import { sanitizeEndpoint } from '@/utils/security';

export interface UseReelsFeedOptions extends ReelsCallbacks {
  reels: Reel[];
  config?: ReelsConfig;
  initialIndex?: number;
}

export interface UseReelsFeedReturn {
  state: ReelsState;
  controls: ReelsControls;
  /** Report ad playback so the hook can drive gating and pacing. */
  adPlayback: {
    /** Called when the ad element starts playing. */
    onAdStart: (ad: ReelAd, slot: ReelAdSlot) => void;
    /** Called on ad time updates. */
    onAdProgress: (ad: ReelAd, currentTime: number, duration: number) => void;
    /** Called when the ad plays to the end. */
    onAdComplete: (ad: ReelAd, slot: ReelAdSlot) => void;
    /** Called when the ad fails. */
    onAdError: (error: Error, ad: ReelAd | null, slot: ReelAdSlot) => void;
    /** Unlocks forward navigation for a gated ad. */
    releaseGate: () => void;
  };
}

const DEFAULT_WINDOW_SIZE = 1;
const DEFAULT_LOAD_MORE_THRESHOLD = 3;

/**
 * Orchestrates a vertical short-form feed.
 *
 * Responsibilities, in the order they matter:
 *
 * 1. **Slide list** — interleaves content reels with ad slots
 *    ({@link buildSlides}). Placement is stable so indices never shift under a
 *    scrolling viewer.
 * 2. **Windowing** — exposes `mountedIndices`, the only slides that should have
 *    a live `<video>` element. Keeping every reel mounted is what makes naive
 *    feed implementations fall over: browsers cap concurrent media elements
 *    (~6 on iOS Safari) and each one holds a decoder.
 * 3. **Ad resolution** — resolves upcoming ad slots through the VAST pipeline,
 *    `prefetch` slides ahead, and applies session caps by resolving a capped
 *    slot to `empty` rather than removing it.
 * 4. **Gating** — optionally blocks forward navigation until an ad finishes.
 * 5. **Interactions** — per-reel like/save/follow state and the local like delta.
 *
 * The hook deliberately does *not* own any DOM: {@link ReelsPlayer} maps
 * `mountedIndices` and `activeIndex` onto elements. That split keeps the feed
 * logic unit-testable without a renderer.
 */
export function useReelsFeed({
  reels,
  config = {},
  initialIndex = 0,
  onSlideChange,
  onReelChange,
  onLoadMore,
  onMuteChange,
  onLike,
  onSave,
  onFollow,
  onError,
}: UseReelsFeedOptions): UseReelsFeedReturn {
  const adConfig = config.ads;
  const windowSize = Math.max(0, config.windowSize ?? DEFAULT_WINDOW_SIZE);
  const loadMoreThreshold = config.loadMoreThreshold ?? DEFAULT_LOAD_MORE_THRESHOLD;

  /* ------------------------------- Consent -------------------------------- */

  /**
   * Privacy macros for every ad request this feed makes.
   *
   * Resolved once and memoised in a ref rather than per slot: a CMP round-trip
   * per slot would repeat work, and — worse — could straddle a consent change,
   * so two ads in one session would carry different strings.
   */
  const consentOption = adConfig?.consent;
  const consentRef = useRef<Promise<VastMacroContext> | null>(null);

  useEffect(() => {
    // A new consent option invalidates the cached answer.
    consentRef.current = null;
  }, [consentOption]);

  const privacyMacros = useCallback((): Promise<VastMacroContext> => {
    consentRef.current ??= Promise.resolve(
      consentOption === 'auto' ? readConsentFromCmp() : consentOption
    ).then(consentMacros);
    return consentRef.current;
  }, [consentOption]);

  /* ---------------------------- VMAP resolution --------------------------- */

  const [vmapBreaks, setVmapBreaks] = useState<VmapAdBreak[] | undefined>(undefined);

  useEffect(() => {
    if (!adConfig?.enabled) return;

    // Inline XML resolves synchronously; a URL needs a fetch.
    if (adConfig.vmapXml) {
      try {
        setVmapBreaks(parseVmap(adConfig.vmapXml).adBreaks);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to parse VMAP'));
      }
      return;
    }

    if (!adConfig.vmapUrl) return;

    let cancelled = false;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

    void (async () => {
      try {
        // The VMAP URL is an ad request like any other: macros substituted (a
        // literal `[CACHEBUSTING]` defeats the cache buster) and scheme checked.
        const url = sanitizeEndpoint(
          substituteMacros(adConfig.vmapUrl!, defaultMacroContext(await privacyMacros()))
        );
        if (!url) throw new Error(`Refusing to fetch VMAP with unsupported URL scheme`);

        const response = await fetch(url, {
          mode: 'cors',
          credentials: 'omit',
          signal: controller?.signal,
        });
        if (!response.ok) throw new Error(`VMAP request failed with HTTP ${response.status}`);
        const xml = await response.text();
        if (!cancelled) setVmapBreaks(parseVmap(xml).adBreaks);
      } catch (error) {
        if (cancelled) return;
        onError?.(error instanceof Error ? error : new Error('Failed to load VMAP'));
      }
    })();

    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, [adConfig?.enabled, adConfig?.vmapUrl, adConfig?.vmapXml, onError, privacyMacros]);

  /* ------------------------------ Slide list ------------------------------ */

  const slides = useMemo(
    () => buildSlides(reels, adConfig, vmapBreaks),
    [reels, adConfig, vmapBreaks]
  );

  /* ------------------------------- Position ------------------------------- */

  // `initialIndex` is a *content* index; translate it to a slide index once.
  const [activeIndex, setActiveIndex] = useState(() => {
    const target = slides.find((s) => s.kind === 'content' && s.contentIndex === initialIndex);
    return target?.index ?? 0;
  });

  const clampIndex = useCallback(
    (index: number) => Math.max(0, Math.min(slides.length - 1, index)),
    [slides.length]
  );

  // Keep the active slide pinned to the same *content* when the list grows or
  // an ad slot appears above it, so an async VMAP load never jumps the viewer.
  const activeKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = activeKeyRef.current;
    if (!key) return;

    const found = slides.findIndex((slide) => slide.key === key);
    if (found >= 0 && found !== activeIndex) setActiveIndex(found);
  }, [slides, activeIndex]);

  const activeSlide = slides[activeIndex] ?? null;
  activeKeyRef.current = activeSlide?.key ?? null;

  /* ----------------------------- Playback state --------------------------- */

  const [muted, setMutedState] = useState(config.muted ?? true);
  const [playing, setPlaying] = useState(config.autoPlay ?? true);

  /* ----------------------------- Interactions ----------------------------- */

  const [interactions, setInteractions] = useState<Record<string, ReelInteraction>>({});

  // Seed interaction state for reels that arrive later (infinite feed) without
  // clobbering what the viewer has already tapped.
  useEffect(() => {
    setInteractions((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const reel of reels) {
        if (!next[reel.id]) {
          next[reel.id] = createReelInteraction(reel);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [reels]);

  /* -------------------------------- Ad state ------------------------------ */

  const [adSlots, setAdSlots] = useState<Record<string, ReelAdSlotState>>({});
  const [adsShown, setAdsShown] = useState(0);
  const [advanceBlocked, setAdvanceBlocked] = useState(false);

  const sessionRef = useRef({ adsShown: 0, lastAdStartedAt: 0 });
  const resolvingRef = useRef<Set<string>>(new Set());

  const vastClient = useMemo(
    () => new VastClient(adConfig?.vastOptions),
    [adConfig?.vastOptions]
  );

  const mediaFileOptions = useMemo(
    () => adConfig?.mediaFileOptions ?? verticalFeedMediaOptions(),
    [adConfig?.mediaFileOptions]
  );

  /**
   * Resolve one ad slot. Idempotent per slot id — concurrent calls for the same
   * slot are collapsed so an impression is never requested twice.
   */
  const resolveSlot = useCallback(
    async (slot: ReelAdSlot) => {
      if (!adConfig?.enabled) return;
      if (resolvingRef.current.has(slot.id)) return;

      const existing = adSlots[slot.id];
      if (existing && existing.status !== 'idle') return;

      // Caps are evaluated at resolve time, not at plan time, so pacing follows
      // real viewing behaviour rather than list position.
      const capped = checkAdCaps(adConfig, sessionRef.current, Date.now());
      if (capped || !slotHasSource(slot, adConfig)) {
        setAdSlots((prev) => ({
          ...prev,
          [slot.id]: { status: 'empty', ads: [], podIndex: 0 },
        }));
        adConfig.onSlotEmpty?.(slot);
        return;
      }

      resolvingRef.current.add(slot.id);
      setAdSlots((prev) => ({
        ...prev,
        [slot.id]: { status: 'loading', ads: [], podIndex: 0 },
      }));

      const toOptions = {
        mediaFileOptions,
        defaultSkipOffset: adConfig.defaultSkipOffset,
      };

      try {
        // 1. Pre-resolved ad — no network at all.
        if (slot.source.ad) {
          setAdSlots((prev) => ({
            ...prev,
            [slot.id]: { status: 'filled', ads: [slot.source.ad!], podIndex: 0 },
          }));
          adConfig.onSlotFilled?.(slot, [slot.source.ad]);
          return;
        }

        const requestMacros = { ...(await privacyMacros()), BREAKPOSITION: 'midroll' };

        // 2. Inline VAST XML (house ads, VMAP VASTAdData, Storybook).
        // 3. Tag URL waterfall.
        const result = slot.source.vastXml
          ? await vastClient.resolve(slot.source.vastXml, {
              macros: defaultMacroContext(requestMacros),
            })
          : await requestWaterfall(
              vastClient,
              slot.source.tagUrl ? [slot.source.tagUrl] : adTagUrls(adConfig),
              requestMacros
            );

        const { ads, errors } = vastAdsToReelAds(result.ads, toOptions);

        // Creatives we could not play still owe the ad server an error pixel.
        for (const error of errors) {
          for (const url of error.errorUrls) {
            sendBeacon(url.replace(/\[ERRORCODE\]/g, String(error.code)));
          }
        }

        if (ads.length === 0) {
          for (const url of result.errorUrls) {
            sendBeacon(url.replace(/\[ERRORCODE\]/g, String(VastErrorCode.WRAPPER_NO_ADS)));
          }
          setAdSlots((prev) => ({
            ...prev,
            [slot.id]: { status: 'empty', ads: [], podIndex: 0 },
          }));
          adConfig.onSlotEmpty?.(slot);
          return;
        }

        setAdSlots((prev) => ({
          ...prev,
          [slot.id]: { status: 'filled', ads, podIndex: 0 },
        }));
        adConfig.onSlotFilled?.(slot, ads);
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error('Failed to resolve ad slot');

        if (err instanceof VastError) {
          for (const url of err.errorUrls) {
            sendBeacon(url.replace(/\[ERRORCODE\]/g, String(err.code)));
          }
        }

        setAdSlots((prev) => ({
          ...prev,
          [slot.id]: { status: 'error', ads: [], podIndex: 0, error: err },
        }));
        adConfig.onSlotError?.(slot, err);
        onError?.(err);
      } finally {
        resolvingRef.current.delete(slot.id);
      }
    },
    [adConfig, adSlots, mediaFileOptions, vastClient, onError, privacyMacros]
  );

  // Resolve the active slot plus `prefetch` slots ahead. Prefetching one slot is
  // the sweet spot: enough to hide the round-trip behind a swipe, not enough to
  // burn impressions the viewer never reaches.
  useEffect(() => {
    if (!adConfig?.enabled) return;

    const prefetch = Math.max(0, adConfig.prefetch ?? 1);
    const upcoming = slides.slice(activeIndex, activeIndex + 1 + prefetch * 2);

    let seen = 0;
    for (const slide of upcoming) {
      if (slide.kind !== 'ad') continue;
      if (seen > prefetch) break;
      seen += 1;
      void resolveSlot(slide.slot);
    }
  }, [activeIndex, slides, adConfig, resolveSlot]);

  /* -------------------------- Empty-slot pass-through --------------------- */

  // An unfilled slot must not become a dead end. Skipping in the direction the
  // viewer was already travelling keeps the gesture feeling continuous.
  const directionRef = useRef<1 | -1>(1);

  useEffect(() => {
    if (!activeSlide || activeSlide.kind !== 'ad') return;

    const slotState = adSlots[activeSlide.slot.id];
    if (!slotState) return;
    if (slotState.status !== 'empty' && slotState.status !== 'error') return;

    // Prefer the travel direction, but fall back to the opposite one when that
    // would leave the feed. Without the fallback an unfilled slot at either end
    // is a dead end — most easily hit with `startAfter: 0` (a pre-roll slot) that
    // comes back empty when the viewer scrolls back up to it.
    const step = directionRef.current;
    const candidates = [activeIndex + step, activeIndex - step];
    const target = candidates.find((index) => index >= 0 && index < slides.length);

    if (target !== undefined) setActiveIndex(target);
  }, [activeSlide, adSlots, activeIndex, slides.length]);

  /* -------------------------------- Gating -------------------------------- */

  useEffect(() => {
    if (!activeSlide || activeSlide.kind !== 'ad') {
      setAdvanceBlocked(false);
      return;
    }
    if (!adConfig?.blockAdvanceUntilComplete) {
      setAdvanceBlocked(false);
      return;
    }

    const slotState = adSlots[activeSlide.slot.id];
    setAdvanceBlocked(slotState?.status === 'filled');
  }, [activeSlide, adConfig?.blockAdvanceUntilComplete, adSlots]);

  /* ------------------------------ Navigation ------------------------------ */

  const goTo = useCallback(
    (index: number) => {
      const target = clampIndex(index);
      setActiveIndex((current) => {
        if (target === current) return current;
        directionRef.current = target > current ? 1 : -1;
        return target;
      });
    },
    [clampIndex]
  );

  const next = useCallback(() => {
    if (advanceBlocked) return;
    directionRef.current = 1;
    setActiveIndex((current) => clampIndex(current + 1));
  }, [advanceBlocked, clampIndex]);

  const previous = useCallback(() => {
    directionRef.current = -1;
    setActiveIndex((current) => clampIndex(current - 1));
  }, [clampIndex]);

  const goToReel = useCallback(
    (reelId: string) => {
      const target = slides.find((s) => s.kind === 'content' && s.reel.id === reelId);
      if (target) goTo(target.index);
    },
    [slides, goTo]
  );

  /* ----------------------------- Change events ---------------------------- */

  const lastNotifiedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!activeSlide) return;
    if (lastNotifiedKey.current === activeSlide.key) return;
    lastNotifiedKey.current = activeSlide.key;

    onSlideChange?.(activeSlide, activeSlide.index);
    if (activeSlide.kind === 'content') {
      onReelChange?.(activeSlide.reel, activeSlide.contentIndex);
    }
  }, [activeSlide, onSlideChange, onReelChange]);

  /* ------------------------------- Load more ------------------------------ */

  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreInFlight = useRef(false);

  useEffect(() => {
    if (!onLoadMore || loadMoreInFlight.current) return;

    const remaining = slides
      .slice(activeIndex + 1)
      .filter((slide) => slide.kind === 'content').length;

    if (remaining > loadMoreThreshold) return;

    loadMoreInFlight.current = true;
    setLoadingMore(true);

    void Promise.resolve(onLoadMore())
      .catch((error) => {
        onError?.(error instanceof Error ? error : new Error('Failed to load more reels'));
      })
      .finally(() => {
        loadMoreInFlight.current = false;
        setLoadingMore(false);
      });
  }, [activeIndex, slides, loadMoreThreshold, onLoadMore, onError]);

  /* ------------------------------- Windowing ------------------------------ */

  const mountedIndices = useMemo(() => {
    const out: number[] = [];
    for (let offset = -windowSize; offset <= windowSize; offset += 1) {
      const index = activeIndex + offset;
      if (index >= 0 && index < slides.length) out.push(index);
    }
    return out;
  }, [activeIndex, windowSize, slides.length]);

  /* ------------------------------- Controls ------------------------------- */

  const setMuted = useCallback(
    (value: boolean) => {
      setMutedState(value);
      onMuteChange?.(value);
    },
    [onMuteChange]
  );

  const toggleMuted = useCallback(() => setMuted(!muted), [muted, setMuted]);

  const toggleInteraction = useCallback(
    (
      reelId: string,
      field: 'liked' | 'saved' | 'following',
      notify?: (reel: Reel, value: boolean) => void
    ) => {
      setInteractions((prev) => {
        const reel = reels.find((r) => r.id === reelId);
        if (!reel) return prev;

        const current = prev[reelId] ?? createReelInteraction(reel);
        const value = !current[field];
        const updated: ReelInteraction = {
          ...current,
          [field]: value,
          likeDelta:
            field === 'liked' ? current.likeDelta + (value ? 1 : -1) : current.likeDelta,
        };

        notify?.(reel, value);
        return { ...prev, [reelId]: updated };
      });
    },
    [reels]
  );

  const controls: ReelsControls = useMemo(
    () => ({
      next,
      previous,
      goTo,
      goToReel,
      setMuted,
      toggleMuted,
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      togglePlay: () => setPlaying((value) => !value),
      toggleLike: (reelId) => toggleInteraction(reelId, 'liked', onLike),
      toggleSave: (reelId) => toggleInteraction(reelId, 'saved', onSave),
      toggleFollow: (reelId) => toggleInteraction(reelId, 'following', onFollow),
      skipAd: () => {
        setAdvanceBlocked(false);
        directionRef.current = 1;
        setActiveIndex((current) => clampIndex(current + 1));
      },
    }),
    [
      next,
      previous,
      goTo,
      goToReel,
      setMuted,
      toggleMuted,
      toggleInteraction,
      onLike,
      onSave,
      onFollow,
      clampIndex,
    ]
  );

  /* ----------------------------- Ad playback ------------------------------ */

  const adPlayback = useMemo(
    () => ({
      onAdStart: (ad: ReelAd, slot: ReelAdSlot) => {
        sessionRef.current.adsShown += 1;
        sessionRef.current.lastAdStartedAt = Date.now();
        setAdsShown(sessionRef.current.adsShown);
        adConfig?.onAdStart?.(ad, slot);
      },
      onAdProgress: (ad: ReelAd, currentTime: number, duration: number) => {
        adConfig?.onAdProgress?.(ad, currentTime, duration);
      },
      onAdComplete: (ad: ReelAd, slot: ReelAdSlot) => {
        setAdvanceBlocked(false);
        adConfig?.onAdComplete?.(ad, slot);

        // Advance through the pod, or out of the slot when it is exhausted.
        const slotState = adSlots[slot.id];
        if (slotState && slotState.podIndex + 1 < slotState.ads.length) {
          setAdSlots((prev) => ({
            ...prev,
            [slot.id]: { ...slotState, podIndex: slotState.podIndex + 1 },
          }));
          return;
        }

        directionRef.current = 1;
        setActiveIndex((current) => clampIndex(current + 1));
      },
      onAdError: (error: Error, ad: ReelAd | null, slot: ReelAdSlot) => {
        setAdvanceBlocked(false);
        adConfig?.onAdError?.(error, ad, slot);
        directionRef.current = 1;
        setActiveIndex((current) => clampIndex(current + 1));
      },
      releaseGate: () => setAdvanceBlocked(false),
    }),
    [adConfig, adSlots, clampIndex]
  );

  const state: ReelsState = {
    slides,
    activeIndex,
    activeSlide,
    mountedIndices,
    isAdActive: activeSlide?.kind === 'ad',
    advanceBlocked,
    muted,
    playing,
    adSlots,
    interactions,
    adsShown,
    loadingMore,
  };

  return { state, controls, adPlayback };
}

/** Convenience re-export so consumers do not need to import the config type separately. */
export type { ReelsConfig, ReelsAdConfig };
