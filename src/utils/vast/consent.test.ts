import { describe, expect, it } from 'vitest';
import {
  consentAllowsAdRequest,
  consentMacros,
  readConsentFromCmp,
  type AdConsent,
} from './consent';
import { substituteMacros } from './macros';

describe('consentMacros', () => {
  it('maps every signal onto its VAST macro', () => {
    const consent: AdConsent = {
      gdprApplies: true,
      tcString: 'CPcqDIAPcqDIAAKAsAENCZCsAP_AAH_AAAqIJJNd_H__bX9j-f5_aft0eY1P9_r3v-QzjhfNt-8F2L_W_L0X_2E7NF36tq4KmR4Eu3LBIQNlHMHUTUmwaokVryHsak2cpzNKJ7BEknMZeydYGF9vmxtj-QKY7_5_d3bx2D-t_9v-39z3_9f39z3_9f_1l_-_1___4A',
      usPrivacy: '1YNN',
      gppString: 'DBABMA~CPXxRfAPXxRfAAfKABENB-CgAAAAAAAAAAYgAAAAAAAA',
      gppSectionIds: [2, 6],
      limitAdTracking: false,
    };

    expect(consentMacros(consent)).toEqual({
      GDPR: '1',
      GDPRCONSENT: consent.tcString,
      US_PRIVACY: '1YNN',
      GPP: consent.gppString,
      GPP_SID: '2,6',
      LIMITADTRACKING: '0',
    });
  });

  it('omits absent signals instead of sending empty ones', () => {
    // `&gdpr_consent=` claims "asked and refused", which is a different
    // statement from "this page has no CMP".
    expect(consentMacros({ usPrivacy: '1YNN' })).toEqual({ US_PRIVACY: '1YNN' });
    expect(consentMacros({})).toEqual({});
    expect(consentMacros(undefined)).toEqual({});
  });

  it('distinguishes gdprApplies=false from gdprApplies being unset', () => {
    expect(consentMacros({ gdprApplies: false })).toEqual({ GDPR: '0' });
    expect(consentMacros({})).not.toHaveProperty('GDPR');
  });

  it('drops an empty section list rather than sending a bare GPP_SID', () => {
    expect(consentMacros({ gppSectionIds: [] })).toEqual({});
  });

  it('survives macro substitution into a tag URL', () => {
    const macros = consentMacros({ gdprApplies: true, tcString: 'CPcqDIA_tc', usPrivacy: '1YNN' });
    const url = substituteMacros(
      'https://ads.example.com/vast?gdpr=[GDPR]&gdpr_consent=[GDPRCONSENT]&us_privacy=[US_PRIVACY]',
      macros
    );

    // Base64url is unreserved, so the consent string must survive verbatim —
    // an ad server that receives a mangled TC string rejects the request.
    expect(url).toBe(
      'https://ads.example.com/vast?gdpr=1&gdpr_consent=CPcqDIA_tc&us_privacy=1YNN'
    );
  });

  it('leaves unknown privacy macros verbatim when no signal is supplied', () => {
    expect(substituteMacros('https://a.example.com?gdpr=[GDPR]', consentMacros({}))).toBe(
      'https://a.example.com?gdpr=[GDPR]'
    );
  });
});

describe('readConsentFromCmp', () => {
  it('returns nothing when the page has no CMP', async () => {
    await expect(readConsentFromCmp({ window: {} })).resolves.toEqual({});
  });

  it('reads TCF, US Privacy and GPP in one pass', async () => {
    const consent = await readConsentFromCmp({
      window: {
        __tcfapi: (_cmd, _v, cb) => cb({ gdprApplies: true, tcString: 'CPtc', eventStatus: 'tcloaded' }, true),
        __uspapi: (_cmd, _v, cb) => cb({ uspString: '1YNN' }, true),
        __gpp: (_cmd, cb) => cb({ gppString: 'DBABMA~C', applicableSections: [2] }, true),
      },
    });

    expect(consent).toEqual({
      gdprApplies: true,
      tcString: 'CPtc',
      usPrivacy: '1YNN',
      gppString: 'DBABMA~C',
      gppSectionIds: [2],
    });
  });

  it('ignores a provisional string while the CMP UI is still open', async () => {
    // `cmpuishown` means the user has not decided yet. Sending that string
    // would claim a consent state the user never gave.
    const consent = await readConsentFromCmp({
      window: {
        __tcfapi: (_cmd, _v, cb) =>
          cb({ gdprApplies: true, tcString: 'PROVISIONAL', eventStatus: 'cmpuishown' }, true),
      },
    });

    expect(consent).toEqual({});
  });

  it('ignores a CMP that reports failure', async () => {
    const consent = await readConsentFromCmp({
      window: { __tcfapi: (_cmd, _v, cb) => cb({ tcString: 'CPtc' }, false) },
    });

    expect(consent).toEqual({});
  });

  it('gives up on a CMP that never calls back', async () => {
    // No ad request at all is strictly worse than one without a consent string.
    const consent = await readConsentFromCmp({
      timeout: 10,
      window: { __tcfapi: () => {} },
    });

    expect(consent).toEqual({});
  });

  it('survives a CMP that throws', async () => {
    const consent = await readConsentFromCmp({
      timeout: 10,
      window: {
        __tcfapi: () => {
          throw new Error('CMP exploded');
        },
        __uspapi: (_cmd, _v, cb) => cb({ uspString: '1YNN' }, true),
      },
    });

    // One broken framework must not take the others down with it.
    expect(consent).toEqual({ usPrivacy: '1YNN' });
  });
});

describe('consentAllowsAdRequest', () => {
  it('blocks when GDPR applies and no consent string exists', () => {
    // The one case where we positively know consent was required and absent.
    expect(consentAllowsAdRequest({ gdprApplies: true })).toBe(false);
    expect(consentAllowsAdRequest({ gdprApplies: true, tcString: '' })).toBe(false);
  });

  it('allows once a consent string exists, whatever it encodes', () => {
    // A user who was asked and refused still produces a string — one encoding
    // the refusal. Honouring it is the ad server's job, not the gate's.
    expect(consentAllowsAdRequest({ gdprApplies: true, tcString: 'CPrefused' })).toBe(true);
  });

  it('allows when the CMP says GDPR does not apply', () => {
    expect(consentAllowsAdRequest({ gdprApplies: false })).toBe(true);
  });

  it('allows when there is no CMP at all', () => {
    // Silence is not refusal. A publisher outside the EU has no reason to run
    // one, and blocking there drops inventory to satisfy a rule that does not
    // apply.
    expect(consentAllowsAdRequest({})).toBe(true);
    expect(consentAllowsAdRequest(undefined)).toBe(true);
  });

  it('does not block on limitAdTracking alone', () => {
    // Forwarded as [LIMITADTRACKING]; it governs personalisation, not whether a
    // request may be made.
    expect(consentAllowsAdRequest({ limitAdTracking: true })).toBe(true);
  });

  it('allows a US-Privacy-only page', () => {
    expect(consentAllowsAdRequest({ usPrivacy: '1YNN' })).toBe(true);
  });
});

describe('readConsentFromCmp inside an iframe', () => {
  /**
   * A window whose CMP lives in an ancestor frame, reachable only over
   * postMessage — which is the situation for every iframe embed.
   */
  function iframeWindow(reply: (call: Record<string, unknown>) => unknown) {
    const listeners: Array<(event: MessageEvent) => void> = [];

    const locatorHost = {
      frames: { __tcfapiLocator: {}, __uspapiLocator: {}, __gppLocator: {} },
      postMessage: (message: unknown) => {
        const payload = message as Record<string, Record<string, unknown>>;
        const call = payload.__tcfapiCall ?? payload.__uspapiCall ?? payload.__gppCall;
        const key = payload.__tcfapiCall
          ? '__tcfapiReturn'
          : payload.__uspapiCall
            ? '__uspapiReturn'
            : '__gppReturn';

        const returnValue = reply(call);
        if (returnValue === undefined) return;

        const event = {
          data: { [key]: { callId: call.callId, returnValue, success: true } },
        } as MessageEvent;
        for (const listener of [...listeners]) listener(event);
      },
    };

    const win = {
      // No __tcfapi of our own: we are in the iframe.
      frames: {},
      addEventListener: (_type: string, listener: (event: MessageEvent) => void) => {
        listeners.push(listener);
      },
      removeEventListener: (_type: string, listener: (event: MessageEvent) => void) => {
        const i = listeners.indexOf(listener);
        if (i >= 0) listeners.splice(i, 1);
      },
    } as Record<string, unknown>;

    win.parent = locatorHost;
    (locatorHost as Record<string, unknown>).parent = locatorHost;
    return win;
  }

  it('reads the publisher CMP through the locator frame', async () => {
    const consent = await readConsentFromCmp({
      timeout: 50,
      window: iframeWindow((call) => {
        if (call.command === 'getTCData') {
          return { gdprApplies: true, tcString: 'CPiframe', eventStatus: 'tcloaded' };
        }
        if (call.command === 'getUSPData') return { uspString: '1YNN' };
        return undefined;
      }),
    });

    expect(consent).toMatchObject({
      gdprApplies: true,
      tcString: 'CPiframe',
      usPrivacy: '1YNN',
    });
  });

  it('still rejects a provisional string received over postMessage', async () => {
    const consent = await readConsentFromCmp({
      timeout: 50,
      window: iframeWindow((call) =>
        call.command === 'getTCData'
          ? { gdprApplies: true, tcString: 'PROVISIONAL', eventStatus: 'cmpuishown' }
          : undefined
      ),
    });

    expect(consent).toEqual({});
  });

  it('gives up when no ancestor answers', async () => {
    // Without this the iframe embed would hang on every ad request.
    const consent = await readConsentFromCmp({
      timeout: 20,
      window: iframeWindow(() => undefined),
    });

    expect(consent).toEqual({});
  });

  it('returns nothing when there is no locator frame anywhere', async () => {
    const orphan: Record<string, unknown> = {
      frames: {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    orphan.parent = orphan;

    await expect(readConsentFromCmp({ timeout: 20, window: orphan })).resolves.toEqual({});
  });
});
