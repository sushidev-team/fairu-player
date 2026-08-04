/**
 * Fires VAST tracking pixels for one ad playback.
 *
 * The tracker is deliberately stateful and single-use: it owns the "fired once"
 * bookkeeping for impressions, quartiles and offset-based progress events, which
 * is the part that is easy to get wrong (double-counted impressions are billing
 * bugs, not cosmetic ones).
 *
 * Pixels are sent as fire-and-forget beacons. `navigator.sendBeacon` is used
 * when available so pixels still land if the page is being torn down; otherwise
 * a `no-cors` fetch with `keepalive` is used.
 */

import { sanitizeEndpoint } from '@/utils/security';
import type { TrackableAd, VastTrackingEvent } from '@/types/vast';
import {
  defaultMacroContext,
  formatPlayhead,
  substituteMacros,
  type VastMacroContext,
} from './macros';

export interface VastTrackerOptions {
  /** Extra macro values merged into every pixel URL. */
  macros?: VastMacroContext;
  /** Called for each pixel actually sent — useful for debug HUDs and tests. */
  onBeacon?: (event: string, url: string) => void;
  /**
   * Called when an event fires, **whether or not the ad declares a URL for it**.
   *
   * This is what lets a host wire lifecycle callbacks (`onFirstQuartile`, …) to
   * the tracker's once-only bookkeeping instead of duplicating it. Firing only
   * on `onBeacon` would silently skip creatives that carry no pixel for an
   * event, which is common for `pause`/`resume`.
   */
  onEvent?: (event: VastTrackingEvent | 'impression') => void;
  /** Override the beacon transport (tests). */
  send?: (url: string) => void;
}

/** Send a single pixel. Never throws. */
export function sendBeacon(url: string): void {
  const safe = sanitizeEndpoint(url);
  if (!safe) return;

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon(safe)) return;
    }
  } catch {
    // sendBeacon throws on some browsers for cross-origin URLs; fall through.
  }

  try {
    void fetch(safe, {
      method: 'GET',
      mode: 'no-cors',
      credentials: 'omit',
      keepalive: true,
      cache: 'no-store',
    }).catch(() => {});
  } catch {
    // Nothing else to try — tracking must never break playback.
  }
}

/**
 * Tracks one ad impression through its lifecycle.
 *
 * Create a tracker when the ad becomes the active slide, call
 * {@link VastTracker.progress} on time updates, and one of
 * {@link VastTracker.complete} / {@link VastTracker.skip} /
 * {@link VastTracker.error} at the end.
 */
export class VastTracker {
  private readonly ad: TrackableAd;
  private readonly options: VastTrackerOptions;
  private readonly fired = new Set<string>();
  private readonly firedProgressOffsets = new Set<number>();
  private lastPlayhead = 0;
  private disposed = false;
  /** `null` until something actually measures visibility. */
  private inView: boolean | null = null;

  constructor(ad: TrackableAd, options: VastTrackerOptions = {}) {
    this.ad = ad;
    this.options = options;
  }

  /** Whether an event has already been fired for this playback. */
  hasFired(event: string): boolean {
    return this.fired.has(event);
  }

  /**
   * Fire the `impression` and `creativeView` pixels. Safe to call repeatedly —
   * only the first call sends anything.
   */
  impression(): void {
    if (this.disposed || this.fired.has('impression')) return;
    this.fired.add('impression');

    this.options.onEvent?.('impression');
    this.emit('impression', this.ad.impressionUrls ?? []);
    this.event('creativeView');
    this.event('loaded');
  }

  /** Fire a one-shot tracking event (`start`, `pause`, `mute`, …). */
  event(name: VastTrackingEvent): void {
    if (this.disposed) return;

    // Repeatable interaction events are allowed to fire more than once; the
    // billing-relevant milestones are not.
    const onceOnly: VastTrackingEvent[] = [
      'creativeView',
      'start',
      'firstQuartile',
      'midpoint',
      'thirdQuartile',
      'complete',
      'skip',
      'loaded',
    ];

    if (onceOnly.includes(name)) {
      if (this.fired.has(name)) return;
      this.fired.add(name);
    }

    this.options.onEvent?.(name);
    this.emit(name, this.ad.trackingEvents?.[name] ?? []);
  }

  /**
   * Report playback progress. Fires quartile milestones and any offset-based
   * `progress` trackings that have been passed.
   */
  progress(currentTime: number, duration: number): void {
    if (this.disposed) return;
    this.lastPlayhead = currentTime;

    if (currentTime > 0) this.event('start');

    if (duration > 0) {
      const percent = (currentTime / duration) * 100;
      if (percent >= 25) this.event('firstQuartile');
      if (percent >= 50) this.event('midpoint');
      if (percent >= 75) this.event('thirdQuartile');
    }

    for (const { offset, url } of this.ad.progressTrackings ?? []) {
      if (currentTime >= offset && !this.firedProgressOffsets.has(offset)) {
        this.firedProgressOffsets.add(offset);
        this.emit('progress', [url]);
      }
    }
  }

  /** Fire `complete` (and the quartiles, if a seek skipped past them). */
  complete(duration?: number): void {
    if (this.disposed) return;
    const total = duration ?? this.ad.duration;
    if (total > 0) this.progress(total, total);
    this.event('complete');
  }

  /** Fire `skip`. */
  skip(): void {
    this.event('skip');
  }

  /** Fire `mute` or `unmute`. */
  mute(muted: boolean): void {
    this.event(muted ? 'mute' : 'unmute');
  }

  /** Fire `pause` or `resume`. */
  paused(isPaused: boolean): void {
    this.event(isPaused ? 'pause' : 'resume');
  }

  /**
   * Fire the click-through tracking pixels. Navigation itself is the caller's
   * job so it can honour popup blockers and the host app's routing.
   */
  click(): void {
    if (this.disposed) return;
    this.emit('click', this.ad.clickTrackingUrls ?? []);
  }

  /**
   * Fire `<Error>` pixels with the `[ERRORCODE]` macro filled in.
   *
   * @param code - VAST error code, see {@link import('@/types/vast').VastErrorCode}
   */
  error(code: number): void {
    if (this.disposed) return;
    this.emit('error', this.ad.errorUrls ?? [], { ERRORCODE: code });
  }

  /**
   * Report current visibility, which fills the `[INVIEW]` macro on every
   * subsequent pixel.
   *
   * Left unset the macro is omitted rather than guessed: `[INVIEW]=1` from a
   * player that never measured is a claim, not a default.
   */
  setInView(inView: boolean): void {
    this.inView = inView;
  }

  /** Fire the viewable-impression pixel matching the measured state. */
  viewable(state: 'viewable' | 'notViewable' | 'undetermined'): void {
    if (this.disposed || !this.ad.vast) return;

    const key = `viewable:${state}`;
    if (this.fired.has(key)) return;
    this.fired.add(key);

    const urls =
      state === 'viewable'
        ? this.ad.vast.viewableUrls
        : state === 'notViewable'
          ? this.ad.vast.notViewableUrls
          : this.ad.vast.viewUndeterminedUrls;

    this.emit(key, urls);
  }

  /** Stop the tracker. Later calls are ignored. */
  dispose(): void {
    this.disposed = true;
  }

  private emit(event: string, urls: string[], extraMacros: VastMacroContext = {}): void {
    if (urls.length === 0) return;

    const context = defaultMacroContext({
      ...this.options.macros,
      ADPLAYHEAD: formatPlayhead(this.lastPlayhead),
      CONTENTPLAYHEAD: formatPlayhead(this.lastPlayhead),
      ...(this.inView === null ? {} : { INVIEW: this.inView ? '1' : '0' }),
      ...extraMacros,
    });

    const send = this.options.send ?? sendBeacon;

    for (const url of urls) {
      const resolved = substituteMacros(url, context);
      send(resolved);
      this.options.onBeacon?.(event, resolved);
    }
  }
}
