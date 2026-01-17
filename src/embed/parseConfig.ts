import type { PlayerConfig, Track, PlayerTheme } from '@/types/player';
import type { TrackingConfig } from '@/types/tracking';

export interface EmbedConfig {
  player: PlayerConfig;
  tracking?: Partial<TrackingConfig>;
  theme?: PlayerTheme;
  container?: string;
}

/**
 * Parse player configuration from data attributes on an element
 */
export function parseDataAttributes(element: HTMLElement): EmbedConfig {
  const dataset = element.dataset;

  // Parse track
  const track: Track | undefined = dataset.src
    ? {
        id: dataset.id || generateId(),
        src: dataset.src,
        title: dataset.title,
        artist: dataset.artist,
        artwork: dataset.artwork,
        duration: dataset.duration ? parseFloat(dataset.duration) : undefined,
        chapters: dataset.chapters ? JSON.parse(dataset.chapters) : undefined,
      }
    : undefined;

  // Parse playlist
  const playlist: Track[] | undefined = dataset.playlist
    ? JSON.parse(dataset.playlist)
    : undefined;

  // Parse features
  const features = {
    chapters: dataset.chapters !== 'false',
    volumeControl: dataset.volume !== 'false',
    playbackSpeed: dataset.speed !== 'false',
    skipButtons: dataset.skip !== 'false',
    progressBar: dataset.progress !== 'false',
    timeDisplay: dataset.time !== 'false',
    playlistView: dataset.playlistView !== 'false',
  };

  // Parse player config
  const player: PlayerConfig = {
    track,
    playlist,
    features,
    autoPlayNext: dataset.autoPlayNext !== 'false',
    shuffle: dataset.shuffle === 'true',
    repeat: (dataset.repeat as PlayerConfig['repeat']) || 'none',
    skipForwardSeconds: dataset.skipForward ? parseInt(dataset.skipForward) : 30,
    skipBackwardSeconds: dataset.skipBackward ? parseInt(dataset.skipBackward) : 10,
    playbackSpeeds: dataset.speeds ? JSON.parse(dataset.speeds) : undefined,
    volume: dataset.initialVolume ? parseFloat(dataset.initialVolume) : 1,
    muted: dataset.muted === 'true',
    autoPlay: dataset.autoPlay === 'true',
  };

  // Parse tracking config
  const tracking: Partial<TrackingConfig> | undefined = dataset.trackingEndpoint
    ? {
        enabled: dataset.trackingEnabled !== 'false',
        endpoint: dataset.trackingEndpoint,
      }
    : undefined;

  // Parse theme
  const theme = (dataset.theme as PlayerTheme) || 'light';

  return {
    player,
    tracking,
    theme,
    container: dataset.container,
  };
}

/**
 * Parse player configuration from URL parameters
 */
export function parseUrlParams(url: string): EmbedConfig {
  const urlObj = new URL(url);
  const params = urlObj.searchParams;

  // Parse track
  const track: Track | undefined = params.get('src')
    ? {
        id: params.get('id') || generateId(),
        src: params.get('src')!,
        title: params.get('title') || undefined,
        artist: params.get('artist') || undefined,
        artwork: params.get('artwork') || undefined,
        duration: params.get('duration') ? parseFloat(params.get('duration')!) : undefined,
      }
    : undefined;

  // Parse playlist from JSON param
  const playlistParam = params.get('playlist');
  const playlist: Track[] | undefined = playlistParam
    ? JSON.parse(decodeURIComponent(playlistParam))
    : undefined;

  // Parse features
  const features = {
    chapters: params.get('chapters') !== 'false',
    volumeControl: params.get('volume') !== 'false',
    playbackSpeed: params.get('speed') !== 'false',
    skipButtons: params.get('skip') !== 'false',
    progressBar: params.get('progress') !== 'false',
    timeDisplay: params.get('time') !== 'false',
    playlistView: params.get('playlistView') !== 'false',
  };

  const player: PlayerConfig = {
    track,
    playlist,
    features,
    autoPlayNext: params.get('autoPlayNext') !== 'false',
    shuffle: params.get('shuffle') === 'true',
    repeat: (params.get('repeat') as PlayerConfig['repeat']) || 'none',
    skipForwardSeconds: params.get('skipForward') ? parseInt(params.get('skipForward')!) : 30,
    skipBackwardSeconds: params.get('skipBackward') ? parseInt(params.get('skipBackward')!) : 10,
    volume: params.get('initialVolume') ? parseFloat(params.get('initialVolume')!) : 1,
    muted: params.get('muted') === 'true',
    autoPlay: params.get('autoPlay') === 'true',
  };

  const theme = (params.get('theme') as PlayerTheme) || 'light';

  return {
    player,
    theme,
  };
}

function generateId(): string {
  return `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
