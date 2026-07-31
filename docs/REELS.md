# Reels — vertical short-form feed with VAST ad reels

> **VAST is not reels-only.** The parser, wrapper resolution and tracking are
> shared with the classic `VideoPlayer` via `useVastAdBreaks` — see
> [VAST.md](./VAST.md).

How the Shorts / Instagram-Reels interaction model is built on top of this
player, and how ad reels are interleaved using IAB standards.

---

## 1. Why the existing `VideoPlayer` was not enough

`VideoPlayer` is a **single-surface** player: one `<video>`, one control bar,
16:9, ads as pre/mid/post-roll interruptions of *that one* video. A feed is a
different shape in four ways that all break that model:

| | `VideoPlayer` | Reels feed |
|---|---|---|
| Surface | one video | N videos, one visible |
| Navigation | seek along a timeline | swipe between timelines |
| Ads | breaks inside a timeline | **ads are feed items** |
| Chrome | control bar | overlay rail, no scrubbing chrome |
| Aspect | 16:9 letterboxed | 9:16 full bleed |

The decisive one is the third. A pre-roll interrupts *a* video; an ad reel *is* a
video. That changes what an "ad break" even is, which is why `VideoAdContext`
could not be reused — it is built around interrupting a parent timeline.

### The constraint that shapes everything

Browsers cap concurrently decodable media elements. On iOS Safari it is
around six; exceed it and `play()` silently stops resolving. A naive feed that
mounts a `<video>` per item therefore **stops playing after a handful of swipes**
and looks like a random bug.

So the feed must virtualise by media element, not just by DOM node. That single
requirement produces the architecture below.

---

## 2. Architecture

```
ReelsPlayer                     the feed surface: gestures, transform track, windowing
├── useReelsFeed                slide list, active index, ad resolution, gating, caps
│   ├── buildSlides()           content ⊕ ad slots → stable, indexed slide list
│   ├── VastClient              tag fetch + wrapper chain resolution
│   └── vastAdsToReelAds()      VAST ad → playable ReelAd
├── ReelItem        (×window)   one content reel: <video> + HLS + overlays
│   ├── ReelInfo                author, caption, audio ticker, CTA
│   ├── ReelActionRail          like / comment / save / share / mute
│   └── ReelProgress            hairline progress, optional scrubbing
└── ReelAdSlide     (×window)   one ad: <video> + VastTracker + skip + CTA
```

Files:

| Concern | File |
|---|---|
| Types | `src/types/reels.ts` |
| Feed orchestration | `src/hooks/useReelsFeed.ts` |
| Slot placement | `src/utils/reelsAdScheduler.ts` |
| Feed surface | `src/components/Reels/ReelsPlayer.tsx` |
| Content slide | `src/components/Reels/ReelItem.tsx` |
| Ad slide | `src/components/Reels/ReelAdSlide.tsx` |
| VAST/VMAP | `src/utils/vast/*` |

### 2.1 Windowing

`useReelsFeed` exposes `mountedIndices` — the only slides that may hold a live
`<video>`. Everything else is not rendered. `ReelItem` additionally releases its
source (`removeAttribute('src')` + `load()`) when it leaves the window, which is
the only reliable way to make the element hand the decoder back.

```
windowSize: 1   →  [ index-1, index, index+1 ]   3 elements, 1 playing
windowSize: 0   →  [ index ]                     1 element, cold swipes
```

`preloadCount` controls how many *upcoming* slides get `preload="auto"` instead
of `"metadata"`, which is what makes a swipe start instantly rather than showing
the poster for a beat.

### 2.2 Why a transform track, not native scroll-snap

Native `scroll-snap-type: y mandatory` has better momentum on iOS, but two
requirements make it awkward:

1. **Exactly one slide plays.** With native scrolling, "which slide is active"
   is derived from scroll position via an observer — inherently laggy and prone
   to two slides briefly both being "active".
2. **A gated ad must refuse to advance.** There is no clean way to cancel a
   native scroll mid-gesture without visible jank.

So `ReelsPlayer` drives a single `translate3d` column and handles wheel, pointer
and keyboard itself. The gesture is tracked in refs (not state), because reading
it back from state would make the commit depend on when React flushes between
`pointermove` and `pointerup`.

### 2.3 Interaction model

| Input | Result |
|---|---|
| Swipe / drag up-down | Navigate; rubber-bands at the ends and against a gated ad |
| Mouse wheel | Navigate, accumulated to a threshold with a cooldown so one flick = one slide |
| `↑` `↓` `PageUp` `PageDown` | Navigate |
| `Home` / `End` | First / last slide |
| `space` / `k` | Toggle play |
| `m` | Toggle mute |
| Tap | Toggle play (deferred by the double-tap window) |
| Double-tap | Like, with a heart burst — only ever *adds* a like |
| Press and hold | Pause while held |

Keyboard handling ignores events originating from `INPUT`/`TEXTAREA`/`SELECT`, so
an overlay comment box is not hijacked.

### 2.4 Sizing — the phone bezel is not part of the component

The `PhoneFrame` in the Storybook stories is a **preview helper only**; it is not
exported from the package. `ReelsPlayer` renders bare.

Two sizing strategies, via `config.layout`:

```tsx
// 'portrait' (default) — the feed owns its size: 9:16, full width,
// capped at the viewport height. Right for a card in a normal page.
<ReelsPlayer reels={reels} />

// 'fill' — the feed emits no sizing classes at all and takes the parent's box.
<div className="h-dvh w-screen">
  <ReelsPlayer reels={reels} config={{ layout: 'fill' }} />
</div>
```

Use `'fill'` rather than passing sizing classes for anything full-screen or
fixed-height. That is not a style preference — in `'portrait'` the component
emits `max-h-[100dvh]`, and **tailwind-merge v2 does not group `max-h-none` with
`max-h-[100dvh]`**, so a caller genuinely cannot un-set the height cap by passing
a class. `aspect-*` *does* dedupe correctly, so overriding just the aspect ratio
works in either layout. Both behaviours are pinned by tests.

Common shapes:

| Shape | How |
|---|---|
| Card in a page | default — `<ReelsPlayer reels={reels} />` |
| Fixed-width column (Shorts on desktop) | wrap in `<div className="w-[360px]">`, default layout |
| Full screen | `layout: 'fill'` + `<div className="h-dvh w-screen">` |
| Fixed height, any aspect | `layout: 'fill'` + a sized parent |

A landscape container crops the portrait video via `object-cover` rather than
letterboxing it — the same thing a real feed does with a mis-sized upload.

### 2.5 Audio starts muted — non-negotiable

Every browser blocks unmuted autoplay without a prior user gesture. `muted`
defaults to `true` and mute is a **single feed-level switch**, not per reel,
which is what users expect from every short-form app.

---

## 3. Ad reels

### 3.1 The model

An ad is a **feed slide**, not an interruption. The feed is a list of slides:

```ts
type ReelSlide =
  | { kind: 'content'; key: string; index: number; contentIndex: number; reel: Reel }
  | { kind: 'ad';      key: string; index: number; slot: ReelAdSlot };
```

Placement is a **pure function** of the content list and the config
(`buildSlides`). This matters more than it looks: the feed is virtualised by
index, so if a slot could move after the viewer scrolled past it, the whole
feed would jump. The property is covered by a test — every key from a shorter
feed must still sit at the same index once more reels are appended.

### 3.2 Frequency capping without moving slots

Capping is **not** expressed by removing slots. A capped slot stays in the list
and resolves to `empty`; the player scrolls straight through it in the direction
the viewer was already travelling.

This is both a correctness requirement (indices must be stable) and an accurate
model of reality: on a real exchange the slot exists, the auction just does not
fill it.

```ts
ads: {
  frequency: 4,              // an ad slot after every 4 content reels
  startAfter: 2,             // …but not before the viewer has seen 2
  maxAdsPerSession: 6,       // hard cap
  minSecondsBetweenAds: 90,  // pacing; a slot that violates it is burned
}
```

Caps are evaluated at **resolve time**, not at plan time, so pacing follows real
viewing behaviour rather than list position.

### 3.3 Standards used

Everything is IAB, no proprietary format:

| Standard | Where | What it gives us |
|---|---|---|
| **VAST 2.0–4.3** | `src/utils/vast/parseVast.ts` | The creative: media files, duration, `skipoffset`, tracking, `VideoClicks`, icons, `AdVerifications` |
| **VAST Wrappers** | `src/utils/vast/VastClient.ts` | SSP → DSP redirect chains, with inherited tracking merged |
| **VAST Macros** | `src/utils/vast/macros.ts` | `[CACHEBUSTING]`, `[ADPLAYHEAD]`, `[ERRORCODE]`, `[PLAYERSIZE]`, … |
| **VAST Error codes** | `src/types/vast.ts` | 403 no supported media file, 405 display problem, 302 wrapper limit, … |
| **VMAP 1.0** | `src/utils/vast/parseVmap.ts` | Ad-break *placement*, decoupled from the creatives |

Deliberately **not** supported: **VPAID**. It is an executable ad framework,
deprecated in VAST 4.1, and running third-party JS with player-level access is a
security problem, not a feature. The media-file selector rejects
`apiFramework="VPAID"` and `"OMID"` outright, so such a creative can never reach
a `<video>` element.

### 3.4 Inventory sources

Three, in precedence order per slot:

```ts
// 1. Pre-resolved — no network. House ads, offline builds, tests.
ads: { enabled: true, ads: [{ id, src, duration, skipOffset, title, … }] }

// 2. Inline VAST XML — full pipeline, no network.
ads: { enabled: true, vmapXml: '<vmap:VMAP …>' }

// 3. Tag URL waterfall — the production path. Tried in order until one fills.
ads: {
  enabled: true,
  tagUrl: [
    'https://ssp-a.example.com/vast?cb=[CACHEBUSTING]&size=[PLAYERSIZE]',
    'https://ssp-b.example.com/vast?cb=[CACHEBUSTING]',   // fallback
    'https://house.example.com/vast',                      // guaranteed fill
  ],
}
```

VMAP replaces the `frequency` model when present — its `<AdBreak timeOffset>`
drives placement. `position:N` maps directly onto "after N content reels";
`percent` and `time` are mapped onto the feed for documents authored against
linear content. `breakType="display"` and `"nonlinear"` breaks are ignored,
because there is nowhere to render a banner in a full-bleed vertical feed.

### 3.5 Media-file selection

A VAST response routinely carries a dozen renditions. `selectMediaFile()` ranks
them by:

1. MIME-type preference (mp4 → HLS → webm)
2. Distance from the target pixel height — **undershooting is penalised twice as
   hard as overshooting**, so an ad never looks softer than the feed
3. Bitrate, capped by `maxBitrate`

`verticalFeedMediaOptions()` supplies 9:16 defaults with a deliberately
conservative 4 Mbps cap: an ad that stalls is worse than an ad that looks
slightly soft.

### 3.6 Tracking correctness

`VastTracker` owns the "fired once" bookkeeping, because double-counted
impressions are a billing bug, not a cosmetic one.

- **Impression fires on view, not on load.** The pixel goes out when the ad
  becomes the active slide *and the playhead moves past zero* — never on
  prefetch. Firing on prefetch is the single most common way a feed integration
  over-reports.
- **Quartiles are backfilled.** If the first `timeupdate` lands at 80 %, the
  earlier milestones still fire, in order, exactly once.
- **Milestones vs interactions.** `start`, quartiles, `complete`, `skip` and
  `impression` fire at most once. `pause`/`resume`/`mute`/`unmute` are
  repeatable.
- **`skipoffset` of 0 is honoured** ("skippable immediately") and not confused
  with a missing offset, which falls back to `defaultSkipOffset`.
- **`<Error>` pixels** are sent with `[ERRORCODE]` substituted on playback
  failure and on unplayable creatives.
- **Beacons use `sendBeacon`** where available, so pixels still land if the page
  is being torn down, falling back to `keepalive` fetch.

### 3.7 Ad-slide UX decisions

- **Ads are never scrubbable.** `ReelProgress` renders display-only on an ad.
- **Skip appears only if the creative allows it.** `skipOffset: null` renders no
  skip affordance at all rather than a permanently disabled button.
- **Gating is off by default.** `blockAdvanceUntilComplete` exists for
  contractual cases (compliance clips, mandatory sponsored viewing). Neither
  Shorts nor Reels gate in-feed ads, and gating costs session length.
- **Click-through opens with `noopener,noreferrer`** so the landing page cannot
  reach back into the player, and fires `ClickTracking` separately from the
  navigation.
- **Pods** (`<Ad sequence>`) play back to back within one slide; the slide
  advances through `podIndex` before releasing the feed.

### 3.8 Security posture of the ad path

The ad pipeline consumes third-party XML and third-party URLs, so:

- Tag URLs and wrapper redirects go through `sanitizeEndpoint()` — **only
  absolute `http(s)`**. A hostile config or a hostile wrapper cannot smuggle
  `javascript:` or `file:` into the pipeline. Covered by tests.
- Media URLs go through `sanitizeUrl()` before reaching the `<video>`.
- The wrapper chain is depth-limited (default 5, VAST's recommendation), so a
  self-referencing wrapper terminates instead of looping. Covered by a test.
- Ad requests use `mode: 'cors'` and `credentials: 'omit'`.
- VPAID/OMID creatives are rejected by the media-file selector.

---

## 4. Usage

```tsx
import { ReelsPlayer } from '@fairu/player';
import '@fairu/player/styles.css';

<ReelsPlayer
  reels={reels}
  config={{
    // Feed
    windowSize: 1,
    preloadCount: 1,
    loop: true,
    muted: true,

    // Ads
    ads: {
      enabled: true,
      frequency: 4,
      startAfter: 2,
      maxAdsPerSession: 6,
      minSecondsBetweenAds: 90,
      defaultSkipOffset: 5,
      prefetch: 1,
      tagUrl: 'https://ads.example.com/vast?cb=[CACHEBUSTING]',

      onAdStart: (ad) => analytics.track('ad_start', { id: ad.id }),
      onAdComplete: (ad) => analytics.track('ad_complete', { id: ad.id }),
      onAdSkip: (ad, _slot, at) => analytics.track('ad_skip', { id: ad.id, at }),
      onSlotEmpty: (slot) => analytics.track('ad_unfilled', { slot: slot.id }),
    },
  }}
  onLoadMore={fetchNextPage}
  onReelComplete={(reel) => analytics.track('reel_complete', { id: reel.id })}
/>;
```

### Storybook

`Reels/ReelsPlayer` has 12 stories, all network-free:

| Story | Shows |
|---|---|
| `Default` | The plain feed |
| `WithEventLog` | Every callback piped to a live console |
| `WithVastAdReels` | Real VAST 4.2 parsing, with the beacon stream visible |
| `VmapDrivenPlacement` | VMAP-driven placement, display break ignored |
| `HouseAdsWithoutVast` | Pre-resolved ads, one non-skippable |
| `AdPacingPlayground` | Live frequency / capping / pacing knobs |
| `InfiniteFeed` | Paged `onLoadMore` |
| `FeatureToggles` | All 15 overlay features independently |
| `WindowingAndPreload` | Which slides hold a `<video>`, visualised |
| `GatedNonSkippableAd` | The most aggressive configuration |
| `WithoutPhoneFrame` | The feed with no bezel, in its four real shapes |
| `FullScreen` | `layout: 'fill'` in a `h-dvh` parent |
| `FrameWithoutChrome` | Bezel without notch, for screenshots |
| `CustomOverlay` | `renderOverlay` slot |

---

## 5. Known gaps

Honest list of what is **not** built:

- **No OMID / Open Measurement.** `AdVerifications` is parsed and exposed on
  `ReelAd.vast`, but no verification script is executed. Third-party viewability
  (IAS, DoubleVerify, Moat) would need the OM SDK.
- **Viewable-impression is binary.** `tracker.viewable('viewable')` fires when
  the ad becomes active. It does not implement the MRC 50 %-for-2s measurement —
  that needs an `IntersectionObserver` threshold plus a dwell timer.
- **No server-side ad insertion (SSAI).** Client-side stitching only.
- **`repeatAfter` and time-based VMAP offsets assume ~15 s per reel.** Fine for
  documents authored for a feed, approximate for ones authored for linear video.
- **No `usePlaylist` integration.** The feed owns its own ordering; shuffle and
  repeat semantics from `usePlaylist` are not wired in.
- **Ad pods share one slide.** An alternative model — one slide per pod member —
  would be more Shorts-like but complicates index stability.
- **The overlay needs roughly 380×320px.** Below that the action rail (5 items,
  anchored `bottom-24`) runs past the top edge and the caption column gets
  squeezed. Verified at 240×427 in a browser. Real feeds are ≥320px wide, so this
  only bites on deliberately tiny embeds — but there is no responsive collapse
  of the rail yet.
- **Demo media is third-party.** `src/stories/fixtures.ts` points at
  `mdn.github.io` and `test-videos.co.uk`. The previous fixture host
  (`gtv-videos-bucket`) went to HTTP 403 and silently broke every video story in
  the repo, which is exactly the failure mode that file now centralises.
