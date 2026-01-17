# @fairu/player

A lightweight, modular React podcast player with TypeScript support. Designed to be embeddable as a widget for fairu.app and external sites.

## Features

- **React 18+ with TypeScript** - Full type safety and modern React features
- **Tailwind CSS + CSS Variables** - Easy theming with CSS custom properties
- **Playlist Support** - Queue management, shuffle, repeat modes
- **Chapters** - Display and navigate podcast chapters
- **Embeddable** - Script-based and iframe embedding options
- **GDPR Compliant** - Opt-in tracking with configurable endpoints
- **Ads Support** - Pre-roll, mid-roll, and post-roll ad integration
- **Keyboard Controls** - Full keyboard navigation support
- **Accessible** - ARIA labels and focus management

## Installation

```bash
npm install @fairu/player
```

## Quick Start

### Basic Usage

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

## Configuration

### PlayerConfig

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

### PlayerFeatures

```typescript
interface PlayerFeatures {
  chapters?: boolean;      // Show chapter markers
  volumeControl?: boolean; // Show volume slider
  playbackSpeed?: boolean; // Show speed selector
  skipButtons?: boolean;   // Show skip buttons
  progressBar?: boolean;   // Show progress bar
  timeDisplay?: boolean;   // Show time display
  playlistView?: boolean;  // Show playlist panel
}
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
