# @fairu/player

A lightweight, modular React media player with TypeScript support. Supports audio podcasts and video with HLS streaming. Designed to be embeddable as a widget for fairu.app and external sites.

## Features

- **React 18+ with TypeScript** - Full type safety and modern React features
- **Audio & Video Player** - Unified API for audio podcasts and video content
- **HLS Streaming** - Adaptive bitrate streaming with quality selection
- **Live Streaming** - HLS live streams with low latency mode
- **Tailwind CSS + CSS Variables** - Easy theming with CSS custom properties
- **Playlist Support** - Queue management, shuffle, repeat modes
- **Chapters** - Display and navigate podcast chapters
- **Subtitles** - Video subtitle/caption support
- **Fullscreen Mode** - Native fullscreen with keyboard controls
- **Watch Progress Tracking** - Track watched segments and completion
- **Media Session** - Lock screen, notification shade, headset buttons and CarPlay/Android Auto
- **Persistence** - Remembers volume, mute, speed and where playback stopped, per track
- **Embeddable** - Script-based and iframe embedding options
- **GDPR Compliant** - Opt-in tracking with configurable endpoints
- **Ads Support** - Pre-roll, mid-roll, and post-roll ad integration with VAST tracking
- **Video Ads** - Video ads and custom component ads
- **Keyboard Controls** - Full keyboard navigation support
- **Accessible** - ARIA labels and focus management
- **Hooks API** - Composable hooks for custom player implementations

## Installation

```bash
npm install @fairu/player
```

## Quick Start

### Basic Audio Usage

```tsx
import { PlayerProvider, Player } from '@fairu/player';
import '@fairu/player/styles.css';

function App() {
  return (
    <PlayerProvider
      config={{
        track: {
          id: '1',
          src: 'https://example.com/podcast.mp3',
          title: 'My Podcast Episode',
          artist: 'Podcast Host',
          artwork: 'https://example.com/artwork.jpg',
        },
      }}
    >
      <Player />
    </PlayerProvider>
  );
}
```

### Basic Video Usage

```tsx
import { VideoProvider, VideoPlayer } from '@fairu/player';
import '@fairu/player/styles.css';

function App() {
  return (
    <VideoProvider
      config={{
        track: {
          id: '1',
          src: 'https://example.com/video.mp4',
          title: 'My Video',
          poster: 'https://example.com/poster.jpg',
        },
      }}
    >
      <VideoPlayer />
    </VideoProvider>
  );
}
```

### Video with HLS Streaming

```tsx
import { VideoProvider, VideoPlayer } from '@fairu/player';

const videoTrack = {
  id: '1',
  src: 'https://example.com/video.m3u8',
  title: 'HLS Video',
  poster: 'https://example.com/poster.jpg',
};

function App() {
  return (
    <VideoProvider
      config={{
        track: videoTrack,
        hls: {
          enabled: true,
          autoQuality: true,
          startLevel: -1, // Auto-select starting quality
          maxBufferLength: 30,
          lowLatencyMode: false,
        },
      }}
    >
      <VideoPlayer />
    </VideoProvider>
  );
}
```

### Live Streaming

The player supports live streaming via HLS. For optimal live stream playback, enable `lowLatencyMode`:

```tsx
import { VideoProvider, VideoPlayer } from '@fairu/player';

function LiveStream() {
  return (
    <VideoProvider
      config={{
        track: {
          id: 'live-1',
          src: 'https://stream.example.com/live.m3u8',
          title: 'Live Broadcast',
        },
        hls: {
          enabled: true,
          lowLatencyMode: true, // Reduces latency for live streams
          maxBufferLength: 10,  // Smaller buffer for live
        },
      }}
    >
      <VideoPlayer />
    </VideoProvider>
  );
}
```

**Supported Live Stream Formats:**

| Format | Support | Notes |
|--------|---------|-------|
| HLS Live (.m3u8) | Yes | Full support with hls.js |
| Audio Streams (Icecast/Shoutcast) | Yes | Via native HTML5 audio |
| DASH Live | No | Not currently supported |
| WebRTC | No | Not currently supported |

**Current Limitations:**

- No built-in "LIVE" badge indicator
- Progress bar shows buffered position (not live edge indicator)
- No "Go to Live" button for DVR streams
- Duration displays as stream length, not "LIVE"

For full live streaming UI features (LIVE badge, DVR controls, live edge indicator), a future update is planned. The current implementation focuses on reliable playback of HLS live streams with low latency support.

### Playlist

```tsx
import { PlayerProvider, Player } from '@fairu/player';
import '@fairu/player/styles.css';

function App() {
  return (
    <PlayerProvider
      config={{
        playlist: [
          { id: '1', src: 'episode1.mp3', title: 'Episode 1' },
          { id: '2', src: 'episode2.mp3', title: 'Episode 2' },
          { id: '3', src: 'episode3.mp3', title: 'Episode 3' },
        ],
        shuffle: false,
        repeat: 'all',
      }}
    >
      <Player showPlaylist />
    </PlayerProvider>
  );
}
```

### With Chapters

```tsx
const track = {
  id: '1',
  src: 'podcast.mp3',
  title: 'Podcast Episode',
  chapters: [
    { id: 'ch1', title: 'Introduction', startTime: 0 },
    { id: 'ch2', title: 'Main Topic', startTime: 120 },
    { id: 'ch3', title: 'Conclusion', startTime: 300 },
  ],
};

<PlayerProvider config={{ track }}>
  <Player showChapters />
</PlayerProvider>
```

### Video with Subtitles

```tsx
const videoTrack = {
  id: '1',
  src: 'https://example.com/video.mp4',
  title: 'Video with Subtitles',
  poster: 'https://example.com/poster.jpg',
  subtitles: [
    { id: 'en', label: 'English', language: 'en', src: '/subtitles/en.vtt', default: true },
    { id: 'de', label: 'Deutsch', language: 'de', src: '/subtitles/de.vtt' },
  ],
};

<VideoProvider config={{ track: videoTrack, features: { subtitles: true } }}>
  <VideoPlayer />
</VideoProvider>
```

## Components

### Audio Components

| Component | Description |
|-----------|-------------|
| `Player` | Complete audio player with all controls |
| `PlayButton` | Play/pause toggle button |
| `ProgressBar` | Seek bar with buffering indicator |
| `TimeDisplay` | Current time / duration display |
| `VolumeControl` | Volume slider with mute button |
| `PlaybackSpeed` | Playback rate selector |
| `SkipButtons` | Forward/backward skip buttons |
| `PlaylistView` | Playlist panel with track list |
| `TrackItem` | Individual track in playlist |
| `PlaylistControls` | Shuffle/repeat controls |
| `ChapterList` | Chapter navigation list |
| `ChapterMarker` | Chapter marker on progress bar |

### Video Components

| Component | Description |
|-----------|-------------|
| `VideoPlayer` | Complete video player with all controls |
| `VideoOverlay` | Overlay for play button and loading states |
| `VideoControls` | Bottom control bar for video |
| `FullscreenButton` | Fullscreen toggle button |
| `QualitySelector` | HLS quality level selector |

### Ad Components

| Component | Description |
|-----------|-------------|
| `AdOverlay` | Ad display overlay |
| `AdSkipButton` | Skip ad button with countdown |

## Hooks API

The player provides composable hooks for building custom player UIs:

### `usePlayer`

Access the audio player context for state and controls.

```tsx
import { usePlayer } from '@fairu/player';

function CustomControls() {
  const { state, controls } = usePlayer();

  return (
    <div>
      <button onClick={controls.togglePlay}>
        {state.isPlaying ? 'Pause' : 'Play'}
      </button>
      <span>{state.currentTime} / {state.duration}</span>
    </div>
  );
}
```

### `useVideoPlayer`

Access the video player context for video-specific features.

```tsx
import { useVideoPlayer } from '@fairu/player';

function CustomVideoControls() {
  const { state, controls, currentTrack } = useVideoPlayer();

  return (
    <div>
      <button onClick={controls.togglePlay}>
        {state.isPlaying ? 'Pause' : 'Play'}
      </button>
      <button onClick={controls.toggleFullscreen}>
        {state.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
      </button>
      <span>Quality: {state.currentQuality}</span>
    </div>
  );
}
```

### `useMedia`

Generic media hook that works with any HTMLMediaElement.

```tsx
import { useMedia } from '@fairu/player';

function CustomAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { state, controls } = useMedia(audioRef, { src: 'audio.mp3' });

  return (
    <>
      <audio ref={audioRef} />
      <button onClick={controls.togglePlay}>
        {state.isPlaying ? 'Pause' : 'Play'}
      </button>
    </>
  );
}
```

### `useHLS`

HLS-specific functionality for adaptive streaming.

```tsx
import { useHLS, isHLSSource } from '@fairu/player';

function HLSPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    isHLS,
    isUsingHlsJs,
    levels,
    currentLevel,
    setLevel,
    isAutoQuality,
    setAutoQuality,
    attachHLS,
    detachHLS,
    hlsInstance,
  } = useHLS({
    src: 'https://example.com/video.m3u8',
    videoRef,
    config: { autoQuality: true, lowLatencyMode: false },
    onQualityLevelsLoaded: (parsed) => console.log(parsed.length, 'levels'),
    onError: (error) => console.error(error),
  });

  return (
    <>
      <video ref={videoRef} />
      <select
        value={currentLevel}
        onChange={(e) => setLevel(Number(e.target.value))}
      >
        <option value={-1}>Auto</option>
        {levels.map((level, i) => (
          <option key={level.label} value={i}>{level.label}</option>
        ))}
      </select>
    </>
  );
}
```

`levels` comes from the manifest, so it is empty until it has been parsed.
`currentLevel` is an index into it, with `-1` meaning adaptive — which is why
`setLevel` takes a number rather than a label. Safari plays HLS natively, so
`isUsingHlsJs` is false there and `hlsInstance` is `null`.

### `useFullscreen`

Fullscreen management for any container element.

```tsx
import { useFullscreen } from '@fairu/player';

function FullscreenContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, enterFullscreen, exitFullscreen, toggleFullscreen } = useFullscreen(containerRef);

  return (
    <div ref={containerRef}>
      <button onClick={toggleFullscreen}>
        {isFullscreen ? 'Exit' : 'Enter'} Fullscreen
      </button>
    </div>
  );
}
```

### `usePlaylist`

Playlist management with shuffle and repeat.

```tsx
import { usePlaylist } from '@fairu/player';

function PlaylistManager() {
  const { state, controls } = usePlaylist({
    tracks: [...],
    initialIndex: 0,
    onTrackChange: (track, index) => console.log('now playing', track.title, index),
    onQueueEnd: () => console.log('reached the end'),
  });

  return (
    <div>
      {state.tracks.map((track, i) => (
        <div key={track.id} onClick={() => controls.goToTrack(i)}>
          {state.currentIndex === i && '▶'} {track.title}
        </div>
      ))}
      <button onClick={controls.previous}>Previous</button>
      <button onClick={controls.next}>Next</button>
      <button onClick={controls.toggleShuffle}>
        Shuffle {state.shuffle ? 'on' : 'off'}
      </button>
    </div>
  );
}
```

**`state`:** `tracks`, `currentIndex`, `currentTrack`, `shuffle`, `repeat`,
`queue`, `history`.

**`controls`:** `next`, `previous`, `goToTrack`, `setRepeat`, `toggleShuffle`,
`addToQueue`, `removeFromQueue`, `clearQueue`.

Two behaviours worth knowing:

- **Shuffle keeps the current track playing** and reorders what comes after it,
  so switching it on never jumps elsewhere and every remaining track is visited
  before `onQueueEnd` fires.
- **A new track list is adopted when its ids differ.** Re-passing the same
  tracks — which happens on every render with an inline array — leaves the
  position alone; a genuinely different list resets the cursor, history and
  queue.

### `useChapters`

Chapter navigation for podcasts.

```tsx
import { useChapters } from '@fairu/player';

function ChapterNav() {
  const { chapters, currentChapter, goToChapter } = useChapters();

  return (
    <ul>
      {chapters.map(chapter => (
        <li
          key={chapter.id}
          onClick={() => goToChapter(chapter)}
          className={currentChapter?.id === chapter.id ? 'active' : ''}
        >
          {chapter.title}
        </li>
      ))}
    </ul>
  );
}
```

### `useKeyboardControls`

Enable keyboard shortcuts for player controls.

```tsx
import { useKeyboardControls } from '@fairu/player';

function PlayerWithKeyboard() {
  useKeyboardControls({
    enabled: true,
    scope: 'global', // or 'focused'
  });

  return <Player />;
}
```

### `useAds` / `useVideoAds`

Access ad state and controls.

```tsx
import { useAds, useVideoAds } from '@fairu/player';

function AdIndicator() {
  const { state } = useAds(); // or useVideoAds() for video

  if (!state.isPlayingAd) return null;

  return (
    <div>
      Ad {state.adsRemaining} remaining
      {state.canSkip && <button>Skip</button>}
    </div>
  );
}
```

## Configuration

### PlayerConfig (Audio)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `track` | `Track` | - | Single track to play |
| `playlist` | `Track[]` | - | Array of tracks for playlist mode |
| `features` | `PlayerFeatures` | all enabled | Enable/disable player features |
| `autoPlayNext` | `boolean` | `true` | Auto-play next track in playlist |
| `shuffle` | `boolean` | `false` | Enable shuffle mode |
| `repeat` | `'none' \| 'one' \| 'all'` | `'none'` | Repeat mode |
| `skipForwardSeconds` | `number` | `30` | Skip forward duration |
| `skipBackwardSeconds` | `number` | `10` | Skip backward duration |
| `playbackSpeeds` | `number[]` | `[0.5, 0.75, 1, 1.25, 1.5, 2]` | Available playback speeds |
| `volume` | `number` | `1` | Initial volume (0-1) |
| `muted` | `boolean` | `false` | Start muted |
| `autoPlay` | `boolean` | `false` | Auto-play on load |

### VideoConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `track` | `VideoTrack` | - | Single video track |
| `playlist` | `VideoTrack[]` | - | Video playlist |
| `features` | `VideoFeatures` | all enabled | Enable/disable features |
| `poster` | `string` | - | Default poster image |
| `controlsHideDelay` | `number` | `3000` | Auto-hide controls delay (ms) |
| `hls` | `HLSConfig` | - | HLS streaming configuration |
| `autoPlayNext` | `boolean` | `true` | Auto-play next video |
| `shuffle` | `boolean` | `false` | Shuffle mode |
| `repeat` | `RepeatMode` | `'none'` | Repeat mode |

### HLSConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable HLS support |
| `autoQuality` | `boolean` | `true` | Auto-select quality based on bandwidth |
| `startLevel` | `number` | `-1` | Starting quality (-1 for auto) |
| `maxBufferLength` | `number` | `30` | Max buffer length in seconds |
| `lowLatencyMode` | `boolean` | `false` | Enable low latency for live streams |

### VideoFeatures

```typescript
interface VideoFeatures {
  chapters?: boolean;        // Show chapter markers
  volumeControl?: boolean;   // Show volume slider
  playbackSpeed?: boolean;   // Show speed selector
  skipButtons?: boolean;     // Show skip buttons
  progressBar?: boolean;     // Show progress bar
  timeDisplay?: boolean;     // Show time display
  playlistView?: boolean;    // Show playlist panel
  fullscreen?: boolean;      // Show fullscreen button
  qualitySelector?: boolean; // Show quality selector (HLS)
  subtitles?: boolean;       // Enable subtitles
  pictureInPicture?: boolean; // Enable PiP mode
  autoHideControls?: boolean; // Auto-hide controls
  seekingDisabled?: boolean;  // Disable seeking
}
```

## Ads

### Audio Ads

```tsx
import { AdProvider, PlayerProvider, Player } from '@fairu/player';

<AdProvider
  config={{
    enabled: true,
    adBreaks: [
      {
        id: 'pre1',
        position: 'pre-roll',
        ads: [
          {
            id: 'ad1',
            src: 'https://example.com/ad.mp3',
            duration: 15,
            skipAfterSeconds: 5,
            clickThroughUrl: 'https://example.com',
          },
        ],
      },
      {
        id: 'mid1',
        position: 'mid-roll',
        triggerTime: 300, // 5 minutes
        ads: [{ id: 'ad2', src: 'ad2.mp3', duration: 30 }],
      },
    ],
    onAdStart: (ad, adBreak) => console.log('Ad started', ad.id),
    onAdComplete: (ad, adBreak) => console.log('Ad complete', ad.id),
  }}
>
  <PlayerProvider config={playerConfig}>
    <Player />
  </PlayerProvider>
</AdProvider>
```

### Video Ads

```tsx
import { VideoAdProvider, VideoProvider, VideoPlayer } from '@fairu/player';

<VideoAdProvider
  config={{
    enabled: true,
    adBreaks: [
      {
        id: 'pre1',
        position: 'pre-roll',
        ads: [
          {
            id: 'ad1',
            src: 'https://example.com/ad.mp4',
            duration: 15,
            skipAfterSeconds: 5,
            poster: 'https://example.com/ad-poster.jpg',
            clickThroughUrl: 'https://example.com',
            trackingUrls: {
              impression: 'https://tracking.example.com/impression',
              start: 'https://tracking.example.com/start',
              complete: 'https://tracking.example.com/complete',
            },
          },
        ],
      },
    ],
  }}
>
  <VideoProvider config={videoConfig}>
    <VideoPlayer />
  </VideoProvider>
</VideoAdProvider>
```

### Custom Component Ads

You can render custom React components instead of video ads:

```tsx
const CustomAdComponent = ({ onComplete, onSkip, canSkip, skipCountdown, ad }) => (
  <div className="custom-ad">
    <h2>{ad.title}</h2>
    <img src={ad.poster} alt={ad.title} />
    <button onClick={onComplete}>Continue</button>
    {canSkip && <button onClick={onSkip}>Skip Ad</button>}
    {!canSkip && <span>Skip in {skipCountdown}s</span>}
  </div>
);

const adBreaks = [
  {
    id: 'custom1',
    position: 'mid-roll',
    triggerTime: 60,
    ads: [
      {
        id: 'ad1',
        src: '', // Not used for component ads
        duration: 10,
        component: CustomAdComponent,
      },
    ],
  },
];
```

### Dynamic Ad Triggering (Event Pipeline)

For advanced use cases, you can trigger overlay ads and info cards programmatically from anywhere in your application using the `AdEventBus`. This is useful for:

- Analytics-driven ad triggers (show ads when users reach milestones)
- E-commerce integration (cart abandonment reminders)
- Real-time events (WebSocket-triggered promotions)
- Timer-based campaigns
- A/B testing different ad placements

```tsx
import { createAdEventBus, VideoPlayer } from '@fairu/player';

// Create an event bus (can be a singleton for app-wide access)
const adEventBus = createAdEventBus();

function App() {
  return (
    <VideoPlayer
      track={myTrack}
      adEventBus={adEventBus}  // Pass the event bus to the player
    />
  );
}

// Trigger ads from ANYWHERE in your app:

// Show an overlay ad
adEventBus.emit('showOverlayAd', {
  id: 'promo-1',
  imageUrl: 'https://example.com/promo.png',
  clickThroughUrl: 'https://example.com/offer',
  displayAt: 0,  // Ignored for manual triggers
  closeable: true,
  position: 'bottom',
});

// Hide a specific overlay ad
adEventBus.emit('hideOverlayAd', { id: 'promo-1' });

// Hide all overlay ads
adEventBus.emit('hideAllOverlayAds');

// Show an info card
adEventBus.emit('showInfoCard', {
  id: 'product-1',
  type: 'product',
  title: 'Featured Product',
  description: 'Check out this deal!',
  price: '$49.99',
  url: 'https://example.com/product',
  displayAt: 0,
  position: 'top-right',
});

// Hide info cards
adEventBus.emit('hideInfoCard', { id: 'product-1' });
adEventBus.emit('hideAllInfoCards');

// Reset all dismissed ads (allow them to show again)
adEventBus.emit('resetDismissed');
```

#### Available Events

| Event | Payload | Description |
|-------|---------|-------------|
| `showOverlayAd` | `OverlayAd` | Show an overlay banner ad |
| `hideOverlayAd` | `{ id: string }` | Hide a specific overlay ad |
| `hideAllOverlayAds` | - | Hide all overlay ads |
| `showInfoCard` | `InfoCard` | Show an info card |
| `hideInfoCard` | `{ id: string }` | Hide a specific info card |
| `hideAllInfoCards` | - | Hide all info cards |
| `resetDismissed` | - | Reset dismissed states |

#### Integration Examples

```tsx
// Analytics integration
analytics.on('userMilestone', (milestone) => {
  if (milestone === '50%_watched') {
    adEventBus.emit('showOverlayAd', promoAd);
  }
});

// E-commerce cart abandonment
cart.on('abandoned', () => {
  adEventBus.emit('showInfoCard', {
    id: 'cart-reminder',
    type: 'product',
    title: 'Complete your purchase!',
    price: '-20% with code SAVE20',
    displayAt: 0,
  });
});

// WebSocket real-time events
socket.on('flash-sale', (saleData) => {
  adEventBus.emit('showOverlayAd', {
    id: 'flash-sale',
    imageUrl: saleData.bannerUrl,
    clickThroughUrl: saleData.url,
    displayAt: 0,
    closeable: true,
  });
});
```

#### Global Event Bus

For app-wide access, you can use a singleton pattern:

```tsx
import { getGlobalAdEventBus, resetGlobalAdEventBus } from '@fairu/player';

// Get the global instance (created on first access)
const adEventBus = getGlobalAdEventBus();

// Use it anywhere in your app
adEventBus.emit('showOverlayAd', myAd);

// Reset on unmount or cleanup
resetGlobalAdEventBus();
```

### VAST Tracking Events

The player supports standard VAST tracking events:

| Event | Description |
|-------|-------------|
| `impression` | Ad is displayed |
| `start` | Playback begins |
| `firstQuartile` | 25% watched |
| `midpoint` | 50% watched |
| `thirdQuartile` | 75% watched |
| `complete` | 100% watched |
| `skip` | User skipped the ad |
| `click` | User clicked the ad |
| `error` | Playback error occurred |
| `pause` | Ad paused |
| `resume` | Ad resumed |
| `mute` | Audio muted |
| `unmute` | Audio unmuted |

## TypeScript Types

### Core Types

```typescript
import type {
  // Track types
  Track,
  VideoTrack,
  Chapter,
  Subtitle,
  VideoQuality,

  // State types
  PlayerState,
  VideoState,
  PlaylistState,
  WatchProgress,

  // Config types
  PlayerConfig,
  VideoConfig,
  HLSConfig,
  PlayerFeatures,
  VideoFeatures,

  // Ad types
  Ad,
  AdBreak,
  AdPosition,
  VideoAd,
  VideoAdBreak,
  AdConfig,
  VideoAdConfig,
  AdTrackingUrls,

  // Control types
  PlayerControls,
  VideoControls,
  PlaylistControls,

  // Context types
  PlayerContextValue,
  VideoContextValue,
} from '@fairu/player';
```

### Track Type

```typescript
interface Track {
  id: string;
  src: string;
  title: string;
  artist?: string;
  album?: string;
  artwork?: string;
  duration?: number;
  chapters?: Chapter[];
}

interface VideoTrack extends Track {
  type?: 'video';
  poster?: string;
  qualities?: VideoQuality[];
  subtitles?: Subtitle[];
}
```

### WatchProgress Type

```typescript
interface WatchProgress {
  watchedSegments: WatchedSegment[];
  percentageWatched: number;
  isFullyWatched: boolean;
  furthestPoint: number;
}

interface WatchedSegment {
  start: number;
  end: number;
}
```

## Embedding

### Script-based Embed

```html
<div
  data-fairu-player
  data-src="https://example.com/podcast.mp3"
  data-title="My Podcast"
  data-theme="dark"
></div>
<script src="https://fairu.app/player/embed.js" data-auto-init></script>
```

### Programmatic Embed

```html
<div id="my-player"></div>
<script src="https://fairu.app/player/embed.js"></script>
<script>
  FairuPlayer.create('#my-player', {
    player: {
      track: {
        id: '1',
        src: 'https://example.com/podcast.mp3',
        title: 'My Podcast',
      },
    },
    theme: 'light',
  });
</script>
```

### Iframe Embed

```html
<iframe
  src="https://fairu.app/embed/player?src=https://example.com/podcast.mp3&theme=dark"
  width="100%"
  height="150"
  frameborder="0"
></iframe>
```

## CDN Usage

The player is available as a standalone script for direct inclusion via CDN. Two variants are provided:

### Standalone (recommended for most users)

Includes React bundled - no dependencies required (~540 KB):

```html
<link rel="stylesheet" href="https://unpkg.com/@fairu/player/dist/player.css">
<script src="https://unpkg.com/@fairu/player/dist/fairu-player.iife.js"></script>

<div data-fairu-player data-src="https://example.com/audio.mp3"></div>

<script>
  FairuPlayer.init();
</script>
```

### Lightweight (for sites already using React)

Requires external React 18+ (~66 KB):

```html
<link rel="stylesheet" href="https://unpkg.com/@fairu/player/dist/player.css">
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@fairu/player/dist/fairu-player.light.iife.js"></script>

<div data-fairu-player data-src="https://example.com/audio.mp3"></div>

<script>
  FairuPlayer.init();
</script>
```

### CDN API

```javascript
// Initialize all elements with data-fairu-player attribute
FairuPlayer.init();

// Initialize with custom selector
FairuPlayer.init('.my-player');

// Mount programmatically
FairuPlayer.create('#my-container', {
  src: 'https://example.com/audio.mp3',
  player: {
    showWaveform: false,
  }
});

// Unmount
FairuPlayer.unmount(element);
```

### Data Attributes

Configure the player using data attributes:

| Attribute | Description |
|-----------|-------------|
| `data-src` | Media URL |
| `data-title` | Track title |
| `data-artist` | Artist name |
| `data-artwork` | Artwork URL |
| `data-theme` | Theme (`light` or `dark`) |

## Theming

The player uses CSS custom properties for theming:

```css
:root {
  --fp-color-primary: #6366f1;
  --fp-color-background: #ffffff;
  --fp-color-surface: #f3f4f6;
  --fp-color-text: #1f2937;
  --fp-color-text-muted: #6b7280;
  --fp-progress-bg: #e5e7eb;
  --fp-progress-fill: var(--fp-color-primary);
  --fp-border-radius: 8px;
}

[data-theme="dark"] {
  --fp-color-background: #1f2937;
  --fp-color-surface: #374151;
  --fp-color-text: #f9fafb;
}
```

## Tracking

Enable GDPR-compliant tracking:

```tsx
import { PlayerProvider, TrackingProvider, Player } from '@fairu/player';

<TrackingProvider
  config={{
    enabled: true, // Must be explicitly enabled (GDPR)
    endpoint: 'https://api.example.com/track',
    events: {
      play: true,
      pause: true,
      progress: true,
      complete: true,
    },
    progressIntervals: [25, 50, 75, 100],
  }}
>
  <PlayerProvider config={playerConfig}>
    <Player />
  </PlayerProvider>
</TrackingProvider>
```

## Vue, Angular, Svelte & plain HTML

The player also ships as a custom element, so it is not React-only. One import
registers `<fairu-player>`:

```ts
import '@fairu/player/wc';
import '@fairu/player/styles.css';
```

The import is safe to run on a server — it registers nothing when there is no
DOM, so Angular Universal, Nuxt and Next can import it unconditionally.

> Every example below is executed in CI. `verification/` holds a Vue, an
> Angular, a Svelte and a plain-HTML app that bind the element exactly as
> documented here; Playwright drives all four in a real browser against the
> built package on every push. If a snippet on this page stops working, that job
> goes red.

There are two ways in, because neither covers everything:

- **Attributes** for the simple case. HTML attributes are strings, so this is
  what a hand-written page or a CMS can express.
- **Properties** (`config`, `playlist`) for structured data. A playlist or an ad
  schedule cannot go through an attribute without JSON-stringifying it — and
  every framework's binding syntax sets DOM properties, which is exactly what
  this needs.

Properties win over attributes when both are set.

### Plain HTML

```html
<fairu-player
  src="https://example.com/episode.mp3"
  title="Wie Streaming wirklich funktioniert"
  artist="Fairu Podcast"
  artwork="https://example.com/cover.jpg"
  theme="dark"
></fairu-player>
```

### Vue

```vue
<script setup>
import '@fairu/player/wc';
import { ref } from 'vue';

const config = ref({
  playlist: [
    { id: 'ep-1', src: '/ep-1.mp3', title: 'Folge 1', artist: 'Fairu' },
    { id: 'ep-2', src: '/ep-2.mp3', title: 'Folge 2', artist: 'Fairu' },
  ],
  volume: 0.8,
});
</script>

<template>
  <fairu-player
    :config="config"
    theme="dark"
    @fairu-play="onPlay"
    @fairu-ended="onEnded"
  />
</template>
```

Tell Vue the tag is a custom element so it does not warn about an unknown
component:

```ts
// vite.config.ts
vue({
  template: {
    compilerOptions: { isCustomElement: (tag) => tag === 'fairu-player' },
  },
});
```

### Angular

```ts
import { CUSTOM_ELEMENTS_SCHEMA, Component } from '@angular/core';
import '@fairu/player/wc';

@Component({
  selector: 'app-episode',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // required for custom elements
  template: `
    <fairu-player
      [config]="config"
      theme="dark"
      (fairu-play)="onPlay()"
      (fairu-timeupdate)="onTime($any($event).detail.time)"
    ></fairu-player>
  `,
})
export class EpisodeComponent {
  config = { track: { id: 'ep-1', src: '/ep-1.mp3', title: 'Folge 1' } };
  onPlay() {}
  onTime(seconds: number) {}
}
```

### Svelte

```svelte
<script>
  import '@fairu/player/wc';
  const config = { track: { id: 'ep-1', src: '/ep-1.mp3' } };
</script>

<fairu-player {config} theme="dark" on:fairu-play={handlePlay} />
```

### Attributes

| Attribute | Description |
|---|---|
| `src` | Media URL. Builds a single track. |
| `track-id` | Stable identity for the media, used to key the remembered position. Defaults to `src`. Do **not** rely on the element's `id` for this — that identifies the DOM node, not the media. |
| `title`, `artist`, `album` | Track metadata, also used for the OS lock screen. |
| `artwork` | Cover image (audio). |
| `poster` | Poster image (video). Implies `type="video"`. |
| `type` | `audio` or `video`. Optional — inferred from `poster` otherwise. |
| `theme` | Theme name, applied as `data-theme`. |
| `autoplay`, `muted` | Booleans. A bare attribute means true. |
| `volume` | 0–1. |
| `persistence` | `false` to disable remembering preferences. |
| `auto-resume` | `true` to seek to the remembered position on load. |
| `media-session` | `false` to disable the OS lock-screen integration. |

### Properties

| Property | Type | Description |
|---|---|---|
| `config` | `PlayerConfig \| VideoConfig` | The full config object, same shape as the React `config` prop. |
| `playlist` | `Track[] \| VideoTrack[]` | Convenience for setting just the queue. |
| `isVideo` | `boolean` (read-only) | Whether this instance renders video. |

### Events

All events bubble and are `composed`, so a parent element can listen. The
payload is on `event.detail`.

> **The names use a dash, not a colon.** Angular's template parser reads a colon
> in a binding name as a namespace separator: `(fairu:play)` compiles *without
> an error* and binds to `play` — so the handler never fires for this event, and
> does fire for the native `play` bubbling up from the inner media element. A
> dash has no meaning in Vue, Angular or Svelte template syntax, so
> `(fairu-play)`, `@fairu-play` and `on:fairu-play` all bind to exactly the name
> below. This is asserted against Angular's own compiler in
> `src/wc/frameworkBindings.test.ts`.

| Event | `detail` |
|---|---|
| `fairu-ready` | `null` — fired once the element has mounted. |
| `fairu-play` / `fairu-pause` / `fairu-ended` | `null` |
| `fairu-timeupdate` | `{ time: number }` |
| `fairu-trackchange` | `{ track, index }` |
| `fairu-error` | `{ message, error }` |

### Changing media

Rebinding `config` or `playlist` swaps what is playing — the ordinary Vue and
Angular pattern works:

```vue
<fairu-player :config="{ track: currentEpisode }" />
```

The list is compared by track id, not by array identity, so re-passing the same
tracks (which happens on every render with an inline object) does **not** reset
the listener's position. A genuinely different list resets the cursor, history
and queue, as you would expect from switching playlists.

## Media Session (lock screen & OS controls)

The player publishes the current track to the OS, so the episode title, artwork
and transport controls appear on the lock screen, in the notification shade, on
the macOS Now Playing widget, on Bluetooth headsets and in CarPlay / Android
Auto. Hardware play/pause and next/previous buttons are wired up too.

This is on by default and needs no configuration — metadata is taken from the
current track's `title`, `artist`, `album` and `artwork` (or `poster` for video).

```tsx
<Player
  config={{
    track: {
      id: 'ep-1',
      src: 'https://example.com/episode.mp3',
      title: 'Wie Streaming wirklich funktioniert',
      artist: 'Fairu Podcast',
      artwork: 'https://example.com/cover.jpg', // shown on the lock screen
    },
    mediaSession: {
      enabled: true, // default
      seekOffset: 30, // seconds for the OS skip buttons
    },
  }}
/>
```

Turn it off for background/ambient video and ad-only surfaces, which should not
take over the viewer's Now Playing slot:

```tsx
<VideoPlayer config={{ mediaSession: { enabled: false } }} />
```

Everything is feature-detected: the API is unavailable in non-secure contexts
and some webviews, and individual actions are rejected by browsers that do not
implement them. Use `isMediaSessionSupported()` if you need to branch on it.

### Standalone hook

```tsx
import { useMediaSession } from '@fairu/player';

useMediaSession({
  metadata: { title, artist, artwork: [{ src: cover, sizes: '512x512' }] },
  isPlaying,
  position: currentTime,
  duration,
  onPlay: controls.play,
  onPause: controls.pause,
  onSeekTo: controls.seek,
});
```

## Persistence

Volume, mute, playback rate and playback position survive a reload. Both are on
by default.

```tsx
<Player
  config={{
    playlist: episodes,
    persistence: {
      enabled: true, // default
      scope: 'sidebar', // namespace, so several players can coexist
      maxAge: 30 * 24 * 60 * 60 * 1000, // discard entries older than 30 days
    },
    resume: {
      minPosition: 10, // ignore anything below this, in seconds
      completedThreshold: 0.95, // treat as finished past 95 %
      saveInterval: 5000, // throttle writes while playing
      maxEntries: 100, // remembered tracks; oldest evicted first
    },
  }}
/>
```

Storage failures never surface to a viewer. Server-side rendering, blocked
storage in a cross-origin iframe, Safari private mode and an exhausted quota all
degrade to "no persistence" — the player still plays.

Opt out entirely for consent-gated setups, then switch it on after opt-in:

```tsx
<Player config={{ persistence: { enabled: hasConsent } }} />
```

### Standalone hooks

```tsx
import { usePersistentPreferences, useResumePosition } from '@fairu/player';

const { preferences, update, reset } = usePersistentPreferences({
  defaults: { volume: 0.8 },
});

const { resumeAt, entry, save, markCompleted, clearAll } = useResumePosition({
  trackId: track.id,
});

// `resumeAt` is null when there is nothing worth resuming — never played,
// too early, or already finished.
if (resumeAt !== null) controls.seek(resumeAt);
```

### Clearing stored data

```tsx
import { clearStored } from '@fairu/player';

clearStored(); // removes every entry this player owns, host page untouched
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` / `K` | Play/Pause |
| `←` | Skip backward 5s |
| `→` | Skip forward 5s |
| `Shift + ←` | Skip backward 10s |
| `Shift + →` | Skip forward 10s |
| `↑` | Volume up |
| `↓` | Volume down |
| `M` | Toggle mute |
| `J` | Skip backward 10s |
| `L` | Skip forward 10s |
| `0-9` | Seek to 0-90% |
| `Home` | Go to start |
| `End` | Go to end |
| `F` | Toggle fullscreen (video) |
| `C` | Toggle subtitles (video) |

## Storybook

The project includes a comprehensive Storybook setup for interactive component development and documentation.

### Running Storybook

```bash
npm run storybook
```

This starts Storybook at [http://localhost:6006](http://localhost:6006).

### Available Stories

| Category | Components |
|----------|------------|
| **Player** | `Player`, `NowPlayingView`, `CoverArtView` |
| **VideoPlayer** | `VideoPlayer`, `VideoOverlay`, `VideoControls`, `DynamicAdTriggering`, `EventPipeline` |
| **Controls** | `PlayButton`, `ProgressBar`, `VolumeControl`, `TimeDisplay`, `PlaybackSpeed`, `SkipButtons`, `FullscreenButton`, `QualitySelector` |
| **Playlist** | `PlaylistView`, `TrackItem`, `PlaylistControls` |
| **Chapters** | `ChapterList`, `ChapterMarker` |
| **Ads** | `AdOverlay`, `AdSkipButton`, `OverlayAd`, `InfoCard` |

### Story Features

Each component includes multiple story variants:
- **Default** - Basic usage with minimal props
- **With Controls** - Interactive Storybook controls for all props
- **Edge Cases** - Long text, missing data, loading states
- **Theming** - Light/dark mode variants

### Building Static Storybook

```bash
npm run build-storybook
```

This generates a static build in the `storybook-static` directory, ready for deployment.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run Storybook
npm run storybook

# Lint (blocking in CI: zero errors, warning budget ratchets down)
npm run lint

# Run tests
npm run test

# Verify the custom element in Vue, Angular, Svelte and plain HTML
# (real browser, against dist — see verification/README.md)
npm run build:lib
cd verification && npm ci && npm run install:browsers:local && npm run test:local

# Build library
npm run build:lib

# Type checking
npm run typecheck
```

## Fairu.app Hosting

The player includes built-in support for [fairu.app](https://fairu.app) as a media hosting solution. When using fairu.app, you only need to provide the file UUID - the player automatically constructs the correct URLs for media files and cover images.

### Quick Start with Fairu Hosting

```tsx
import { PlayerProvider, Player, createTrackFromFairu } from '@fairu/player';
import '@fairu/player/styles.css';

function App() {
  // Just provide the UUID from fairu.app
  const track = createTrackFromFairu({
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    title: 'My Podcast Episode',
    artist: 'Podcast Host',
  });

  return (
    <PlayerProvider config={{ track }}>
      <Player />
    </PlayerProvider>
  );
}
```

### Video with Fairu Hosting

```tsx
import { VideoProvider, VideoPlayer, createVideoTrackFromFairu } from '@fairu/player';

function App() {
  const track = createVideoTrackFromFairu({
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    title: 'My Video',
    version: 'high', // Optional: 'low', 'medium', or 'high'
  });

  return (
    <VideoProvider config={{ track }}>
      <VideoPlayer />
    </VideoProvider>
  );
}
```

### Playlist with Fairu Hosting

```tsx
import { createPlaylistFromFairu, createVideoPlaylistFromFairu } from '@fairu/player';

// Audio playlist
const audioPlaylist = createPlaylistFromFairu([
  { uuid: 'uuid-1', title: 'Episode 1' },
  { uuid: 'uuid-2', title: 'Episode 2' },
  { uuid: 'uuid-3', title: 'Episode 3' },
]);

// Video playlist
const videoPlaylist = createVideoPlaylistFromFairu([
  { uuid: 'uuid-1', title: 'Video 1', version: 'high' },
  { uuid: 'uuid-2', title: 'Video 2', version: 'high' },
]);
```

### Fairu URL Utilities

The package exports utility functions for generating fairu.app URLs:

```tsx
import {
  getFairuAudioUrl,
  getFairuVideoUrl,
  getFairuHlsUrl,
  getFairuCoverUrl,
  getFairuThumbnailUrl,
} from '@fairu/player';

// Audio URL
const audioUrl = getFairuAudioUrl('uuid');
// → https://files.fairu.app/uuid/audio.mp3

// Video URL with quality
const videoUrl = getFairuVideoUrl('uuid', { version: 'high' });
// → https://files.fairu.app/uuid/video.mp4?version=high

// HLS streaming URL
const hlsUrl = getFairuHlsUrl('uuid', 'tenant-id');
// → https://files.fairu.app/hls/tenant-id/uuid/master.m3u8

// Cover image with dimensions
const coverUrl = getFairuCoverUrl('uuid', { width: 800, height: 450 });
// → https://files.fairu.app/uuid/cover.jpg?width=800&height=450

// Video thumbnail at specific timestamp
const thumbUrl = getFairuThumbnailUrl('uuid', '00:01:30.000', { width: 320 });
// → https://files.fairu.app/uuid/thumbnail.jpg?timestamp=00:01:30.000&width=320
```

### Fairu Track Types

```typescript
import type { FairuTrack, FairuVideoTrack } from '@fairu/player';

// Audio track
const audioTrack: FairuTrack = {
  uuid: '123e4567-e89b-12d3-a456-426614174000',
  title: 'My Podcast',
  artist: 'Host Name',
  album: 'Podcast Series',
  duration: 3600,
  coverOptions: {
    width: 400,
    height: 400,
    format: 'webp',
  },
};

// Video track
const videoTrack: FairuVideoTrack = {
  uuid: '123e4567-e89b-12d3-a456-426614174000',
  title: 'My Video',
  version: 'high',
  posterOptions: {
    width: 1280,
    height: 720,
  },
};
```

### Cover Image Options

When generating cover images, you can customize the output:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | `number` | `400` | Width in pixels (1-6000) |
| `height` | `number` | `400` | Height in pixels (1-6000) |
| `format` | `'jpg' \| 'png' \| 'webp'` | - | Output format |
| `quality` | `number` | `95` | Quality for JPEG/WebP (1-100) |
| `fit` | `'cover' \| 'contain'` | `'cover'` | Resize mode |
| `focal` | `string` | - | Focal point for smart crop (`"x-y-zoom"`) |

## License

Fairu Source Available License

This software is source available under a custom license. You can use, modify, and distribute this player freely, except for uses that compete with [fairu.app](https://fairu.app)'s media hosting services.

**What you CAN do:**
- Use the player to embed and play your own media content
- Use it with any hosting service (self-hosted, CDN, etc.)
- Modify and customize the player
- Use it in commercial projects
- Use it in open source projects

**What you CANNOT do:**
- Build a competing media hosting/player service using this code

For alternative licensing arrangements, contact support@sushi.dev.

See [LICENSE](./LICENSE) for the full license text.
