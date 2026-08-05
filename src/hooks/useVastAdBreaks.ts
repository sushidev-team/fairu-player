import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AdPosition } from '@/types/ads';
import type { OverlayAd, VideoAdBreak } from '@/types/video';
import type {
  MediaFileSelectionOptions,
  VastClientOptions,
  VmapAdBreak,
  VmapTimeOffset,
} from '@/types/vast';
import { VastError, VastErrorCode } from '@/types/vast';
import {
  consentAllowsAdRequest,
  consentMacros,
  defaultMacroContext,
  parseVmap,
  readConsentFromCmp,
  requestWaterfall,
  sendBeacon,
  substituteMacros,
  VastClient,
  vastAdsToOverlayAds,
  vastAdsToVideoAds,
  landscapePlayerMediaOptions,
  type AdConsent,
  type VastMacroContext,
} from '@/utils/vast';
import { sanitizeEndpoint } from '@/utils/security';

/**
 * Where the ads for one break come from.
 *
 * A plain string is a tag URL. `{ xml }` is a VAST document the host already
 * has — served alongside the page, or stored per channel — which skips the
 * browser round-trip entirely and works without the ad server sending CORS
 * headers. Note that a `data:` URL is **not** a substitute: tag URLs are
 * validated to be absolute `http(s)` so a hostile config cannot smuggle another
 * scheme into the ad pipeline.
 */
export type VastTagSource = string | { xml: string };

/** A mid-roll slot: where its ads come from, and when to play them. */
export interface MidRollTag {
  /** Trigger time in seconds from the start of the content. */
  at: number;
  tagUrl: VastTagSource | VastTagSource[];
}

/**
 * When the ad tags are actually requested.
 *
 * - `eager` — every break is requested at mount. Simple, and the only option
 *   that needs no wiring, but a mid-roll at 20 minutes is then requested twenty
 *   minutes before it plays: the bids have long expired, the creative may be
 *   stale, and every viewer who leaves early has still cost an ad request that
 *   never became an impression.
 * - `just-in-time` — each break is requested shortly before it is due, driven by
 *   {@link UseVastAdBreaksReturn.notifyTime}. Requires the host to feed the
 *   playhead back; breaks the viewer never reaches are never requested.
 */
export type AdRequestStrategy = 'eager' | 'just-in-time';

/** Default lead time for a just-in-time request. */
const DEFAULT_PREFETCH_SECONDS = 15;

export interface UseVastAdBreaksOptions {
  /** Turn the whole thing off without unmounting. Default `true`. */
  enabled?: boolean;

  /** Pre-roll source(s). Several entries are tried in order until one fills. */
  preRoll?: VastTagSource | VastTagSource[];
  /** Mid-roll sources with their trigger times. */
  midRolls?: MidRollTag[];
  /** Post-roll source(s). */
  postRoll?: VastTagSource | VastTagSource[];

  /**
   * VMAP document. When supplied it **replaces** `preRoll`/`midRolls`/`postRoll`
   * — the point of VMAP is that the ad server owns placement, not the player.
   */
  vmapUrl?: string;
  /** Inline VMAP XML, for tests and server-rendered configs. */
  vmapXml?: string;

  /**
   * Content duration in seconds. Required to resolve VMAP `percent` offsets;
   * without it those breaks are dropped rather than guessed. Also used to time
   * the post-roll request under `just-in-time`.
   */
  duration?: number;

  /**
   * When to request the tags. Default `'eager'`.
   *
   * `'just-in-time'` is the better behaviour but needs
   * {@link UseVastAdBreaksReturn.notifyTime} wired to the player's
   * `onTimeUpdate`; defaulting to it would silently drop mid- and post-rolls for
   * every existing integration that does not.
   */
  requestStrategy?: AdRequestStrategy;
  /**
   * How many seconds before its trigger a break is requested under
   * `just-in-time`. Default `15` — long enough to hide the round-trip and any
   * wrapper chain, short enough that the bid is still fresh.
   */
  prefetchSeconds?: number;

  /**
   * Privacy signals forwarded to the ad server as `[GDPR]`, `[GDPRCONSENT]`,
   * `[US_PRIVACY]`, `[GPP]`, `[GPP_SID]` and `[LIMITADTRACKING]`.
   *
   * Pass `'auto'` to read them from the page's CMP (`__tcfapi` / `__uspapi` /
   * `__gpp`) before the first ad request. Without a consent string an EU SSP
   * either drops the request or serves it non-personalised, so this is worth
   * wiring even when the legal side is already handled elsewhere.
   */
  consent?: AdConsent | 'auto';

  /**
   * Suppress ad requests when a CMP says GDPR applies and produced no consent
   * string. Default `true`.
   *
   * Narrow on purpose. It blocks exactly one case — consent was required and no
   * answer exists — and leaves the ambiguous ones alone: a page with no CMP is
   * silence, not refusal, and a user who was asked and declined still produces a
   * `tcString` encoding that refusal.
   *
   * Defaulting to `true` changes nothing for integrations that pass no
   * `consent`, because without a CMP reading there is no `gdprApplies` to act
   * on. It only ever bites once you have opted into reading consent at all.
   */
  requireConsent?: boolean;

  /**
   * Called when {@link requireConsent} suppressed the requests.
   *
   * Worth wiring: a blocked session and a session with no inventory look
   * identical in a fill-rate report and need completely different fixes.
   */
  onConsentBlocked?: (consent: AdConsent | undefined) => void;

  /** Default skip offset when the creative declares none. `null` = non-skippable. */
  defaultSkipOffset?: number | null;
  /** Forwarded to the VAST client (wrapper depth, timeout, macros). */
  vastOptions?: VastClientOptions;
  /** Media-file selection hints. Defaults to a 16:9 player. */
  mediaFileOptions?: MediaFileSelectionOptions;

  onError?: (error: Error) => void;
  /**
   * Called whenever the set of ready breaks changes. Under `just-in-time` this
   * fires more than once: after planning, then again as each break fills.
   */
  onResolved?: (adBreaks: VideoAdBreak[]) => void;
  /**
   * Called whenever the set of banners changes.
   *
   * Separate from {@link onResolved} because they arrive on their own schedule:
   * a response can carry a banner and no linear ad at all, which fills nothing
   * and still has something to show.
   */
  onOverlays?: (overlayAds: OverlayAd[]) => void;
}

export interface UseVastAdBreaksReturn {
  /** Ready to hand straight to `<VideoPlayer adConfig={{ enabled: true, adBreaks }} />`. */
  adBreaks: VideoAdBreak[];
  /**
   * Banners from the same responses, ready for `<VideoPlayer config={{ overlayAds }} />`.
   *
   * These are `<NonLinearAds>`: inventory the ad server already trafficked and
   * that the player used to drop on the floor. They are not breaks — nothing is
   * interrupted — so they are returned beside `adBreaks` rather than inside
   * them, and a response carrying only one of these is a fill.
   */
  overlayAds: OverlayAd[];
  loading: boolean;
  error: Error | null;
  /**
   * `true` when {@link UseVastAdBreaksOptions.requireConsent} suppressed the
   * requests. Distinguishes "not allowed to ask" from "asked, nothing came
   * back", which otherwise look the same from `adBreaks: []`.
   */
  consentBlocked: boolean;
  /** Re-request every tag. Use when the content changes. */
  reload: () => void;
  /**
   * Feed the content playhead back so `just-in-time` knows when to request the
   * next break. Wire it straight to the player:
   *
   * ```tsx
   * <VideoPlayer onTimeUpdate={notifyTime} adConfig={{ enabled: true, adBreaks }} />
   * ```
   *
   * Deliberately not React state: it is called on every time update, and a
   * `setState` there would re-render the host app several times a second. Only
   * an actual fill updates state.
   *
   * A no-op under `eager`.
   */
  notifyTime: (currentTime: number, duration?: number) => void;
}

/** A break whose placement is known but whose ads have not been requested yet. */
interface PlannedBreak {
  id: string;
  position: AdPosition;
  triggerTime?: number;
  /** Tag URLs and/or inline documents, tried in order. */
  tags: VastTagSource[];
  /**
   * A VMAP break declared `nonlinear` and not `linear`.
   *
   * Its response is requested like any other and read only for banners: the
   * document said this placement does not interrupt, so a linear creative that
   * happens to ride along must not become a break. Nor does an absent one owe
   * an error — nothing was expecting a spot here.
   */
  overlayOnly?: boolean;
}

/** Map a VMAP offset onto the player's three positions. */
function positionFor(
  offset: VmapTimeOffset,
  duration: number | undefined
): { position: AdPosition; triggerTime?: number } | null {
  switch (offset.kind) {
    case 'start':
      return { position: 'pre-roll' };
    case 'end':
      return { position: 'post-roll' };
    case 'time':
      return { position: 'mid-roll', triggerTime: offset.value };
    case 'percent':
      // Guessing a duration would put the break in the wrong place, which is
      // worse than not showing it.
      if (!duration || duration <= 0) return null;
      return { position: 'mid-roll', triggerTime: offset.value * duration };
    case 'position':
      // `position:N` counts *items*, which only means something in a playlist or
      // feed. A single video has no Nth item.
      return null;
    default:
      return null;
  }
}

/** Ranking used to keep the break list in playback order. */
const POSITION_RANK: Record<AdPosition, number> = {
  'pre-roll': 0,
  'mid-roll': 1,
  'post-roll': 2,
};

function byPlaybackOrder(a: VideoAdBreak, b: VideoAdBreak): number {
  return (
    POSITION_RANK[a.position] - POSITION_RANK[b.position] ||
    (a.triggerTime ?? 0) - (b.triggerTime ?? 0)
  );
}

const asList = (value: VastTagSource | VastTagSource[] | undefined): VastTagSource[] =>
  !value ? [] : Array.isArray(value) ? value.filter(Boolean) : [value];

/**
 * Fetches VAST/VMAP tags and turns them into `VideoAdBreak[]` for
 * {@link import('@/components/VideoPlayer').VideoPlayer}.
 *
 * This is the piece that makes `VideoPlayer` accept an **ad tag** rather than
 * hand-written ad definitions:
 *
 * ```tsx
 * const { adBreaks, loading } = useVastAdBreaks({
 *   preRoll: 'https://ads.example.com/vast?cb=[CACHEBUSTING]',
 *   midRolls: [{ at: 300, tagUrl: 'https://ads.example.com/vast?pos=mid' }],
 *   defaultSkipOffset: 5,
 * });
 *
 * <VideoPlayer
 *   track={track}
 *   adConfig={{ enabled: !loading && adBreaks.length > 0, adBreaks }}
 * />
 * ```
 *
 * Or let a VMAP document decide placement:
 *
 * ```tsx
 * const { adBreaks } = useVastAdBreaks({
 *   vmapUrl: 'https://ads.example.com/vmap',
 *   duration: track.duration,
 * });
 * ```
 *
 * Request each break shortly before it plays instead of all of them at mount:
 *
 * ```tsx
 * const { adBreaks, notifyTime } = useVastAdBreaks({
 *   midRolls: [{ at: 1200, tagUrl }],
 *   requestStrategy: 'just-in-time',
 * });
 *
 * <VideoPlayer onTimeUpdate={notifyTime} adConfig={{ enabled: true, adBreaks }} />
 * ```
 *
 * Placement is always planned up front — for VMAP that means the document is
 * still fetched at mount, because it *is* the schedule. Only the ad requests
 * move. Creatives that cannot be played are dropped individually, with their
 * `<Error>` pixel fired, so one bad rendition does not lose the whole break.
 */
export function useVastAdBreaks(options: UseVastAdBreaksOptions = {}): UseVastAdBreaksReturn {
  const {
    enabled = true,
    preRoll,
    midRolls,
    postRoll,
    vmapUrl,
    vmapXml,
    duration,
    requestStrategy = 'eager',
    prefetchSeconds = DEFAULT_PREFETCH_SECONDS,
    consent,
    requireConsent = true,
    onConsentBlocked,
    defaultSkipOffset,
    vastOptions,
    mediaFileOptions,
    onError,
    onResolved,
    onOverlays,
  } = options;

  const [adBreaks, setAdBreaks] = useState<VideoAdBreak[]>([]);
  const [overlayAds, setOverlayAds] = useState<OverlayAd[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [consentBlocked, setConsentBlocked] = useState(false);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const client = useMemo(() => new VastClient(vastOptions), [vastOptions]);
  const toOptions = useMemo(
    () => ({
      mediaFileOptions: mediaFileOptions ?? landscapePlayerMediaOptions(),
      defaultSkipOffset,
    }),
    [mediaFileOptions, defaultSkipOffset]
  );

  // Callbacks are read from refs so a host passing inline arrow functions does
  // not re-request every ad tag on each render — which would double-count.
  const onErrorRef = useRef(onError);
  const onResolvedRef = useRef(onResolved);
  const onOverlaysRef = useRef(onOverlays);
  const onConsentBlockedRef = useRef(onConsentBlocked);
  onErrorRef.current = onError;
  onResolvedRef.current = onResolved;
  onOverlaysRef.current = onOverlays;
  onConsentBlockedRef.current = onConsentBlocked;

  /**
   * Everything `notifyTime` needs, kept in one ref.
   *
   * `notifyTime` is called from the player on every time update and must not be
   * re-created on each render — so it reads a mutable box rather than closing
   * over state. `generation` guards against a fill from a previous config
   * landing after a reload.
   */
  const pendingRef = useRef({
    generation: 0,
    strategy: 'eager' as AdRequestStrategy,
    prefetch: DEFAULT_PREFETCH_SECONDS,
    duration: undefined as number | undefined,
    planned: [] as PlannedBreak[],
    /** Ids already requested — a no-fill must not be retried on every tick. */
    attempted: new Set<string>(),
    filled: new Map<string, VideoAdBreak>(),
    /** Non-linear creatives from the same responses, keyed by the break they came with. */
    overlays: new Map<string, OverlayAd[]>(),
    macros: {} as VastMacroContext,
    fill: (_planned: PlannedBreak) => {},
  });

  // Serialise the tag configuration so an inline array literal does not
  // retrigger the request on every render.
  const tagKey = useMemo(
    () => JSON.stringify({ preRoll, midRolls, postRoll, vmapUrl, vmapXml, duration, consent }),
    [preRoll, midRolls, postRoll, vmapUrl, vmapXml, duration, consent]
  );

  useEffect(() => {
    const pending = pendingRef.current;
    const generation = pending.generation + 1;

    pending.generation = generation;
    pending.strategy = requestStrategy;
    pending.prefetch = prefetchSeconds;
    pending.duration = duration;
    pending.planned = [];
    pending.attempted = new Set();
    pending.filled = new Map();
    pending.overlays = new Map();
    pending.macros = {};

    setConsentBlocked(false);

    if (!enabled) {
      setAdBreaks([]);
      setOverlayAds([]);
      return;
    }

    const hasWork = Boolean(preRoll || postRoll || vmapUrl || vmapXml || midRolls?.length);
    if (!hasWork) {
      setAdBreaks([]);
      setOverlayAds([]);
      return;
    }

    const live = () => pendingRef.current.generation === generation;

    setLoading(true);
    setError(null);

    /** Publish the current fill set, in playback order. */
    const publish = () => {
      const next = [...pending.filled.values()].sort(byPlaybackOrder);
      setAdBreaks(next);
      onResolvedRef.current?.(next);
    };

    /** Publish the banners, in the order they appear over the content. */
    const publishOverlays = () => {
      const next = [...pending.overlays.values()].flat().sort((a, b) => a.displayAt - b.displayAt);
      setOverlayAds(next);
      onOverlaysRef.current?.(next);
    };

    /** Request one planned break and publish it if it filled. */
    const fill = async (planned: PlannedBreak): Promise<void> => {
      if (!live() || pending.attempted.has(planned.id)) return;
      pending.attempted.add(planned.id);

      const { id, position, triggerTime, tags, overlayOnly } = planned;
      if (tags.length === 0) return;

      // Inline documents resolve without a network round-trip; URLs go through
      // the waterfall. Mixing both in one list is allowed, with inline entries
      // acting as the guaranteed-fill fallback at the end.
      const inline = tags.find((t): t is { xml: string } => typeof t !== 'string');
      const urls = tags.filter((t): t is string => typeof t === 'string');
      const requestMacros = { ...pending.macros, BREAKPOSITION: position };

      let result =
        urls.length > 0
          ? await requestWaterfall(client, urls, requestMacros)
          : { ads: [], errorUrls: [], documentCount: 0 };

      if (result.ads.length === 0 && inline) {
        result = await client.resolve(inline.xml, {
          macros: defaultMacroContext(requestMacros),
        });
      }

      if (!live()) return;

      const { ads, errors } = vastAdsToVideoAds(result.ads, toOptions);

      /*
       * The same response, read for what it also carries.
       *
       * `<NonLinearAds>` were parsed and rendered nowhere: the ad server counted
       * a response, the viewer saw nothing and no pixel ever came back. They are
       * banners over the content rather than interruptions of it, so they are
       * not breaks and do not belong in `adBreaks` — they come out beside them.
       *
       * A non-linear carries no timing of its own; VAST leaves that to the
       * player. The break it arrived with is the honest answer: a mid-roll's
       * banner belongs at the mid-roll's second, and a pre-roll's at the start.
       */
      const overlays = vastAdsToOverlayAds(result.ads, {
        displayAt: position === 'post-roll' ? (pending.duration ?? 0) : (triggerTime ?? 0),
      });

      // Unplayable creatives still owe the ad server an error pixel.
      for (const err of errors) {
        for (const url of err.errorUrls) {
          sendBeacon(url.replace(/\[ERRORCODE\]/g, String(err.code)));
        }
      }

      if (overlays.length > 0) {
        pending.overlays.set(id, overlays);
        publishOverlays();
      }

      /*
       * A break the VMAP declared non-linear is a placement, not an
       * interruption. Its banners are already published above; a linear
       * creative in the same response is not what the document asked for, and
       * an absent one owes no error pixel.
       */
      if (overlayOnly) return;

      if (ads.length === 0) {
        /*
         * A response holding only a banner is a fill, not a no-fill. Reporting
         * WRAPPER_NO_ADS here told the ad server its creative had failed while
         * the player was in fact about to show it — the error that made
         * non-linear inventory look unsellable.
         */
        if (overlays.length === 0) {
          for (const url of result.errorUrls) {
            sendBeacon(url.replace(/\[ERRORCODE\]/g, String(VastErrorCode.WRAPPER_NO_ADS)));
          }
        }

        return;
      }

      pending.filled.set(id, {
        id,
        position,
        ...(triggerTime !== undefined ? { triggerTime } : {}),
        ads,
      });
      publish();
    };

    pending.fill = (planned) => {
      void fill(planned).catch((caught) => {
        if (!live()) return;
        onErrorRef.current?.(
          caught instanceof Error ? caught : new Error('Failed to resolve ad break')
        );
      });
    };

    /** Work out where the breaks go, without requesting any of them yet. */
    const plan = async (): Promise<PlannedBreak[]> => {
      if (!vmapUrl && !vmapXml) {
        return [
          { id: 'vast-preroll', position: 'pre-roll' as const, tags: asList(preRoll) },
          ...(midRolls ?? []).map((mid, index) => ({
            id: `vast-midroll-${index}`,
            position: 'mid-roll' as const,
            triggerTime: mid.at,
            tags: asList(mid.tagUrl),
          })),
          { id: 'vast-postroll', position: 'post-roll' as const, tags: asList(postRoll) },
        ].filter((b) => b.tags.length > 0);
      }

      // The VMAP document *is* the schedule, so it is fetched up front even
      // under `just-in-time` — deferring it would mean not knowing where the
      // breaks are until it is too late to request them.
      let xml = vmapXml;
      if (!xml && vmapUrl) {
        // The VMAP URL is an ad request like any other: it needs its macros
        // substituted (a literal `[CACHEBUSTING]` defeats the cache buster)
        // and its scheme validated before we fetch it.
        const resolvedVmapUrl = sanitizeEndpoint(
          substituteMacros(vmapUrl, defaultMacroContext(pending.macros))
        );
        if (!resolvedVmapUrl) {
          throw new VastError(
            `Refusing to fetch VMAP with unsupported URL scheme: ${vmapUrl}`,
            VastErrorCode.SCHEMA_VALIDATION
          );
        }

        const response = await fetch(resolvedVmapUrl, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) {
          throw new VastError(
            `VMAP request failed with HTTP ${response.status}`,
            VastErrorCode.WRAPPER_NO_ADS
          );
        }
        xml = await response.text();
      }

      /*
       * Non-linear breaks are planned too.
       *
       * Filtering them out here is what kept trafficked banner inventory
       * invisible under VMAP even once the player could render it: the break
       * was discarded before its document was ever fetched.
       */
      const vmapBreaks: VmapAdBreak[] = parseVmap(xml!).adBreaks.filter(
        (b) => b.breakTypes.includes('linear') || b.breakTypes.includes('nonlinear')
      );

      const planned: PlannedBreak[] = [];
      for (const adBreak of vmapBreaks) {
        const placement = positionFor(adBreak.timeOffset, duration);
        if (!placement) continue;

        const source = adBreak.adSource;
        // Inline `<VASTAdData>` and `<AdTagURI>` differ only in where the
        // document comes from, so both become ordinary tag sources.
        const tags: VastTagSource[] = source?.vastAdData
          ? [{ xml: source.vastAdData }]
          : asList(source?.adTagUrl);
        if (tags.length === 0) continue;

        planned.push({
          id: adBreak.id,
          position: placement.position,
          ...(placement.triggerTime !== undefined ? { triggerTime: placement.triggerTime } : {}),
          tags,
          ...(adBreak.breakTypes.includes('linear') ? {} : { overlayOnly: true }),
        });
      }

      return planned;
    };

    void (async () => {
      try {
        // Ask the CMP before the first request, not after — a tag fired without
        // the consent string cannot be retroactively made personalisable.
        const resolvedConsent = consent === 'auto' ? await readConsentFromCmp() : consent;
        if (!live()) return;

        // Checked before planning, so a VMAP document — itself an ad request —
        // is not fetched either.
        if (requireConsent && !consentAllowsAdRequest(resolvedConsent)) {
          setConsentBlocked(true);
          setAdBreaks([]);
          setOverlayAds([]);
          onConsentBlockedRef.current?.(resolvedConsent);
          return;
        }

        pending.macros = consentMacros(resolvedConsent);

        const planned = await plan();
        if (!live()) return;
        pending.planned = planned;

        if (requestStrategy === 'eager') {
          await Promise.all(planned.map((b) => fill(b)));
        } else {
          // The pre-roll is due immediately, so there is nothing to defer.
          const preRollBreaks = planned.filter((b) => b.position === 'pre-roll');
          await Promise.all(preRollBreaks.map((b) => fill(b)));

          // Nothing to time a post-roll against without a duration; requesting
          // it up front beats never requesting it at all.
          if (!duration || duration <= 0) {
            await Promise.all(planned.filter((b) => b.position === 'post-roll').map((b) => fill(b)));
          }
        }

        if (!live()) return;
        // Publish even when nothing filled, so `onResolved` always fires once.
        if (pending.filled.size === 0) publish();
        /*
         * And the banners, unconditionally.
         *
         * They are published as each response yields one, so without this a
         * generation that produced none would leave the previous content's
         * banners on screen — over an episode they were never sold against.
         * `adBreaks` is spared that by the line above; this is its counterpart.
         */
        if (pending.overlays.size === 0) publishOverlays();
      } catch (caught) {
        if (!live()) return;
        const err =
          caught instanceof Error ? caught : new Error('Failed to resolve VAST ad breaks');
        setError(err);
        setAdBreaks([]);
        setOverlayAds([]);
        onErrorRef.current?.(err);
      } finally {
        if (live()) setLoading(false);
      }
    })();

    return () => {
      // Bumping the generation is what cancels in-flight work: a fill that
      // lands afterwards finds a stale generation and drops its result.
      pendingRef.current.generation += 1;
    };
    // `tagKey` collapses the tag configuration into one stable dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tagKey, nonce, client, toOptions, requestStrategy, prefetchSeconds, requireConsent]);

  const notifyTime = useCallback((currentTime: number, contentDuration?: number) => {
    const pending = pendingRef.current;
    if (pending.strategy !== 'just-in-time') return;
    if (!Number.isFinite(currentTime)) return;

    const total = contentDuration ?? pending.duration;

    for (const planned of pending.planned) {
      if (pending.attempted.has(planned.id)) continue;

      if (planned.position === 'mid-roll') {
        if (planned.triggerTime === undefined) continue;
        if (currentTime >= planned.triggerTime - pending.prefetch) pending.fill(planned);
        continue;
      }

      if (planned.position === 'post-roll') {
        if (!total || total <= 0) continue;
        if (currentTime >= total - pending.prefetch) pending.fill(planned);
      }
    }
  }, []);

  return { adBreaks, overlayAds, loading, error, consentBlocked, reload, notifyTime };
}

export default useVastAdBreaks;
