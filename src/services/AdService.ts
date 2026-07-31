import { toUrlList, type AdConfig, type Ad, type AdBreak, type AdPosition, type AdTrackingUrl } from '@/types/ads';
import { defaultMacroContext, sendBeacon, substituteMacros } from '@/utils/vast';

export class AdService {
  private config: AdConfig;
  private playedAdBreaks: Set<string> = new Set();

  constructor(config: AdConfig) {
    this.config = config;
  }

  /**
   * Get ad breaks for a specific position
   */
  getAdBreaksForPosition(position: AdPosition): AdBreak[] {
    if (!this.config.enabled || !this.config.adBreaks) return [];
    return this.config.adBreaks.filter((ab) => ab.position === position);
  }

  /**
   * Get mid-roll ad breaks that should trigger at a specific time
   */
  getMidRollAdBreaksAtTime(currentTime: number): AdBreak[] {
    if (!this.config.enabled || !this.config.adBreaks) return [];

    return this.config.adBreaks.filter((ab) => {
      if (ab.position !== 'mid-roll') return false;
      if (!ab.triggerTime) return false;
      if (this.playedAdBreaks.has(ab.id)) return false;

      // Check if we've just passed the trigger time
      return currentTime >= ab.triggerTime && currentTime < ab.triggerTime + 1;
    });
  }

  /**
   * Mark ad break as played
   */
  markAdBreakPlayed(adBreakId: string) {
    this.playedAdBreaks.add(adBreakId);
  }

  /**
   * Reset played ad breaks (e.g., when track changes)
   */
  resetPlayedAdBreaks() {
    this.playedAdBreaks.clear();
  }

  /**
   * Track ad event.
   *
   * Fires **every** URL declared for the event — a VAST wrapper chain routinely
   * contributes more than one — with macros substituted and `sendBeacon` as the
   * transport. Prefer {@link import('@/utils/vast').VastTracker} for anything
   * with playback state; it additionally guarantees once-only quartiles.
   *
   * @param eventType - Standard VAST event type (excludes 'progress', which has
   * a different structure)
   */
  trackAdEvent(
    ad: Ad,
    eventType: Exclude<keyof NonNullable<Ad['trackingUrls']>, 'progress'>
  ): void {
    const urls = toUrlList(ad.trackingUrls?.[eventType] as AdTrackingUrl | undefined);
    if (urls.length === 0) return;

    const macros = defaultMacroContext();
    for (const url of urls) {
      sendBeacon(substituteMacros(url, macros));
    }
  }

  /**
   * Check if skip is allowed for an ad
   */
  isSkipAllowed(ad: Ad): boolean {
    if (!this.config.skipAllowed) return false;
    return ad.skipAfterSeconds !== null && ad.skipAfterSeconds !== undefined;
  }

  /**
   * Get skip delay for an ad
   */
  getSkipDelay(ad: Ad): number | null {
    if (!this.isSkipAllowed(ad)) return null;
    return ad.skipAfterSeconds ?? this.config.defaultSkipAfter ?? 5;
  }
}
