/**
 * Convert VAST `<NonLinear>` creatives into the player's {@link OverlayAd}.
 *
 * `<NonLinearAds>` were parsed but rendered nowhere, so non-linear inventory
 * could be trafficked and would silently never appear — the ad server counted a
 * response, the viewer saw nothing, and no pixel ever came back.
 *
 * A non-linear ad is a banner *over* the content rather than an interruption of
 * it, so unlike a linear break it carries no timing of its own: VAST leaves
 * placement to the player. `displayAt` is therefore the caller's decision, and
 * `minSuggestedDuration` is honoured as the display length when the creative
 * offers one.
 */

import type { VastAd, VastNonLinearCreative } from '@/types/vast';
import type { OverlayAd } from '@/types/video';

export interface ToOverlayAdOptions {
  /**
   * Seconds from the start of the content at which the overlay appears.
   * Default `0` — visible as soon as playback starts.
   */
  displayAt?: number;
  /** Display length when the creative suggests none. Default `10` seconds. */
  defaultDuration?: number;
  /** Where the banner sits. Default `'bottom'`. */
  position?: 'bottom' | 'top';
  /**
   * Whether the viewer may dismiss it. Default `true`.
   *
   * VAST has no say here, and a banner that cannot be closed over content the
   * viewer chose is the fastest way to lose them.
   */
  closeable?: boolean;
}

/** The non-linear creatives of an ad that this player can actually render. */
export function getNonLinears(ad: VastAd): VastNonLinearCreative[] {
  return ad.creatives.filter(
    (creative): creative is VastNonLinearCreative =>
      creative.type === 'nonlinear' && Boolean(creative.staticResource)
  );
}

/**
 * Convert one VAST ad into overlay banners.
 *
 * Returns an empty array when the ad carries no renderable non-linear creative.
 * `<IFrameResource>` and `<HTMLResource>` are skipped deliberately: rendering
 * third-party markup would need a sandboxed frame with its own security model,
 * which is a separate decision from "show a banner".
 */
export function vastAdToOverlayAds(ad: VastAd, options: ToOverlayAdOptions = {}): OverlayAd[] {
  const { displayAt = 0, defaultDuration = 10, position = 'bottom', closeable = true } = options;

  return getNonLinears(ad).map((creative, index) => {
    const tracking = creative.trackingEvents;

    // A non-linear impression is the ad-level `<Impression>` plus the
    // creative's own `creativeView` — the creative can be trafficked into
    // several slots, and only `creativeView` says which one was shown.
    const impression = [...ad.impressionUrls, ...(tracking.creativeView ?? [])];
    const click = [...creative.clickTrackingUrls, ...(tracking.acceptInvitation ?? [])];
    const close = [...(tracking.close ?? []), ...(tracking.collapse ?? [])];

    return {
      // A creative index keeps ids unique when one ad ships several banners.
      id: index === 0 ? ad.id : `${ad.id}-nonlinear-${index}`,
      imageUrl: creative.staticResource!,
      clickThroughUrl: creative.clickThroughUrl,
      displayAt,
      duration: creative.minSuggestedDuration ?? defaultDuration,
      position,
      closeable,
      altText: ad.adTitle,
      ...(impression.length || click.length || close.length
        ? {
            trackingUrls: {
              ...(impression.length ? { impression } : {}),
              ...(click.length ? { click } : {}),
              ...(close.length ? { close } : {}),
            },
          }
        : {}),
    } satisfies OverlayAd;
  });
}

/** Convert several VAST ads, dropping the ones with nothing renderable. */
export function vastAdsToOverlayAds(
  ads: VastAd[],
  options: ToOverlayAdOptions = {}
): OverlayAd[] {
  return ads.flatMap((ad) => vastAdToOverlayAds(ad, options));
}
