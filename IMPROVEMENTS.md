# Fairu Player - Improvement Plan

> ⚠️ **VERALTET — kein Statusbericht für dieses Repo.**
>
> Die `[x] Completed`-Marker unten treffen auf `@fairu/player` (React) **nicht** zu.
> Keines der hier als fertig markierten Artefakte existiert in `src/`: weder
> `FairuProvider.tsx` noch `useABLoop`, `useEqualizer`, `usePlaybackHistory`,
> `useShareableTimestamp`, `useSyncPlayback`, `useAutoplayDetection`,
> `useSubtitleStyling`, `usePlaylistPersistence`, `ErrorBoundary/`, `size-limit`
> oder `vitest-axe`.
>
> Das Dokument stammt vom 10.04.2026 und gehört vermutlich zur Planung des
> Dart-Ports (`sushidev-team/fairu-player-dart`).
>
> **Aktueller Stand und Priorisierung: siehe [ROADMAP.md](./ROADMAP.md).**

## Overview

This document tracks all planned improvements and new features for @fairu/player. Each item includes scope, affected files, and implementation notes.

---

## 1. Unified Provider / Simplified Setup

**Goal:** Replace 7 nested context providers with a single `<FairuProvider>` root component.

**Current Problem:**
```tsx
<LabelsProvider>
  <TrackingProvider>
    <PlayerProvider>
      <AdProvider>
        <VideoProvider>
          <VideoAdProvider>
            <OverlayAdProvider>
              <VideoPlayer />
            </OverlayAdProvider>
          </VideoAdProvider>
        </VideoProvider>
      </AdProvider>
    </PlayerProvider>
  </TrackingProvider>
</LabelsProvider>
```

**Solution:**
- Create `src/context/FairuProvider.tsx` that composes all providers internally
- Accept a unified config object with sections per provider
- Keep individual providers exported for advanced/custom usage
- Audio-only mode skips video-related providers

**Affected Files:**
- `src/context/FairuProvider.tsx` (new)
- `src/context/index.ts` (export)
- `src/index.ts` (export)
- `src/types/provider.ts` (new - unified config type)

**Status:** [x] Completed

---

## 2. Error Boundaries

**Goal:** Graceful fallback UI when player subsystems fail (HLS, Cast, PiP, etc.).

**Solution:**
- Create `src/components/ErrorBoundary/PlayerErrorBoundary.tsx`
- Catch errors in HLS loading, Cast API, PiP API, ad loading
- Show a minimal fallback UI with retry button
- Emit error events via PlayerEventBus for external handling
- Wrap critical subsystems (VideoOverlay, AdOverlay, HLS) individually

**Affected Files:**
- `src/components/ErrorBoundary/PlayerErrorBoundary.tsx` (new)
- `src/components/ErrorBoundary/index.ts` (new)
- `src/components/VideoPlayer/VideoPlayer.tsx` (wrap subsystems)
- `src/components/Player/Player.tsx` (wrap subsystems)
- `src/index.ts` (export)

**Status:** [x] Completed

---

## 3. Accessibility (a11y) Improvements

**Goal:** WCAG 2.1 AA compliance with automated testing.

**Solution:**
- Add `vitest-axe` for automated a11y testing
- Add focus trapping in overlay components (SleepTimer, QualitySelector, SubtitleSelector, PlaybackSpeed)
- Add `aria-live` regions for state changes (play/pause, volume, time updates)
- Add screen-reader-only announcements for key actions
- Ensure all interactive elements have visible focus indicators

**Affected Files:**
- `package.json` (add vitest-axe)
- `src/components/controls/SleepTimer/SleepTimer.tsx` (focus trap)
- `src/components/controls/QualitySelector/` (focus trap)
- `src/components/controls/SubtitleSelector/` (focus trap)
- `src/components/controls/PlaybackSpeed/` (focus trap)
- `src/components/controls/VolumeControl/` (aria-live)
- `src/components/controls/ProgressBar/` (aria-live)
- `src/hooks/useFocusTrap.ts` (new hook)
- Existing test files (add axe assertions)

**Status:** [x] Completed

---

## 4. Bundle Size Monitoring

**Goal:** Prevent bundle size regressions with CI-compatible size limits.

**Solution:**
- Add `size-limit` package with config in `package.json`
- Define budgets: main bundle < 80KB gzip, CSS < 15KB gzip
- Add `npm run size` script
- Integrate into CI (can run as part of `npm test`)

**Affected Files:**
- `package.json` (add size-limit, config, script)
- `.github/workflows/` (optional CI integration)

**Status:** [x] Completed

---

## 5. Autoplay Policy Handling

**Goal:** Detect and handle browser autoplay restrictions with clear user feedback.

**Solution:**
- Create `src/hooks/useAutoplayDetection.ts`
- On mount, attempt a muted play to detect policy
- Expose `autoplayAllowed`, `autoplayMutedOnly`, `autoplayBlocked` states
- Show unobtrusive UI hint when autoplay is blocked ("Tap to play")
- Integrate into VideoPlayer and Player components
- Respect user gesture requirements

**Affected Files:**
- `src/hooks/useAutoplayDetection.ts` (new)
- `src/hooks/index.ts` (export)
- `src/components/VideoPlayer/VideoPlayer.tsx` (integrate)
- `src/components/Player/Player.tsx` (integrate)
- `src/types/media.ts` (add autoplay state)

**Status:** [x] Completed

---

## 6. A-B Loop / Segment Repeat

**Goal:** Allow users to loop a specific segment of audio/video.

**Solution:**
- Create `src/hooks/useABLoop.ts`
  - `setA()` - mark loop start at current time
  - `setB()` - mark loop end at current time
  - `clearLoop()` - remove loop
  - `isLooping`, `loopStart`, `loopEnd` state
  - Automatically seek back to A when reaching B
- Add visual indicator in ProgressBar (highlighted segment)
- Add keyboard shortcut: `[` for A, `]` for B, `\` for clear
- Optional loop count limit

**Affected Files:**
- `src/hooks/useABLoop.ts` (new)
- `src/hooks/index.ts` (export)
- `src/components/controls/ProgressBar/ProgressBar.tsx` (render loop region)
- `src/hooks/useKeyboardControls.ts` (add shortcuts)
- `src/types/media.ts` (ABLoop types)
- `src/index.ts` (export)

**Status:** [x] Completed

---

## 7. Thumbnail Preview Timeline

**Goal:** Show video thumbnail previews when hovering over the progress bar.

**Solution:**
- Create `src/components/controls/ProgressBar/ThumbnailPreview.tsx`
- Accept a thumbnail sprite URL or VTT file with thumbnail timestamps
- On hover, calculate position and show corresponding thumbnail
- Support both sprite sheets (single image grid) and individual thumbnails
- Integrate with existing `getFairuThumbnailUrl` utility
- Lazy-load thumbnail sprite on first hover

**Affected Files:**
- `src/components/controls/ProgressBar/ThumbnailPreview.tsx` (new)
- `src/components/controls/ProgressBar/ProgressBar.tsx` (integrate)
- `src/types/video.ts` (ThumbnailConfig type)
- `src/utils/thumbnails.ts` (new - VTT parser, sprite calculator)

**Status:** [x] Completed

---

## 8. Caption/Subtitle Styling

**Goal:** Allow users to customize subtitle appearance.

**Solution:**
- Create `src/hooks/useSubtitleStyling.ts`
- Configurable: fontSize, fontFamily, textColor, backgroundColor, backgroundOpacity, position (top/bottom), textShadow
- Persist preferences in localStorage
- Apply styles via CSS custom properties on the subtitle container
- Add UI component `SubtitleSettings` with preset themes (Default, High Contrast, Yellow on Black)

**Affected Files:**
- `src/hooks/useSubtitleStyling.ts` (new)
- `src/hooks/index.ts` (export)
- `src/components/controls/SubtitleSettings/SubtitleSettings.tsx` (new)
- `src/components/controls/SubtitleSettings/index.ts` (new)
- `src/components/controls/index.ts` (export)
- `src/types/video.ts` (SubtitleStyle type)
- `src/index.ts` (export)

**Status:** [x] Completed

---

## 9. Playlist Persistence

**Goal:** Save and restore playlist queue order, current index, and shuffle state.

**Solution:**
- Create `src/hooks/usePlaylistPersistence.ts`
- Save to localStorage: track order, current index, shuffle state, repeat mode
- Keyed by playlist ID or custom key
- Auto-save on changes with debounce
- Auto-restore on mount
- Configurable expiry (default 30 days)
- Follows same pattern as `useResumePosition`

**Affected Files:**
- `src/hooks/usePlaylistPersistence.ts` (new)
- `src/hooks/index.ts` (export)
- `src/context/PlayerContext.tsx` (integrate)
- `src/types/player.ts` (PlaylistPersistenceConfig type)
- `src/index.ts` (export)

**Status:** [x] Completed

---

## 10. Equalizer / Audio Filters

**Goal:** Web Audio API-based audio processing with presets.

**Solution:**
- Create `src/hooks/useEqualizer.ts`
  - Connect media element to Web Audio API (AudioContext, MediaElementSourceNode)
  - BiquadFilter nodes for frequency bands (60Hz, 230Hz, 910Hz, 4kHz, 14kHz)
  - Presets: Flat, Podcast (voice boost), Music, Bass Boost, Treble Boost
  - Custom band adjustment
  - Volume normalization via DynamicsCompressorNode
- Create `src/components/controls/Equalizer/Equalizer.tsx` (UI)
- Persist selected preset in localStorage

**Affected Files:**
- `src/hooks/useEqualizer.ts` (new)
- `src/hooks/index.ts` (export)
- `src/components/controls/Equalizer/Equalizer.tsx` (new)
- `src/components/controls/Equalizer/index.ts` (new)
- `src/components/controls/index.ts` (export)
- `src/types/audio.ts` (new - EQ types)
- `src/index.ts` (export)

**Status:** [x] Completed

---

## 11. Playback History

**Goal:** Track which episodes/videos have been played and their progress.

**Solution:**
- Create `src/hooks/usePlaybackHistory.ts`
  - Record: trackId, lastPlayedAt, progress (%), duration, completed
  - localStorage-based with configurable max entries (default 100)
  - Methods: getHistory(), clearHistory(), markAsPlayed(), isPlayed(), getResumeList()
  - Integrates with existing WatchProgress system
- Create `src/components/PlaybackHistory/PlaybackHistory.tsx` (optional UI)
  - "Continue listening/watching" list
  - Progress indicator per item

**Affected Files:**
- `src/hooks/usePlaybackHistory.ts` (new)
- `src/hooks/index.ts` (export)
- `src/components/PlaybackHistory/PlaybackHistory.tsx` (new)
- `src/components/PlaybackHistory/index.ts` (new)
- `src/types/history.ts` (new)
- `src/index.ts` (export)

**Status:** [x] Completed

---

## 12. Shareable Timestamps

**Goal:** Generate and parse deep-links with playback position.

**Solution:**
- Create `src/hooks/useShareableTimestamp.ts`
  - `getShareUrl(time?)` - generate URL with `?t=123` or `?t=1m30s`
  - `parseTimestamp(url)` - extract time from URL
  - Copy to clipboard support
  - Format options: seconds (`t=90`) or human-readable (`t=1m30s`)
- On player mount, check URL for `t` parameter and seek
- Integrate with existing `parseUrlParams` from embed system
- Add share button component

**Affected Files:**
- `src/hooks/useShareableTimestamp.ts` (new)
- `src/hooks/index.ts` (export)
- `src/components/controls/ShareButton/ShareButton.tsx` (new)
- `src/components/controls/ShareButton/index.ts` (new)
- `src/components/controls/index.ts` (export)
- `src/embed/parseConfig.ts` (extend with `t` param)
- `src/index.ts` (export)

**Status:** [x] Completed

---

## 13. Synchronized Playback (Watch/Listen Together)

**Goal:** Multi-device playback sync via WebSocket or similar real-time transport.

**Solution:**
- Create `src/hooks/useSyncPlayback.ts`
  - Connect to a sync server (WebSocket URL configurable)
  - Room-based: create room, join room (via code/URL)
  - Sync events: play, pause, seek, playbackRate
  - Leader/follower model (leader controls, followers sync)
  - Latency compensation
  - Graceful degradation when connection drops
- Create `src/services/SyncService.ts` (WebSocket management)
- This is transport-agnostic: provide interface, users bring their own server

**Affected Files:**
- `src/hooks/useSyncPlayback.ts` (new)
- `src/hooks/index.ts` (export)
- `src/services/SyncService.ts` (new)
- `src/services/index.ts` (export)
- `src/types/sync.ts` (new)
- `src/index.ts` (export)

**Note:** This is the most complex feature. Server-side is out of scope - we provide the client-side hook and a reference interface.

**Status:** [x] Completed

---

## Implementation Order

Recommended sequence based on dependencies and impact:

### Phase 1 - Foundation (no dependencies)
1. **Bundle Size Monitoring** - Quick setup, immediate CI value
2. **Error Boundaries** - Safety net before adding more features
3. **Autoplay Policy Handling** - UX improvement, standalone

### Phase 2 - Core Features (independent)
4. **A-B Loop** - Standalone hook + ProgressBar integration
5. **Shareable Timestamps** - Leverages existing embed/parseConfig
6. **Playlist Persistence** - Follows useResumePosition pattern

### Phase 3 - Enhanced UX
7. **Unified Provider** - Simplifies setup, benefits from error boundaries
8. **Caption/Subtitle Styling** - Standalone, video-specific
9. **Playback History** - Builds on WatchProgress + ResumePosition

### Phase 4 - Advanced Features
10. **Accessibility Improvements** - Cross-cutting, test all components
11. **Thumbnail Preview Timeline** - Video-specific, needs asset support
12. **Equalizer / Audio Filters** - Web Audio API, standalone

### Phase 5 - Premium Feature
13. **Synchronized Playback** - Most complex, least dependencies on other items
