/**
 * Privacy-signal macros for ad requests.
 *
 * An SSP that receives no consent signal has two choices: drop the request, or
 * serve it non-personalised at a fraction of the CPM. Either way the inventory
 * is worth less, so these macros are a revenue concern rather than a compliance
 * checkbox — the compliance part is the host's CMP, which the player only reads.
 *
 * The player never *decides* anything about consent. It reads what a CMP already
 * published and forwards it verbatim, exactly as VAST 4.2 § 6 and the IAB
 * framework specs require.
 *
 * Spec references:
 * - TCF v2.2: https://iabeurope.eu/tcf-2-2/
 * - CCPA / US Privacy: https://github.com/InteractiveAdvertisingBureau/USPrivacy
 * - GPP: https://github.com/InteractiveAdvertisingBureau/Global-Privacy-Platform
 */

import type { AdConsent } from '@/types/vast';
import type { VastMacroContext } from './macros';

export type { AdConsent };

/** Minimal shape of the TCF v2 `__tcfapi` payload the player reads. */
interface TcfData {
  gdprApplies?: boolean;
  tcString?: string;
  /** `tcloaded` / `useractioncomplete` mean the string is final. */
  eventStatus?: string;
  cmpStatus?: string;
}

/** Minimal shape of the `__uspapi` payload. */
interface UspData {
  uspString?: string;
}

/** Minimal shape of the `__gpp` payload. */
interface GppData {
  gppString?: string;
  applicableSections?: number[];
}

type TcfApi = (
  command: string,
  version: number,
  callback: (data: TcfData | null, success: boolean) => void
) => void;

type UspApi = (
  command: string,
  version: number,
  callback: (data: UspData | null, success: boolean) => void
) => void;

type GppApi = (
  command: string,
  callback: (data: GppData | null, success: boolean) => void
) => void;

export interface CmpWindow {
  __tcfapi?: TcfApi;
  __uspapi?: UspApi;
  __gpp?: GppApi;
  /** Named child frames — this is where the `*Locator` frames are found. */
  frames?: Record<string, unknown>;
  parent?: CmpWindow;
  postMessage?: (message: unknown, targetOrigin: string) => void;
  addEventListener?: (type: string, listener: (event: MessageEvent) => void) => void;
  removeEventListener?: (type: string, listener: (event: MessageEvent) => void) => void;
}

/** Default time to wait for a CMP before giving up and requesting without it. */
const DEFAULT_CMP_TIMEOUT_MS = 1500;

/** How far up the frame chain to look for a CMP locator before giving up. */
const MAX_FRAME_DEPTH = 20;

/** Monotonic call ids, so concurrent CMP calls cannot mix up their answers. */
let callSequence = 0;

/**
 * Turn consent signals into the VAST macros an ad server expects.
 *
 * Absent fields produce no macro at all rather than an empty one — a bare
 * `&gdpr_consent=` reads as "consent was requested and refused", which is a
 * different claim from "this page has no CMP".
 */
export function consentMacros(consent: AdConsent | undefined): VastMacroContext {
  if (!consent) return {};

  const macros: VastMacroContext = {};

  if (consent.gdprApplies !== undefined) macros.GDPR = consent.gdprApplies ? '1' : '0';
  if (consent.tcString) macros.GDPRCONSENT = consent.tcString;
  if (consent.usPrivacy) macros.US_PRIVACY = consent.usPrivacy;
  if (consent.gppString) macros.GPP = consent.gppString;
  if (consent.gppSectionIds?.length) macros.GPP_SID = consent.gppSectionIds.join(',');
  if (consent.limitAdTracking !== undefined) {
    macros.LIMITADTRACKING = consent.limitAdTracking ? '1' : '0';
  }

  return macros;
}

/**
 * Find the frame that hosts a CMP, walking up the ancestor chain.
 *
 * Inside an iframe there is no `window.__tcfapi` — the CMP lives on the
 * publisher's page and the IAB specs define a `postMessage` protocol instead,
 * discovered through a marker frame named `__tcfapiLocator` (and its `__uspapi`
 * / `__gpp` equivalents). Without this, an iframe embed silently gets no
 * consent signal at all, which is far worse than getting a negative one.
 */
function findLocatorFrame(win: CmpWindow, locatorName: string): CmpWindow | null {
  let current: CmpWindow | undefined = win;

  for (let depth = 0; current && depth < MAX_FRAME_DEPTH; depth += 1) {
    try {
      // Cross-origin ancestors throw on property access; that is expected and
      // simply means "keep walking".
      if (current.frames?.[locatorName]) return current;
    } catch {
      // Ignore and continue up.
    }

    const parent: CmpWindow | undefined = current.parent;
    // `window.parent === window` at the top of the chain.
    if (!parent || parent === current) break;
    current = parent;
  }

  return null;
}

/**
 * Call a CMP in an ancestor frame over `postMessage`.
 *
 * Resolves `null` on timeout, malformed replies or no locator — every failure
 * path here means "no signal", never an exception into the ad pipeline.
 */
function callViaLocator<T>(
  win: CmpWindow,
  locatorName: string,
  callKey: string,
  returnKey: string,
  payload: Record<string, unknown>,
  timeout: number
): Promise<T | null> {
  const host = findLocatorFrame(win, locatorName);
  const post = host?.postMessage;
  const listen = win.addEventListener;
  const unlisten = win.removeEventListener;
  if (!host || !post || !listen) return Promise.resolve(null);

  const callId = `fairu-${(callSequence += 1)}`;

  return new Promise<T | null>((resolve) => {
    let settled = false;

    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unlisten?.call(win, 'message', onMessage);
      resolve(value);
    };

    const onMessage = (event: MessageEvent) => {
      // Some CMPs post a JSON string rather than a structured clone.
      let data: unknown = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }

      const reply = (data as Record<string, { callId?: string; returnValue?: T; success?: boolean }>)
        ?.[returnKey];
      if (!reply || reply.callId !== callId) return;

      finish(reply.success === false ? null : (reply.returnValue ?? null));
    };

    const timer = setTimeout(() => finish(null), timeout);

    try {
      listen.call(win, 'message', onMessage);
      post.call(host, { [callKey]: { ...payload, callId } }, '*');
    } catch {
      finish(null);
    }
  });
}

/** Resolve a CMP callback into a promise, with a timeout and no throw path. */
function callCmp<T>(invoke: (resolve: (value: T | null) => void) => void, timeout: number) {
  return new Promise<T | null>((resolve) => {
    let settled = false;
    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), timeout);

    try {
      invoke(finish);
    } catch {
      // A CMP that throws is treated as absent — an ad request without a
      // consent string still has a chance of filling; no ad request has none.
      finish(null);
    }
  });
}

/** A TC string is only final once the user has actually decided. */
function tcfIsFinal(data: TcfData | null): boolean {
  // `cmpuishown` means the banner is still open; the string at that point is
  // provisional and must not be sent.
  return (
    !data?.eventStatus ||
    data.eventStatus === 'tcloaded' ||
    data.eventStatus === 'useractioncomplete'
  );
}

/**
 * Read whatever privacy signals the host page publishes.
 *
 * All three frameworks are queried in parallel and independently: a page can
 * carry a GPP string without TCF, or US Privacy without either. Anything that
 * is missing, slow or broken simply does not contribute a macro.
 *
 * Each framework is tried **twice**: directly on this window, and — when that is
 * absent — over `postMessage` to the CMP's locator frame. The second path is
 * what makes an iframe embed work at all, since the CMP then lives on the
 * publisher's page rather than in our document.
 *
 * ```ts
 * const consent = await readConsentFromCmp();
 * const { adBreaks } = useVastAdBreaks({ preRoll: tag, consent });
 * ```
 *
 * Returns an empty object outside the browser, so this is safe to call in SSR.
 */
export async function readConsentFromCmp(
  options: { timeout?: number; window?: CmpWindow } = {}
): Promise<AdConsent> {
  const timeout = options.timeout ?? DEFAULT_CMP_TIMEOUT_MS;
  const host =
    options.window ??
    (typeof window !== 'undefined' ? (window as unknown as CmpWindow) : undefined);

  if (!host) return {};

  const [tcf, usp, gpp] = await Promise.all([
    host.__tcfapi
      ? callCmp<TcfData>((resolve) => {
          host.__tcfapi!('getTCData', 2, (data, success) =>
            resolve(success && tcfIsFinal(data) ? data : null)
          );
        }, timeout)
      : callViaLocator<TcfData>(
          host,
          '__tcfapiLocator',
          '__tcfapiCall',
          '__tcfapiReturn',
          { command: 'getTCData', version: 2 },
          timeout
        ).then((data) => (tcfIsFinal(data) ? data : null)),

    host.__uspapi
      ? callCmp<UspData>((resolve) => {
          host.__uspapi!('getUSPData', 1, (data, success) => resolve(success ? data : null));
        }, timeout)
      : callViaLocator<UspData>(
          host,
          '__uspapiLocator',
          '__uspapiCall',
          '__uspapiReturn',
          { command: 'getUSPData', version: 1 },
          timeout
        ),

    host.__gpp
      ? callCmp<GppData>((resolve) => {
          host.__gpp!('ping', (data, success) => resolve(success ? data : null));
        }, timeout)
      : callViaLocator<GppData>(
          host,
          '__gppLocator',
          '__gppCall',
          '__gppReturn',
          { command: 'ping', version: '1.1' },
          timeout
        ),
  ]);

  const consent: AdConsent = {};

  if (tcf?.gdprApplies !== undefined) consent.gdprApplies = tcf.gdprApplies;
  if (tcf?.tcString) consent.tcString = tcf.tcString;
  if (usp?.uspString) consent.usPrivacy = usp.uspString;
  if (gpp?.gppString) consent.gppString = gpp.gppString;
  if (gpp?.applicableSections?.length) consent.gppSectionIds = gpp.applicableSections;

  return consent;
}

/**
 * Whether an ad request may be sent with these signals.
 *
 * The rule is deliberately narrow: **block only when a CMP has said GDPR
 * applies and has not produced a consent string.** That is the one case where
 * we positively know consent was required and is absent.
 *
 * What this does *not* block, and why:
 *
 * - **No CMP at all.** Silence is not a refusal. A publisher outside the EU has
 *   no reason to run one, and blocking there would drop inventory to satisfy a
 *   rule that does not apply.
 * - **`gdprApplies === false`.** The CMP has explicitly said the regime does not
 *   apply.
 * - **`limitAdTracking`.** It is forwarded as `[LIMITADTRACKING]`; honouring it
 *   is the ad server's job, and it governs personalisation rather than whether a
 *   request may be made at all.
 *
 * A user who was *asked* and refused still produces a `tcString` — one encoding
 * the refusal — so this does not block them here. It blocks the case where no
 * answer exists, which is the one where sending anything would be a guess.
 */
export function consentAllowsAdRequest(consent: AdConsent | undefined): boolean {
  return !(consent?.gdprApplies === true && !consent.tcString);
}
