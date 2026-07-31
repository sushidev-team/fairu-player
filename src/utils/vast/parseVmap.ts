/**
 * VMAP 1.0 parser.
 *
 * VMAP describes *where* ad breaks sit; the breaks themselves point at VAST
 * (either an `<AdTagURI>` or an inline `<VASTAdData>` document). For a reels feed
 * there is no single timeline, so `timeOffset="position:N"` — "after the Nth
 * item" — is the offset form that matters most, with `percent` and `time`
 * mapped onto the feed length as a fallback.
 */

import {
  VastError,
  VastErrorCode,
  type VmapAdBreak,
  type VmapAdSource,
  type VmapResponse,
  type VmapTimeOffset,
} from '@/types/vast';
import { parseDuration, parseXml } from './parseVast';

function localName(el: Element): string {
  return (el.localName || el.tagName.replace(/^.*:/, '')).toLowerCase();
}

function children(parent: Element, name: string): Element[] {
  const lower = name.toLowerCase();
  return Array.from(parent.children).filter((el) => localName(el) === lower);
}

function child(parent: Element, name: string): Element | undefined {
  return children(parent, name)[0];
}

function text(el: Element | undefined): string | undefined {
  if (!el) return undefined;
  const value = (el.textContent ?? '').trim();
  return value === '' ? undefined : value;
}

function attr(el: Element | undefined, name: string): string | undefined {
  if (!el) return undefined;
  const value = el.getAttribute(name);
  return value === null || value.trim() === '' ? undefined : value.trim();
}

function boolAttr(el: Element | undefined, name: string, fallback: boolean): boolean {
  const value = attr(el, name);
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

/**
 * Parse a VMAP `timeOffset` attribute.
 *
 * Supported forms:
 * - `start` / `end`
 * - `HH:MM:SS[.mmm]` → `{ kind: 'time' }`
 * - `NN%` → `{ kind: 'percent', value: 0..1 }`
 * - `#N` (VMAP `position:N` shorthand) → `{ kind: 'position', value: N }`
 * - `position:N` → `{ kind: 'position', value: N }`
 */
export function parseTimeOffset(raw: string | undefined): VmapTimeOffset {
  const value = (raw ?? 'start').trim();
  const lower = value.toLowerCase();

  if (lower === 'start') return { kind: 'start', value: 0, raw: value };
  if (lower === 'end') return { kind: 'end', value: 0, raw: value };

  if (lower.startsWith('position:')) {
    const position = Number.parseInt(lower.slice('position:'.length), 10);
    return {
      kind: 'position',
      value: Number.isFinite(position) ? position : 1,
      raw: value,
    };
  }

  if (value.startsWith('#')) {
    const position = Number.parseInt(value.slice(1), 10);
    return {
      kind: 'position',
      value: Number.isFinite(position) ? position : 1,
      raw: value,
    };
  }

  if (value.endsWith('%')) {
    const percent = Number.parseFloat(value.slice(0, -1));
    return {
      kind: 'percent',
      value: Number.isFinite(percent) ? percent / 100 : 0,
      raw: value,
    };
  }

  const seconds = parseDuration(value);
  if (seconds !== undefined) return { kind: 'time', value: seconds, raw: value };

  // Unparseable offsets degrade to a pre-roll rather than dropping the break.
  return { kind: 'start', value: 0, raw: value };
}

function parseAdSource(breakEl: Element): VmapAdSource | undefined {
  const el = child(breakEl, 'AdSource');
  if (!el) return undefined;

  const vastAdData = child(el, 'VASTAdData') ?? child(el, 'VASTData');

  return {
    id: attr(el, 'id'),
    allowMultipleAds: boolAttr(el, 'allowMultipleAds', false),
    followRedirects: boolAttr(el, 'followRedirects', true),
    adTagUrl: text(child(el, 'AdTagURI')),
    // Serialise the embedded VAST back to a string so it can go straight into
    // the same parser as a fetched document.
    vastAdData: vastAdData ? serializeInnerVast(vastAdData) : undefined,
  };
}

/**
 * Serialise the `<VAST>` element nested inside `<vmap:VASTAdData>`.
 *
 * VMAP wraps a complete VAST document, so the wrapper element itself is dropped
 * and the inner `<VAST>` is returned.
 */
function serializeInnerVast(vastAdData: Element): string | undefined {
  const vast = Array.from(vastAdData.children).find((el) => localName(el) === 'vast');
  const target = vast ?? vastAdData;

  if (typeof XMLSerializer === 'undefined') return undefined;
  return new XMLSerializer().serializeToString(target);
}

function parseTracking(breakEl: Element): Record<string, string[]> {
  const container = child(breakEl, 'TrackingEvents');
  if (!container) return {};

  const out: Record<string, string[]> = {};
  for (const tracking of children(container, 'Tracking')) {
    const event = attr(tracking, 'event');
    const url = text(tracking);
    if (!event || !url) continue;
    out[event] = [...(out[event] ?? []), url];
  }
  return out;
}

function parseExtensions(breakEl: Element): Record<string, string> {
  const container = child(breakEl, 'Extensions');
  if (!container) return {};

  const out: Record<string, string> = {};
  for (const [index, extension] of children(container, 'Extension').entries()) {
    const key = attr(extension, 'type') ?? `extension-${index}`;
    const value = (extension.textContent ?? '').trim();
    if (value) out[key] = value;
  }
  return out;
}

/** Parse a VMAP document. */
export function parseVmap(xml: string): VmapResponse {
  const doc = parseXml(xml);
  const root = doc.documentElement;

  if (!root || localName(root) !== 'vmap') {
    throw new VastError('Document root is not <vmap:VMAP>', VastErrorCode.SCHEMA_VALIDATION);
  }

  const adBreaks: VmapAdBreak[] = [];

  for (const [index, breakEl] of children(root, 'AdBreak').entries()) {
    const breakTypes = (attr(breakEl, 'breakType') ?? 'linear')
      .split(',')
      .map((type) => type.trim().toLowerCase())
      .filter(Boolean);

    adBreaks.push({
      id: attr(breakEl, 'breakId') ?? `vmap-break-${index}`,
      breakTypes,
      timeOffset: parseTimeOffset(attr(breakEl, 'timeOffset')),
      repeatAfter: parseDuration(attr(breakEl, 'repeatAfter')),
      adSource: parseAdSource(breakEl),
      trackingEvents: parseTracking(breakEl),
      extensions: parseExtensions(breakEl),
    });
  }

  return { version: attr(root, 'version'), adBreaks };
}

/**
 * Resolve a VMAP break's offset to "number of content reels that precede it".
 *
 * @param offset - the parsed offset
 * @param contentCount - how many content reels the feed currently knows about
 * @returns a 0-based content count, or `null` when the break cannot be placed
 */
export function offsetToContentCount(
  offset: VmapTimeOffset,
  contentCount: number
): number | null {
  switch (offset.kind) {
    case 'start':
      return 0;
    case 'end':
      return contentCount;
    case 'position':
      // VMAP positions are 1-based: `position:1` means "before the 1st item".
      return Math.max(0, Math.min(contentCount, offset.value - 1));
    case 'percent':
      return Math.max(0, Math.min(contentCount, Math.round(offset.value * contentCount)));
    case 'time':
      // A feed has no single timeline. Treating each reel as ~15 s gives a
      // predictable mapping for VMAP documents authored for linear content.
      return Math.max(0, Math.min(contentCount, Math.round(offset.value / 15)));
    default:
      return null;
  }
}

/** Only `linear` breaks can be rendered as an ad reel. */
export function isLinearBreak(adBreak: VmapAdBreak): boolean {
  return adBreak.breakTypes.includes('linear');
}
