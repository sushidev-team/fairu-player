/**
 * Bridge between the parsed VAST model and the {@link ReelAd} shape the
 * reels player renders.
 */

import type { ReelAd } from '@/types/reels';
import { VastError, VastErrorCode, type MediaFileSelectionOptions, type VastAd } from '@/types/vast';
import { getLinearCreative } from './parseVast';
import { selectMediaFile, verticalFeedMediaOptions } from './mediaFile';

export interface ToReelAdOptions {
  /** Media-file selection hints. Defaults to {@link verticalFeedMediaOptions}. */
  mediaFileOptions?: MediaFileSelectionOptions;
  /**
   * Skip offset used when the creative declares no `skipoffset`.
   * `null` keeps the ad non-skippable.
   */
  defaultSkipOffset?: number | null;
  /** Fallback CTA label when the ad has no explicit one. */
  ctaLabel?: string;
}

/**
 * Convert a resolved VAST ad into a playable {@link ReelAd}.
 *
 * @throws {VastError} 403 when no `<MediaFile>` is playable, 400 when the ad has
 * no `<Linear>` creative at all.
 */
export function vastAdToReelAd(ad: VastAd, options: ToReelAdOptions = {}): ReelAd {
  const linear = getLinearCreative(ad);

  if (!linear) {
    throw new VastError(
      `VAST ad ${ad.id} has no linear creative`,
      VastErrorCode.GENERAL_LINEAR,
      ad.errorUrls
    );
  }

  const mediaOptions = options.mediaFileOptions ?? verticalFeedMediaOptions();
  const mediaFile = selectMediaFile(linear.mediaFiles, mediaOptions);

  if (!mediaFile) {
    throw new VastError(
      `VAST ad ${ad.id} has no playable media file`,
      VastErrorCode.NO_SUPPORTED_MEDIAFILE,
      ad.errorUrls
    );
  }

  // `skipoffset` may legitimately be 0 ("skippable immediately"), so only a
  // missing offset falls back to the player default.
  const skipOffset = linear.skipOffset ?? options.defaultSkipOffset ?? null;

  return {
    id: ad.id,
    src: mediaFile.url,
    mimeType: mediaFile.type,
    duration: linear.duration,
    skipOffset,
    title: ad.adTitle,
    advertiser: ad.advertiser ?? ad.adSystem,
    description: ad.description,
    ctaLabel: options.ctaLabel,
    clickThroughUrl: linear.videoClicks.clickThroughUrl,
    clickTrackingUrls: linear.videoClicks.clickTrackingUrls,
    impressionUrls: ad.impressionUrls,
    trackingEvents: linear.trackingEvents,
    progressTrackings: linear.progressTrackings,
    errorUrls: ad.errorUrls,
    icons: linear.icons,
    vast: ad,
  };
}

/**
 * Convert a list of VAST ads, dropping the ones that cannot be played.
 *
 * Ad pods routinely mix renditions the player cannot handle; dropping those
 * individually keeps the rest of the pod playable instead of failing the break.
 *
 * @returns the playable ads plus the errors for the ones that were dropped
 */
export function vastAdsToReelAds(
  ads: VastAd[],
  options: ToReelAdOptions = {}
): { ads: ReelAd[]; errors: VastError[] } {
  const out: ReelAd[] = [];
  const errors: VastError[] = [];

  for (const ad of ads) {
    try {
      out.push(vastAdToReelAd(ad, options));
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
