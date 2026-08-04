/**
 * Bridge between the VAST pipeline and the audio player.
 *
 * VAST 4.1 folded DAAST into the main specification and retired it as a separate
 * standard, so a podcast ad is an ordinary VAST document — the only thing that
 * differs from video is which `<MediaFile>` types the player accepts, and the
 * fact that a `<Companion>` (the "now playing" artwork) is the *primary* visual
 * surface rather than an afterthought.
 */

import type { Ad, AdBreak, AdPosition, AdTrackingUrls } from '@/types/ads';
import {
  VastError,
  VastErrorCode,
  type MediaFileSelectionOptions,
  type VastAd,
  type VastNonLinearCreative,
  type VastTrackingEvent,
} from '@/types/vast';
import { getLinearCreative } from './parseVast';
import { audioAdMediaOptions, selectMediaFile } from './mediaFile';

export interface ToAudioAdOptions {
  /** Media-file selection hints. Defaults to {@link audioAdMediaOptions}. */
  mediaFileOptions?: MediaFileSelectionOptions;
  /** Skip offset when the creative declares none. `null` = non-skippable. */
  defaultSkipOffset?: number | null;
}

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

/** The `<Companion>` creatives of an ad, largest first. */
export function getCompanions(ad: VastAd): VastNonLinearCreative[] {
  return ad.creatives
    .filter((c): c is VastNonLinearCreative => c.type === 'companion')
    .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0));
}

/**
 * Pick the companion that best fits a square artwork slot.
 *
 * Podcast players show cover art, so a roughly square creative beats a wide
 * banner even when the banner has more pixels. Falls back to the largest
 * available when nothing is close to square.
 */
export function selectCompanion(
  companions: VastNonLinearCreative[],
  targetAspect = 1
): VastNonLinearCreative | undefined {
  const renderable = companions.filter((c) => c.staticResource || c.htmlResource || c.iframeResource);
  if (renderable.length === 0) return undefined;

  const scored = renderable.map((c) => {
    const aspect = c.width && c.height ? c.width / c.height : targetAspect;
    return { c, distance: Math.abs(Math.log(aspect / targetAspect)) };
  });

  scored.sort((a, b) => a.distance - b.distance);
  return scored[0].c;
}

/**
 * Convert a resolved VAST ad into an audio {@link Ad}.
 *
 * @throws {VastError} 403 when no audio `<MediaFile>` is playable, 400 when the
 * ad has no `<Linear>` creative.
 */
export function vastAdToAudioAd(ad: VastAd, options: ToAudioAdOptions = {}): Ad {
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
    options.mediaFileOptions ?? audioAdMediaOptions()
  );

  if (!mediaFile) {
    throw new VastError(
      `VAST ad ${ad.id} has no playable audio media file`,
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

  // The artwork slot is square, so prefer a square companion.
  const companion = selectCompanion(getCompanions(ad));

  return {
    id: ad.id,
    src: mediaFile.url,
    duration: linear.duration,
    skipAfterSeconds: linear.skipOffset ?? options.defaultSkipOffset ?? null,
    clickThroughUrl: linear.videoClicks.clickThroughUrl,
    title: ad.adTitle,
    description: ad.description,
    trackingUrls,
    ...(linear.icons.length > 0 ? { icons: linear.icons } : {}),
    ...(companion?.staticResource
      ? {
          companion: {
            imageUrl: companion.staticResource,
            clickUrl: companion.clickThroughUrl ?? linear.videoClicks.clickThroughUrl ?? '',
            width: companion.width ?? 0,
            height: companion.height ?? 0,
            clickTrackingUrls: companion.clickTrackingUrls,
            trackingEvents: companion.trackingEvents,
          },
        }
      : {}),
  };
}

/** Convert several VAST ads, dropping the ones that cannot be played. */
export function vastAdsToAudioAds(
  ads: VastAd[],
  options: ToAudioAdOptions = {}
): { ads: Ad[]; errors: VastError[] } {
  const out: Ad[] = [];
  const errors: VastError[] = [];

  for (const ad of ads) {
    try {
      out.push(vastAdToAudioAd(ad, options));
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

/** Wrap converted ads into an {@link AdBreak}. */
export function toAudioAdBreak(
  id: string,
  position: AdPosition,
  ads: Ad[],
  triggerTime?: number
): AdBreak {
  return {
    id,
    position,
    ...(triggerTime !== undefined ? { triggerTime } : {}),
    ads,
  };
}
