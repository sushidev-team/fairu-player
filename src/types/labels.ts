/**
 * Player labels for text localization
 */
export interface PlayerLabels {
  // PlayButton
  play: string;
  pause: string;
  // VolumeControl
  mute: string;
  unmute: string;
  volume: string;
  // FullscreenButton
  enterFullscreen: string;
  exitFullscreen: string;
  // PlaybackSpeed
  playbackSpeed: string;
  playbackSpeedOptions: string;
  // QualitySelector
  selectQuality: string;
  qualityOptions: string;
  autoQuality: string;
  // SubtitleSelector
  subtitles: string;
  subtitleOptions: string;
  subtitlesOff: string;
  // SkipButtons (with template {seconds})
  skipForward: string;
  skipBackward: string;
  // ProgressBar
  seekSlider: string;
  // TimeDisplay
  timeSeparator: string;
  // NowPlayingIndicator
  nowPlaying: string;
  paused: string;
  // VideoOverlay
  playVideo: string;
  // Ads
  ad: string;
  skipAd: string;
  skipIn: string;
  learnMore: string;
  // Playlist
  previousTrack: string;
  nextTrack: string;
  // PictureInPicture
  enterPictureInPicture: string;
  exitPictureInPicture: string;
  // Cast
  startCast: string;
  stopCast: string;
  // Rating
  rateUp: string;
  rateDown: string;
  removeRating: string;
}

/**
 * Default English labels
 */
export const defaultLabels: PlayerLabels = {
  play: 'Play',
  pause: 'Pause',
  mute: 'Mute',
  unmute: 'Unmute',
  volume: 'Volume',
  enterFullscreen: 'Enter fullscreen',
  exitFullscreen: 'Exit fullscreen',
  playbackSpeed: 'Playback speed',
  playbackSpeedOptions: 'Playback speed options',
  selectQuality: 'Select video quality',
  qualityOptions: 'Video quality options',
  autoQuality: 'Auto',
  subtitles: 'Subtitles',
  subtitleOptions: 'Subtitle options',
  subtitlesOff: 'Off',
  skipForward: 'Skip forward {seconds} seconds',
  skipBackward: 'Skip backward {seconds} seconds',
  seekSlider: 'Seek slider',
  timeSeparator: '/',
  nowPlaying: 'Now playing',
  paused: 'Paused',
  playVideo: 'Play video',
  ad: 'AD',
  skipAd: 'Skip Ad',
  skipIn: 'Skip in {seconds}s',
  learnMore: 'Learn more about this ad',
  previousTrack: 'Previous track',
  nextTrack: 'Next track',
  enterPictureInPicture: 'Enter picture-in-picture',
  exitPictureInPicture: 'Exit picture-in-picture',
  startCast: 'Cast',
  stopCast: 'Stop casting',
  rateUp: 'Like',
  rateDown: 'Dislike',
  removeRating: 'Remove rating',
};

/**
 * Partial labels for overriding specific labels
 */
export type PartialLabels = Partial<PlayerLabels>;

/**
 * Interpolate template strings with values
 * @example interpolateLabel('Skip forward {seconds} seconds', { seconds: 10 })
 * // Returns: 'Skip forward 10 seconds'
 */
export function interpolateLabel(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));
}
