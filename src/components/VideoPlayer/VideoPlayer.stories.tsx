import type { Meta, StoryObj } from '@storybook/react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { VideoPlayer, type VideoPlayerRef } from './VideoPlayer';
import { VideoProvider, useVideoPlayer } from '@/context/VideoContext';
import { VideoAdProvider, useVideoAds } from '@/context/VideoAdContext';
import { createAdEventBus } from '@/utils/AdEventBus';
import { createPlayerEventBus } from '@/utils/PlayerEventBus';
import type { OverlayAd as OverlayAdTypeForPiP } from '@/types/video';
import type {
  VideoTrack,
  VideoAdBreak,
  WatchProgress,
  CustomAdComponentProps,
  EndScreenConfig,
  RecommendedVideo,
  OverlayAd as OverlayAdType,
  InfoCard as InfoCardType,
} from '@/types/video';
import {
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
      onAdStart: (ad) => console.log('Ad started:', ad.title, 'component' in ad ? '(component)' : '(video)'),
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

// ============= End Screen Stories =============

const recommendedVideos: RecommendedVideo[] = [
  {
    id: 'rec-1',
    title: 'Introduction to TypeScript - Complete Guide 2024',
    thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
    duration: 1245,
    views: '1.2M views',
    channel: 'Code Academy',
    channelAvatar: 'https://placehold.co/32x32/2d5a27/ffffff?text=CA',
    src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
  {
    id: 'rec-2',
    title: 'React Best Practices You Need to Know',
    thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
    duration: 845,
    views: '856K views',
    channel: 'Frontend Masters',
    channelAvatar: 'https://placehold.co/32x32/5a272d/ffffff?text=FM',
    src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  },
  {
    id: 'rec-3',
    title: 'Building a Video Player from Scratch',
    thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg',
    duration: 2100,
    views: '432K views',
    channel: 'Dev Tutorials',
    channelAvatar: 'https://placehold.co/32x32/1a1a2e/ffffff?text=DT',
    src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  },
  {
    id: 'rec-4',
    title: 'CSS Grid Layout - Master Guide',
    thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
    duration: 1560,
    views: '678K views',
    channel: 'CSS Wizards',
  },
  {
    id: 'rec-5',
    title: 'Node.js Performance Optimization',
    thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg',
    duration: 1890,
    views: '234K views',
    channel: 'Backend Pro',
  },
  {
    id: 'rec-6',
    title: 'Database Design Fundamentals',
    thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerFun.jpg',
    duration: 2400,
    views: '567K views',
    channel: 'Data School',
  },
];

/**
 * Video player with End Screen
 * Watch the video to the end or skip to see the end screen with recommendations
 */
export const WithEndScreen: Story = {
  args: {
    track: {
      id: 'short-video',
      src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      title: 'Short Demo Video',
      poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
      duration: 15,
    },
    config: {
      endScreen: {
        enabled: true,
        showAt: 5, // Show 5 seconds before end
        recommendations: recommendedVideos,
        layout: 'grid',
        columns: 3,
        autoPlayNext: false,
        showReplay: true,
        title: 'Recommended Videos',
      },
    },
  },
};

/**
 * End Screen with Auto-Play
 * The next video will automatically start after a countdown
 */
export const EndScreenWithAutoPlay: Story = {
  args: {
    track: {
      id: 'short-video-autoplay',
      src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      title: 'Short Demo Video',
      poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
      duration: 15,
    },
    config: {
      endScreen: {
        enabled: true,
        showAt: 5,
        recommendations: recommendedVideos,
        layout: 'grid',
        columns: 3,
        autoPlayNext: true,
        autoPlayDelay: 5,
        showReplay: true,
        title: 'Up Next',
      },
    },
  },
};

/**
 * End Screen with Carousel Layout
 */
export const EndScreenCarousel: Story = {
  args: {
    track: {
      id: 'short-video-carousel',
      src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      title: 'Short Demo Video',
      poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
      duration: 15,
    },
    config: {
      endScreen: {
        enabled: true,
        showAt: 5,
        recommendations: recommendedVideos,
        layout: 'carousel',
        autoPlayNext: false,
        showReplay: true,
        title: 'More Videos',
      },
    },
  },
};

/**
 * Interactive End Screen Demo
 * Full control over end screen features with event logging
 */
function EndScreenInteractiveDemo() {
  const [events, setEvents] = useState<string[]>([]);
  const [currentVideo, setCurrentVideo] = useState<VideoTrack>({
    id: 'demo-video',
    src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    title: 'Demo Video',
    poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
  });

  const addEvent = useCallback((event: string) => {
    setEvents((prev) => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${event}`]);
  }, []);

  const handleVideoSelect = useCallback((video: RecommendedVideo) => {
    addEvent(`Selected: ${video.title}`);
    if (video.src) {
      setCurrentVideo({
        id: video.id,
        src: video.src,
        title: video.title,
        poster: video.thumbnail,
      });
      addEvent(`Now playing: ${video.title}`);
    }
  }, [addEvent]);

  const endScreenConfig: EndScreenConfig = {
    enabled: true,
    showAt: 5,
    recommendations: recommendedVideos,
    layout: 'grid',
    columns: 3,
    autoPlayNext: true,
    autoPlayDelay: 8,
    showReplay: true,
    title: 'Recommended Videos',
    onVideoSelect: handleVideoSelect,
  };

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-blue-900/50 border border-blue-500 rounded-lg p-4 text-white text-sm">
        <h3 className="font-semibold mb-2">End Screen Demo</h3>
        <p className="text-blue-200">
          Spiele das Video ab und warte bis zum Ende (oder skippe vorwärts). Der End Screen erscheint 5 Sekunden vor Ende.
          Klicke auf ein Video um es abzuspielen, oder nutze den Replay-Button.
        </p>
      </div>

      {/* Video Player */}
      <VideoPlayer
        key={currentVideo.id}
        track={currentVideo}
        config={{ endScreen: endScreenConfig }}
        onEnded={() => addEvent('Video ended')}
        onPlay={() => addEvent('Playing')}
      />

      {/* Event Log */}
      <div className="bg-gray-800 rounded-lg p-4 text-white">
        <h3 className="text-lg font-semibold mb-2">Event Log</h3>
        <div className="space-y-1 text-sm font-mono max-h-32 overflow-y-auto">
          {events.length === 0 ? (
            <span className="text-gray-500">Noch keine Events. Starte das Video...</span>
          ) : (
            events.map((event, i) => <div key={i}>{event}</div>)
          )}
        </div>
      </div>

      {/* Current Video Info */}
      <div className="bg-gray-800 rounded-lg p-4 text-white">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Now Playing:</h3>
        <p className="font-medium">{currentVideo.title}</p>
      </div>
    </div>
  );
}

export const EndScreenInteractive: Story = {
  render: () => <EndScreenInteractiveDemo />,
};

// ============= Overlay Ad & Info Card Stories =============

/**
 * Video player with Overlay Ads (Banner Ads)
 * Overlay ads appear during video playback as banners
 */
export const WithOverlayAds: Story = {
  args: {
    track: sampleVideo,
    config: {
      overlayAds: [
        {
          id: 'overlay-1',
          imageUrl: 'https://placehold.co/600x80/1a1a2e/ffffff?text=Special+Offer+-+50%25+Off+Today+Only!',
          clickThroughUrl: 'https://example.com/promo',
          displayAt: 5,
          duration: 10,
          position: 'bottom',
          closeable: true,
          altText: '50% off promotion',
        },
        {
          id: 'overlay-2',
          imageUrl: 'https://placehold.co/600x80/2d5a27/ffffff?text=Subscribe+to+Our+Newsletter',
          clickThroughUrl: 'https://example.com/subscribe',
          displayAt: 20,
          duration: 8,
          position: 'bottom',
          closeable: true,
        },
      ],
    },
  },
};

/**
 * Video player with Info Cards (Sponsored Cards)
 * Info cards appear as clickable cards with product/video info
 */
export const WithInfoCards: Story = {
  args: {
    track: sampleVideo,
    config: {
      infoCards: [
        {
          id: 'card-1',
          type: 'product',
          title: 'Wireless Headphones Pro',
          description: 'Premium noise-cancelling headphones featured in this video.',
          thumbnail: 'https://placehold.co/300x200/1a1a2e/ffffff?text=Headphones',
          url: 'https://example.com/product',
          displayAt: 5,
          duration: 20,
          price: '$299.99',
          position: 'top-right',
        },
        {
          id: 'card-2',
          type: 'video',
          title: 'Watch the Full Tutorial',
          description: 'Extended version with bonus content.',
          thumbnail: 'https://placehold.co/300x200/2d5a27/ffffff?text=Tutorial',
          url: 'https://example.com/tutorial',
          displayAt: 30,
          duration: 15,
          position: 'top-right',
        },
      ],
    },
  },
};

/**
 * Interactive demo with all new ad features
 */
function AllAdFeaturesDemo() {
  const [events, setEvents] = useState<string[]>([]);

  const addEvent = useCallback((event: string) => {
    setEvents((prev) => [...prev.slice(-14), `${new Date().toLocaleTimeString()}: ${event}`]);
  }, []);

  const overlayAds: OverlayAdType[] = [
    {
      id: 'overlay-1',
      imageUrl: 'https://placehold.co/600x80/8b5cf6/ffffff?text=Premium+Subscription+-+Start+Free+Trial',
      clickThroughUrl: 'https://example.com/premium',
      displayAt: 3,
      duration: 8,
      position: 'bottom',
      closeable: true,
    },
  ];

  const infoCards: InfoCardType[] = [
    {
      id: 'card-1',
      type: 'product',
      title: 'Featured Product',
      description: 'Check out this amazing product!',
      thumbnail: 'https://placehold.co/300x200/1a1a2e/ffffff?text=Product',
      url: 'https://example.com',
      displayAt: 5,
      duration: 20,
      price: '$49.99',
      position: 'top-right',
    },
  ];

  const endScreenConfig: EndScreenConfig = {
    enabled: true,
    showAt: 5,
    recommendations: recommendedVideos.slice(0, 6),
    layout: 'grid',
    columns: 3,
    autoPlayNext: true,
    autoPlayDelay: 8,
    showReplay: true,
    title: 'Recommended',
    onVideoSelect: (video) => addEvent(`End screen: Selected "${video.title}"`),
  };

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 border border-purple-500 rounded-lg p-4 text-white text-sm">
        <h3 className="font-semibold mb-2">Alle neuen Ad-Features Demo</h3>
        <ul className="text-purple-200 space-y-1 text-xs">
          <li>• <strong>Overlay Ad:</strong> Banner erscheint bei 3s (8s Dauer)</li>
          <li>• <strong>Info Card:</strong> Produkt-Karte erscheint bei 5s (klicke auf das "i" Icon)</li>
          <li>• <strong>End Screen:</strong> Erscheint 5s vor Video-Ende mit Auto-Play</li>
        </ul>
      </div>

      {/* Video Player mit allen Features */}
      <VideoPlayer
        track={{
          id: 'demo-all-features',
          src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          title: 'Demo Video mit allen Features',
          poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
        }}
        config={{
          overlayAds,
          infoCards,
          endScreen: endScreenConfig,
        }}
        onPlay={() => addEvent('Video playing')}
        onEnded={() => addEvent('Video ended')}
      />

      {/* Event Log */}
      <div className="bg-gray-800 rounded-lg p-4 text-white">
        <h3 className="text-lg font-semibold mb-2">Event Log</h3>
        <div className="space-y-1 text-sm font-mono max-h-40 overflow-y-auto">
          {events.length === 0 ? (
            <span className="text-gray-500">Starte das Video um Events zu sehen...</span>
          ) : (
            events.map((event, i) => <div key={i}>{event}</div>)
          )}
        </div>
      </div>
    </div>
  );
}

export const AllAdFeatures: Story = {
  render: () => <AllAdFeaturesDemo />,
};

// ============= Bumper Ad Story =============

/**
 * Video player with Bumper Ad (6s non-skippable)
 * Bumper ads are short, non-skippable ads ideal for brand awareness
 */
const bumperAdBreak: VideoAdBreak = {
  id: 'bumper-preroll',
  position: 'pre-roll',
  ads: [
    {
      id: 'bumper-1',
      src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      duration: 6,
      type: 'bumper', // Bumper ads are always 6s and non-skippable
      title: 'Bumper Ad',
      clickThroughUrl: 'https://example.com',
    },
  ],
};

export const WithBumperAd: Story = {
  args: {
    track: sampleVideo,
    adConfig: {
      enabled: true,
      adBreaks: [bumperAdBreak],
      onBumperStart: (ad) => console.log('Bumper ad started:', ad.title),
      onBumperComplete: (ad) => console.log('Bumper ad completed:', ad.title),
    },
  },
};

// ============= Dynamic Ad Triggering Story =============

/**
 * Dynamic Ad Triggering Demo
 * Shows how to programmatically trigger overlay ads and info cards using the player ref
 */
function DynamicAdTriggeringDemo() {
  const playerRef = useRef<VideoPlayerRef>(null);
  const [events, setEvents] = useState<string[]>([]);

  const addEvent = useCallback((event: string) => {
    setEvents((prev) => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${event}`]);
  }, []);

  // Sample overlay ads for dynamic triggering
  const sampleOverlayAds: OverlayAdType[] = [
    {
      id: 'dynamic-overlay-1',
      imageUrl: 'https://placehold.co/600x80/4f46e5/ffffff?text=Dynamic+Overlay+Ad+1',
      clickThroughUrl: 'https://example.com/ad1',
      displayAt: 0, // Ignored for manual triggering
      duration: 10,
      position: 'bottom',
      closeable: true,
      altText: 'Dynamic Ad 1',
    },
    {
      id: 'dynamic-overlay-2',
      imageUrl: 'https://placehold.co/600x80/10b981/ffffff?text=Dynamic+Overlay+Ad+2',
      clickThroughUrl: 'https://example.com/ad2',
      displayAt: 0,
      duration: 10,
      position: 'top',
      closeable: true,
      altText: 'Dynamic Ad 2',
    },
  ];

  // Sample info cards for dynamic triggering
  const sampleInfoCards: InfoCardType[] = [
    {
      id: 'dynamic-card-1',
      type: 'product',
      title: 'Featured Product',
      description: 'Dynamically triggered product card!',
      thumbnail: 'https://placehold.co/300x200/f59e0b/ffffff?text=Product',
      url: 'https://example.com/product',
      displayAt: 0,
      price: '$99.99',
      position: 'top-right',
    },
    {
      id: 'dynamic-card-2',
      type: 'video',
      title: 'Related Video',
      description: 'Watch this related content',
      thumbnail: 'https://placehold.co/300x200/ec4899/ffffff?text=Video',
      url: 'https://example.com/video',
      displayAt: 0,
      position: 'top-right',
    },
  ];

  // Button handlers
  const showOverlayAd = (index: number) => {
    const ad = sampleOverlayAds[index];
    playerRef.current?.overlayAdControls.showOverlayAd(ad);
    addEvent(`Showed overlay ad: ${ad.altText}`);
  };

  const hideOverlayAd = (index: number) => {
    const ad = sampleOverlayAds[index];
    playerRef.current?.overlayAdControls.hideOverlayAd(ad.id);
    addEvent(`Hid overlay ad: ${ad.altText}`);
  };

  const hideAllOverlayAds = () => {
    playerRef.current?.overlayAdControls.hideAllOverlayAds();
    addEvent('Hid all overlay ads');
  };

  const showInfoCard = (index: number) => {
    const card = sampleInfoCards[index];
    playerRef.current?.overlayAdControls.showInfoCard(card);
    addEvent(`Showed info card: ${card.title}`);
  };

  const hideInfoCard = (index: number) => {
    const card = sampleInfoCards[index];
    playerRef.current?.overlayAdControls.hideInfoCard(card.id);
    addEvent(`Hid info card: ${card.title}`);
  };

  const hideAllInfoCards = () => {
    playerRef.current?.overlayAdControls.hideAllInfoCards();
    addEvent('Hid all info cards');
  };

  const resetAll = () => {
    playerRef.current?.overlayAdControls.resetDismissed();
    addEvent('Reset all dismissed states');
  };

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-gradient-to-r from-cyan-900 to-blue-900 border border-cyan-500 rounded-lg p-4 text-white text-sm">
        <h3 className="font-semibold mb-2">🎮 Dynamic Ad Triggering Demo</h3>
        <p className="text-cyan-200 text-xs">
          Use the buttons below to dynamically show/hide overlay ads and info cards.
          This demonstrates how to programmatically control ads using the player ref.
        </p>
      </div>

      {/* Video Player */}
      <VideoPlayer
        ref={playerRef}
        track={{
          id: 'demo-dynamic',
          src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          title: 'Dynamic Ad Triggering Demo',
          poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
        }}
      />

      {/* Control Panel */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        {/* Overlay Ad Controls */}
        <div>
          <h4 className="text-white font-semibold mb-2">Overlay Ads</h4>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => showOverlayAd(0)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded transition-colors"
            >
              Show Ad 1 (Bottom)
            </button>
            <button
              onClick={() => showOverlayAd(1)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded transition-colors"
            >
              Show Ad 2 (Top)
            </button>
            <button
              onClick={() => hideOverlayAd(0)}
              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors"
            >
              Hide Ad 1
            </button>
            <button
              onClick={() => hideOverlayAd(1)}
              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors"
            >
              Hide Ad 2
            </button>
            <button
              onClick={hideAllOverlayAds}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
            >
              Hide All
            </button>
          </div>
        </div>

        {/* Info Card Controls */}
        <div>
          <h4 className="text-white font-semibold mb-2">Info Cards</h4>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => showInfoCard(0)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded transition-colors"
            >
              Show Product Card
            </button>
            <button
              onClick={() => showInfoCard(1)}
              className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white text-xs rounded transition-colors"
            >
              Show Video Card
            </button>
            <button
              onClick={() => hideInfoCard(0)}
              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors"
            >
              Hide Product
            </button>
            <button
              onClick={() => hideInfoCard(1)}
              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors"
            >
              Hide Video
            </button>
            <button
              onClick={hideAllInfoCards}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
            >
              Hide All
            </button>
          </div>
        </div>

        {/* Reset */}
        <div>
          <button
            onClick={resetAll}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors"
          >
            Reset All Dismissed
          </button>
        </div>
      </div>

      {/* Event Log */}
      <div className="bg-gray-900 rounded-lg p-4 text-white">
        <h3 className="text-sm font-semibold mb-2 text-gray-400">Event Log</h3>
        <div className="space-y-1 text-xs font-mono max-h-32 overflow-y-auto">
          {events.length === 0 ? (
            <span className="text-gray-500">Click buttons to see events...</span>
          ) : (
            events.map((event, i) => <div key={i} className="text-cyan-300">{event}</div>)
          )}
        </div>
      </div>

      {/* Code Example */}
      <div className="bg-gray-900 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-2 text-gray-400">Code Example</h4>
        <pre className="text-xs overflow-x-auto text-green-300">
{`import { useRef } from 'react';
import { VideoPlayer, VideoPlayerRef, OverlayAdType, InfoCardType } from '@fairu/player';

function MyPlayer() {
  const playerRef = useRef<VideoPlayerRef>(null);

  const showAd = () => {
    playerRef.current?.overlayAdControls.showOverlayAd({
      id: 'my-ad',
      imageUrl: 'https://example.com/ad.png',
      displayAt: 0,
      clickThroughUrl: 'https://example.com',
    });
  };

  const hideAd = () => {
    playerRef.current?.overlayAdControls.hideOverlayAd('my-ad');
  };

  return (
    <div>
      <VideoPlayer ref={playerRef} track={...} />
      <button onClick={showAd}>Show Ad</button>
      <button onClick={hideAd}>Hide Ad</button>
    </div>
  );
}`}
        </pre>
      </div>
    </div>
  );
}

export const DynamicAdTriggering: Story = {
  render: () => <DynamicAdTriggeringDemo />,
};

// ============= Event Pipeline Story =============

/**
 * Event Pipeline Demo
 * Shows how to control ads from anywhere in your app using the AdEventBus
 */
function EventPipelineDemo() {
  const adEventBus = useMemo(() => createAdEventBus(), []);
  const [events, setEvents] = useState<string[]>([]);
  const [triggerSource, setTriggerSource] = useState<string>('manual');

  const addEvent = useCallback((event: string) => {
    setEvents((prev) => [...prev.slice(-14), `${new Date().toLocaleTimeString()}: ${event}`]);
  }, []);

  const eventOverlayAds: OverlayAdType[] = useMemo(
    () => [
      {
        id: 'event-overlay-1',
        imageUrl: 'https://placehold.co/600x80/7c3aed/ffffff?text=Event-Triggered+Overlay+Ad',
        clickThroughUrl: 'https://example.com/ad1',
        displayAt: 0,
        position: 'bottom' as const,
        closeable: true,
        altText: 'Event Overlay Ad',
      },
      {
        id: 'event-overlay-2',
        imageUrl: 'https://placehold.co/600x80/059669/ffffff?text=Promo+Banner+-+Limited+Time!',
        clickThroughUrl: 'https://example.com/promo',
        displayAt: 0,
        position: 'top' as const,
        closeable: true,
        altText: 'Promo Banner',
      },
    ],
    []
  );

  const eventInfoCards: InfoCardType[] = useMemo(
    () => [
      {
        id: 'event-card-1',
        type: 'product' as const,
        title: 'Event-Triggered Product',
        description: 'This card was triggered via event pipeline!',
        thumbnail: 'https://placehold.co/300x200/dc2626/ffffff?text=Hot+Deal',
        url: 'https://example.com/product',
        displayAt: 0,
        price: '$149.99',
        position: 'top-right' as const,
      },
    ],
    []
  );

  const simulateExternalTrigger = useCallback((source: string, action: () => void) => {
    setTriggerSource(source);
    action();
  }, []);

  const showOverlayAd = useCallback(
    (ad: OverlayAdType, source: string) => {
      simulateExternalTrigger(source, () => {
        adEventBus.emit('showOverlayAd', ad);
        addEvent(`[${source}] showOverlayAd: ${ad.altText}`);
      });
    },
    [adEventBus, addEvent, simulateExternalTrigger]
  );

  const hideAllOverlayAds = useCallback(
    (source: string) => {
      simulateExternalTrigger(source, () => {
        adEventBus.emit('hideAllOverlayAds');
        addEvent(`[${source}] hideAllOverlayAds`);
      });
    },
    [adEventBus, addEvent, simulateExternalTrigger]
  );

  const showInfoCard = useCallback(
    (card: InfoCardType, source: string) => {
      simulateExternalTrigger(source, () => {
        adEventBus.emit('showInfoCard', card);
        addEvent(`[${source}] showInfoCard: ${card.title}`);
      });
    },
    [adEventBus, addEvent, simulateExternalTrigger]
  );

  const hideAllInfoCards = useCallback(
    (source: string) => {
      simulateExternalTrigger(source, () => {
        adEventBus.emit('hideAllInfoCards');
        addEvent(`[${source}] hideAllInfoCards`);
      });
    },
    [adEventBus, addEvent, simulateExternalTrigger]
  );

  const resetDismissed = useCallback(
    (source: string) => {
      simulateExternalTrigger(source, () => {
        adEventBus.emit('resetDismissed');
        addEvent(`[${source}] resetDismissed`);
      });
    },
    [adEventBus, addEvent, simulateExternalTrigger]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      showOverlayAd(eventOverlayAds[1], 'auto-timer');
    }, 5000);
    return () => clearTimeout(timer);
  }, [eventOverlayAds, showOverlayAd]);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-violet-900 to-purple-900 border border-violet-500 rounded-lg p-4 text-white text-sm">
        <h3 className="font-semibold mb-2">Event Pipeline Demo</h3>
        <p className="text-violet-200 text-xs mb-3">
          Control ads from anywhere using <code className="bg-black/30 px-1 rounded">AdEventBus</code>.
          Events can come from analytics, timers, WebSockets, or any external source.
        </p>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-violet-300">Last trigger:</span>
          <span className="px-2 py-0.5 bg-violet-500 rounded font-mono">{triggerSource}</span>
        </div>
      </div>

      <VideoPlayer
        track={{
          id: 'demo-event-pipeline',
          src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          title: 'Event Pipeline Demo',
          poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
        }}
        adEventBus={adEventBus}
      />

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            Manual Triggers
          </h4>
          <div className="space-y-2">
            <button
              onClick={() => showOverlayAd(eventOverlayAds[0], 'manual')}
              className="w-full px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs rounded"
            >
              Show Overlay Ad
            </button>
            <button
              onClick={() => showInfoCard(eventInfoCards[0], 'manual')}
              className="w-full px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded"
            >
              Show Product Card
            </button>
            <button
              onClick={() => hideAllOverlayAds('manual')}
              className="w-full px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded"
            >
              Hide All Overlays
            </button>
            <button
              onClick={() => hideAllInfoCards('manual')}
              className="w-full px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded"
            >
              Hide All Cards
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            Analytics Triggers
          </h4>
          <div className="space-y-2">
            <button
              onClick={() => showOverlayAd(eventOverlayAds[0], 'analytics')}
              className="w-full px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
            >
              User Milestone
            </button>
            <button
              onClick={() => showInfoCard(eventInfoCards[0], 'analytics')}
              className="w-full px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
            >
              High Engagement
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            External Systems
          </h4>
          <div className="space-y-2">
            <button
              onClick={() => showOverlayAd(eventOverlayAds[1], 'e-commerce')}
              className="w-full px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded"
            >
              Cart Abandoned
            </button>
            <button
              onClick={() => resetDismissed('admin')}
              className="w-full px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded"
            >
              Admin: Reset All
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg p-4 text-white">
        <h3 className="text-sm font-semibold mb-2 text-gray-400">Event Log</h3>
        <div className="space-y-1 text-xs font-mono max-h-32 overflow-y-auto">
          {events.length === 0 ? (
            <span className="text-gray-500">Waiting... (promo in 5s)</span>
          ) : (
            events.map((event, i) => (
              <div key={i} className="text-violet-300">
                {event}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-2 text-gray-400">Usage</h4>
        <pre className="text-xs overflow-x-auto text-green-300">
          {`import { createAdEventBus, VideoPlayer } from '@fairu/player';

const adEventBus = createAdEventBus();

<VideoPlayer track={track} adEventBus={adEventBus} />

// Trigger from anywhere:
adEventBus.emit('showOverlayAd', { id: 'promo', imageUrl: '...', displayAt: 0 });
adEventBus.emit('hideOverlayAd', { id: 'promo' });
adEventBus.emit('showInfoCard', { id: 'card', type: 'product', ... });
adEventBus.emit('resetDismissed');`}
        </pre>
      </div>
    </div>
  );
}

export const EventPipeline: Story = {
  render: () => <EventPipelineDemo />,
};

// ============= Picture-in-Picture Stories =============

/**
 * Video player with Picture-in-Picture enabled
 * Click the PiP button in the controls to enter PiP mode
 */
export const PictureInPicture: Story = {
  args: {
    track: sampleVideo,
    config: {
      features: {
        pictureInPicture: true,
      },
    },
  },
};

/**
 * Interactive PiP demo with event logging, status display, and tab visibility
 */
function PictureInPictureInteractiveDemo() {
  const playerEventBus = useMemo(() => createPlayerEventBus(), []);
  const [events, setEvents] = useState<string[]>([]);
  const [isPiP, setIsPiP] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);

  const addEvent = useCallback((event: string) => {
    setEvents((prev) => [...prev.slice(-14), `${new Date().toLocaleTimeString()}: ${event}`]);
  }, []);

  useEffect(() => {
    const unsubs = [
      playerEventBus.on('enterPictureInPicture', () => {
        addEvent('PiP entered');
        setIsPiP(true);
      }),
      playerEventBus.on('exitPictureInPicture', () => {
        addEvent('PiP exited');
        setIsPiP(false);
      }),
      playerEventBus.on('tabHidden', ({ timestamp }) => {
        addEvent(`Tab hidden at ${new Date(timestamp).toLocaleTimeString()}`);
        setIsTabVisible(false);
      }),
      playerEventBus.on('tabVisible', ({ hiddenDuration }) => {
        addEvent(`Tab visible (hidden for ${hiddenDuration.toFixed(1)}s)`);
        setIsTabVisible(true);
      }),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [playerEventBus, addEvent]);

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-gradient-to-r from-cyan-900 to-teal-900 border border-cyan-500 rounded-lg p-4 text-white text-sm">
        <h3 className="font-semibold mb-2">Picture-in-Picture Interactive Demo</h3>
        <p className="text-cyan-200 text-xs">
          Click the PiP button in the controls bar to enter Picture-in-Picture mode.
          Switch tabs to see tab visibility events. All events are logged below.
        </p>
      </div>

      {/* Status Indicators */}
      <div className="flex gap-4">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${isPiP ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'}`}>
          <span className={`w-2 h-2 rounded-full ${isPiP ? 'bg-green-400' : 'bg-gray-600'}`} />
          PiP: {isPiP ? 'Active' : 'Inactive'}
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${isTabVisible ? 'bg-blue-900 text-blue-300' : 'bg-orange-900 text-orange-300'}`}>
          <span className={`w-2 h-2 rounded-full ${isTabVisible ? 'bg-blue-400' : 'bg-orange-400'}`} />
          Tab: {isTabVisible ? 'Visible' : 'Hidden'}
        </div>
      </div>

      {/* Video Player */}
      <VideoPlayer
        track={sampleVideo}
        config={{
          features: { pictureInPicture: true },
        }}
        playerEventBus={playerEventBus}
        onPictureInPictureChange={(pip) => addEvent(`onPictureInPictureChange: ${pip}`)}
        onTabVisibilityChange={(visible) => addEvent(`onTabVisibilityChange: ${visible}`)}
      />

      {/* Event Log */}
      <div className="bg-gray-900 rounded-lg p-4 text-white">
        <h3 className="text-sm font-semibold mb-2 text-gray-400">Event Log</h3>
        <div className="space-y-1 text-xs font-mono max-h-40 overflow-y-auto">
          {events.length === 0 ? (
            <span className="text-gray-500">Click the PiP button or switch tabs to see events...</span>
          ) : (
            events.map((event, i) => <div key={i} className="text-cyan-300">{event}</div>)
          )}
        </div>
      </div>
    </div>
  );
}

export const PictureInPictureInteractive: Story = {
  render: () => <PictureInPictureInteractiveDemo />,
};

/**
 * Tab Visibility with Return Ad demo
 * Pause on hidden, resume on visible, show return ad after 3 seconds away
 */
function TabVisibilityWithReturnAdDemo() {
  const adEventBus = useMemo(() => createAdEventBus(), []);
  const playerEventBus = useMemo(() => createPlayerEventBus(), []);
  const [events, setEvents] = useState<string[]>([]);

  const addEvent = useCallback((event: string) => {
    setEvents((prev) => [...prev.slice(-14), `${new Date().toLocaleTimeString()}: ${event}`]);
  }, []);

  const returnAd: OverlayAdTypeForPiP = {
    id: 'return-ad',
    imageUrl: 'https://placehold.co/600x80/dc2626/ffffff?text=Welcome+Back!+Special+Offer+Inside',
    clickThroughUrl: 'https://example.com/welcome-back',
    displayAt: 0,
    duration: 15,
    position: 'bottom',
    closeable: true,
    altText: 'Welcome back offer',
  };

  useEffect(() => {
    const unsubs = [
      playerEventBus.on('tabHidden', () => {
        addEvent('Tab hidden - video paused');
      }),
      playerEventBus.on('tabVisible', ({ hiddenDuration }) => {
        addEvent(`Tab visible - hidden for ${hiddenDuration.toFixed(1)}s`);
      }),
      playerEventBus.on('triggerReturnAd', ({ hiddenDuration }) => {
        addEvent(`Return ad triggered (hidden ${hiddenDuration.toFixed(1)}s)`);
      }),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [playerEventBus, addEvent]);

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-gradient-to-r from-red-900 to-orange-900 border border-red-500 rounded-lg p-4 text-white text-sm">
        <h3 className="font-semibold mb-2">Tab Visibility with Return Ad</h3>
        <ul className="text-red-200 space-y-1 text-xs">
          <li>1. Start playing the video</li>
          <li>2. Switch to another tab</li>
          <li>3. Come back - video resumes and a return ad appears every time</li>
        </ul>
      </div>

      {/* Video Player */}
      <VideoPlayer
        track={sampleVideo}
        config={{
          features: { pictureInPicture: true },
          tabVisibility: {
            pauseOnHidden: true,
            resumeOnVisible: true,
            showReturnAd: true,
            returnAdMinHiddenDuration: 0,
            returnAd: returnAd,
          },
        }}
        adEventBus={adEventBus}
        playerEventBus={playerEventBus}
      />

      {/* Event Log */}
      <div className="bg-gray-900 rounded-lg p-4 text-white">
        <h3 className="text-sm font-semibold mb-2 text-gray-400">Event Log</h3>
        <div className="space-y-1 text-xs font-mono max-h-40 overflow-y-auto">
          {events.length === 0 ? (
            <span className="text-gray-500">Play the video, then switch tabs to see events...</span>
          ) : (
            events.map((event, i) => <div key={i} className="text-orange-300">{event}</div>)
          )}
        </div>
      </div>

      {/* Code Example */}
      <div className="bg-gray-900 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-2 text-gray-400">Configuration</h4>
        <pre className="text-xs overflow-x-auto text-green-300">
{`<VideoPlayer
  track={track}
  adEventBus={adEventBus}
  playerEventBus={playerEventBus}
  config={{
    features: { pictureInPicture: true },
    tabVisibility: {
      pauseOnHidden: true,
      resumeOnVisible: true,
      showReturnAd: true,
      returnAdMinHiddenDuration: 0,
      returnAd: {
        id: 'return-ad',
        imageUrl: '/welcome-back.png',
        displayAt: 0,
        closeable: true,
      },
    },
  }}
/>`}
        </pre>
      </div>
    </div>
  );
}

export const TabVisibilityWithReturnAd: Story = {
  render: () => <TabVisibilityWithReturnAdDemo />,
};
