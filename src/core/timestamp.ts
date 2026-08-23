/**
 * Timestamps in a URL — `?t=1m30s`.
 *
 * Ported from the work stranded in PR #16, with the parser tightened. The input
 * is a query parameter, so it is whatever the sender felt like typing; the
 * original accepted `Infinity` (`Number('Infinity')` is a number, and it is
 * greater than zero), which reaches `currentTime` as a non-finite seek and
 * leaves the element unplayable.
 *
 * Both directions are plain functions with no React and no `window`, which is
 * what lets the embed loader and the player share one definition of the format.
 */

/**
 * Seconds → the compact form YouTube popularised.
 *
 * `90` → `1m30s`, `3661` → `1h1m1s`, `3600` → `1h`, `45` → `45s`.
 *
 * Sub-second precision is dropped on purpose: the value ends up in a shared
 * link, where `1m30s` is something a person can read, edit and say out loud.
 */
export function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0s';

  const total = Math.floor(seconds);
  if (total <= 0) return '0s';

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  let result = '';
  if (hours > 0) result += `${hours}h`;
  if (minutes > 0) result += `${minutes}m`;
  // The seconds part is what keeps `0` from formatting as an empty string.
  if (secs > 0 || result === '') result += `${secs}s`;
  return result;
}

/** A plain, non-negative decimal. Nothing exotic gets through this. */
const DECIMAL = /^\d+(?:\.\d+)?$/;

/** `1h2m3s`, with at least one component present. */
const HMS = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;

/**
 * A timestamp → seconds, or `null` when it is not one.
 *
 * Accepts what people actually paste: `90`, `45s`, `1m30s`, `1h2m3s`, `1:30`,
 * `1:02:03`.
 *
 * Deliberately stricter than `Number()`: hex, exponent notation and the string
 * `Infinity` are all numbers to JavaScript and none of them is a timestamp.
 * Rejecting them here means a bad link does nothing rather than something
 * strange.
 */
export function parseTimestamp(input: string): number | null {
  if (typeof input !== 'string') return null;

  const value = input.trim();
  if (!value) return null;

  if (DECIMAL.test(value)) return finite(Number(value));

  const hms = HMS.exec(value);
  if (hms && (hms[1] || hms[2] || hms[3])) {
    const hours = Number(hms[1] ?? 0);
    const minutes = Number(hms[2] ?? 0);
    const seconds = Number(hms[3] ?? 0);
    return finite(hours * 3600 + minutes * 60 + seconds);
  }

  const parts = value.split(':');
  if ((parts.length === 2 || parts.length === 3) && parts.every((p) => DECIMAL.test(p))) {
    const numbers = parts.map(Number);
    return finite(
      parts.length === 2
        ? numbers[0] * 60 + numbers[1]
        : numbers[0] * 3600 + numbers[1] * 60 + numbers[2]
    );
  }

  return null;
}

/**
 * The last gate, and every branch goes through it.
 *
 * Rejecting the literal string `Infinity` is not enough: the digit patterns
 * above accept a run of any length, and `Number('9'.repeat(400))` overflows to
 * `Infinity` just the same. A caller clamps against the duration, so such a
 * link would seek to the end of the media rather than do nothing.
 */
function finite(seconds: number): number | null {
  return Number.isFinite(seconds) ? seconds : null;
}

/**
 * Put a timestamp on a URL, or take it off again.
 *
 * Separate from the player so the embed loader can build the same links.
 */
export function withTimestamp(url: string, seconds: number, paramName = 't'): string {
  const next = new URL(url);
  next.searchParams.set(paramName, formatTimestamp(seconds));
  return next.toString();
}

/** The timestamp carried by a URL, or `null`. */
export function timestampFrom(url: string, paramName = 't'): number | null {
  const raw = new URL(url).searchParams.get(paramName);
  return raw === null ? null : parseTimestamp(raw);
}
