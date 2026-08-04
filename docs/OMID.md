# Open Measurement (OMID) — what adopting it costs

`<AdVerifications>` is parsed and exposed today, and nothing is done with it. A
DSP that attaches an IAS, DoubleVerify or Moat verification script gets its
resource carried through the wrapper chain and then dropped on the floor. This
document is the plan for changing that, and the case for when not to.

**Status: not started.** Nothing below is implemented.

---

## 1. Why this is a business decision, not a feature ticket

Everything else in the ad stack is the player doing its own job well. OMID is
different: it means **executing a third party's JavaScript inside the page that
embeds the player**, and taking on the operational obligations that come with
it — a signed certification, a versioned SDK to keep current, and a measurement
surface whose failures are attributed to us.

So the question is not "is it good to have". It is:

> Are we selling into demand that requires third-party verification?

If the answer is no — direct-sold campaigns, house ads, a single trusted
advertiser — OMID buys nothing and costs a permanent maintenance burden.

If the answer is yes, it is not optional at all. Programmatic video demand above
a certain CPM is routinely bought with a viewability guarantee, and a player
that cannot return verified measurement is bid on as unmeasured inventory —
which in practice means the floor price, or no bid.

**Recommendation: do not start this until a specific SSP or advertiser has asked
for it in writing.** When that happens, it becomes urgent, and the estimate
below applies.

---

## 2. What already exists

More than half the plumbing is done, which is worth knowing before estimating:

| Piece | State |
|---|---|
| `<AdVerifications>` / `<Verification>` parsing | ✅ `src/utils/vast/parseVast.ts` |
| `vendor`, `javascriptResource`, `verificationParameters` | ✅ `VastAdVerification` in `src/types/vast.ts` |
| Verification resources merged through wrapper chains | ✅ `applyWrapperToAds` — **fixed while writing this document**, see below |
| Ad video element with a stable ref | ✅ `adVideoRef` in `src/context/VideoAdContext.tsx` |
| Playback lifecycle events, once-only | ✅ `VastTracker` |
| Viewability geometry (50 % / 2 s, tab visibility) | ✅ `src/hooks/useAdViewability.ts` |
| Rejecting `apiFramework="OMID"` media files | ✅ `src/utils/vast/mediaFile.ts` — **must be revisited**, see §5 |

What is missing is the OM SDK itself and the session plumbing around it.

> **A bug this exercise surfaced.** `<AdVerifications>` was read from `<InLine>`
> only. In practice the DSP supplies the creative and the **SSP's wrapper**
> attaches the verification vendor, so the resources OMID needs were exactly the
> ones being dropped. Wrappers now parse them and `applyWrapperToAds` merges the
> chain instead of overriding. Worth knowing because it means the verification
> data you can inspect *today* is complete — before the fix, an audit of "do our
> ads carry verifications?" would have answered "no" for the common case.

---

## 3. What OMID actually requires

The IAB Open Measurement SDK for web ("OM Web SDK") works like this:

1. The player loads **`omweb-v1.js`**, the service script, into the page.
2. For each ad, the player creates an **AdSession** describing the ad, the
   verification resources from `<AdVerifications>`, and the player's own
   identity (`partnerName` / `partnerVersion`).
3. The verification scripts are loaded into a **sandboxed iframe** the SDK
   manages, not into the host page directly.
4. The player registers the ad element via **`registerAdView`** and reports
   geometry changes; the SDK derives viewability itself.
5. The player emits **VideoEvents** — `loaded`, `start`, `firstQuartile`,
   `midpoint`, `thirdQuartile`, `complete`, `pause`, `resume`, `skipped`,
   `volumeChange`, `playerStateChange`, `bufferStart`/`bufferFinish` — through
   the OMID media events API, in addition to the VAST pixels we already fire.
6. The session is finished explicitly, so the verifier can flush.

Two consequences worth naming up front:

- **The SDK owns viewability, we do not.** Our `useAdViewability` keeps serving
  `<ViewableImpression>`; the verifier computes its own number from the geometry
  we report. The two can legitimately disagree, and advertisers will trust the
  verifier's. Do not try to reconcile them.
- **`omweb-v1.js` cannot be bundled.** IAB distributes it and it must be kept
  current. It is a runtime dependency loaded from a URL the integrator controls,
  which makes it the first external script this library has ever pulled in — and
  the CSP story for every embedding publisher changes accordingly.

---

## 4. Proposed implementation

Five steps, each independently reviewable.

### Step 1 — Certification and account (blocking, external)

Register with IAB Tech Lab as an integration partner and get a `partnerName`.
Compliance testing happens against a validation script and must pass before any
verifier will trust our sessions. **This is lead time measured in weeks and does
not depend on our code.** Start it first.

### Step 2 — `src/utils/omid/OmidService.ts`

A thin wrapper that owns the service script and nothing else.

```ts
export interface OmidServiceOptions {
  /** URL of omweb-v1.js. No default — the integrator hosts it. */
  serviceScriptUrl: string;
  partnerName: string;
  partnerVersion?: string;
}

export function loadOmidService(options: OmidServiceOptions): Promise<OmidApi | null>;
```

Resolves `null` rather than throwing when the script fails: **measurement must
never break playback**, and an unmeasured ad is far better than no ad. Same rule
the consent path already follows.

### Step 3 — `src/hooks/useOmidSession.ts`

One session per ad playback, mirroring how `VastTracker` is scoped.

```ts
const omid = useOmidSession(adVideoRef, {
  verifications: ad.vast?.adVerifications,
  contentUrl: window.location.href,
  enabled: Boolean(omidConfig),
});
```

Creates the session on ad start, registers the ad view, finishes on
complete/skip/error. Returns `null` when disabled or unavailable, so every call
site is `omid?.…`.

### Step 4 — Emit the media events

`VastTracker.onEvent` already fires for every lifecycle event, **including ones
the creative declares no pixel for** — which is exactly the hook OMID needs.
Wire the OMID media events there, in `VideoAdContext` and `AdContext`, rather
than at each call site. One place, no drift.

Volume and player-state changes are not currently `VastTracker` events for the
video player and need adding.

### Step 5 — Revisit the media-file rejection

`UNPLAYABLE_FRAMEWORKS` in `src/utils/vast/mediaFile.ts` refuses
`apiFramework="OMID"`. That was correct while nothing could execute a
verification script — but with the SDK in place it becomes wrong, and would
silently drop exactly the inventory OMID was adopted for. It must become
conditional on OMID being configured.

**This is the single easiest thing to get wrong**, because it fails as "no
fill" rather than as an error.

---

## 5. Deliberate non-goals

- **VPAID stays rejected.** OMID is the replacement for it, and adopting one is
  not a reason to accept the other.
- **No OMID for the audio player.** OMID measures viewability; audio has none.
  IAB's audio measurement is a separate standard.
- **No default service-script URL.** Shipping one would mean choosing a CDN on
  every embedding publisher's behalf.

---

## 6. Rough shape of the work

| | |
|---|---|
| IAB certification | Weeks of lead time, mostly waiting |
| Steps 2–5 | The smaller half of the effort |
| Compliance testing and fixing | Genuinely unpredictable |
| Ongoing | SDK version bumps, re-certification, CSP support for publishers |

The recurring cost is the part that gets underestimated: this is not a feature
that ships and is done. Treat it as taking on a dependency with an external
release cadence and a compliance obligation attached.

---

## 7. What to do first when this becomes real

1. Get the written requirement — which SSP, which verifier, which campaign.
2. Start IAB certification immediately; everything else can proceed in parallel.
3. Build steps 2–4 behind an `omidConfig` that is absent by default, so nothing
   changes for anyone who does not opt in.
4. Do step 5 **last**, and only once a real verified session has been observed
   end to end. Accepting OMID media files before measurement works turns a
   configuration problem into missing revenue.
