import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AdPosition } from '@/types/ads';
import type { VideoAdBreak } from '@/types/video';
import type {
  MediaFileSelectionOptions,
  VastClientOptions,
  VmapAdBreak,
  VmapTimeOffset,
} from '@/types/vast';
import { VastError, VastErrorCode } from '@/types/vast';
import {
  parseVmap,
  requestWaterfall,
  sendBeacon,
  VastClient,
  vastAdsToVideoAds,
  landscapePlayerMediaOptions,
} from '@/utils/vast';

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
   * without it those breaks are dropped rather than guessed.
   */
  duration?: number;

  /** Default skip offset when the creative declares none. `null` = non-skippable. */
  defaultSkipOffset?: number | null;
  /** Forwarded to the VAST client (wrapper depth, timeout, macros). */
  vastOptions?: VastClientOptions;
  /** Media-file selection hints. Defaults to a 16:9 player. */
  mediaFileOptions?: MediaFileSelectionOptions;

  onError?: (error: Error) => void;
  /** Called once the breaks are ready. */
  onResolved?: (adBreaks: VideoAdBreak[]) => void;
}

export interface UseVastAdBreaksReturn {
  /** Ready to hand straight to `<VideoPlayer adConfig={{ enabled: true, adBreaks }} />`. */
  adBreaks: VideoAdBreak[];
  loading: boolean;
  error: Error | null;
  /** Re-request every tag. Use when the content changes. */
  reload: () => void;
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
 * Tags are requested once per mount (and on {@link UseVastAdBreaksReturn.reload}).
 * Creatives that cannot be played are dropped individually, with their `<Error>`
 * pixel fired, so one bad rendition does not lose the whole break.
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
    defaultSkipOffset,
    vastOptions,
    mediaFileOptions,
    onError,
    onResolved,
  } = options;

  const [adBreaks, setAdBreaks] = useState<VideoAdBreak[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
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
  onErrorRef.current = onError;
  onResolvedRef.current = onResolved;

  // Serialise the tag configuration so an inline array literal does not
  // retrigger the request on every render.
  const tagKey = useMemo(
    () => JSON.stringify({ preRoll, midRolls, postRoll, vmapUrl, vmapXml, duration }),
    [preRoll, midRolls, postRoll, vmapUrl, vmapXml, duration]
  );

  useEffect(() => {
    if (!enabled) {
      setAdBreaks([]);
      return;
    }

    const hasWork = Boolean(preRoll || postRoll || vmapUrl || vmapXml || midRolls?.length);
    if (!hasWork) {
      setAdBreaks([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const asList = (value: VastTagSource | VastTagSource[] | undefined): VastTagSource[] =>
      !value ? [] : Array.isArray(value) ? value.filter(Boolean) : [value];

    /** Resolve one tag list into a break, or null when it did not fill. */
    const resolveBreak = async (
      id: string,
      position: AdPosition,
      tags: VastTagSource[],
      triggerTime?: number
    ): Promise<VideoAdBreak | null> => {
      if (tags.length === 0) return null;

      // Inline documents resolve without a network round-trip; URLs go through
      // the waterfall. Mixing both in one list is allowed, with inline entries
      // acting as the guaranteed-fill fallback at the end.
      const inline = tags.find((t): t is { xml: string } => typeof t !== 'string');
      const urls = tags.filter((t): t is string => typeof t === 'string');

      let result =
        urls.length > 0
          ? await requestWaterfall(client, urls, { BREAKPOSITION: position })
          : { ads: [], errorUrls: [], documentCount: 0 };

      if (result.ads.length === 0 && inline) {
        result = await client.resolve(inline.xml);
      }
      const { ads, errors } = vastAdsToVideoAds(result.ads, toOptions);

      // Unplayable creatives still owe the ad server an error pixel.
      for (const err of errors) {
        for (const url of err.errorUrls) {
          sendBeacon(url.replace(/\[ERRORCODE\]/g, String(err.code)));
        }
      }

      if (ads.length === 0) {
        for (const url of result.errorUrls) {
          sendBeacon(url.replace(/\[ERRORCODE\]/g, String(VastErrorCode.WRAPPER_NO_ADS)));
        }
        return null;
      }

      return { id, position, ...(triggerTime !== undefined ? { triggerTime } : {}), ads };
    };

    void (async () => {
      try {
        let breaks: VideoAdBreak[] = [];

        if (vmapUrl || vmapXml) {
          let xml = vmapXml;
          if (!xml && vmapUrl) {
            const response = await fetch(vmapUrl, { mode: 'cors', credentials: 'omit' });
            if (!response.ok) {
              throw new VastError(
                `VMAP request failed with HTTP ${response.status}`,
                VastErrorCode.WRAPPER_NO_ADS
              );
            }
            xml = await response.text();
          }

          const vmapBreaks: VmapAdBreak[] = parseVmap(xml!).adBreaks.filter((b) =>
            b.breakTypes.includes('linear')
          );

          const resolved = await Promise.all(
            vmapBreaks.map(async (adBreak) => {
              const placement = positionFor(adBreak.timeOffset, duration);
              if (!placement) return null;

              const source = adBreak.adSource;
              if (source?.vastAdData) {
                const result = await client.resolve(source.vastAdData);
                const { ads } = vastAdsToVideoAds(result.ads, toOptions);
                if (ads.length === 0) return null;
                return {
                  id: adBreak.id,
                  position: placement.position,
                  ...(placement.triggerTime !== undefined
                    ? { triggerTime: placement.triggerTime }
                    : {}),
                  ads,
                } satisfies VideoAdBreak;
              }

              return resolveBreak(
                adBreak.id,
                placement.position,
                asList(source?.adTagUrl),
                placement.triggerTime
              );
            })
          );

          breaks = resolved.filter((b): b is VideoAdBreak => b !== null);
        } else {
          const requests: Array<Promise<VideoAdBreak | null>> = [
            resolveBreak('vast-preroll', 'pre-roll', asList(preRoll)),
            ...(midRolls ?? []).map((mid, index) =>
              resolveBreak(`vast-midroll-${index}`, 'mid-roll', asList(mid.tagUrl), mid.at)
            ),
            resolveBreak('vast-postroll', 'post-roll', asList(postRoll)),
          ];

          breaks = (await Promise.all(requests)).filter((b): b is VideoAdBreak => b !== null);
        }

        if (cancelled) return;

        // Order by position, then by trigger time. The player selects breaks by
        // position so cross-position order is not load-bearing, but mid-rolls
        // must be ascending for the trigger scan, and a predictable array is
        // much easier to assert against and to read in a debugger.
        const rank: Record<AdPosition, number> = { 'pre-roll': 0, 'mid-roll': 1, 'post-roll': 2 };
        breaks.sort(
          (a, b) => rank[a.position] - rank[b.position] || (a.triggerTime ?? 0) - (b.triggerTime ?? 0)
        );

        setAdBreaks(breaks);
        onResolvedRef.current?.(breaks);
      } catch (caught) {
        if (cancelled) return;
        const err =
          caught instanceof Error ? caught : new Error('Failed to resolve VAST ad breaks');
        setError(err);
        setAdBreaks([]);
        onErrorRef.current?.(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `tagKey` collapses the tag configuration into one stable dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tagKey, nonce, client, toOptions]);

  return { adBreaks, loading, error, reload };
}

export default useVastAdBreaks;
