import React, { type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { PlayerProvider } from '@/context/PlayerContext';
import { TrackingProvider } from '@/context/TrackingContext';
import { LabelsProvider } from '@/context/LabelsContext';
import type { Track, PlayerConfig } from '@/types/player';
import type { TrackingConfig } from '@/types/tracking';
import type { VideoTrack, VideoConfig, OverlayAd, InfoCard } from '@/types/video';
import type { Ad, AdBreak } from '@/types/ads';

// ─── Mock Data Factories ─────────────────────────────────────────────

export function createMockTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1',
    src: 'https://example.com/audio.mp3',
    title: 'Test Track',
    artist: 'Test Artist',
    album: 'Test Album',
    artwork: 'https://example.com/cover.jpg',
    duration: 180,
    ...overrides,
  };
}

export function createMockVideoTrack(overrides: Partial<VideoTrack> = {}): VideoTrack {
  return {
    id: 'video-1',
    src: 'https://example.com/video.mp4',
    title: 'Test Video',
    artist: 'Test Creator',
    poster: 'https://example.com/poster.jpg',
    duration: 300,
    ...overrides,
  };
}

export function createMockPlaylist(count = 3): Track[] {
  return Array.from({ length: count }, (_, i) =>
    createMockTrack({
      id: `track-${i + 1}`,
      title: `Track ${i + 1}`,
      artist: `Artist ${i + 1}`,
      src: `https://example.com/track-${i + 1}.mp3`,
    })
  );
}

export function createMockVideoPlaylist(count = 3): VideoTrack[] {
  return Array.from({ length: count }, (_, i) =>
    createMockVideoTrack({
      id: `video-${i + 1}`,
      title: `Video ${i + 1}`,
      src: `https://example.com/video-${i + 1}.mp4`,
    })
  );
}

export function createMockAd(overrides: Partial<Ad> = {}): Ad {
  return {
    id: 'ad-1',
    src: 'https://example.com/ad.mp4',
    duration: 15,
    skipAfterSeconds: 5,
    clickThroughUrl: 'https://example.com/click',
    ...overrides,
  };
}

export function createMockAdBreak(overrides: Partial<AdBreak> = {}): AdBreak {
  return {
    id: 'break-1',
    position: 'pre-roll',
    ads: [createMockAd()],
    played: false,
    ...overrides,
  };
}

export function createMockOverlayAd(overrides: Partial<OverlayAd> = {}): OverlayAd {
  return {
    id: 'overlay-1',
    imageUrl: 'https://example.com/banner.jpg',
    clickThroughUrl: 'https://example.com/click',
    displayAt: 10,
    duration: 15,
    position: 'bottom',
    closeable: true,
    ...overrides,
  };
}

export function createMockInfoCard(overrides: Partial<InfoCard> = {}): InfoCard {
  return {
    id: 'card-1',
    type: 'product',
    title: 'Test Product',
    description: 'A test product description',
    thumbnail: 'https://example.com/thumb.jpg',
    url: 'https://example.com/product',
    displayAt: 20,
    duration: 10,
    position: 'top-right',
    ...overrides,
  };
}

export function createMockChapters() {
  return [
    { id: 'ch-1', title: 'Intro', startTime: 0, endTime: 30 },
    { id: 'ch-2', title: 'Main Content', startTime: 30, endTime: 120 },
    { id: 'ch-3', title: 'Outro', startTime: 120, endTime: 180 },
  ];
}

export function createMockMarkers() {
  return [
    { id: 'm-1', time: 15, title: 'Highlight 1' },
    { id: 'm-2', time: 60, title: 'Highlight 2' },
    { id: 'm-3', time: 120, title: 'Highlight 3' },
  ];
}

// ─── Mock Video Element ──────────────────────────────────────────────

export function createMockVideoElement(overrides: Partial<HTMLVideoElement> = {}): HTMLVideoElement {
  const el = document.createElement('video');

  // Add common properties
  Object.defineProperty(el, 'duration', { writable: true, value: overrides.duration ?? 300 });
  Object.defineProperty(el, 'currentTime', { writable: true, value: overrides.currentTime ?? 0 });
  Object.defineProperty(el, 'volume', { writable: true, value: overrides.volume ?? 1 });
  Object.defineProperty(el, 'muted', { writable: true, value: overrides.muted ?? false });
  Object.defineProperty(el, 'paused', { writable: true, value: overrides.paused ?? true });
  Object.defineProperty(el, 'playbackRate', { writable: true, value: overrides.playbackRate ?? 1 });
  Object.defineProperty(el, 'readyState', { writable: true, value: overrides.readyState ?? 4 });

  return el;
}

// ─── Mock HLS Instance ──────────────────────────────────────────────

export function createMockHlsInstance() {
  return {
    loadSource: vi.fn(),
    attachMedia: vi.fn(),
    detachMedia: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    levels: [
      { height: 360, width: 640, bitrate: 800000, name: '360p' },
      { height: 720, width: 1280, bitrate: 2500000, name: '720p' },
      { height: 1080, width: 1920, bitrate: 5000000, name: '1080p' },
    ],
    currentLevel: -1,
    nextLevel: -1,
    autoLevelEnabled: true,
    subtitleTracks: [],
    subtitleTrack: -1,
  };
}

// ─── Config Factories ────────────────────────────────────────────────

export function createMockPlayerConfig(overrides: Partial<PlayerConfig> = {}): PlayerConfig {
  return {
    track: createMockTrack(),
    volume: 1,
    muted: false,
    autoPlay: false,
    skipForwardSeconds: 30,
    skipBackwardSeconds: 10,
    repeat: 'none',
    shuffle: false,
    ...overrides,
  };
}

export function createMockTrackingConfig(overrides: Partial<TrackingConfig> = {}): TrackingConfig {
  return {
    enabled: true,
    endpoint: 'https://example.com/track',
    events: {
      play: true,
      pause: true,
      seek: true,
      complete: true,
      progress: true,
      chapterChange: true,
      trackChange: true,
      adStart: true,
      adComplete: true,
      adSkip: true,
      error: true,
    },
    progressIntervals: [25, 50, 75],
    batchEvents: false,
    ...overrides,
  };
}

// ─── Render Helpers ──────────────────────────────────────────────────

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  playerConfig?: Partial<PlayerConfig>;
  trackingConfig?: Partial<TrackingConfig>;
  labels?: Record<string, string>;
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: RenderWithProvidersOptions = {}
) {
  const { playerConfig, trackingConfig, labels, ...renderOptions } = options;

  const config = createMockPlayerConfig(playerConfig);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <TrackingProvider config={trackingConfig}>
        <PlayerProvider config={config}>
          <LabelsProvider labels={labels}>
            {children}
          </LabelsProvider>
        </PlayerProvider>
      </TrackingProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// ─── Event Helpers ───────────────────────────────────────────────────

export function fireMediaEvent(element: HTMLMediaElement, event: string, detail?: Record<string, unknown>) {
  const evt = new Event(event, { bubbles: true });
  if (detail) {
    Object.assign(evt, detail);
  }
  element.dispatchEvent(evt);
}

export function simulateTimeUpdate(element: HTMLMediaElement, time: number) {
  Object.defineProperty(element, 'currentTime', { writable: true, value: time });
  fireMediaEvent(element, 'timeupdate');
}

export function simulateLoadedMetadata(element: HTMLMediaElement, duration: number) {
  Object.defineProperty(element, 'duration', { writable: true, value: duration });
  fireMediaEvent(element, 'loadedmetadata');
}

// ─── Async Helpers ───────────────────────────────────────────────────

export function waitForNextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
