/**
 * Bridge between the VAST pipeline and the classic `VideoPlayer`.
 *
 * The reels feed consumes `ReelAd`; `VideoPlayer` consumes `VideoAd` inside a
 * `VideoAdBreak`. This module converts in both directions:
 *
 * - {@link vastAdToVideoAd} — a resolved VAST ad becomes a playable `VideoAd`
 *   whose `trackingUrls` keep **every** pixel per event.
 * - {@link videoAdToTrackable} — any `VideoAd` (hand-authored or VAST-derived)
 *   is normalised into the shape {@link import('./VastTracker').VastTracker}
 *   understands, so both players share one pixel-firing implementation.
 */

import { toUrlList, type Ad, type AdPosition, type AdTrackingUrls } from '@/types/ads';
import type { VideoAd, VideoAdBreak } from '@/types/video';
import {
  VastError,
  VastErrorCode,
  type MediaFileSelectionOptions,
  type TrackableAd,
  type VastAd,
  type VastTrackingEvent,
  type VastTrackingEvents,
} from '@/types/vast';
import { getLinearCreative } from './parseVast';
import { selectMediaFile } from './mediaFile';

export interface ToVideoAdOptions {
  /**
   * Media-file selection hints. Defaults to the player's own pixel size when
   * omitted, falling back to 1280×720.
   */
  mediaFileOptions?: MediaFileSelectionOptions;
  /**
   * Skip offset in seconds when the creative declares no `skipoffset`.
   * `null` keeps the ad non-skippable — which is also what `VideoAd`
   * expresses with `skipAfterSeconds: null`.
   */
  defaultSkipOffset?: number | null;
}

/** Sensible defaults for a 16:9 player. */
export function landscapePlayerMediaOptions(
  overrides: MediaFileSelectionOptions = {}
): MediaFileSelectionOptions {
  const width =
    typeof window !== 'undefined' && window.innerWidth ? Math.min(window.innerWidth, 1920) : 1280;

  return {
    width,
    height: Math.round((width * 9) / 16),
    pixelRatio:
      typeof window !== 'undefined' && window.devicePixelRatio
        ? Math.min(window.devicePixelRatio, 2)
        : 1,
    maxBitrate: 6000,
    allowHls: true,
    ...overrides,
  };
}

/** VAST event names that map onto `AdTrackingUrls` keys. */
const TRACKED_EVENTS = [
  'start',
  'firstQuartile',
  'midpoint',
  'thirdQuartile',
  'complete',
  'skip',
  'pause',
  'resume',
  'mute',
  'unmute',
  'creativeView',
] as const;

/**
 * Convert a resolved VAST ad into a `VideoAd`.
 *
 * Every pixel is preserved: `impression` and `error` become arrays, and each
 * tracking event keeps its full URL list. That is the whole point of the
 * widened {@link AdTrackingUrls} — a wrapper chain contributes pixels that a
 * single-string field would silently drop.
 *
 * @throws {VastError} 403 when no `<MediaFile>` is playable, 400 when the ad has
 * no `<Linear>` creative.
 */
export function vastAdToVideoAd(ad: VastAd, options: ToVideoAdOptions = {}): VideoAd {
  const linear = getLinearCreative(ad);

  if (!linear) {
    throw new VastError(
      `VAST ad ${ad.id} has no linear creative`,
      VastErrorCode.GENERAL_LINEAR,
      ad.errorUrls
    );
  }

  const mediaFile = selectMediaFile(
    linear.mediaFiles,
    options.mediaFileOptions ?? landscapePlayerMediaOptions()
  );

  if (!mediaFile) {
    throw new VastError(
      `VAST ad ${ad.id} has no playable media file`,
      VastErrorCode.NO_SUPPORTED_MEDIAFILE,
      ad.errorUrls
    );
  }

  const trackingUrls: AdTrackingUrls = {
    impression: ad.impressionUrls,
    error: ad.errorUrls,
    click: linear.videoClicks.clickTrackingUrls,
  };

  for (const event of TRACKED_EVENTS) {
    const urls = linear.trackingEvents[event as VastTrackingEvent];
    if (urls?.length) trackingUrls[event] = urls;
  }

  if (linear.progressTrackings.length > 0) {
    trackingUrls.progress = linear.progressTrackings.map(({ offset, url }) => ({ offset, url }));
  }

  // A declared `skipoffset` of 0 means "skippable immediately" and must not be
  // confused with a missing one.
  const skipOffset = linear.skipOffset ?? options.defaultSkipOffset ?? null;

  return {
    id: ad.id,
    src: mediaFile.url,
    duration: linear.duration,
    skipAfterSeconds: skipOffset,
    clickThroughUrl: linear.videoClicks.clickThroughUrl,
    title: ad.adTitle,
    description: ad.description,
    trackingUrls,
    ...(linear.icons.length > 0 ? { icons: linear.icons } : {}),
    // A 6s non-skippable spot is a bumper by IAB convention; surfacing it lets
    // the player fire its bumper callbacks.
    type: linear.duration > 0 && linear.duration <= 6 && skipOffset === null ? 'bumper' : 'standard',
  };
}

/** Convert several VAST ads, dropping the ones that cannot be played. */
export function vastAdsToVideoAds(
  ads: VastAd[],
  options: ToVideoAdOptions = {}
): { ads: VideoAd[]; errors: VastError[] } {
  const out: VideoAd[] = [];
  const errors: VastError[] = [];

  for (const ad of ads) {
    try {
      out.push(vastAdToVideoAd(ad, options));
    } catch (error) {
      errors.push(
        error instanceof VastError
          ? error
          : new VastError(
              error instanceof Error ? error.message : 'Failed to convert VAST ad',
              VastErrorCode.UNDEFINED
            )
      );
    }
  }

  return { ads: out, errors };
}

/** Wrap converted ads into a `VideoAdBreak` at the given position. */
export function toVideoAdBreak(
  id: string,
  position: AdPosition,
  ads: VideoAd[],
  triggerTime?: number
): VideoAdBreak {
  return {
    id,
    position,
    ...(triggerTime !== undefined ? { triggerTime } : {}),
    ads,
  };
}

/**
 * Normalise a `VideoAd` into the shape {@link VastTracker} consumes.
 *
 * Works for hand-authored ads too — a plain `impression: 'https://…'` becomes a
 * one-element list — so the classic player gets macro substitution and
 * once-only quartiles without its configs having to change.
 */
export function videoAdToTrackable(ad: VideoAd): TrackableAd {
  return adToTrackable(ad);
}

/**
 * Normalise any {@link Ad}-shaped object — audio or video — for the tracker.
 *
 * `VideoAd` and the base `Ad` differ only in fields the tracker does not read,
 * so one implementation covers the classic video player, the audio player and
 * the reels feed.
 */
export function adToTrackable(ad: Ad): TrackableAd {
  const urls = ad.trackingUrls;
  const trackingEvents: VastTrackingEvents = {};

  for (const event of TRACKED_EVENTS) {
    const list = toUrlList(urls?.[event]);
    if (list.length > 0) trackingEvents[event as VastTrackingEvent] = list;
  }

  return {
    id: ad.id,
    duration: ad.duration,
    impressionUrls: toUrlList(urls?.impression),
    errorUrls: toUrlList(urls?.error),
    clickTrackingUrls: toUrlList(urls?.click),
    trackingEvents,
    progressTrackings: urls?.progress ?? [],
  };
}
