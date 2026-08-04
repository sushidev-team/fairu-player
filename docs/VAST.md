# VAST support

What `@fairu/player` does and does not do with IAB ad tags.

---

## Read this first: what shipped when

| | `@fairu/player` ≤ 1.2.0 | 1.3.x | this branch |
|---|---|---|---|
| VAST XML parsing | ❌ | ✅ | ✅ |
| Wrapper chain resolution | ❌ | ✅ | ✅ |
| Tracking pixels | partial¹ | ✅ | ✅ |
| VMAP placement | ❌ | ✅ | ✅ |
| `VideoPlayer` accepts a tag URL | ❌ | ✅ via `useVastAdBreaks` | ✅ |
| Reels feed accepts a tag URL | n/a (no reels) | ✅ | ✅ |
| Audio player accepts a tag URL | ❌ | ✅ | ✅ |
| Consent macros (TCF / CCPA / GPP) | ❌ | ❌ | ✅ |
| Consent in an iframe embed (locator) | ❌ | ❌ | ✅ |
| No request without required consent | ❌ | ❌ | ✅ default on |
| Just-in-time mid-roll requests | ❌ | ❌ | ✅ opt-in |
| Frequency capping outside reels | ❌ | ❌ | ✅ |
| MRC viewability measurement | ❌ | ❌ | ✅ |
| AdChoices badge outside reels | ❌ | ❌ | ✅ |
| NonLinear overlays rendered | ❌ | ❌ | ✅ |
| Companion beside the video player | ❌ | ❌ | ✅ |

¹ ≤ 1.2.0 fired **one** URL per event, with no macro substitution — see
[Corrections](#corrections-to-120-behaviour).

Everything in the first three columns is on npm. The `this branch` column is not
published yet.

---

## The two entry points

### Classic `VideoPlayer` — `useVastAdBreaks`

```tsx
import { VideoPlayer, useVastAdBreaks } from '@fairu/player';

const { adBreaks, loading, error } = useVastAdBreaks({
  preRoll: 'https://ads.example.com/vast?cb=[CACHEBUSTING]',
  midRolls: [{ at: 300, tagUrl: 'https://ads.example.com/vast?pos=mid' }],
  postRoll: 'https://ads.example.com/vast?pos=post',
  defaultSkipOffset: 5,
});

<VideoPlayer
  track={track}
  adConfig={{ enabled: adBreaks.length > 0, adBreaks }}
/>;
```

Let a VMAP document own placement instead:

```tsx
const { adBreaks } = useVastAdBreaks({
  vmapUrl: 'https://ads.example.com/vmap',
  duration: track.duration, // needed to resolve `percent` offsets
});
```

Or pass the document directly, when the backend already has it — no ad request
from the browser, and no CORS requirement on the ad server:

```tsx
const { adBreaks } = useVastAdBreaks({
  preRoll: { xml: channel.vastXml },
});
```

A **waterfall** is a list; the first tag that fills wins. An inline `{ xml }`
entry mixed into the list acts as the guaranteed-fill fallback:

```tsx
preRoll: [
  'https://ssp-a.example.com/vast',
  'https://ssp-b.example.com/vast',
  { xml: houseAdVast },
]
```

### Reels feed

See [REELS.md](./REELS.md) § 3. Same pipeline, different placement model: ads
are feed items rather than interruptions.

---

## Consent

### The two rules this follows

**1. The player reads consent; it never asks for it.** There is no code path
that renders a consent banner, and there will not be one. In an embed the
consent belongs to the publisher whose article the player sits in — showing our
own banner inside someone else's page would be claiming an authority we do not
have.

**2. The player stores nothing.** No cookies, no `localStorage`, no
`sessionStorage` — `grep` the source. It is therefore not a service that a
consent manager needs to list, and adding the player to a site does not require
a `CONSENT_VERSION` bump. The **ad server behind your tag URL** is the service
that needs declaring, and that is true whether or not this player is involved.

### Reading the signals

```tsx
const { adBreaks, consentBlocked } = useVastAdBreaks({
  preRoll: tag,
  consent: 'auto',
});
```

`'auto'` queries all three frameworks once, before the first ad request, and
gives up after 1.5 s rather than holding up playback. Pass an `AdConsent` object
instead when the host already holds the strings:

```tsx
consent: { gdprApplies: true, tcString, usPrivacy: '1YNN' }
```

Two lookups happen per framework, in this order:

| | Where the CMP is | How it is reached |
|---|---|---|
| Inline embed, or the player on your own page | same window | `window.__tcfapi` / `__uspapi` / `__gpp` |
| **iframe embed** | publisher's page, an ancestor frame | `postMessage` to `__tcfapiLocator` / `__uspapiLocator` / `__gppLocator` |

The second row matters more than it looks. Inside an iframe there is no
`window.__tcfapi` at all, so a player that only checks the local window silently
concludes "no CMP" on every publisher — the one place where getting it wrong is
least visible. The ancestor chain is walked up to 20 frames; cross-origin
ancestors throw on property access, which is expected and simply means "keep
walking".

A `tcString` is only accepted once it is final. While `eventStatus` is
`cmpuishown` the banner is still open and the string is provisional; sending it
would claim a decision the user has not made.

### What gets sent

Signals that are absent produce **no macro at all**:

| Signal | Macro |
|---|---|
| `gdprApplies` | `[GDPR]` — `1` / `0` |
| `tcString` | `[GDPRCONSENT]` |
| `usPrivacy` | `[US_PRIVACY]` |
| `gppString` | `[GPP]` |
| `gppSectionIds` | `[GPP_SID]` — comma separated |
| `limitAdTracking` | `[LIMITADTRACKING]` — `1` / `0` |

A bare `&gdpr_consent=` tells an SSP "asked and refused", which is a different
claim from "this page has no CMP". Omitting is the honest encoding of "unknown",
and the difference is worth real money.

### When no request is sent at all

`requireConsent` defaults to **`true`** and blocks exactly one case:

> A CMP said **GDPR applies**, and produced **no consent string**.

That is the only situation where we positively know consent was required and
does not exist. Everything ambiguous is deliberately left alone:

| Situation | Request sent? | Why |
|---|---|---|
| `gdprApplies: true`, no `tcString` | **no** | Consent required, no answer exists |
| `gdprApplies: true`, `tcString` present | yes | Even a refusal is encoded *in* the string — honouring it is the ad server's job |
| `gdprApplies: false` | yes | The CMP explicitly said the regime does not apply |
| No CMP at all | yes | Silence is not refusal. A publisher outside the EU has no reason to run one |
| `limitAdTracking: true` | yes | Forwarded as a macro; it governs personalisation, not whether a request may be made |

The gate sits **before planning**, so a VMAP document — itself an ad request —
is not fetched either, and it applies to deferred mid-rolls under
`just-in-time`, not only to the pre-roll.

Turning it on by default changes nothing for existing integrations: without a
`consent` option there is no `gdprApplies` to act on, so the gate never fires.
It only ever bites once you have opted into reading consent at all.

```tsx
const { adBreaks, consentBlocked } = useVastAdBreaks({
  preRoll: tag,
  consent: 'auto',
  onConsentBlocked: (consent) => analytics.track('ad_blocked_no_consent', consent),
});
```

Wire `onConsentBlocked`, or read `consentBlocked`. A blocked session and a
session with no inventory both look like `adBreaks: []` in a fill-rate report
and need completely different fixes.

`requireConsent: false` restores the previous behaviour — request anyway, let
the SSP decide. That is a defensible position if every publisher you serve is
known to be set up correctly; it is not the default because that assumption
fails quietly.

The reels feed takes the same two options on `ReelsAdConfig`. A blocked slot
resolves to `empty`, so the feed scrolls straight through it exactly as it does
for an unfilled auction — the slot is never removed, because removing it would
shift every index behind it under a scrolling viewer.

---

## Requesting ads just before they play

By default every break is requested at mount. For a pre-roll that is right; for
a mid-roll at twenty minutes it means the bid expired long before the spot runs,
and every viewer who leaves early has still cost an ad request that never became
an impression.

```tsx
const { adBreaks, notifyTime } = useVastAdBreaks({
  midRolls: [{ at: 1200, tagUrl }],
  requestStrategy: 'just-in-time',
  prefetchSeconds: 15,
});

<VideoPlayer onTimeUpdate={notifyTime} adConfig={{ enabled: true, adBreaks }} />
```

`notifyTime` is deliberately not React state — it is called several times a
second, and only an actual fill re-renders.

Placement is still planned up front. A VMAP document *is* the schedule, so it is
fetched at mount either way; only the ad requests move.

This is opt-in because defaulting to it would silently drop mid- and post-rolls
for every integration that does not wire `notifyTime`. It should become the
default in the next major.

---

## Load rules

```tsx
<VideoPlayer adConfig={{
  enabled: true,
  adBreaks,
  maxAdsPerSession: 4,
  minSecondsBetweenAds: 600,
  maxAdDurationPerBreak: 60,
  onAdCapped: (adBreak, reason) => log(reason), // 'session-cap' | 'pacing'
}} />
```

Rules are evaluated when a break is about to play, not when it is planned, so
pacing follows what the listener actually did. A capped break is skipped, never
queued — deferring an ad stacks two spots back to back, which is worse than
dropping one. A pod over `maxAdDurationPerBreak` is trimmed rather than dropped:
the first spot is the one that was sold.

Log `onAdCapped`. A capped session and a session with no inventory look
identical from the outside and need very different fixes.

---

## What is implemented

| Standard | Scope |
|---|---|
| **VAST 2.0 – 4.3** | `<InLine>`, `<Wrapper>`, ad pods (`sequence`), `<Linear>` with `<MediaFile>`, `skipoffset`, `<TrackingEvents>` incl. offset-based `progress`, `<VideoClicks>`, `<Icons>` (AdChoices, rendered in all three players), `<ViewableImpression>` (measured), `<NonLinearAds>` (rendered as overlays), `<CompanionAds>` (rendered in the audio and video players), `<Pricing>`, `<AdVerifications>` (parsed), `<Extensions>` |
| **Wrappers** | Full chain resolution, tracking merged into the in-line ad, depth-limited (default 5), `followAdditionalWrappers` and `allowMultipleAds` honoured |
| **Macros** | `[CACHEBUSTING]`, `[TIMESTAMP]`, `[ADPLAYHEAD]`, `[CONTENTPLAYHEAD]`, `[PLAYERSIZE]`, `[ERRORCODE]`, `[BREAKPOSITION]`, `[PAGEURL]`, `[REFERRER]`, `[INVIEW]`, plus the privacy set below and the legacy `%%MACRO%%` form. Unknown macros are left verbatim |
| **Privacy** | `[GDPR]`, `[GDPRCONSENT]`, `[US_PRIVACY]`, `[GPP]`, `[GPP_SID]`, `[LIMITADTRACKING]`, read from the page's CMP on request |
| **Error codes** | 100, 101, 102, 200, 302, 303, 400, 403, 405, 900 reported to `<Error>` pixels |
| **VMAP 1.0** | `<AdBreak>` with `start`/`end`/time/percent/`position` offsets, `<AdSource>` as `<AdTagURI>` or inline `<VASTAdData>`, `repeatAfter`, `breakType` filtering |
| **Load rules** | Session cap, minimum gap between breaks and pod-duration cap, shared by all three players |

### Not implemented

- **VPAID — deliberately rejected.** Executable third-party JS with player-level
  access. Deprecated in VAST 4.1. The media-file selector refuses
  `apiFramework="VPAID"` and `"OMID"`, so such a creative can never reach a
  `<video>` element.
- **OMID / Open Measurement.** `<AdVerifications>` is parsed and exposed, but no
  verification script is executed. Third-party viewability (IAS, DoubleVerify,
  Moat) needs the OM SDK — see [OMID.md](./OMID.md) for what adopting it costs.
- **SSAI.** Client-side stitching only.
- **`position:N` VMAP offsets in `VideoPlayer`.** They count *items*, which is
  meaningless for a single video; they are dropped. The reels feed does honour
  them.

### Implemented since 1.3.x

- **Audio ads.** VAST 4.1 absorbed DAAST, so an audio ad is an ordinary VAST
  document — `AudioPlayer` takes `adConfig` and the same `useVastAdBreaks`
  output, with `audioAdMediaOptions()` picking the `audio/*` renditions.
- **MRC viewability.** 50 % of pixels for 2 continuous seconds, measured by
  `useAdViewability`, with the clock stopped by pause, scroll-out and a
  backgrounded tab. Resolves to `Viewable`, `NotViewable` or `ViewUndetermined`
  and fills `[INVIEW]`.

---

## Corrections to 1.2.0 behaviour

Wiring the classic player onto the shared tracker fixed three real defects that
existed in the released version, independent of VAST:

**1. Only the first URL per event was fired.**
`AdTrackingUrls.impression` was typed `string`. A VAST wrapper chain contributes
an SSP impression *and* a DSP impression; the second was silently dropped. The
type is now `string | string[]` — backwards compatible, existing configs keep
working — and every URL is sent.

**2. Macros were not substituted.**
`fetch(url)` sent `?cb=[CACHEBUSTING]` verbatim, so ad servers received the
literal placeholder instead of a cache buster. Verified fixed in a browser: the
pixel now goes out as `?cb=48746971`.

**3. Pixels were lost on page teardown.**
Plain `fetch` was used; the tracker now prefers `navigator.sendBeacon` with a
`keepalive` fetch fallback.

The quartile bookkeeping also moved into `VastTracker`, which means the classic
player, the reels feed and `AdService` now share one implementation of
"fire exactly once", instead of three that could drift.

**4. `OverlayAd` was missed by that sweep.** It kept firing pixels with a bare
`fetch` — the same three defects again — until non-linear support was wired up.
It is now on the shared beacon path.

---

## Architecture

```
useVastAdBreaks ─┐
                 ├─→ VastClient ──→ parseVast ──→ applyWrapperToAds
useReelsFeed ────┘        │                            │
                          │                            ▼
                          │                    selectMediaFile
                          │                            │
                          ▼                            ▼
                     parseVmap              vastAdToVideoAd / vastAdToReelAd
                                                       │
                                                       ▼
                                                  VastTracker
                                            (once-only, macros, beacons)
```

| Concern | File |
|---|---|
| Types | `src/types/vast.ts` |
| XML parser | `src/utils/vast/parseVast.ts` |
| VMAP parser | `src/utils/vast/parseVmap.ts` |
| Fetch + wrapper chain | `src/utils/vast/VastClient.ts` |
| Media-file selection | `src/utils/vast/mediaFile.ts` |
| Macros | `src/utils/vast/macros.ts` |
| Pixel firing | `src/utils/vast/VastTracker.ts` |
| Consent signals | `src/utils/vast/consent.ts` |
| Load rules | `src/utils/adCaps.ts` |
| Viewability | `src/hooks/useAdViewability.ts` |
| → `VideoAd` | `src/utils/vast/toVideoAd.ts` |
| → `ReelAd` | `src/utils/vast/toReelAd.ts` |
| → `Ad` (audio) | `src/utils/vast/toAudioAd.ts` |
| → `OverlayAd` (non-linear) | `src/utils/vast/toOverlayAd.ts` |
| `VideoPlayer` / `AudioPlayer` hook | `src/hooks/useVastAdBreaks.ts` |
| AdChoices badge | `src/components/ads/AdChoicesIcon/` |

---

## Security

The pipeline consumes third-party XML and third-party URLs, so:

- Tag URLs and wrapper redirects pass `sanitizeEndpoint()` — **absolute `http(s)`
  only**. A hostile config or wrapper cannot smuggle `javascript:`, `file:` or
  `data:` into the ad pipeline. Covered by tests.
- Media URLs pass `sanitizeUrl()` before reaching a `<video>`.
- The wrapper chain is depth-limited, so a self-referencing wrapper terminates.
- Ad requests use `mode: 'cors'`, `credentials: 'omit'`.
- Click-throughs open with `noopener,noreferrer`.
- VPAID/OMID creatives are rejected by the media-file selector.

> Because tag URLs must be absolute `http(s)`, an ad server that does not send
> `Access-Control-Allow-Origin` cannot be fetched from the browser. Use the
> `{ xml }` form and have the backend fetch the tag in that case.

---

## Verification

Beyond unit tests, the `VideoPlayer` VAST path was driven in headless Chrome:

```
resolved: 2 break(s): pre-roll, mid-roll@20s
ad plays: Jellyfish_360_10s_1MB.mp4 @ 8.5s, "AD" badge, Skip Ad button
pixels:   imp?cb=48746971 → start → q1 → q2 → q3     (in order, once each)
callbacks: ad:start → ad:firstQuartile → ad:midpoint → ad:thirdQuartile
```

The cache buster being a real number rather than `[CACHEBUSTING]` is the
macro-substitution fix.

Stories: `Components/VideoPlayer` → *Vast Tag Pre Roll*, *Vmap Ad Breaks*;
`Reels/ReelsPlayer` → *With Vast Ad Reels*, *Vmap Driven Placement*.
