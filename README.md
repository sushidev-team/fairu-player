# @fairu/player

A lightweight, modular React media player with TypeScript support. Supports audio podcasts and video with HLS streaming. Designed to be embeddable as a widget for fairu.app and external sites.

## Features

- **React 18+ with TypeScript** - Full type safety and modern React features
- **Audio & Video Player** - Unified API for audio podcasts and video content
- **HLS Streaming** - Adaptive bitrate streaming with quality selection
- **Tailwind CSS + CSS Variables** - Easy theming with CSS custom properties
- **Playlist Support** - Queue management, shuffle, repeat modes
- **Chapters** - Display and navigate podcast chapters
- **Subtitles** - Video subtitle/caption support
- **Fullscreen Mode** - Native fullscreen with keyboard controls
- **Watch Progress Tracking** - Track watched segments and completion
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
    isReady,
    availableQualities,
    currentQuality,
    setQuality,
    isAutoQuality,
    setAutoQuality
  } = useHLS(videoRef, {
    src: 'https://example.com/video.m3u8',
    autoQuality: true,
  });

  return (
    <>
      <video ref={videoRef} />
      <select
        value={currentQuality}
        onChange={(e) => setQuality(e.target.value)}
      >
        <option value="auto">Auto</option>
        {availableQualities.map(q => (
          <option key={q.label} value={q.label}>{q.label}</option>
        ))}
      </select>
    </>
  );
}
```

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
  const {
    tracks,
    currentIndex,
    currentTrack,
    shuffle,
    repeat,
    hasNext,
    hasPrevious,
    playTrack,
    next,
    previous,
    toggleShuffle,
    setRepeat,
  } = usePlaylist({
    tracks: [...],
    initialIndex: 0,
  });

  return (
    <div>
      {tracks.map((track, i) => (
        <div key={track.id} onClick={() => playTrack(i)}>
          {currentIndex === i && '▶'} {track.title}
        </div>
      ))}
    </div>
  );
}
```

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

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run Storybook
npm run storybook

# Run tests
npm run test

# Build library
npm run build:lib

# Type checking
npm run typecheck
```

## License

MIT
