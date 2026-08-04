/**
 * VAST 4.x macro substitution.
 *
 * Ad servers embed macros such as `[CACHEBUSTING]` or `[CONTENTPLAYHEAD]` in tag
 * and tracking URLs. The player is expected to replace the ones it knows and
 * leave the rest untouched. See VAST 4.3 § 6 "Macros".
 */

/** Macro values the player can supply. */
export interface VastMacroContext {
  /** Random 8-digit integer, regenerated per request. */
  CACHEBUSTING?: string | number;
  /** Unix epoch milliseconds. */
  TIMESTAMP?: string | number;
  /** `HH:MM:SS.mmm` playhead of the *content* video. */
  CONTENTPLAYHEAD?: string;
  /** `HH:MM:SS.mmm` playhead of the *ad*. */
  ADPLAYHEAD?: string;
  /** `<width>x<height>` of the player. */
  PLAYERSIZE?: string;
  /** `0` muted, `1` audible. */
  PLAYERSTATE?: string;
  /** VAST error code, only meaningful on `<Error>` pixels. */
  ERRORCODE?: string | number;
  /** `1` when the ad is at least 50 % visible. */
  INVIEW?: string;
  /** Ad break position: `preroll` | `midroll` | `postroll` | `standalone`. */
  BREAKPOSITION?: string;
  /** Page/app URL the ad is served into. */
  PAGEURL?: string;
  /** Referrer URL. */
  REFERRER?: string;

  /* --- Privacy signals, see {@link import('./consent').consentMacros} --- */

  /** TCF `gdprApplies`: `1` when GDPR applies, `0` when it does not. */
  GDPR?: string;
  /** TCF consent string. */
  GDPRCONSENT?: string;
  /** US Privacy / CCPA string, e.g. `1YNN`. */
  US_PRIVACY?: string;
  /** GPP string. */
  GPP?: string;
  /** Comma-separated GPP section IDs. */
  GPP_SID?: string;
  /** Device-level limit-ad-tracking flag: `1` or `0`. */
  LIMITADTRACKING?: string;

  /** Free-form additional macros. */
  [key: string]: string | number | undefined;
}

/** Matches `[MACRO]` and the legacy `%%MACRO%%` form. */
const MACRO_PATTERN = /\[([A-Z0-9_]+)\]|%%([A-Z0-9_]+)%%/g;

/** Random 8-digit cache buster, as recommended by the spec. */
export function cacheBuster(): string {
  return String(Math.floor(Math.random() * 90_000_000) + 10_000_000);
}

/**
 * Format seconds as the `HH:MM:SS.mmm` string required by the
 * `[CONTENTPLAYHEAD]` / `[ADPLAYHEAD]` macros.
 */
export function formatPlayhead(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(millis, 3)}`;
}

/**
 * Build the macro set the player always knows about, merged with `overrides`.
 * A fresh `CACHEBUSTING` and `TIMESTAMP` are generated on every call so each
 * request gets distinct values.
 */
export function defaultMacroContext(overrides: VastMacroContext = {}): VastMacroContext {
  const size =
    typeof window !== 'undefined' && window.innerWidth
      ? `${Math.round(window.innerWidth)}x${Math.round(window.innerHeight)}`
      : undefined;

  return {
    CACHEBUSTING: cacheBuster(),
    TIMESTAMP: Date.now(),
    PLAYERSIZE: size,
    PAGEURL: typeof window !== 'undefined' ? window.location?.href : undefined,
    REFERRER: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
    ...overrides,
  };
}

/**
 * Replace known macros in `url`. Unknown macros are left verbatim so ad servers
 * that pre-fill them server-side keep working.
 *
 * Values are percent-encoded, except `CACHEBUSTING`, `TIMESTAMP` and
 * `ERRORCODE`, which are plain numerics.
 */
export function substituteMacros(url: string, context: VastMacroContext = {}): string {
  const raw = new Set(['CACHEBUSTING', 'TIMESTAMP', 'ERRORCODE']);

  return url.replace(MACRO_PATTERN, (match, bracket, percent) => {
    const name: string = bracket ?? percent;
    const value = context[name];
    if (value === undefined || value === null) return match;
    const str = String(value);
    return raw.has(name) ? str : encodeURIComponent(str);
  });
}

/** Apply {@link substituteMacros} to a list of URLs. */
export function substituteMacrosAll(urls: string[], context: VastMacroContext = {}): string[] {
  return urls.map((url) => substituteMacros(url, context));
}
