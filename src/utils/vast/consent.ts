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

interface CmpWindow {
  __tcfapi?: TcfApi;
  __uspapi?: UspApi;
  __gpp?: GppApi;
}

/** Default time to wait for a CMP before giving up and requesting without it. */
const DEFAULT_CMP_TIMEOUT_MS = 1500;

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

/**
 * Read whatever privacy signals the host page publishes.
 *
 * All three frameworks are queried in parallel and independently: a page can
 * carry a GPP string without TCF, or US Privacy without either. Anything that
 * is missing, slow or broken simply does not contribute a macro.
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
  const host = options.window ?? (typeof window !== 'undefined' ? (window as CmpWindow) : undefined);

  if (!host) return {};

  const [tcf, usp, gpp] = await Promise.all([
    host.__tcfapi
      ? callCmp<TcfData>((resolve) => {
          host.__tcfapi!('getTCData', 2, (data, success) => {
            // `cmpuishown` means the user is still deciding; the string at that
            // point is provisional and must not be sent.
            const ready =
              !data?.eventStatus ||
              data.eventStatus === 'tcloaded' ||
              data.eventStatus === 'useractioncomplete';
            resolve(success && ready ? data : null);
          });
        }, timeout)
      : Promise.resolve(null),

    host.__uspapi
      ? callCmp<UspData>((resolve) => {
          host.__uspapi!('getUSPData', 1, (data, success) => resolve(success ? data : null));
        }, timeout)
      : Promise.resolve(null),

    host.__gpp
      ? callCmp<GppData>((resolve) => {
          host.__gpp!('ping', (data, success) => resolve(success ? data : null));
        }, timeout)
      : Promise.resolve(null),
  ]);

  const consent: AdConsent = {};

  if (tcf?.gdprApplies !== undefined) consent.gdprApplies = tcf.gdprApplies;
  if (tcf?.tcString) consent.tcString = tcf.tcString;
  if (usp?.uspString) consent.usPrivacy = usp.uspString;
  if (gpp?.gppString) consent.gppString = gpp.gppString;
  if (gpp?.applicableSections?.length) consent.gppSectionIds = gpp.applicableSections;

  return consent;
}
