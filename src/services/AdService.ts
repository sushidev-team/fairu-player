import type { AdConfig, Ad, AdBreak, AdPosition } from '@/types/ads';

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
   * Track ad event
   */
  async trackAdEvent(ad: Ad, eventType: keyof NonNullable<Ad['trackingUrls']>): Promise<void> {
    const url = ad.trackingUrls?.[eventType];
    if (!url) return;

    try {
      await fetch(url, { method: 'GET', mode: 'no-cors' });
    } catch (error) {
      console.error(`Failed to track ad ${eventType}:`, error);
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
