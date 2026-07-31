# VAST support

What `@fairu/player` does and does not do with IAB ad tags.

---

## Read this first: what shipped when

| | npm `@fairu/player@1.2.0` | this branch |
|---|---|---|
| VAST XML parsing | ❌ | ✅ |
| Wrapper chain resolution | ❌ | ✅ |
| Tracking pixels | partial¹ | ✅ |
| VMAP placement | ❌ | ✅ |
| `VideoPlayer` accepts a tag URL | ❌ | ✅ via `useVastAdBreaks` |
| Reels feed accepts a tag URL | n/a (no reels) | ✅ |

¹ 1.2.0 fired **one** URL per event, with no macro substitution — see
[Corrections](#corrections-to-1.2.0-behaviour).

**None of this is released.** Until the branch is merged and published, an
integrator working against npm is correct that the player has no VAST parser.
Providing a `vast_url` per channel in the backend is exactly the right input for
what is described below — it just cannot be consumed yet by a released build.

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

## What is implemented

| Standard | Scope |
|---|---|
| **VAST 2.0 – 4.3** | `<InLine>`, `<Wrapper>`, ad pods (`sequence`), `<Linear>` with `<MediaFile>`, `skipoffset`, `<TrackingEvents>` incl. offset-based `progress`, `<VideoClicks>`, `<Icons>` (AdChoices), `<ViewableImpression>`, `<Pricing>`, `<AdVerifications>` (parsed), `<Extensions>` |
| **Wrappers** | Full chain resolution, tracking merged into the in-line ad, depth-limited (default 5), `followAdditionalWrappers` and `allowMultipleAds` honoured |
| **Macros** | `[CACHEBUSTING]`, `[TIMESTAMP]`, `[ADPLAYHEAD]`, `[CONTENTPLAYHEAD]`, `[PLAYERSIZE]`, `[ERRORCODE]`, `[BREAKPOSITION]`, `[PAGEURL]`, `[REFERRER]`, plus the legacy `%%MACRO%%` form. Unknown macros are left verbatim |
| **Error codes** | 100, 101, 102, 200, 302, 303, 400, 403, 405, 900 reported to `<Error>` pixels |
| **VMAP 1.0** | `<AdBreak>` with `start`/`end`/time/percent/`position` offsets, `<AdSource>` as `<AdTagURI>` or inline `<VASTAdData>`, `repeatAfter`, `breakType` filtering |

### Not implemented

- **VPAID — deliberately rejected.** Executable third-party JS with player-level
  access. Deprecated in VAST 4.1. The media-file selector refuses
  `apiFramework="VPAID"` and `"OMID"`, so such a creative can never reach a
  `<video>` element.
- **OMID / Open Measurement.** `<AdVerifications>` is parsed and exposed, but no
  verification script is executed. Third-party viewability (IAS, DoubleVerify,
  Moat) needs the OM SDK.
- **MRC viewability measurement.** `ViewableImpression` fires when the ad becomes
  active; there is no 50 %-for-2s intersection measurement.
- **SSAI.** Client-side stitching only.
- **DAAST** (audio ads). The audio `Player` has no VAST path.
- **`position:N` VMAP offsets in `VideoPlayer`.** They count *items*, which is
  meaningless for a single video; they are dropped. The reels feed does honour
  them.

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
| → `VideoAd` | `src/utils/vast/toVideoAd.ts` |
| → `ReelAd` | `src/utils/vast/toReelAd.ts` |
| `VideoPlayer` hook | `src/hooks/useVastAdBreaks.ts` |

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
