import { describe, expect, it } from 'vitest';
import { consentMacros, readConsentFromCmp, type AdConsent } from './consent';
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
