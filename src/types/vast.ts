/**
 * IAB VAST / VMAP types.
 *
 * Modelled on VAST 4.3 (backwards compatible with 2.0/3.0) and VMAP 1.0.
 * Only the subset that a linear in-stream player actually needs is represented —
 * NonLinear/Companion creatives are parsed but not rendered by the reels player.
 *
 * Spec references:
 * - VAST 4.3: https://iabtechlab.com/standards/vast/
 * - VMAP 1.0: https://iabtechlab.com/standards/vmap/
 */

/**
 * Tracking events defined by VAST `<TrackingEvents>`.
 *
 * `progress` carries an offset and is therefore kept separate from the
 * fire-and-forget events in {@link VastTrackingEvents}.
 */
export type VastTrackingEvent =
  // Linear playback
  | 'creativeView'
  | 'start'
  | 'firstQuartile'
  | 'midpoint'
  | 'thirdQuartile'
  | 'complete'
  // User interaction
  | 'mute'
  | 'unmute'
  | 'pause'
  | 'resume'
  | 'rewind'
  | 'skip'
  | 'closeLinear'
  // NonLinear interaction
  | 'close'
  | 'acceptInvitation'
  | 'collapse'
  | 'fullscreen'
  | 'exitFullscreen'
  | 'playerExpand'
  | 'playerCollapse'
  // VAST 4 verification / errors
  | 'loaded'
  | 'otherAdInteraction';

/** Map of tracking event → list of pixel URLs (a VAST ad may declare many per event). */
export type VastTrackingEvents = Partial<Record<VastTrackingEvent, string[]>>;

/** `<Tracking event="progress" offset="...">` — offset already resolved to seconds. */
export interface VastProgressTracking {
  /** Offset in seconds from ad start. */
  offset: number;
  url: string;
}

/** A single `<MediaFile>` entry. */
export interface VastMediaFile {
  url: string;
  /** MIME type, e.g. `video/mp4`, `application/x-mpegURL`. */
  type?: string;
  width?: number;
  height?: number;
  /** Nominal bitrate in kbps. */
  bitrate?: number;
  minBitrate?: number;
  maxBitrate?: number;
  delivery?: 'progressive' | 'streaming';
  codec?: string;
  scalable?: boolean;
  maintainAspectRatio?: boolean;
  /** VAST 4 `<MediaFile apiFramework>` — `OMID`/`VPAID` creatives are rejected by the selector. */
  apiFramework?: string;
}

/** `<Icon>` — used for the AdChoices / privacy badge. */
export interface VastIcon {
  program?: string;
  width?: number;
  height?: number;
  xPosition?: string;
  yPosition?: string;
  /** Static resource URL (image). */
  staticResource?: string;
  staticResourceType?: string;
  iframeResource?: string;
  htmlResource?: string;
  clickThroughUrl?: string;
  clickTrackingUrls: string[];
  viewTrackingUrls: string[];
  duration?: number;
  offset?: number;
}

/** `<VideoClicks>`. */
export interface VastVideoClicks {
  clickThroughUrl?: string;
  clickTrackingUrls: string[];
  customClickUrls: string[];
}

/** A `<Linear>` creative. */
export interface VastLinearCreative {
  type: 'linear';
  /** Duration in seconds. */
  duration: number;
  /**
   * Resolved skip offset in seconds, or `null` when the creative declares no
   * `skipoffset` (i.e. non-skippable unless the player supplies a default).
   */
  skipOffset: number | null;
  mediaFiles: VastMediaFile[];
  videoClicks: VastVideoClicks;
  trackingEvents: VastTrackingEvents;
  progressTrackings: VastProgressTracking[];
  icons: VastIcon[];
  /** `<AdParameters>` payload, verbatim. */
  adParameters?: string;
}

/** A `<NonLinear>` or `<CompanionAds>` creative. */
export interface VastNonLinearCreative {
  type: 'nonlinear' | 'companion';
  width?: number;
  height?: number;
  /**
   * `<NonLinear minSuggestedDuration>` in seconds — how long the advertiser
   * wants the overlay on screen. Advisory, and absent on most creatives.
   */
  minSuggestedDuration?: number;
  staticResource?: string;
  staticResourceType?: string;
  iframeResource?: string;
  htmlResource?: string;
  clickThroughUrl?: string;
  clickTrackingUrls: string[];
  trackingEvents: VastTrackingEvents;
}

export type VastCreative = VastLinearCreative | VastNonLinearCreative;

/** `<AdVerifications><Verification>` — OMID resource descriptor. */
export interface VastAdVerification {
  vendor?: string;
  javascriptResource?: string;
  verificationParameters?: string;
}

/**
 * A fully resolved VAST ad (`<InLine>`), after any `<Wrapper>` chain has been
 * followed and its tracking merged in.
 */
export interface VastAd {
  id: string;
  /** Sequence number for ad pods (`<Ad sequence="1">`). */
  sequence?: number;
  /** `<Ad conditionalAd>`. */
  conditional?: boolean;
  adSystem?: string;
  adTitle?: string;
  description?: string;
  advertiser?: string;
  pricing?: { value: number; model?: string; currency?: string };
  /** `<Impression>` URLs, including those inherited from wrappers. */
  impressionUrls: string[];
  /** `<Error>` URLs, including those inherited from wrappers. */
  errorUrls: string[];
  /** `<ViewableImpression>`. */
  viewableUrls: string[];
  notViewableUrls: string[];
  viewUndeterminedUrls: string[];
  creatives: VastCreative[];
  adVerifications: VastAdVerification[];
  extensions: Record<string, string>;
  /** Depth of the wrapper chain that produced this ad (0 = direct InLine). */
  wrapperDepth: number;
  /** The VAST version attribute of the document this ad came from. */
  vastVersion?: string;
}

/** The parse result for one VAST document. */
export interface VastResponse {
  version?: string;
  /** Resolved in-line ads, ordered by `sequence` when present. */
  ads: VastAd[];
  /**
   * Wrappers that still need fetching. Empty once {@link VastClient} has fully
   * resolved the chain.
   */
  wrappers: VastWrapper[];
  /** Document-level `<Error>` URLs (VAST with no ads). */
  errorUrls: string[];
}

/** An unresolved `<Wrapper>`. */
export interface VastWrapper {
  id: string;
  sequence?: number;
  /** `<VASTAdTagURI>`. */
  tagUrl: string;
  adSystem?: string;
  impressionUrls: string[];
  errorUrls: string[];
  viewableUrls: string[];
  notViewableUrls: string[];
  viewUndeterminedUrls: string[];
  /** Tracking that must be merged into every ad returned by the wrapped tag. */
  trackingEvents: VastTrackingEvents;
  progressTrackings: VastProgressTracking[];
  clickTrackingUrls: string[];
  /** `<Wrapper followAdditionalWrappers>` (default true). */
  followAdditionalWrappers: boolean;
  /** `<Wrapper allowMultipleAds>` (default false). */
  allowMultipleAds: boolean;
  /** `<Wrapper fallbackOnNoAd>`. */
  fallbackOnNoAd?: boolean;
  extensions: Record<string, string>;
  wrapperDepth: number;
}

/**
 * VAST error codes used when reporting via `<Error>` pixels ([ERRORCODE] macro).
 * See VAST 4.3 § 2.3.6.
 */
export const VastErrorCode = {
  /** XML parsing error. */
  XML_PARSE: 100,
  /** VAST schema validation error. */
  SCHEMA_VALIDATION: 101,
  /** VAST version not supported. */
  VERSION_UNSUPPORTED: 102,
  /** Trafficking error — player cannot display the linear ad. */
  TRAFFICKING: 200,
  /** Wrapper limit reached. */
  WRAPPER_LIMIT: 302,
  /** No ads VAST response after one or more wrappers. */
  WRAPPER_NO_ADS: 303,
  /** Linear: no MediaFile matched the player's capabilities. */
  NO_SUPPORTED_MEDIAFILE: 403,
  /** Problem displaying MediaFile. */
  MEDIAFILE_DISPLAY: 405,
  /** General linear error. */
  GENERAL_LINEAR: 400,
  /** Undefined error. */
  UNDEFINED: 900,
} as const;

export type VastErrorCodeValue = (typeof VastErrorCode)[keyof typeof VastErrorCode];

/** Error raised while fetching or parsing a VAST document. */
export class VastError extends Error {
  readonly code: VastErrorCodeValue;
  /** `<Error>` URLs that should receive the error pixel. */
  readonly errorUrls: string[];

  constructor(message: string, code: VastErrorCodeValue, errorUrls: string[] = []) {
    super(message);
    this.name = 'VastError';
    this.code = code;
    this.errorUrls = errorUrls;
  }
}

/**
 * The minimum an ad must expose to be tracked.
 *
 * Both the reels feed's `ReelAd` and the classic player's `VideoAd` (once
 * normalised) satisfy this, so a single {@link import('@/utils/vast').VastTracker}
 * implementation serves both. Without it each player grows its own pixel-firing
 * logic, and they drift on the details that matter — once-only quartiles, macro
 * substitution, and using `sendBeacon` so pixels survive page teardown.
 */
export interface TrackableAd {
  id: string;
  /** Declared duration in seconds; used to backfill quartiles on `complete`. */
  duration: number;
  impressionUrls?: string[];
  trackingEvents?: VastTrackingEvents;
  progressTrackings?: VastProgressTracking[];
  clickTrackingUrls?: string[];
  errorUrls?: string[];
  /** Present when the ad came from a VAST document; enables viewable pixels. */
  vast?: VastAd;
}

/**
 * Player capabilities used to pick the best `<MediaFile>`.
 */
export interface MediaFileSelectionOptions {
  /** Viewport width in CSS pixels. */
  width?: number;
  /** Viewport height in CSS pixels. */
  height?: number;
  /** Device pixel ratio, used to scale the target resolution. */
  pixelRatio?: number;
  /** Cap on bitrate in kbps (e.g. derived from a connection estimate). */
  maxBitrate?: number;
  /**
   * MIME types the player can play, best first.
   * Defaults to mp4 → HLS → webm.
   */
  supportedTypes?: string[];
  /** Allow HLS (`application/x-mpegURL`) media files. Default: true. */
  allowHls?: boolean;
  /**
   * Select for an audio-only player. Switches the default MIME allow-list to
   * `audio/*` and makes resolution irrelevant to ranking.
   *
   * VAST 4.1 absorbed DAAST, so audio ads are ordinary VAST documents — the only
   * thing that differs is which `<MediaFile>` types the player can accept.
   */
  audioOnly?: boolean;
}

/** Options for {@link VastClient}. */
export interface VastClientOptions {
  /**
   * Maximum number of wrapper redirects to follow. VAST recommends 5.
   * Exceeding it reports {@link VastErrorCode.WRAPPER_LIMIT}.
   */
  maxWrapperDepth?: number;
  /** Per-request timeout in milliseconds. Default 8000. */
  timeout?: number;
  /** Send credentials with ad requests. Default `false` (`omit`). */
  withCredentials?: boolean;
  /** Custom fetch implementation (tests, SSR, proxying). */
  fetchImpl?: typeof fetch;
  /**
   * Extra macro values merged into the built-in set before URL substitution.
   * Keys are macro names without brackets, e.g. `{ PLAYERSIZE: '1080x1920' }`.
   */
  macros?: Record<string, string | number | undefined>;
  /** Called for every resolved document — useful for debugging waterfalls. */
  onDocument?: (info: { url?: string; depth: number; response: VastResponse }) => void;
}

/* -------------------------------------------------------------------------- */
/*                               Privacy signals                              */
/* -------------------------------------------------------------------------- */

/**
 * Privacy signals as published by the host page's CMP.
 *
 * The player never decides anything about consent — it reads what a CMP already
 * published and forwards it verbatim. See
 * {@link import('@/utils/vast/consent').consentMacros} for the mapping onto
 * VAST macros.
 *
 * Every field is optional: a player embedded outside the EU may legitimately
 * have nothing but a `usPrivacy` string, and one on a page with no CMP has none
 * of them.
 */
export interface AdConsent {
  /** TCF `gdprApplies`. Maps to `[GDPR]` as `1`/`0`. */
  gdprApplies?: boolean;
  /** TCF consent string (`tcString`). Maps to `[GDPRCONSENT]`. */
  tcString?: string;
  /** US Privacy / CCPA string, e.g. `1YNN`. Maps to `[US_PRIVACY]`. */
  usPrivacy?: string;
  /** GPP string. Maps to `[GPP]`. */
  gppString?: string;
  /** GPP section IDs. Maps to `[GPP_SID]` as a comma-separated list. */
  gppSectionIds?: number[];
  /**
   * Platform-level "limit ad tracking" flag. Maps to `[LIMITADTRACKING]`.
   *
   * Distinct from `gdprApplies`: this is the device opting out of tracking, not
   * a jurisdiction deciding that consent is required.
   */
  limitAdTracking?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                                    VMAP                                    */
/* -------------------------------------------------------------------------- */

/** How a VMAP `timeOffset` was expressed. */
export type VmapOffsetKind = 'start' | 'end' | 'time' | 'percent' | 'position';

/** Resolved VMAP `timeOffset`. */
export interface VmapTimeOffset {
  kind: VmapOffsetKind;
  /** Seconds for `time`, 0-1 fraction for `percent`, 1-based slot for `position`. */
  value: number;
  /** The raw attribute value. */
  raw: string;
}

/** `<vmap:AdSource>`. */
export interface VmapAdSource {
  id?: string;
  allowMultipleAds: boolean;
  followRedirects: boolean;
  /** `<vmap:AdTagURI>`. */
  adTagUrl?: string;
  /** Inline `<vmap:VASTAdData>` document, serialised back to XML. */
  vastAdData?: string;
}

/** `<vmap:AdBreak>`. */
export interface VmapAdBreak {
  /** `breakId`, or a generated stable id. */
  id: string;
  /** `breakType` — `linear`, `nonlinear`, `display` (comma separated in the spec). */
  breakTypes: string[];
  timeOffset: VmapTimeOffset;
  /** `repeatAfter` in seconds, when present. */
  repeatAfter?: number;
  adSource?: VmapAdSource;
  trackingEvents: Record<string, string[]>;
  extensions: Record<string, string>;
}

/** A parsed VMAP document. */
export interface VmapResponse {
  version?: string;
  adBreaks: VmapAdBreak[];
}
