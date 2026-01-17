import type { Meta, StoryObj } from '@storybook/react';
import { PlayerProvider } from '@/context/PlayerContext';
import { TrackingProvider } from '@/context/TrackingContext';
import { Player } from './index';
import type { Track, PlayerConfig } from '@/types/player';
import {
  createTrackFromFairu,
  createPlaylistFromFairu,
  getFairuAudioUrl,
  getFairuCoverUrl,
  type FairuTrack,
} from '@/utils/fairu';

// Sample tracks for stories
const sampleTrack: Track = {
  id: '1',
  src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  title: 'Sample Podcast Episode',
  artist: 'Podcast Host',
  artwork: 'https://picsum.photos/200',
  duration: 375,
  chapters: [
    { id: 'ch1', title: 'Introduction', startTime: 0 },
    { id: 'ch2', title: 'Main Topic', startTime: 60 },
    { id: 'ch3', title: 'Deep Dive', startTime: 180 },
    { id: 'ch4', title: 'Conclusion', startTime: 300 },
  ],
};

const samplePlaylist: Track[] = [
  {
    id: '1',
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    title: 'Episode 1: Getting Started',
    artist: 'Tech Podcast',
    artwork: 'https://picsum.photos/200?random=1',
    duration: 375,
  },
  {
    id: '2',
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    title: 'Episode 2: Advanced Topics',
    artist: 'Tech Podcast',
    artwork: 'https://picsum.photos/200?random=2',
    duration: 420,
  },
  {
    id: '3',
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    title: 'Episode 3: Best Practices',
    artist: 'Tech Podcast',
    artwork: 'https://picsum.photos/200?random=3',
    duration: 390,
  },
];

// Wrapper component for stories
function PlayerWrapper({
  config,
  showChapters,
  showPlaylist,
  compact,
}: {
  config: PlayerConfig;
  showChapters?: boolean;
  showPlaylist?: boolean;
  compact?: boolean;
}) {
  return (
    <TrackingProvider>
      <PlayerProvider config={config}>
        <div style={{ maxWidth: '500px' }}>
          <Player
            showChapters={showChapters}
            showPlaylist={showPlaylist}
            compact={compact}
          />
        </div>
      </PlayerProvider>
    </TrackingProvider>
  );
}

const meta: Meta<typeof PlayerWrapper> = {
  title: 'Components/Player',
  component: PlayerWrapper,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PlayerWrapper>;

export const Default: Story = {
  args: {
    config: {
      track: sampleTrack,
    },
  },
};

export const WithChapters: Story = {
  args: {
    config: {
      track: sampleTrack,
    },
    showChapters: true,
  },
};

export const Playlist: Story = {
  args: {
    config: {
      playlist: samplePlaylist,
    },
    showPlaylist: true,
  },
};

export const PlaylistWithChapters: Story = {
  args: {
    config: {
      playlist: [
        { ...sampleTrack, id: '1', title: 'Episode with Chapters' },
        ...samplePlaylist.slice(1),
      ],
    },
    showChapters: true,
    showPlaylist: true,
  },
};

export const Compact: Story = {
  args: {
    config: {
      track: sampleTrack,
    },
    compact: true,
  },
};

export const MinimalFeatures: Story = {
  args: {
    config: {
      track: sampleTrack,
      features: {
        chapters: false,
        volumeControl: false,
        playbackSpeed: false,
        skipButtons: false,
      },
    },
  },
};

export const CustomSpeeds: Story = {
  args: {
    config: {
      track: sampleTrack,
      playbackSpeeds: [0.5, 1, 1.5, 2, 3],
    },
  },
};

export const AutoPlay: Story = {
  args: {
    config: {
      track: sampleTrack,
      autoPlay: true,
    },
  },
};

export const ShuffleAndRepeat: Story = {
  args: {
    config: {
      playlist: samplePlaylist,
      shuffle: true,
      repeat: 'all',
    },
    showPlaylist: true,
  },
};

// ============= Fairu.app Hosting Stories =============

/**
 * Example: Using fairu.app hosting with just a UUID
 * Shows URL generation and a working player demo
 */
function FairuHostingDemo() {
  // Example UUID (placeholder)
  const exampleUuid = '123e4567-e89b-12d3-a456-426614174000';

  // Show what URLs would be generated
  const audioUrl = getFairuAudioUrl(exampleUuid);
  const coverUrl = getFairuCoverUrl(exampleUuid, { width: 200, height: 200 });

  // For the demo, use a real audio file but show the Fairu pattern
  const demoTrack = {
    id: exampleUuid,
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    title: 'Podcast Episode (Demo)',
    artist: 'Fairu Podcast',
    artwork: 'https://picsum.photos/200',
  };

  return (
    <div className="space-y-6">
      {/* Info Panel */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-lg p-4 text-white text-sm border border-purple-500">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-1 bg-purple-500 text-xs font-bold rounded">FAIRU.APP</span>
          <h3 className="text-lg font-semibold">Hosting Mode</h3>
        </div>
        <p className="text-purple-200 mb-4">
          Mit fairu.app benötigst du nur die UUID. URLs werden automatisch generiert.
        </p>
        <div className="space-y-2 font-mono text-xs bg-black/30 rounded p-3">
          <div className="flex flex-wrap">
            <span className="text-purple-300 w-20">UUID:</span>
            <span className="text-blue-400 break-all">{exampleUuid}</span>
          </div>
          <div className="flex flex-wrap">
            <span className="text-purple-300 w-20">Audio:</span>
            <span className="text-green-400 break-all">{audioUrl}</span>
          </div>
          <div className="flex flex-wrap">
            <span className="text-purple-300 w-20">Cover:</span>
            <span className="text-green-400 break-all">{coverUrl}</span>
          </div>
        </div>
      </div>

      {/* Working Player Demo */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-3 text-gray-400">Live Player Demo:</h4>
        <PlayerProvider config={{ track: demoTrack }}>
          <Player />
        </PlayerProvider>
      </div>

      {/* Code Example */}
      <div className="bg-gray-900 rounded-lg p-4 text-white text-sm">
        <h4 className="text-sm font-semibold mb-2 text-gray-400">Code:</h4>
        <pre className="text-xs overflow-x-auto text-green-300">
{`import { PlayerProvider, Player, createTrackFromFairu } from '@fairu/player';

// Nur UUID und Metadaten - URLs werden automatisch generiert
const track = createTrackFromFairu({
  uuid: '${exampleUuid}',
  title: 'Mein Podcast',
  artist: 'Host Name',
});

<PlayerProvider config={{ track }}>
  <Player />
</PlayerProvider>`}
        </pre>
      </div>
    </div>
  );
}

export const FairuHosting: Story = {
  render: () => (
    <div style={{ maxWidth: '600px' }}>
      <FairuHostingDemo />
    </div>
  ),
};

/**
 * Example: Fairu playlist with working demo
 */
function FairuPlaylistDemo() {
  const fairuTracks: FairuTrack[] = [
    { uuid: 'uuid-episode-1', title: 'Episode 1: Einführung', artist: 'Podcast Host' },
    { uuid: 'uuid-episode-2', title: 'Episode 2: Deep Dive', artist: 'Podcast Host' },
    { uuid: 'uuid-episode-3', title: 'Episode 3: Fazit', artist: 'Podcast Host' },
  ];

  // Show generated playlist structure
  const generatedPlaylist = createPlaylistFromFairu(fairuTracks);

  // For demo, use real audio files
  const demoPlaylist = [
    { id: 'uuid-episode-1', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', title: 'Episode 1: Einführung', artist: 'Podcast Host', artwork: 'https://picsum.photos/200?random=1' },
    { id: 'uuid-episode-2', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', title: 'Episode 2: Deep Dive', artist: 'Podcast Host', artwork: 'https://picsum.photos/200?random=2' },
    { id: 'uuid-episode-3', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', title: 'Episode 3: Fazit', artist: 'Podcast Host', artwork: 'https://picsum.photos/200?random=3' },
  ];

  return (
    <div className="space-y-6">
      {/* Info Panel */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-lg p-4 text-white text-sm border border-purple-500">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-1 bg-purple-500 text-xs font-bold rounded">FAIRU.APP</span>
          <h3 className="text-lg font-semibold">Playlist Mode</h3>
        </div>
        <pre className="text-xs overflow-x-auto bg-black/30 rounded p-3 text-green-300">
{`import { createPlaylistFromFairu } from '@fairu/player';

const playlist = createPlaylistFromFairu([
  { uuid: 'uuid-episode-1', title: 'Episode 1' },
  { uuid: 'uuid-episode-2', title: 'Episode 2' },
  { uuid: 'uuid-episode-3', title: 'Episode 3' },
]);`}
        </pre>
      </div>

      {/* Working Player Demo */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-3 text-gray-400">Live Playlist Demo:</h4>
        <PlayerProvider config={{ playlist: demoPlaylist }}>
          <Player showPlaylist />
        </PlayerProvider>
      </div>

      {/* Generated Structure */}
      <div className="bg-gray-900 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-2 text-gray-400">Generierte Playlist-Struktur:</h4>
        <pre className="text-xs text-gray-300 overflow-x-auto max-h-48">
          {JSON.stringify(generatedPlaylist, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export const FairuPlaylist: Story = {
  render: () => (
    <div style={{ maxWidth: '600px' }}>
      <FairuPlaylistDemo />
    </div>
  ),
};

/**
 * Example: All Fairu URL utilities
 */
function FairuUrlUtilitiesDemo() {
  const uuid = '550e8400-e29b-41d4-a716-446655440000';

  const urls = {
    audio: getFairuAudioUrl(uuid),
    cover: getFairuCoverUrl(uuid, { width: 400, height: 400 }),
    coverWebP: getFairuCoverUrl(uuid, { width: 800, height: 450, format: 'webp', quality: 90 }),
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-lg p-4 text-white border border-purple-500">
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2 py-1 bg-purple-500 text-xs font-bold rounded">FAIRU.APP</span>
          <h3 className="text-lg font-semibold">URL Utilities</h3>
        </div>

        <div className="space-y-4 text-sm">
          {/* Audio URL */}
          <div className="bg-black/30 rounded p-3">
            <div className="text-purple-300 text-xs mb-1">getFairuAudioUrl(uuid)</div>
            <code className="text-green-400 text-xs break-all">{urls.audio}</code>
          </div>

          {/* Cover URL */}
          <div className="bg-black/30 rounded p-3">
            <div className="text-purple-300 text-xs mb-1">getFairuCoverUrl(uuid, {'{'} width: 400, height: 400 {'}'})</div>
            <code className="text-green-400 text-xs break-all">{urls.cover}</code>
          </div>

          {/* Cover WebP */}
          <div className="bg-black/30 rounded p-3">
            <div className="text-purple-300 text-xs mb-1">getFairuCoverUrl(uuid, {'{'} width: 800, height: 450, format: &apos;webp&apos;, quality: 90 {'}'})</div>
            <code className="text-green-400 text-xs break-all">{urls.coverWebP}</code>
          </div>
        </div>
      </div>

      {/* Available functions */}
      <div className="bg-gray-800 rounded-lg p-4 text-white text-sm">
        <h4 className="font-semibold mb-3">Verfügbare Funktionen:</h4>
        <ul className="space-y-2 text-xs">
          <li className="flex gap-2">
            <code className="text-blue-400">getFairuAudioUrl(uuid)</code>
            <span className="text-gray-400">→ audio.mp3</span>
          </li>
          <li className="flex gap-2">
            <code className="text-blue-400">getFairuVideoUrl(uuid, options?)</code>
            <span className="text-gray-400">→ video.mp4</span>
          </li>
          <li className="flex gap-2">
            <code className="text-blue-400">getFairuHlsUrl(uuid, tenant)</code>
            <span className="text-gray-400">→ HLS master.m3u8</span>
          </li>
          <li className="flex gap-2">
            <code className="text-blue-400">getFairuCoverUrl(uuid, options?)</code>
            <span className="text-gray-400">→ cover.jpg mit Resize</span>
          </li>
          <li className="flex gap-2">
            <code className="text-blue-400">getFairuThumbnailUrl(uuid, timestamp)</code>
            <span className="text-gray-400">→ Video-Frame</span>
          </li>
          <li className="flex gap-2">
            <code className="text-blue-400">createTrackFromFairu(fairuTrack)</code>
            <span className="text-gray-400">→ Audio Track</span>
          </li>
          <li className="flex gap-2">
            <code className="text-blue-400">createVideoTrackFromFairu(fairuTrack)</code>
            <span className="text-gray-400">→ Video Track</span>
          </li>
          <li className="flex gap-2">
            <code className="text-blue-400">createPlaylistFromFairu(tracks)</code>
            <span className="text-gray-400">→ Audio Playlist</span>
          </li>
          <li className="flex gap-2">
            <code className="text-blue-400">createVideoPlaylistFromFairu(tracks)</code>
            <span className="text-gray-400">→ Video Playlist</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export const FairuUrlUtilities: Story = {
  render: () => (
    <div style={{ maxWidth: '600px' }}>
      <FairuUrlUtilitiesDemo />
    </div>
  ),
};
