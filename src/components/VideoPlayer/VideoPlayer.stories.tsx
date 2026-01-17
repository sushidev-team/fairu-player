import type { Meta, StoryObj } from '@storybook/react';
import { useState, useCallback } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { VideoProvider, useVideoPlayer } from '@/context/VideoContext';
import { VideoAdProvider, useVideoAds } from '@/context/VideoAdContext';
import type { VideoTrack, VideoAdBreak, WatchProgress, CustomAdComponentProps } from '@/types/video';
import {
  createVideoTrackFromFairu,
  createVideoPlaylistFromFairu,
  getFairuVideoUrl,
  getFairuCoverUrl,
  getFairuHlsUrl,
  type FairuVideoTrack,
} from '@/utils/fairu';

const meta: Meta<typeof VideoPlayer> = {
  title: 'Components/VideoPlayer',
  component: VideoPlayer,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
  decorators: [
    (Story) => (
      <div className="fp-dark w-[800px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof VideoPlayer>;

// Sample video tracks - using free test videos
const sampleVideo: VideoTrack = {
  id: '1',
  src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  title: 'Big Buck Bunny',
  artist: 'Blender Foundation',
  poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
  duration: 596,
};

const sampleVideoWithQualities: VideoTrack = {
  ...sampleVideo,
  qualities: [
    { label: 'Auto', src: sampleVideo.src },
    { label: '1080p', src: sampleVideo.src, width: 1920, height: 1080 },
    { label: '720p', src: sampleVideo.src, width: 1280, height: 720 },
    { label: '480p', src: sampleVideo.src, width: 854, height: 480 },
  ],
};

const videoPlaylist: VideoTrack[] = [
  sampleVideo,
  {
    id: '2',
    src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    title: 'Elephants Dream',
    artist: 'Blender Foundation',
    poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
    duration: 653,
  },
  {
    id: '3',
    src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    title: 'Sintel',
    artist: 'Blender Foundation',
    poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg',
    duration: 888,
  },
];

// Sample video ad - using short test video
const samplePreRollAd: VideoAdBreak = {
  id: 'preroll-1',
  position: 'pre-roll',
  ads: [
    {
      id: 'ad-1',
      src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      duration: 15,
      skipAfterSeconds: 5,
      title: 'ForBiggerBlazes - Sample Ad',
      clickThroughUrl: 'https://example.com',
      trackingUrls: {
        impression: 'https://example.com/track/impression',
        start: 'https://example.com/track/start',
        firstQuartile: 'https://example.com/track/firstQuartile',
        midpoint: 'https://example.com/track/midpoint',
        thirdQuartile: 'https://example.com/track/thirdQuartile',
        complete: 'https://example.com/track/complete',
        skip: 'https://example.com/track/skip',
      },
    },
  ],
};

const sampleMidRollAd: VideoAdBreak = {
  id: 'midroll-1',
  position: 'mid-roll',
  triggerTime: 10, // Trigger at 10 seconds
  ads: [
    {
      id: 'mid-ad-1',
      src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      duration: 15,
      skipAfterSeconds: 3,
      title: 'Mid-Roll Ad',
      clickThroughUrl: 'https://example.com/midroll',
    },
  ],
};

/**
 * Default video player
 */
export const Default: Story = {
  args: {
    track: sampleVideo,
  },
};

/**
 * Video player with quality selector
 */
export const WithQualitySelector: Story = {
  args: {
    track: sampleVideoWithQualities,
    config: {
      features: {
        qualitySelector: true,
      },
    },
  },
};

/**
 * Video player with playlist
 */
export const WithPlaylist: Story = {
  args: {
    playlist: videoPlaylist,
  },
};

/**
 * Video player with playlist - Interactive demo showing track info
 */
function PlaylistDemo() {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  return (
    <div className="space-y-4">
      <VideoPlayer
        playlist={videoPlaylist}
        onTrackChange={(track, index) => {
          console.log('Track changed:', track.title, 'Index:', index);
          setCurrentTrackIndex(index);
        }}
      />

      {/* Playlist Info */}
      <div className="bg-gray-800 rounded-lg p-4 text-white">
        <h3 className="text-lg font-semibold mb-3">Playlist</h3>
        <div className="space-y-2">
          {videoPlaylist.map((track, index) => (
            <div
              key={track.id}
              className={`flex items-center gap-3 p-2 rounded ${
                index === currentTrackIndex ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <img
                src={track.poster}
                alt={track.title}
                className="w-12 h-8 object-cover rounded"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${index === currentTrackIndex ? 'text-white font-medium' : 'text-white/80'}`}>
                  {track.title}
                </p>
                <p className="text-xs text-white/50">{track.artist}</p>
              </div>
              {index === currentTrackIndex && (
                <span className="text-xs px-2 py-1 bg-blue-500 rounded">Playing</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const PlaylistInteractive: Story = {
  render: () => <PlaylistDemo />,
};

/**
 * Video player with pre-roll ad
 * Click play to see the ad first, then the main content
 */
export const WithPreRollAd: Story = {
  args: {
    track: sampleVideo,
    adConfig: {
      enabled: true,
      adBreaks: [samplePreRollAd],
      skipAllowed: true,
      defaultSkipAfter: 5,
      onAdStart: (ad) => console.log('Ad started:', ad.title),
      onAdComplete: (ad) => console.log('Ad completed:', ad.title),
      onAdSkip: (ad) => console.log('Ad skipped:', ad.title),
      onFirstQuartile: (ad) => console.log('Ad 25%:', ad.title),
      onMidpoint: (ad) => console.log('Ad 50%:', ad.title),
      onThirdQuartile: (ad) => console.log('Ad 75%:', ad.title),
    },
  },
};

/**
 * Interactive ad test with manual trigger button
 */
function AdTestComponent() {
  const { controls: adControls } = useVideoAds();

  return (
    <div className="mt-4 flex gap-2">
      <button
        onClick={() => adControls.startAdBreak(samplePreRollAd)}
        className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-400"
      >
        Play Pre-Roll Ad
      </button>
      <button
        onClick={() => adControls.startAdBreak(sampleMidRollAd)}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-400"
      >
        Play Mid-Roll Ad
      </button>
      <button
        onClick={() => adControls.stopAds()}
        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-400"
      >
        Stop Ads
      </button>
    </div>
  );
}

/**
 * Interactive ad testing - manually trigger ads
 */
export const AdTestInteractive: Story = {
  render: () => (
    <VideoProvider config={{ track: sampleVideo }}>
      <VideoAdProvider config={{ enabled: true, skipAllowed: true, defaultSkipAfter: 3 }}>
        <div>
          <VideoPlayerWithAdTest />
          <AdTestComponent />
        </div>
      </VideoAdProvider>
    </VideoProvider>
  ),
};

// Helper component for the interactive test
function VideoPlayerWithAdTest() {
  const { state, controls, videoRef, containerRef, currentTrack } = useVideoPlayer();
  const { state: adState, controls: adControls, adVideoRef } = useVideoAds();

  const isAdPlaying = adState?.isPlayingAd ?? false;

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className="fairu-video-player relative bg-black rounded-xl overflow-hidden aspect-video"
    >
      {/* Main Video */}
      <video
        ref={videoRef as React.RefObject<HTMLVideoElement>}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: isAdPlaying ? 'none' : 'block' }}
        preload="metadata"
        playsInline
        poster={currentTrack?.poster}
      />

      {/* Ad Video Element - IMPORTANT: must be rendered for ads to work */}
      <video
        ref={adVideoRef as React.RefObject<HTMLVideoElement>}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: isAdPlaying ? 'block' : 'none' }}
        playsInline
      />

      {/* Play button overlay when not playing */}
      {!state.isPlaying && !isAdPlaying && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
          onClick={() => controls.play()}
        >
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30">
            <svg viewBox="0 0 24 24" fill="white" className="w-10 h-10 ml-1">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Ad Overlay */}
      {isAdPlaying && adState && (
        <div className="absolute inset-0 z-40">
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded">AD</span>
                <span className="text-white text-sm">{adState.currentAd?.title}</span>
              </div>
              {adState.canSkip ? (
                <button
                  onClick={() => adControls.skipAd()}
                  className="px-4 py-2 bg-white text-black text-sm font-medium rounded"
                >
                  Skip Ad
                </button>
              ) : adState.skipCountdown > 0 ? (
                <span className="px-4 py-2 bg-white/20 text-white text-sm rounded">
                  Skip in {adState.skipCountdown}s
                </span>
              ) : null}
            </div>
            <div className="h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500"
                style={{ width: `${(adState.adProgress / adState.adDuration) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Video Controls */}
      {!isAdPlaying && state.isPlaying && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="h-1 bg-white/20 rounded-full overflow-hidden mb-2 cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = ((e.clientX - rect.left) / rect.width) * 100;
              controls.seekTo(percent);
            }}
          >
            <div
              className="h-full bg-white"
              style={{ width: `${(state.currentTime / state.duration) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => controls.toggle()} className="text-white">
              {state.isPlaying ? '⏸' : '▶'}
            </button>
            <span className="text-white text-sm">
              {Math.floor(state.currentTime)}s / {Math.floor(state.duration)}s
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Video player with autoplay
 */
export const AutoPlay: Story = {
  args: {
    track: sampleVideo,
    config: {
      autoPlay: true,
    },
  },
};

/**
 * Video player without fullscreen button
 */
export const NoFullscreen: Story = {
  args: {
    track: sampleVideo,
    config: {
      features: {
        fullscreen: false,
      },
    },
  },
};

/**
 * Minimal controls
 */
export const MinimalControls: Story = {
  args: {
    track: sampleVideo,
    config: {
      features: {
        skipButtons: false,
        playbackSpeed: false,
        qualitySelector: false,
        volumeControl: true,
        timeDisplay: true,
        progressBar: true,
        fullscreen: true,
      },
    },
  },
};

/**
 * Custom skip duration
 */
export const CustomSkipDuration: Story = {
  args: {
    track: sampleVideo,
    config: {
      skipForwardSeconds: 30,
      skipBackwardSeconds: 10,
    },
  },
};

// Non-skippable ad config
const nonSkippablePreRollAd: VideoAdBreak = {
  id: 'preroll-non-skip',
  position: 'pre-roll',
  ads: [
    {
      id: 'ad-non-skip-1',
      src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      duration: 15,
      skipAfterSeconds: null, // null means non-skippable
      title: 'Non-Skippable Ad',
      clickThroughUrl: 'https://example.com',
    },
  ],
};

/**
 * Video player with non-skippable pre-roll ad
 * The ad must be watched completely before the main video plays
 */
export const WithNonSkippableAd: Story = {
  args: {
    track: sampleVideo,
    adConfig: {
      enabled: true,
      adBreaks: [nonSkippablePreRollAd],
      skipAllowed: false, // Global setting to disable all skipping
      onAdStart: (ad) => console.log('Non-skippable ad started:', ad.title),
      onAdComplete: (ad) => console.log('Non-skippable ad completed:', ad.title),
    },
  },
};

/**
 * Video player with seeking disabled
 * Users cannot skip ahead or rewind using the progress bar or skip buttons
 */
export const SeekingDisabled: Story = {
  args: {
    track: sampleVideo,
    config: {
      features: {
        seekingDisabled: true,
      },
    },
  },
};

/**
 * Video player with watch progress tracking
 * Demonstrates onStart, onFinished, and watch progress tracking
 */
function WatchProgressDemo() {
  const [progress, setProgress] = useState<WatchProgress | null>(null);
  const [events, setEvents] = useState<string[]>([]);

  const addEvent = useCallback((event: string) => {
    setEvents((prev) => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${event}`]);
  }, []);

  return (
    <div className="space-y-4">
      <VideoPlayer
        track={sampleVideo}
        onStart={() => addEvent('🎬 Video started')}
        onPlay={() => addEvent('▶️ Playing')}
        onPause={() => addEvent('⏸️ Paused')}
        onEnded={() => addEvent('⏹️ Video ended')}
        onFinished={() => addEvent('✅ Video fully watched!')}
        onWatchProgressUpdate={(p) => {
          setProgress(p);
          if (p.isFullyWatched) {
            addEvent('🎉 Achieved 95%+ watch completion');
          }
        }}
      />

      {/* Watch Progress Display */}
      <div className="bg-gray-800 rounded-lg p-4 text-white">
        <h3 className="text-lg font-semibold mb-2">Watch Progress</h3>
        {progress && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Percentage Watched:</span>
              <span className="font-mono">{progress.percentageWatched.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Furthest Point:</span>
              <span className="font-mono">{progress.furthestPoint.toFixed(1)}s</span>
            </div>
            <div className="flex justify-between">
              <span>Fully Watched:</span>
              <span className={progress.isFullyWatched ? 'text-green-400' : 'text-yellow-400'}>
                {progress.isFullyWatched ? 'Yes ✓' : 'Not yet'}
              </span>
            </div>
            <div>
              <span>Watched Segments:</span>
              <div className="mt-1 font-mono text-xs">
                {progress.watchedSegments.map((seg, i) => (
                  <span key={i} className="mr-2">
                    [{seg.start.toFixed(1)}-{seg.end.toFixed(1)}s]
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Event Log */}
      <div className="bg-gray-800 rounded-lg p-4 text-white">
        <h3 className="text-lg font-semibold mb-2">Event Log</h3>
        <div className="space-y-1 text-sm font-mono">
          {events.length === 0 ? (
            <span className="text-gray-500">No events yet. Press play to start.</span>
          ) : (
            events.map((event, i) => <div key={i}>{event}</div>)
          )}
        </div>
      </div>
    </div>
  );
}

export const WatchProgressTracking: Story = {
  render: () => <WatchProgressDemo />,
};

/**
 * Complete example: Non-skippable ad + Seeking disabled + Watch tracking
 * This is typical for educational content or compliance videos
 */
function ComplianceVideoDemo() {
  const [progress, setProgress] = useState<WatchProgress | null>(null);
  const [completed, setCompleted] = useState(false);

  return (
    <div className="space-y-4">
      <div className="bg-blue-900/50 border border-blue-500 rounded-lg p-4 text-white">
        <h3 className="font-semibold">⚠️ Compliance Training Video</h3>
        <p className="text-sm mt-1">
          You must watch this video completely. Seeking is disabled and the ad cannot be skipped.
        </p>
      </div>

      <VideoPlayer
        track={{
          ...sampleVideo,
          title: 'Compliance Training Video',
        }}
        config={{
          features: {
            seekingDisabled: true,
          },
        }}
        adConfig={{
          enabled: true,
          adBreaks: [nonSkippablePreRollAd],
          skipAllowed: false,
        }}
        onFinished={() => setCompleted(true)}
        onWatchProgressUpdate={setProgress}
      />

      {/* Completion Status */}
      <div className={`rounded-lg p-4 ${completed ? 'bg-green-900/50 border-green-500' : 'bg-gray-800'} border`}>
        <div className="flex items-center justify-between text-white">
          <span className="font-semibold">
            {completed ? '✅ Training Complete!' : 'Training Progress'}
          </span>
          <span className="text-lg font-mono">
            {progress?.percentageWatched.toFixed(0) ?? 0}%
          </span>
        </div>
        {!completed && (
          <p className="text-sm text-gray-400 mt-1">
            Watch the entire video to complete the training.
          </p>
        )}
      </div>
    </div>
  );
}

export const ComplianceVideoExample: Story = {
  render: () => <ComplianceVideoDemo />,
};

// ============= HLS Streaming Stories =============

// Sample HLS test streams
const hlsTestStreams = {
  // Mux test stream - reliable HLS test source
  mux: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  // Apple Bip Bop - multi-bitrate test stream
  bipBop: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8',
  // Apple Advanced Stream (1080p)
  advanced: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
};

/**
 * HLS Stream playback
 * Tests automatic HLS detection and playback using hls.js
 */
export const HLSStream: Story = {
  args: {
    track: {
      id: 'hls-1',
      src: hlsTestStreams.mux,
      title: 'HLS Test Stream',
      artist: 'Mux Test',
    },
    config: {
      hls: {
        enabled: true,
        autoQuality: true,
      },
    },
  },
};

/**
 * HLS with quality selector
 * Shows automatic quality level extraction from HLS manifest
 */
export const HLSWithQuality: Story = {
  args: {
    track: {
      id: 'hls-quality',
      src: hlsTestStreams.bipBop,
      title: 'HLS Multi-Bitrate Stream',
      artist: 'Apple Test',
    },
    config: {
      features: {
        qualitySelector: true,
      },
      hls: {
        enabled: true,
        autoQuality: true,
        startLevel: -1, // -1 for auto
      },
    },
  },
};

/**
 * HLS with fixed starting quality
 * Starts playback at a specific quality level
 */
export const HLSFixedQuality: Story = {
  args: {
    track: {
      id: 'hls-fixed',
      src: hlsTestStreams.bipBop,
      title: 'HLS Fixed Quality',
      artist: 'Apple Test',
    },
    config: {
      features: {
        qualitySelector: true,
      },
      hls: {
        enabled: true,
        autoQuality: false,
        startLevel: 0, // Start at lowest quality
      },
    },
  },
};

/**
 * HLS Interactive Demo
 * Shows HLS state information including quality levels and auto-quality status
 */
function HLSDemo() {
  return (
    <div className="space-y-4">
      <VideoPlayer
        track={{
          id: 'hls-demo',
          src: hlsTestStreams.advanced,
          title: 'HLS Advanced Stream (1080p)',
          artist: 'Apple Test',
        }}
        config={{
          features: {
            qualitySelector: true,
          },
          hls: {
            enabled: true,
            autoQuality: true,
          },
        }}
        onTimeUpdate={() => {
          // This is just to trigger a re-render to show updated state
        }}
      />

      {/* HLS Info Panel */}
      <div className="bg-gray-800 rounded-lg p-4 text-white">
        <h3 className="text-lg font-semibold mb-3">HLS Stream Info</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Stream Type:</span>
            <span className="ml-2 font-mono">HLS (.m3u8)</span>
          </div>
          <div>
            <span className="text-gray-400">Library:</span>
            <span className="ml-2 font-mono">hls.js</span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-400">Test URL:</span>
            <span className="ml-2 font-mono text-xs break-all">{hlsTestStreams.advanced}</span>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-400">
          Quality levels are automatically extracted from the HLS manifest.
          Use the quality selector in the player controls to switch between levels.
        </p>
      </div>
    </div>
  );
}

export const HLSInteractive: Story = {
  render: () => <HLSDemo />,
};

// ============= Component Ad Stories =============

/**
 * Custom React component for an interactive ad
 */
function CustomAdComponent({ onComplete, onSkip, canSkip, skipCountdown, duration, progress, ad }: CustomAdComponentProps) {
  const progressPercent = (progress / duration) * 100;

  return (
    <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-indigo-900 flex flex-col items-center justify-center text-white p-8">
      {/* Ad Badge */}
      <span className="absolute top-4 left-4 px-3 py-1 bg-yellow-500 text-black text-xs font-bold rounded">
        INTERACTIVE AD
      </span>

      {/* Main Content */}
      <div className="text-center max-w-md">
        <h2 className="text-3xl font-bold mb-4">{ad.title || 'Special Offer!'}</h2>
        <p className="text-lg text-white/80 mb-6">
          This is a custom React component ad. It can contain any interactive content you want!
        </p>

        {/* Interactive Buttons */}
        <div className="flex gap-4 justify-center mb-8">
          <button
            onClick={() => window.open('https://example.com', '_blank')}
            className="px-6 py-3 bg-white text-purple-900 font-bold rounded-lg hover:bg-white/90 transition-colors"
          >
            Learn More
          </button>
          <button
            onClick={() => console.log('Sign up clicked')}
            className="px-6 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-500 transition-colors border-2 border-white/30"
          >
            Sign Up Free
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="w-full max-w-sm mx-auto">
          <div className="flex justify-between text-sm text-white/60 mb-1">
            <span>Ad Progress</span>
            <span>{Math.ceil(duration - progress)}s remaining</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Skip/Complete Button */}
      <div className="absolute bottom-4 right-4">
        {canSkip ? (
          <button
            onClick={onSkip}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:bg-white/90 transition-colors"
          >
            Skip Ad
          </button>
        ) : skipCountdown > 0 ? (
          <span className="px-4 py-2 bg-white/20 text-white text-sm rounded">
            Skip in {skipCountdown}s
          </span>
        ) : (
          <button
            onClick={onComplete}
            className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded hover:bg-green-400 transition-colors"
          >
            Continue to Video
          </button>
        )}
      </div>
    </div>
  );
}

// Component ad break configuration
const componentAdBreak: VideoAdBreak = {
  id: 'component-preroll-1',
  position: 'pre-roll',
  ads: [
    {
      id: 'component-ad-1',
      src: '', // No video source needed for component ads
      duration: 10,
      skipAfterSeconds: 5,
      title: 'Interactive Component Ad',
      component: CustomAdComponent,
    },
  ],
};

/**
 * Video player with a custom React component ad
 * The ad renders an interactive React component instead of a video
 */
export const WithComponentAd: Story = {
  args: {
    track: sampleVideo,
    adConfig: {
      enabled: true,
      adBreaks: [componentAdBreak],
      skipAllowed: true,
      defaultSkipAfter: 5,
      onAdStart: (ad) => console.log('Component ad started:', ad.title),
      onAdComplete: (ad) => console.log('Component ad completed:', ad.title),
      onAdSkip: (ad) => console.log('Component ad skipped:', ad.title),
    },
  },
};

/**
 * Interactive component ad demo with non-skippable behavior
 */
const nonSkippableComponentAdBreak: VideoAdBreak = {
  id: 'component-preroll-non-skip',
  position: 'pre-roll',
  ads: [
    {
      id: 'component-ad-non-skip',
      src: '',
      duration: 8,
      skipAfterSeconds: null, // Non-skippable
      title: 'Important Announcement',
      component: CustomAdComponent,
    },
  ],
};

export const WithNonSkippableComponentAd: Story = {
  args: {
    track: sampleVideo,
    adConfig: {
      enabled: true,
      adBreaks: [nonSkippableComponentAdBreak],
      skipAllowed: false,
      onAdStart: (ad) => console.log('Non-skippable component ad started:', ad.title),
      onAdComplete: (ad) => console.log('Non-skippable component ad completed:', ad.title),
    },
  },
};

/**
 * Mixed ads: Video ad followed by component ad
 */
const mixedAdBreak: VideoAdBreak = {
  id: 'mixed-preroll',
  position: 'pre-roll',
  ads: [
    {
      id: 'video-ad-1',
      src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      duration: 15,
      skipAfterSeconds: 5,
      title: 'Video Ad',
    },
    {
      id: 'component-ad-2',
      src: '',
      duration: 8,
      skipAfterSeconds: 3,
      title: 'Interactive Follow-up',
      component: CustomAdComponent,
    },
  ],
};

export const WithMixedAds: Story = {
  args: {
    track: sampleVideo,
    adConfig: {
      enabled: true,
      adBreaks: [mixedAdBreak],
      skipAllowed: true,
      defaultSkipAfter: 5,
      onAdStart: (ad) => console.log('Ad started:', ad.title, ad.component ? '(component)' : '(video)'),
      onAdComplete: (ad) => console.log('Ad completed:', ad.title),
    },
  },
};

// ============= Fairu.app Video Hosting Stories =============

/**
 * Fairu.app Video Hosting Demo
 * Shows how to use fairu.app as video hosting with just a UUID
 */
function FairuVideoDemo() {
  const exampleUuid = '550e8400-e29b-41d4-a716-446655440000';

  // Show generated URLs
  const videoUrl = getFairuVideoUrl(exampleUuid, { version: 'high' });
  const posterUrl = getFairuCoverUrl(exampleUuid, { width: 1280, height: 720 });
  const hlsUrl = getFairuHlsUrl(exampleUuid, 'my-tenant');

  // For demo, use real video
  const demoTrack: VideoTrack = {
    id: exampleUuid,
    src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    title: 'Big Buck Bunny (Demo)',
    poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
  };

  return (
    <div className="space-y-6">
      {/* Info Panel */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-lg p-4 text-white text-sm border border-purple-500">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-1 bg-purple-500 text-xs font-bold rounded">FAIRU.APP</span>
          <h3 className="text-lg font-semibold">Video Hosting</h3>
        </div>
        <p className="text-purple-200 mb-4">
          Video-Hosting mit fairu.app - nur UUID benötigt, unterstützt verschiedene Qualitätsstufen.
        </p>
        <div className="space-y-2 font-mono text-xs bg-black/30 rounded p-3">
          <div>
            <span className="text-purple-300">UUID: </span>
            <span className="text-blue-400">{exampleUuid}</span>
          </div>
          <div>
            <span className="text-purple-300">Video (high): </span>
            <span className="text-green-400 break-all">{videoUrl}</span>
          </div>
          <div>
            <span className="text-purple-300">Poster: </span>
            <span className="text-green-400 break-all">{posterUrl}</span>
          </div>
          <div>
            <span className="text-purple-300">HLS: </span>
            <span className="text-green-400 break-all">{hlsUrl}</span>
          </div>
        </div>
      </div>

      {/* Working Player Demo */}
      <VideoPlayer track={demoTrack} />

      {/* Code Example */}
      <div className="bg-gray-900 rounded-lg p-4 text-white text-sm">
        <h4 className="text-sm font-semibold mb-2 text-gray-400">Code:</h4>
        <pre className="text-xs overflow-x-auto text-green-300">
{`import { VideoPlayer, createVideoTrackFromFairu } from '@fairu/player';

const track = createVideoTrackFromFairu({
  uuid: '${exampleUuid}',
  title: 'Mein Video',
  version: 'high', // 'low' | 'medium' | 'high'
});

<VideoPlayer track={track} />`}
        </pre>
      </div>
    </div>
  );
}

export const FairuVideoHosting: Story = {
  render: () => <FairuVideoDemo />,
};

/**
 * Fairu Video Playlist Demo
 */
function FairuVideoPlaylistDemo() {
  const fairuTracks: FairuVideoTrack[] = [
    { uuid: 'video-uuid-1', title: 'Kapitel 1: Einführung', version: 'high' },
    { uuid: 'video-uuid-2', title: 'Kapitel 2: Grundlagen', version: 'high' },
    { uuid: 'video-uuid-3', title: 'Kapitel 3: Fortgeschritten', version: 'high' },
  ];

  // Show generated playlist
  const generatedPlaylist = createVideoPlaylistFromFairu(fairuTracks);

  // Demo with real videos
  const demoPlaylist: VideoTrack[] = [
    {
      id: 'video-uuid-1',
      src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      title: 'Kapitel 1: Einführung',
      poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
    },
    {
      id: 'video-uuid-2',
      src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      title: 'Kapitel 2: Grundlagen',
      poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
    },
    {
      id: 'video-uuid-3',
      src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      title: 'Kapitel 3: Fortgeschritten',
      poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Info Panel */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-lg p-4 text-white text-sm border border-purple-500">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-1 bg-purple-500 text-xs font-bold rounded">FAIRU.APP</span>
          <h3 className="text-lg font-semibold">Video Playlist</h3>
        </div>
        <pre className="text-xs overflow-x-auto bg-black/30 rounded p-3 text-green-300">
{`import { createVideoPlaylistFromFairu } from '@fairu/player';

const playlist = createVideoPlaylistFromFairu([
  { uuid: 'video-1', title: 'Kapitel 1', version: 'high' },
  { uuid: 'video-2', title: 'Kapitel 2', version: 'high' },
  { uuid: 'video-3', title: 'Kapitel 3', version: 'high' },
]);`}
        </pre>
      </div>

      {/* Working Player Demo */}
      <VideoPlayer playlist={demoPlaylist} />

      {/* Generated Structure */}
      <div className="bg-gray-900 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-2 text-gray-400">Generierte Playlist-Struktur:</h4>
        <pre className="text-xs text-gray-300 overflow-x-auto max-h-40">
          {JSON.stringify(generatedPlaylist, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export const FairuVideoPlaylist: Story = {
  render: () => <FairuVideoPlaylistDemo />,
};

/**
 * Fairu HLS Streaming Demo
 */
function FairuHlsDemo() {
  const uuid = '550e8400-e29b-41d4-a716-446655440000';
  const tenant = 'my-tenant';
  const hlsUrl = getFairuHlsUrl(uuid, tenant);

  return (
    <div className="space-y-6">
      {/* Info Panel */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-lg p-4 text-white text-sm border border-purple-500">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-1 bg-purple-500 text-xs font-bold rounded">FAIRU.APP</span>
          <span className="px-2 py-1 bg-green-500 text-xs font-bold rounded">HLS</span>
          <h3 className="text-lg font-semibold">Adaptive Streaming</h3>
        </div>
        <p className="text-purple-200 mb-4">
          HLS-Streaming mit automatischer Qualitätsanpassung basierend auf Bandbreite.
        </p>
        <div className="font-mono text-xs bg-black/30 rounded p-3">
          <div className="mb-2">
            <span className="text-purple-300">HLS URL: </span>
            <span className="text-green-400 break-all">{hlsUrl}</span>
          </div>
          <div className="text-gray-400 text-xs">
            Format: /hls/{'{tenant}'}/{'{uuid}'}/master.m3u8
          </div>
        </div>
      </div>

      {/* Demo with real HLS stream */}
      <VideoPlayer
        track={{
          id: uuid,
          src: hlsTestStreams.bipBop,
          title: 'HLS Demo Stream',
        }}
        config={{
          features: { qualitySelector: true },
          hls: { enabled: true, autoQuality: true },
        }}
      />

      {/* Code Example */}
      <div className="bg-gray-900 rounded-lg p-4 text-white text-sm">
        <h4 className="text-sm font-semibold mb-2 text-gray-400">Code:</h4>
        <pre className="text-xs overflow-x-auto text-green-300">
{`import { VideoPlayer, getFairuHlsUrl } from '@fairu/player';

const hlsUrl = getFairuHlsUrl('${uuid}', '${tenant}');
// → ${hlsUrl}

<VideoPlayer
  track={{ id: '${uuid}', src: hlsUrl, title: 'Mein Video' }}
  config={{
    features: { qualitySelector: true },
    hls: { enabled: true, autoQuality: true },
  }}
/>`}
        </pre>
      </div>
    </div>
  );
}

export const FairuHlsStreaming: Story = {
  render: () => <FairuHlsDemo />,
};

// ============= Logo Overlay Stories =============

/**
 * Video player with simple logo
 * Shows a logo in the bottom-right corner (default position)
 */
export const WithLogo: Story = {
  args: {
    track: sampleVideo,
    config: {
      logo: {
        src: 'https://fairu.app/images/logo.png',
        alt: 'Sample Logo',
        opacity: 0.8,
      },
    },
  },
};

/**
 * Video player with logo in different positions
 */
export const LogoPositions: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <p className="text-white text-sm mb-2">Top-Left</p>
        <VideoPlayer
          track={sampleVideo}
          config={{
            logo: {
              src: 'https://fairu.app/images/logo.png',
              alt: 'Logo',
              position: 'top-left',
            },
          }}
        />
      </div>
      <div>
        <p className="text-white text-sm mb-2">Top-Right</p>
        <VideoPlayer
          track={sampleVideo}
          config={{
            logo: {
              src: 'https://fairu.app/images/logo.png',
              alt: 'Logo',
              position: 'top-right',
            },
          }}
        />
      </div>
    </div>
  ),
};

/**
 * Video player with clickable logo
 */
export const LogoWithLink: Story = {
  args: {
    track: sampleVideo,
    config: {
      logo: {
        src: 'https://fairu.app/images/logo.png',
        alt: 'Click to visit website',
        href: 'https://example.com',
        target: '_blank',
        position: 'top-right',
      },
    },
  },
};

/**
 * Video player with logo that hides with controls
 */
export const LogoHidesWithControls: Story = {
  args: {
    track: sampleVideo,
    config: {
      logo: {
        src: 'https://fairu.app/images/logo.png',
        alt: 'Watermark',
        hideWithControls: true,
        position: 'bottom-right',
        animation: { type: 'fade', duration: 300 },
      },
    },
  },
};

/**
 * Video player with logo animations
 */
function LogoAnimationsDemo() {
  const logoSrc = 'https://fairu.app/images/logo.png';

  return (
    <div className="space-y-8">
      <div className="bg-blue-900/50 border border-blue-500 rounded-lg p-4 text-white text-sm">
        <h3 className="font-semibold mb-2">Logo Animation Types</h3>
        <p className="text-gray-300">
          Starte das Video und warte bis die Controls verschwinden, um die verschiedenen Animationen zu sehen.
          Das Logo wird mit den Controls ein-/ausgeblendet.
        </p>
      </div>

      <div>
        <p className="text-white text-sm mb-2 font-medium">Fade Animation (sanftes Ein-/Ausblenden)</p>
        <VideoPlayer
          track={sampleVideo}
          config={{
            logo: {
              src: logoSrc,
              alt: 'Logo',
              hideWithControls: true,
              position: 'bottom-right',
              animation: { type: 'fade', duration: 400 },
            },
          }}
        />
      </div>

      <div>
        <p className="text-white text-sm mb-2 font-medium">Scale Animation (Zoom-Effekt)</p>
        <VideoPlayer
          track={sampleVideo}
          config={{
            logo: {
              src: logoSrc,
              alt: 'Logo',
              hideWithControls: true,
              position: 'top-right',
              animation: { type: 'scale', duration: 400 },
            },
          }}
        />
      </div>

      <div>
        <p className="text-white text-sm mb-2 font-medium">Slide Animation (seitliches Hereinfahren)</p>
        <VideoPlayer
          track={sampleVideo}
          config={{
            logo: {
              src: logoSrc,
              alt: 'Logo',
              hideWithControls: true,
              position: 'top-left',
              animation: { type: 'slide', duration: 400 },
            },
          }}
        />
      </div>
    </div>
  );
}

export const LogoAnimations: Story = {
  render: () => <LogoAnimationsDemo />,
};

/**
 * Video player with custom React component as logo
 */
function AnimatedLogoComponent({ visible, isPlaying }: { visible: boolean; isPlaying: boolean; isFullscreen: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg transition-all duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className={`w-3 h-3 rounded-full ${isPlaying ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
      <span className="text-white text-sm font-bold">LIVE</span>
    </div>
  );
}

export const LogoWithComponent: Story = {
  args: {
    track: sampleVideo,
    config: {
      logo: {
        component: AnimatedLogoComponent,
        position: 'top-left',
        hideWithControls: false,
      },
    },
  },
};

/**
 * Interactive logo demo showing all options
 */
function LogoInteractiveDemo() {
  const [position, setPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('bottom-right');
  const [animationType, setAnimationType] = useState<'none' | 'fade' | 'slide' | 'scale'>('fade');
  const [hideWithControls, setHideWithControls] = useState(true);
  const [opacity, setOpacity] = useState(0.9);
  const [margin, setMargin] = useState(16);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  return (
    <div className="space-y-6">
      {/* Info Panel */}
      <div className="bg-blue-900/50 border border-blue-500 rounded-lg p-4 text-white text-sm">
        <p>
          <strong>Tipp:</strong> Aktiviere &quot;Hide with controls&quot; und starte das Video, um die Animationen zu sehen.
          Das Logo wird ein-/ausgeblendet wenn die Controls erscheinen/verschwinden.
        </p>
      </div>

      {/* Controls Panel */}
      <div className="bg-gray-800 rounded-lg p-4 text-white">
        <h3 className="text-lg font-semibold mb-4">Logo Configuration</h3>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Position</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as typeof position)}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
            >
              <option value="top-left">Top Left</option>
              <option value="top-right">Top Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="bottom-right">Bottom Right</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Animation</label>
            <select
              value={animationType}
              onChange={(e) => setAnimationType(e.target.value as typeof animationType)}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
            >
              <option value="none">None</option>
              <option value="fade">Fade</option>
              <option value="slide">Slide</option>
              <option value="scale">Scale</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="hideWithControls"
              checked={hideWithControls}
              onChange={(e) => setHideWithControls(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="hideWithControls" className="text-sm text-gray-400">
              Hide with controls
            </label>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Opacity: {opacity}</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Margin: {margin}px</label>
            <input
              type="range"
              min="0"
              max="50"
              step="4"
              value={margin}
              onChange={(e) => setMargin(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Offset X: {offsetX}px</label>
            <input
              type="range"
              min="-50"
              max="50"
              step="5"
              value={offsetX}
              onChange={(e) => setOffsetX(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Offset Y: {offsetY}px</label>
            <input
              type="range"
              min="-50"
              max="50"
              step="5"
              value={offsetY}
              onChange={(e) => setOffsetY(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Player */}
      <VideoPlayer
        track={sampleVideo}
        config={{
          logo: {
            src: 'https://fairu.app/images/logo.png',
            alt: 'Demo Logo',
            position,
            opacity,
            margin,
            offsetX,
            offsetY,
            hideWithControls,
            animation: { type: animationType, duration: 400 },
          },
        }}
      />

      {/* Code Preview */}
      <div className="bg-gray-900 rounded-lg p-4 text-white text-sm">
        <h4 className="text-sm font-semibold mb-2 text-gray-400">Configuration:</h4>
        <pre className="text-xs overflow-x-auto text-green-300">
{`logo: {
  src: '/logo.png',
  alt: 'Logo',
  position: '${position}',
  opacity: ${opacity},
  margin: ${margin},
  offsetX: ${offsetX},
  offsetY: ${offsetY},
  hideWithControls: ${hideWithControls},
  animation: { type: '${animationType}', duration: 400 },
}`}
        </pre>
      </div>
    </div>
  );
}

export const LogoInteractive: Story = {
  render: () => <LogoInteractiveDemo />,
};
