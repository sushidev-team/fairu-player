/**
 * Fetches VAST tags and resolves the `<Wrapper>` chain into playable ads.
 */

import { sanitizeEndpoint } from '@/utils/security';
import {
  VastError,
  VastErrorCode,
  type VastAd,
  type VastClientOptions,
  type VastResponse,
  type VastWrapper,
} from '@/types/vast';
import { applyWrapperToAds, parseVast } from './parseVast';
import { defaultMacroContext, substituteMacros, type VastMacroContext } from './macros';

/** VAST recommends a redirect limit of 5; anything deeper is almost always a loop. */
const DEFAULT_MAX_WRAPPER_DEPTH = 5;
const DEFAULT_TIMEOUT_MS = 8000;

/** Result of a fully resolved ad request. */
export interface VastRequestResult {
  /** Playable in-line ads with wrapper tracking already folded in. */
  ads: VastAd[];
  /** `<Error>` pixels to fire when the request yielded nothing playable. */
  errorUrls: string[];
  /** Number of documents fetched, including the root tag. */
  documentCount: number;
}

/**
 * Client for VAST ad requests.
 *
 * ```ts
 * const client = new VastClient({ maxWrapperDepth: 3 });
 * const { ads } = await client.request('https://ads.example.com/vast?cb=[CACHEBUSTING]');
 * ```
 *
 * Tag URLs are validated with {@link sanitizeEndpoint} — only absolute
 * `http(s)` endpoints are fetched, so a hostile config cannot smuggle a
 * `javascript:` or `file:` URL into the ad pipeline.
 */
export class VastClient {
  private readonly options: Required<Pick<VastClientOptions, 'maxWrapperDepth' | 'timeout' | 'withCredentials'>> &
    VastClientOptions;

  constructor(options: VastClientOptions = {}) {
    this.options = {
      maxWrapperDepth: options.maxWrapperDepth ?? DEFAULT_MAX_WRAPPER_DEPTH,
      timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
      withCredentials: options.withCredentials ?? false,
      ...options,
    };
  }

  /** Fetch and fully resolve a VAST tag URL. */
  async request(tagUrl: string, macros: VastMacroContext = {}): Promise<VastRequestResult> {
    const context = defaultMacroContext({ ...this.options.macros, ...macros });
    const url = sanitizeEndpoint(substituteMacros(tagUrl, context));

    if (!url) {
      throw new VastError(
        `Refusing to fetch VAST tag with unsupported URL scheme: ${tagUrl}`,
        VastErrorCode.SCHEMA_VALIDATION
      );
    }

    const xml = await this.fetchXml(url);
    return this.resolve(xml, { url, macros: context });
  }

  /**
   * Resolve an already-fetched VAST document, following any wrappers.
   *
   * Use this for inline VAST (house ads, VMAP `<VASTAdData>`, tests) so the
   * document does not need a URL.
   */
  async resolve(
    xml: string,
    context: { url?: string; macros?: VastMacroContext; depth?: number } = {}
  ): Promise<VastRequestResult> {
    const macros = context.macros ?? defaultMacroContext(this.options.macros);
    const depth = context.depth ?? 0;

    let response: VastResponse;
    try {
      response = parseVast(xml, depth);
    } catch (error) {
      // A malformed document has no <Error> URLs we can trust, so surface it.
      throw error instanceof VastError
        ? error
        : new VastError(
            error instanceof Error ? error.message : 'Failed to parse VAST',
            VastErrorCode.XML_PARSE
          );
    }

    this.options.onDocument?.({ url: context.url, depth, response });

    const ads: VastAd[] = [...response.ads];
    const errorUrls: string[] = [...response.errorUrls];
    let documentCount = 1;

    // Resolve wrappers sequentially: a waterfall stops at the first fill, and
    // firing several ad requests in parallel would double-count impressions.
    for (const wrapper of response.wrappers) {
      if (ads.length > 0 && !wrapper.allowMultipleAds) break;

      const nested = await this.resolveWrapper(wrapper, macros, depth);
      documentCount += nested.documentCount;
      errorUrls.push(...nested.errorUrls);

      if (nested.ads.length > 0) {
        ads.push(...nested.ads);
        if (!wrapper.allowMultipleAds) break;
      }
    }

    return { ads, errorUrls, documentCount };
  }

  private async resolveWrapper(
    wrapper: VastWrapper,
    macros: VastMacroContext,
    depth: number
  ): Promise<VastRequestResult> {
    const nextDepth = depth + 1;

    if (nextDepth > this.options.maxWrapperDepth) {
      // Report against the wrapper's own <Error> pixels — the chain, not the
      // creative, is what failed.
      return {
        ads: [],
        errorUrls: wrapper.errorUrls,
        documentCount: 0,
      };
    }

    const url = sanitizeEndpoint(substituteMacros(wrapper.tagUrl, macros));
    if (!url) {
      return { ads: [], errorUrls: wrapper.errorUrls, documentCount: 0 };
    }

    let xml: string;
    try {
      xml = await this.fetchXml(url);
    } catch {
      return { ads: [], errorUrls: wrapper.errorUrls, documentCount: 0 };
    }

    let nested: VastRequestResult;
    try {
      nested = await this.resolve(xml, {
        url,
        macros,
        // A wrapper that forbids further wrappers is enforced by jumping the
        // depth counter to the limit, so any nested wrapper is rejected.
        depth: wrapper.followAdditionalWrappers ? nextDepth : this.options.maxWrapperDepth,
      });
    } catch {
      return { ads: [], errorUrls: wrapper.errorUrls, documentCount: 1 };
    }

    const merged = applyWrapperToAds(wrapper, nested.ads);
    const limited = wrapper.allowMultipleAds ? merged : merged.slice(0, 1);

    return {
      ads: limited,
      // Wrapper errors only matter when the chain produced nothing.
      errorUrls: limited.length > 0 ? [] : [...wrapper.errorUrls, ...nested.errorUrls],
      documentCount: nested.documentCount,
    };
  }

  private async fetchXml(url: string): Promise<string> {
    const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new VastError('fetch is unavailable in this environment', VastErrorCode.UNDEFINED);
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), this.options.timeout)
      : null;

    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        // Ad requests must be readable, so `cors` (not `no-cors`) is required —
        // the ad server has to send Access-Control-Allow-Origin.
        mode: 'cors',
        credentials: this.options.withCredentials ? 'include' : 'omit',
        redirect: 'follow',
        signal: controller?.signal,
      });

      if (!response.ok) {
        throw new VastError(
          `VAST request failed with HTTP ${response.status}`,
          VastErrorCode.WRAPPER_NO_ADS
        );
      }

      return await response.text();
    } catch (error) {
      if (error instanceof VastError) throw error;
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? `VAST request timed out after ${this.options.timeout}ms`
          : error instanceof Error
            ? error.message
            : 'VAST request failed';
      throw new VastError(message, VastErrorCode.WRAPPER_NO_ADS);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

/**
 * Try each tag in order until one returns an ad — the classic waterfall.
 *
 * Returns the first filled result, or the last (empty) result when every tag
 * came back without inventory.
 */
export async function requestWaterfall(
  client: VastClient,
  tagUrls: string[],
  macros: VastMacroContext = {}
): Promise<VastRequestResult> {
  let last: VastRequestResult = { ads: [], errorUrls: [], documentCount: 0 };

  for (const tagUrl of tagUrls) {
    try {
      const result = await client.request(tagUrl, macros);
      if (result.ads.length > 0) return result;
      last = result;
    } catch (error) {
      last = {
        ads: [],
        errorUrls: error instanceof VastError ? error.errorUrls : [],
        documentCount: last.documentCount,
      };
    }
  }

  return last;
}
