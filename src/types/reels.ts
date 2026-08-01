/**
 * Reels / Shorts — vertical short-form video feed types.
 *
 * The feed is a list of {@link ReelSlide}s. Content slides wrap a {@link Reel};
 * ad slides wrap a {@link ReelAdSlot} that is filled lazily from a VAST tag,
 * a VMAP document, or a pre-resolved {@link ReelAd}.
 */

import type { HLSConfig, Subtitle } from './video';
import type { PartialLabels } from './labels';
import type {
  VastAd,
  VastIcon,
  VastClientOptions,
  MediaFileSelectionOptions,
  VastProgressTracking,
  VastTrackingEvents,
} from './vast';

/* -------------------------------------------------------------------------- */
/*                                   Content                                  */
/* -------------------------------------------------------------------------- */

/** Author / channel attached to a reel. */
export interface ReelAuthor {
  id?: string;
  /** Display handle, e.g. `@fairu`. */
  name: string;
  avatar?: string;
  verified?: boolean;
  /** Whether the current viewer already follows this author. */
  following?: boolean;
}

/** Engagement counters. Rendered via `formatStatNumber`. */
export interface ReelStats {
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
}

/** The audio track credited on a reel (the scrolling ticker at the bottom). */
export interface ReelAudioTrack {
  title?: string;
  artist?: string;
  cover?: string;
  /** Link to the sound's own feed. */
  url?: string;
}

/** A single short-form video in the feed. */
export interface Reel {
  id: string;
  /** Progressive (mp4/webm) or HLS (`.m3u8`) source. */
  src: string;
  /** Shown before the first frame decodes; also used as the placeholder blur. */
  poster?: string;
  /** Known duration in seconds. Optional — read from metadata when absent. */
  duration?: number;
  caption?: string;
  author?: ReelAuthor;
  stats?: ReelStats;
  audio?: ReelAudioTrack;
  subtitles?: Subtitle[];
  /** Viewer state, mirrored into `ReelsState.interactions`. */
  liked?: boolean;
  saved?: boolean;
  /** Call-to-action pinned above the action rail. */
  cta?: { label: string; url: string };
  /** Per-reel loop override. Falls back to `ReelsConfig.loop`. */
  loop?: boolean;
  /** Arbitrary payload passed through to callbacks. */
  meta?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                                     Ads                                    */
/* -------------------------------------------------------------------------- */

/**
 * A playable ad, either resolved from VAST or supplied directly.
 * This is what {@link ReelAdSlide} renders.
 */
export interface ReelAd {
  id: string;
  /** Selected `<MediaFile>` URL (or a direct source when hand-authored). */
  src: string;
  mimeType?: string;
  /** Duration in seconds. */
  duration: number;
  /**
   * Seconds until the skip button unlocks. `null` = non-skippable.
   * Resolved from VAST `skipoffset`, falling back to
   * `ReelsAdConfig.defaultSkipOffset`.
   */
  skipOffset: number | null;
  title?: string;
  advertiser?: string;
  description?: string;
  poster?: string;
  /** CTA button label. Defaults to the `learnMore` label. */
  ctaLabel?: string;
  clickThroughUrl?: string;
  /** Fired in addition to the click-through navigation. */
  clickTrackingUrls?: string[];
  /** Impression pixels, fired once when the ad becomes the active slide. */
  impressionUrls?: string[];
  /** Fire-and-forget tracking events keyed by VAST event name. */
  trackingEvents?: VastTrackingEvents;
  /** Offset-based `progress` trackings. */
  progressTrackings?: VastProgressTracking[];
  /** `<Error>` pixels for playback failures. */
  errorUrls?: string[];
  /** AdChoices / privacy icons. */
  icons?: VastIcon[];
  /** The VAST ad this was derived from, when applicable. */
  vast?: VastAd;
}

/** Where the ads for a slot come from. */
export interface ReelAdSource {
  /** VAST tag URL. Macros such as `[CACHEBUSTING]` are substituted. */
  tagUrl?: string;
  /** Inline VAST XML — useful for tests, house ads and Storybook. */
  vastXml?: string;
  /** Pre-resolved ad; skips the VAST pipeline entirely. */
  ad?: ReelAd;
}

/** Load state of an ad slot. */
export type ReelAdSlotStatus = 'idle' | 'loading' | 'filled' | 'empty' | 'error';

/** A placeholder in the feed that resolves to one or more ads. */
export interface ReelAdSlot {
  id: string;
  /**
   * Number of content reels that precede this slot. Used by the scheduler and
   * reported in callbacks so hosts can correlate slots with their own pacing.
   */
  afterContentCount: number;
  source: ReelAdSource;
  /** Set when the slot originates from a VMAP `<AdBreak>`. */
  vmapBreakId?: string;
}

/** Runtime state of a slot, held by {@link useReelsFeed}. */
export interface ReelAdSlotState {
  status: ReelAdSlotStatus;
  /** Ad pod — more than one entry when the VAST response is a pod. */
  ads: ReelAd[];
  /** Index into `ads` currently playing. */
  podIndex: number;
  error?: Error;
}

/** Ad behaviour for the feed. */
export interface ReelsAdConfig {
  enabled?: boolean;

  /* --- Placement ------------------------------------------------------- */

  /**
   * Insert an ad slide after every N content reels. Default `4`.
   * Ignored when {@link ReelsAdConfig.vmapUrl} or
   * {@link ReelsAdConfig.vmapXml} is supplied.
   */
  frequency?: number;
  /** Number of content reels the viewer must pass before the first ad. Default `2`. */
  startAfter?: number;
  /** Hard cap on ad slides per session. Default `Infinity`. */
  maxAdsPerSession?: number;
  /**
   * Minimum wall-clock seconds between two ad slides. A slot that would violate
   * this is skipped (burned) rather than delayed, matching how Shorts paces ads.
   */
  minSecondsBetweenAds?: number;

  /* --- Inventory ------------------------------------------------------- */

  /**
   * VAST tag URL(s). With several entries the list is used as a waterfall:
   * the next tag is tried when one returns no ad.
   */
  tagUrl?: string | string[];
  /** VMAP 1.0 document URL. Its `<AdBreak>` offsets drive placement. */
  vmapUrl?: string;
  /** Inline VMAP XML, for tests and Storybook. */
  vmapXml?: string;
  /** Static pre-resolved ads, cycled in order. Used when no tag URL is set. */
  ads?: ReelAd[];

  /* --- Playback -------------------------------------------------------- */

  /** Default skip offset in seconds when VAST declares none. `null` = non-skippable. */
  defaultSkipOffset?: number | null;
  /**
   * Block scrolling past an ad until it completes or is skipped. Default `false`
   * — Shorts and Reels both let users swipe away, and blocking hurts retention.
   */
  blockAdvanceUntilComplete?: boolean;
  /** Number of upcoming slots to resolve ahead of time. Default `1`. */
  prefetch?: number;
  /** Options forwarded to the VAST client (wrapper depth, timeout, macros). */
  vastOptions?: VastClientOptions;
  /** Media-file selection hints. Defaults target a 9:16 viewport. */
  mediaFileOptions?: MediaFileSelectionOptions;

  /* --- Callbacks ------------------------------------------------------- */

  onSlotFilled?: (slot: ReelAdSlot, ads: ReelAd[]) => void;
  onSlotEmpty?: (slot: ReelAdSlot) => void;
  onSlotError?: (slot: ReelAdSlot, error: Error) => void;
  onAdStart?: (ad: ReelAd, slot: ReelAdSlot) => void;
  onAdProgress?: (ad: ReelAd, currentTime: number, duration: number) => void;
  onAdComplete?: (ad: ReelAd, slot: ReelAdSlot) => void;
  onAdSkip?: (ad: ReelAd, slot: ReelAdSlot, atTime: number) => void;
  onAdClick?: (ad: ReelAd, slot: ReelAdSlot) => void;
  onAdError?: (error: Error, ad: ReelAd | null, slot: ReelAdSlot) => void;
}

/* -------------------------------------------------------------------------- */
/*                                    Feed                                    */
/* -------------------------------------------------------------------------- */

/** A content slide. */
export interface ReelContentSlide {
  kind: 'content';
  /** Stable key — `reel:<reel.id>`. */
  key: string;
  /** Position within the slide list. */
  index: number;
  /** Position within the content-only list. */
  contentIndex: number;
  reel: Reel;
}

/** An ad slide. */
export interface ReelAdSlideEntry {
  kind: 'ad';
  /** Stable key — `ad:<slot.id>`. */
  key: string;
  index: number;
  slot: ReelAdSlot;
}

export type ReelSlide = ReelContentSlide | ReelAdSlideEntry;

/** Overlay feature toggles. All default to `true` unless noted. */
export interface ReelsFeatures {
  /** Thin progress bar along the bottom edge. */
  progressBar?: boolean;
  /** Allow dragging the progress bar to scrub. */
  scrubbing?: boolean;
  /** The right-hand action rail as a whole. */
  actionRail?: boolean;
  like?: boolean;
  comment?: boolean;
  share?: boolean;
  save?: boolean;
  /** Follow button on the author avatar. */
  follow?: boolean;
  /** Mute/unmute toggle. */
  muteToggle?: boolean;
  /** Caption block with "more" expansion. */
  caption?: boolean;
  /** Scrolling audio credit ticker. */
  audioTicker?: boolean;
  /** Double-tap (or double-click) to like, with a heart burst. */
  doubleTapLike?: boolean;
  /** Press and hold to pause. */
  holdToPause?: boolean;
  /** Arrow keys / space / `m` shortcuts. Default `true`. */
  keyboard?: boolean;
  /** Mouse-wheel navigation. Default `true`. */
  wheel?: boolean;
  /** Touch/pointer swipe navigation. Default `true`. */
  swipe?: boolean;
  /** `n / total` counter in the top-right. Default `false`. */
  counter?: boolean;
  /** Up/down chevrons for pointer users. Default `true`. */
  navArrows?: boolean;
}

/**
 * How the feed sizes itself.
 *
 * - `portrait` (default) — the feed owns its size: `9:16`, full width, capped at
 *   the viewport height. Right for a card embedded in a normal page.
 * - `fill` — the feed emits no sizing classes at all and takes the parent's box.
 *   Use this for a full-screen feed (`h-dvh` on the parent), a fixed-height
 *   column, or any custom aspect. This is the escape hatch: because no width,
 *   height or aspect class is emitted, nothing can conflict with yours.
 */
export type ReelsLayout = 'portrait' | 'fill';

/** Feed configuration. */
export interface ReelsConfig {
  /** Sizing strategy. Default `'portrait'`. */
  layout?: ReelsLayout;
  /** Autoplay the active slide. Default `true`. */
  autoPlay?: boolean;
  /**
   * Start muted. Default `true` — every browser blocks unmuted autoplay
   * without a prior user gesture, so an unmuted feed simply will not start.
   */
  muted?: boolean;
  /** Loop each reel instead of advancing. Default `true`. */
  loop?: boolean;
  /** Advance to the next slide when a reel ends. Ignored while `loop`. Default `false`. */
  autoAdvance?: boolean;
  /** Neighbours kept mounted on each side of the active slide. Default `1`. */
  windowSize?: number;
  /** Upcoming slides to warm up (`preload="auto"`). Default `1`. */
  preloadCount?: number;
  /** Slide transition duration in ms. Default `320`. */
  transitionMs?: number;
  /** Fraction of the viewport a drag must cover to commit. Default `0.18`. */
  swipeThreshold?: number;
  /** Feature toggles. */
  features?: ReelsFeatures;
  /** Ad configuration. */
  ads?: ReelsAdConfig;
  /** HLS options for reels served as `.m3u8`. */
  hls?: HLSConfig;
  /** Label overrides. */
  labels?: PartialLabels;
  /** Remaining content slides at which `onLoadMore` fires. Default `3`. */
  loadMoreThreshold?: number;
}

/** Per-reel viewer interaction state owned by the feed. */
export interface ReelInteraction {
  liked: boolean;
  saved: boolean;
  following: boolean;
  /** Local delta applied on top of `reel.stats.likes`. */
  likeDelta: number;
}

/** Feed state exposed by {@link useReelsFeed}. */
export interface ReelsState {
  /** The resolved slide list (content interleaved with ad slots). */
  slides: ReelSlide[];
  /** Index into `slides`. */
  activeIndex: number;
  /** The active slide, or `null` for an empty feed. */
  activeSlide: ReelSlide | null;
  /** Indices that should be mounted right now. */
  mountedIndices: number[];
  /** Whether the active slide is an ad. */
  isAdActive: boolean;
  /** Whether advancing forward is currently blocked (ad gating). */
  advanceBlocked: boolean;
  /** Global mute state — one switch for the whole feed, as users expect. */
  muted: boolean;
  /** Whether the active slide is playing. */
  playing: boolean;
  /** Ad slot states keyed by slot id. */
  adSlots: Record<string, ReelAdSlotState>;
  /** Viewer interactions keyed by reel id. */
  interactions: Record<string, ReelInteraction>;
  /** Number of ad slides shown this session. */
  adsShown: number;
  /** True while `onLoadMore` is in flight. */
  loadingMore: boolean;
}

/** Feed controls exposed by {@link useReelsFeed}. */
export interface ReelsControls {
  next: () => void;
  previous: () => void;
  /** Jump to a slide index. Out-of-range values are clamped. */
  goTo: (index: number) => void;
  /** Jump to a content reel by id. */
  goToReel: (reelId: string) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  toggleLike: (reelId: string) => void;
  toggleSave: (reelId: string) => void;
  toggleFollow: (reelId: string) => void;
  /** Skip the currently playing ad. No-op when it is not yet skippable. */
  skipAd: () => void;
}

/** Callbacks for {@link ReelsPlayer}. */
export interface ReelsCallbacks {
  /** A slide became active. */
  onSlideChange?: (slide: ReelSlide, index: number) => void;
  /** A content reel became active. */
  onReelChange?: (reel: Reel, contentIndex: number) => void;
  /** A reel was watched to the end (fires once per continuous view). */
  onReelComplete?: (reel: Reel) => void;
  /** Fractional watch progress for the active reel, throttled to time updates. */
  onReelProgress?: (reel: Reel, currentTime: number, duration: number) => void;
  onLike?: (reel: Reel, liked: boolean) => void;
  onSave?: (reel: Reel, saved: boolean) => void;
  onFollow?: (reel: Reel, following: boolean) => void;
  onComment?: (reel: Reel) => void;
  onShare?: (reel: Reel) => void;
  onCtaClick?: (reel: Reel) => void;
  onMuteChange?: (muted: boolean) => void;
  /** Fired when fewer than `loadMoreThreshold` content reels remain ahead. */
  onLoadMore?: () => void | Promise<void>;
  onError?: (error: Error) => void;
}

/** Props for {@link ReelsPlayer}. */
export interface ReelsPlayerProps extends ReelsCallbacks {
  /** The content reels. Append to this array to grow the feed. */
  reels: Reel[];
  config?: ReelsConfig;
  /** Initial content index. Default `0`. */
  initialIndex?: number;
  className?: string;
  /** Override the look. Only what you set changes. */
  theme?: import('./theme').FairuTheme;
  /** Render an extra layer above the active slide (badges, debug HUD, …). */
  renderOverlay?: (slide: ReelSlide, index: number) => React.ReactNode;
}

/** Initial per-reel interaction state. */
export function createReelInteraction(reel: Reel): ReelInteraction {
  return {
    liked: reel.liked ?? false,
    saved: reel.saved ?? false,
    following: reel.author?.following ?? false,
    likeDelta: 0,
  };
}
