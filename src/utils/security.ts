/**
 * Security helpers for handling untrusted embed input.
 *
 * Embed configuration can originate from data attributes or iframe URL
 * parameters that are controlled by whoever embeds the player. These helpers
 * make sure such input cannot crash the host page (malformed JSON) or smuggle
 * dangerous URL schemes (e.g. `javascript:`) into media/image sources.
 */

/** URL schemes considered safe for media and image sources. */
const DEFAULT_SAFE_SCHEMES = ['http:', 'https:', 'data:', 'blob:'] as const;

/**
 * Validate a URL against an allowlist of schemes.
 *
 * Relative URLs (no scheme) are resolved against the current document origin
 * when available, so plain paths like `/audio.mp3` are accepted. Anything that
 * resolves to a disallowed scheme (`javascript:`, `vbscript:`, `file:`, …)
 * returns `undefined`.
 */
export function sanitizeUrl(
  value: string | undefined | null,
  allowedSchemes: readonly string[] = DEFAULT_SAFE_SCHEMES
): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const base =
    typeof window !== 'undefined' && window.location
      ? window.location.href
      : 'http://localhost/';

  let parsed: URL;
  try {
    parsed = new URL(trimmed, base);
  } catch {
    return undefined;
  }

  if (!allowedSchemes.includes(parsed.protocol)) return undefined;

  return trimmed;
}

/**
 * Validate a tracking/network endpoint. Only absolute http(s) URLs are allowed —
 * data:/blob: would make no sense as a request target, and other schemes are
 * potential exfiltration or SSRF vectors.
 */
export function sanitizeEndpoint(
  value: string | undefined | null
): string | undefined {
  return sanitizeUrl(value, ['http:', 'https:']);
}

/**
 * Parse JSON without throwing. Returns `fallback` (default `undefined`) on any
 * parse error so a single malformed attribute can never break player mounting.
 */
export function safeJsonParse<T>(
  value: string | undefined | null,
  fallback?: T
): T | undefined {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
