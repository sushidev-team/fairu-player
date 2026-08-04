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

The player never asks. It reads what the page's CMP already published and
forwards it verbatim, which is the only correct arrangement for an embed: the
consent belongs to the publisher whose article the player sits in, not to us.

```tsx
const { adBreaks } = useVastAdBreaks({ preRoll: tag, consent: 'auto' });
```

`'auto'` queries `__tcfapi`, `__uspapi` and `__gpp` once, before the first ad
request, and gives up after 1.5 s rather than blocking playback. Pass an
`AdConsent` object instead when the host already holds the strings.

Signals that are absent produce **no macro at all**. A bare `&gdpr_consent=`
tells an SSP "asked and refused", which is a different claim from "this page has
no CMP", and the difference is worth real money.

The player itself stores nothing — no cookies, no `localStorage`, no
`sessionStorage` — so it is not a service a consent manager needs to list. The
ad server behind your tag URL is.

**Caveat:** an ad request still goes out when no signal is available. If you need
"no consent, no request", gate it in the host — the hook does not decide that for
you.

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
- **TCF inside an iframe embed.** `readConsentFromCmp` reads `__tcfapi` on the
  current window. That is the publisher's CMP for the inline embed, which is
  correct — but inside an iframe the spec requires `postMessage` to the
  `__tcfapiLocator` frame, which is not implemented. An iframe embed therefore
  gets no consent signal at all.
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
