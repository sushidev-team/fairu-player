/**
 * VAST 2.0 – 4.3 XML parser.
 *
 * Uses the platform `DOMParser` — no XML dependency is added to the bundle.
 * Unknown elements are ignored rather than rejected, which is what the spec
 * requires of players ("forward compatibility", VAST 4.3 § 2.2).
 */

import {
  VastError,
  VastErrorCode,
  type VastAd,
  type VastAdVerification,
  type VastCreative,
  type VastIcon,
  type VastLinearCreative,
  type VastMediaFile,
  type VastNonLinearCreative,
  type VastProgressTracking,
  type VastResponse,
  type VastTrackingEvent,
  type VastTrackingEvents,
  type VastVideoClicks,
  type VastWrapper,
} from '@/types/vast';

/* -------------------------------------------------------------------------- */
/*                                DOM helpers                                 */
/* -------------------------------------------------------------------------- */

/** Direct children matching `name` (namespace-insensitive). */
function children(parent: Element, name: string): Element[] {
  const lower = name.toLowerCase();
  const out: Element[] = [];
  for (const child of Array.from(parent.children)) {
    if (localName(child) === lower) out.push(child);
  }
  return out;
}

/** First direct child matching `name`, or `undefined`. */
function child(parent: Element, name: string): Element | undefined {
  return children(parent, name)[0];
}

/** Any descendant matching `name`. */
function descendants(parent: Element, name: string): Element[] {
  const lower = name.toLowerCase();
  return Array.from(parent.getElementsByTagName('*')).filter(
    (el) => localName(el) === lower
  );
}

function localName(el: Element): string {
  // `localName` strips namespace prefixes; `tagName` keeps them (e.g. `vmap:AdBreak`).
  return (el.localName || el.tagName.replace(/^.*:/, '')).toLowerCase();
}

/** Trimmed text content, or `undefined` when empty. */
function text(el: Element | undefined): string | undefined {
  if (!el) return undefined;
  const value = (el.textContent ?? '').trim();
  return value === '' ? undefined : value;
}

/** Trimmed text of a direct child element. */
function childText(parent: Element, name: string): string | undefined {
  return text(child(parent, name));
}

/** Trimmed text of every direct child matching `name`, empties removed. */
function childTexts(parent: Element, name: string): string[] {
  return children(parent, name)
    .map((el) => text(el))
    .filter((value): value is string => !!value);
}

function attr(el: Element | undefined, name: string): string | undefined {
  if (!el) return undefined;
  const value = el.getAttribute(name);
  return value === null || value.trim() === '' ? undefined : value.trim();
}

function numAttr(el: Element | undefined, name: string): number | undefined {
  const value = attr(el, name);
  if (value === undefined) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function boolAttr(el: Element | undefined, name: string, fallback: boolean): boolean {
  const value = attr(el, name);
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

/* -------------------------------------------------------------------------- */
/*                              Value converters                              */
/* -------------------------------------------------------------------------- */

/**
 * Parse a VAST duration (`HH:MM:SS` or `HH:MM:SS.mmm`) into seconds.
 * Returns `undefined` for malformed input rather than `NaN`.
 */
export function parseDuration(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();

  // Some servers emit bare seconds despite the spec.
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number.parseFloat(trimmed);

  const match = /^(\d+):(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?$/.exec(trimmed);
  if (!match) return undefined;

  const [, h, m, s, ms] = match;
  const seconds =
    Number.parseInt(h, 10) * 3600 +
    Number.parseInt(m, 10) * 60 +
    Number.parseInt(s, 10) +
    (ms ? Number.parseInt(ms.padEnd(3, '0'), 10) / 1000 : 0);

  return Number.isFinite(seconds) ? seconds : undefined;
}

/**
 * Resolve a VAST offset attribute (`skipoffset`, `<Tracking offset>`) to seconds.
 *
 * Accepts `HH:MM:SS[.mmm]` and percentages (`25%`). Percentages need the
 * creative duration, so `duration` must be supplied for those to resolve.
 */
export function parseOffset(
  value: string | undefined,
  duration?: number
): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();

  if (trimmed.endsWith('%')) {
    const percent = Number.parseFloat(trimmed.slice(0, -1));
    if (!Number.isFinite(percent)) return undefined;
    if (duration === undefined || !Number.isFinite(duration)) return undefined;
    return (percent / 100) * duration;
  }

  return parseDuration(trimmed);
}

/* -------------------------------------------------------------------------- */
/*                              Element parsers                               */
/* -------------------------------------------------------------------------- */

/** Merge `source` into `target` in place, concatenating URL lists per event. */
export function mergeTrackingEvents(
  target: VastTrackingEvents,
  source: VastTrackingEvents
): VastTrackingEvents {
  for (const [event, urls] of Object.entries(source)) {
    if (!urls || urls.length === 0) continue;
    const key = event as VastTrackingEvent;
    target[key] = [...(target[key] ?? []), ...urls];
  }
  return target;
}

/**
 * Parse a `<TrackingEvents>` container.
 *
 * `progress` entries carry an offset and are returned separately.
 */
function parseTrackingEvents(
  container: Element | undefined,
  duration?: number
): { events: VastTrackingEvents; progress: VastProgressTracking[] } {
  const events: VastTrackingEvents = {};
  const progress: VastProgressTracking[] = [];
  if (!container) return { events, progress };

  for (const tracking of children(container, 'Tracking')) {
    const url = text(tracking);
    if (!url) continue;

    const event = attr(tracking, 'event');
    if (!event) continue;

    if (event === 'progress') {
      const offset = parseOffset(attr(tracking, 'offset'), duration);
      if (offset !== undefined) progress.push({ offset, url });
      continue;
    }

    const key = event as VastTrackingEvent;
    events[key] = [...(events[key] ?? []), url];
  }

  return { events, progress };
}

function parseMediaFiles(linear: Element): VastMediaFile[] {
  const container = child(linear, 'MediaFiles');
  if (!container) return [];

  const files: VastMediaFile[] = [];
  for (const el of children(container, 'MediaFile')) {
    const url = text(el);
    if (!url) continue;

    const delivery = attr(el, 'delivery');
    files.push({
      url,
      type: attr(el, 'type'),
      width: numAttr(el, 'width'),
      height: numAttr(el, 'height'),
      bitrate: numAttr(el, 'bitrate'),
      minBitrate: numAttr(el, 'minBitrate'),
      maxBitrate: numAttr(el, 'maxBitrate'),
      delivery: delivery === 'streaming' ? 'streaming' : delivery === 'progressive' ? 'progressive' : undefined,
      codec: attr(el, 'codec'),
      scalable: boolAttr(el, 'scalable', true),
      maintainAspectRatio: boolAttr(el, 'maintainAspectRatio', true),
      apiFramework: attr(el, 'apiFramework'),
    });
  }

  return files;
}

function parseVideoClicks(linear: Element): VastVideoClicks {
  const container = child(linear, 'VideoClicks');
  if (!container) {
    return { clickTrackingUrls: [], customClickUrls: [] };
  }

  return {
    clickThroughUrl: childText(container, 'ClickThrough'),
    clickTrackingUrls: childTexts(container, 'ClickTracking'),
    customClickUrls: childTexts(container, 'CustomClick'),
  };
}

function parseIcons(linear: Element, duration?: number): VastIcon[] {
  const container = child(linear, 'Icons');
  if (!container) return [];

  return children(container, 'Icon').map((el) => {
    const staticResource = child(el, 'StaticResource');
    const clicks = child(el, 'IconClicks');

    return {
      program: attr(el, 'program'),
      width: numAttr(el, 'width'),
      height: numAttr(el, 'height'),
      xPosition: attr(el, 'xPosition'),
      yPosition: attr(el, 'yPosition'),
      staticResource: text(staticResource),
      staticResourceType: attr(staticResource, 'creativeType'),
      iframeResource: childText(el, 'IFrameResource'),
      htmlResource: childText(el, 'HTMLResource'),
      clickThroughUrl: clicks ? childText(clicks, 'IconClickThrough') : undefined,
      clickTrackingUrls: clicks ? childTexts(clicks, 'IconClickTracking') : [],
      viewTrackingUrls: childTexts(el, 'IconViewTracking'),
      duration: parseDuration(attr(el, 'duration')),
      offset: parseOffset(attr(el, 'offset'), duration),
    } satisfies VastIcon;
  });
}

function parseLinear(linear: Element): VastLinearCreative {
  const duration = parseDuration(childText(linear, 'Duration')) ?? 0;
  const { events, progress } = parseTrackingEvents(child(linear, 'TrackingEvents'), duration);

  return {
    type: 'linear',
    duration,
    skipOffset: parseOffset(attr(linear, 'skipoffset'), duration) ?? null,
    mediaFiles: parseMediaFiles(linear),
    videoClicks: parseVideoClicks(linear),
    trackingEvents: events,
    progressTrackings: progress,
    icons: parseIcons(linear, duration),
    adParameters: childText(linear, 'AdParameters'),
  };
}

function parseNonLinearLike(
  el: Element,
  kind: 'nonlinear' | 'companion',
  trackingContainer: Element | undefined
): VastNonLinearCreative {
  const staticResource = child(el, 'StaticResource');
  const { events } = parseTrackingEvents(trackingContainer);

  return {
    type: kind,
    width: numAttr(el, 'width'),
    height: numAttr(el, 'height'),
    minSuggestedDuration: parseDuration(attr(el, 'minSuggestedDuration')),
    staticResource: text(staticResource),
    staticResourceType: attr(staticResource, 'creativeType'),
    iframeResource: childText(el, 'IFrameResource'),
    htmlResource: childText(el, 'HTMLResource'),
    clickThroughUrl:
      childText(el, 'NonLinearClickThrough') ?? childText(el, 'CompanionClickThrough'),
    clickTrackingUrls: [
      ...childTexts(el, 'NonLinearClickTracking'),
      ...childTexts(el, 'CompanionClickTracking'),
    ],
    trackingEvents: events,
  };
}

function parseCreatives(creativesEl: Element | undefined): VastCreative[] {
  if (!creativesEl) return [];

  const out: VastCreative[] = [];
  for (const creative of children(creativesEl, 'Creative')) {
    const linear = child(creative, 'Linear');
    if (linear) {
      out.push(parseLinear(linear));
      continue;
    }

    const nonLinearAds = child(creative, 'NonLinearAds');
    if (nonLinearAds) {
      const tracking = child(nonLinearAds, 'TrackingEvents');
      for (const nonLinear of children(nonLinearAds, 'NonLinear')) {
        out.push(parseNonLinearLike(nonLinear, 'nonlinear', tracking));
      }
      continue;
    }

    const companionAds = child(creative, 'CompanionAds');
    if (companionAds) {
      for (const companion of children(companionAds, 'Companion')) {
        out.push(
          parseNonLinearLike(companion, 'companion', child(companion, 'TrackingEvents'))
        );
      }
    }
  }

  return out;
}

function parseExtensions(parent: Element): Record<string, string> {
  const container = child(parent, 'Extensions');
  if (!container) return {};

  const out: Record<string, string> = {};
  for (const [index, extension] of children(container, 'Extension').entries()) {
    const key = attr(extension, 'type') ?? `extension-${index}`;
    const value = (extension.textContent ?? '').trim();
    if (value) out[key] = value;
  }
  return out;
}

function parseAdVerifications(parent: Element): VastAdVerification[] {
  // VAST 4 puts these under <InLine><AdVerifications>; VAST 4.1 also allows
  // them inside <Extensions><Extension type="AdVerifications">.
  const containers = descendants(parent, 'AdVerifications');
  const out: VastAdVerification[] = [];

  for (const container of containers) {
    for (const verification of children(container, 'Verification')) {
      const js = child(verification, 'JavaScriptResource');
      out.push({
        vendor: attr(verification, 'vendor'),
        javascriptResource: text(js),
        verificationParameters: childText(verification, 'VerificationParameters'),
      });
    }
  }

  return out;
}

function parseViewableImpression(parent: Element) {
  const container = child(parent, 'ViewableImpression');
  if (!container) {
    return { viewableUrls: [], notViewableUrls: [], viewUndeterminedUrls: [] };
  }
  return {
    viewableUrls: childTexts(container, 'Viewable'),
    notViewableUrls: childTexts(container, 'NotViewable'),
    viewUndeterminedUrls: childTexts(container, 'ViewUndetermined'),
  };
}

function parsePricing(parent: Element) {
  const el = child(parent, 'Pricing');
  const raw = text(el);
  if (!el || !raw) return undefined;

  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return undefined;

  return { value, model: attr(el, 'model'), currency: attr(el, 'currency') };
}

/* -------------------------------------------------------------------------- */
/*                                Entry points                                */
/* -------------------------------------------------------------------------- */

/** Parse an XML string into a document, raising a {@link VastError} on failure. */
export function parseXml(xml: string): Document {
  if (typeof DOMParser === 'undefined') {
    throw new VastError('DOMParser is unavailable in this environment', VastErrorCode.XML_PARSE);
  }

  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) {
    throw new VastError(
      `VAST XML parse error: ${parseError.textContent?.trim().slice(0, 200)}`,
      VastErrorCode.XML_PARSE
    );
  }

  return doc;
}

/**
 * Parse a VAST document.
 *
 * `<InLine>` ads are returned in {@link VastResponse.ads}; `<Wrapper>` ads are
 * returned unresolved in {@link VastResponse.wrappers} for {@link VastClient}
 * to follow.
 *
 * @param xml - the VAST document as a string
 * @param wrapperDepth - how many wrappers were followed to reach this document
 */
export function parseVast(xml: string, wrapperDepth = 0): VastResponse {
  const doc = parseXml(xml);

  const root = doc.documentElement;
  if (!root || localName(root) !== 'vast') {
    throw new VastError(
      'Document root is not <VAST>',
      VastErrorCode.SCHEMA_VALIDATION
    );
  }

  const version = attr(root, 'version');
  const ads: VastAd[] = [];
  const wrappers: VastWrapper[] = [];
  // Document-level <Error> is how a "no ads" response reports back.
  const errorUrls = childTexts(root, 'Error');

  for (const [index, adEl] of children(root, 'Ad').entries()) {
    const id = attr(adEl, 'id') ?? `ad-${wrapperDepth}-${index}`;
    const sequence = numAttr(adEl, 'sequence');
    const conditional = boolAttr(adEl, 'conditionalAd', false);

    const inLine = child(adEl, 'InLine');
    if (inLine) {
      const viewable = parseViewableImpression(inLine);
      ads.push({
        id,
        sequence,
        conditional,
        adSystem: childText(inLine, 'AdSystem'),
        adTitle: childText(inLine, 'AdTitle'),
        description: childText(inLine, 'Description'),
        advertiser: childText(inLine, 'Advertiser'),
        pricing: parsePricing(inLine),
        impressionUrls: childTexts(inLine, 'Impression'),
        errorUrls: childTexts(inLine, 'Error'),
        ...viewable,
        creatives: parseCreatives(child(inLine, 'Creatives')),
        adVerifications: parseAdVerifications(inLine),
        extensions: parseExtensions(inLine),
        wrapperDepth,
        vastVersion: version,
      });
      continue;
    }

    const wrapperEl = child(adEl, 'Wrapper');
    if (wrapperEl) {
      const tagUrl = childText(wrapperEl, 'VASTAdTagURI');
      if (!tagUrl) continue;

      const { events, progress } = parseTrackingEvents(child(wrapperEl, 'TrackingEvents'));
      const viewable = parseViewableImpression(wrapperEl);
      const videoClicks = child(wrapperEl, 'VideoClicks');

      wrappers.push({
        id,
        sequence,
        tagUrl,
        adSystem: childText(wrapperEl, 'AdSystem'),
        impressionUrls: childTexts(wrapperEl, 'Impression'),
        errorUrls: childTexts(wrapperEl, 'Error'),
        ...viewable,
        trackingEvents: events,
        progressTrackings: progress,
        clickTrackingUrls: videoClicks ? childTexts(videoClicks, 'ClickTracking') : [],
        followAdditionalWrappers: boolAttr(wrapperEl, 'followAdditionalWrappers', true),
        allowMultipleAds: boolAttr(wrapperEl, 'allowMultipleAds', false),
        fallbackOnNoAd: attr(wrapperEl, 'fallbackOnNoAd')
          ? boolAttr(wrapperEl, 'fallbackOnNoAd', false)
          : undefined,
        extensions: parseExtensions(wrapperEl),
        wrapperDepth,
      });
    }
  }

  // Ad pods are played in `sequence` order; ads without a sequence keep
  // document order and sort after the sequenced ones.
  const bySequence = (a: { sequence?: number }, b: { sequence?: number }) =>
    (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER);

  return {
    version,
    ads: ads.sort(bySequence),
    wrappers: wrappers.sort(bySequence),
    errorUrls,
  };
}

/**
 * Fold a wrapper's inherited tracking into every ad the wrapped tag returned.
 *
 * Per VAST 4.3 § 3.9, wrapper impressions, errors and tracking events all fire
 * alongside the in-line ad's own pixels.
 */
export function applyWrapperToAds(wrapper: VastWrapper, ads: VastAd[]): VastAd[] {
  return ads.map((ad) => {
    const creatives = ad.creatives.map((creative): VastCreative => {
      if (creative.type !== 'linear') return creative;

      return {
        ...creative,
        trackingEvents: mergeTrackingEvents(
          { ...creative.trackingEvents },
          wrapper.trackingEvents
        ),
        progressTrackings: [...creative.progressTrackings, ...wrapper.progressTrackings],
        videoClicks: {
          ...creative.videoClicks,
          clickTrackingUrls: [
            ...creative.videoClicks.clickTrackingUrls,
            ...wrapper.clickTrackingUrls,
          ],
        },
      };
    });

    return {
      ...ad,
      // The wrapper's own id/system are kept on the extensions so hosts can
      // still attribute the chain, while the in-line identity wins.
      impressionUrls: [...wrapper.impressionUrls, ...ad.impressionUrls],
      errorUrls: [...wrapper.errorUrls, ...ad.errorUrls],
      viewableUrls: [...wrapper.viewableUrls, ...ad.viewableUrls],
      notViewableUrls: [...wrapper.notViewableUrls, ...ad.notViewableUrls],
      viewUndeterminedUrls: [...wrapper.viewUndeterminedUrls, ...ad.viewUndeterminedUrls],
      creatives,
      extensions: { ...wrapper.extensions, ...ad.extensions },
      wrapperDepth: Math.max(ad.wrapperDepth, wrapper.wrapperDepth + 1),
    };
  });
}

/** The first `<Linear>` creative of an ad, or `undefined`. */
export function getLinearCreative(ad: VastAd): VastLinearCreative | undefined {
  return ad.creatives.find((c): c is VastLinearCreative => c.type === 'linear');
}
