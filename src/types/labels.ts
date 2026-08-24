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
  // Reels / Shorts
  reelsFeed: string;
  nextReel: string;
  previousReel: string;
  like: string;
  unlike: string;
  comment: string;
  share: string;
  save: string;
  unsave: string;
  follow: string;
  following: string;
  showMore: string;
  showLess: string;
  sponsored: string;
  adCountdown: string;
  loadingMore: string;

  /* --- Subtitle appearance --------------------------------------------- */
  /*
    Optional, unlike everything above, and deliberately so: `PlayerLabels` is a
    public export, and a consumer who builds one by hand would stop type-checking
    the moment a release added a required key. `defaultLabels` supplies all of
    these, and every reader spreads the defaults underneath, so the values are
    never actually absent at runtime.
  */
  subtitleStyle?: string;
  subtitlePresets?: string;
  subtitleFontSize?: string;
  subtitleBackground?: string;
  subtitlePosition?: string;
  subtitlePositionTop?: string;
  subtitlePositionBottom?: string;
  subtitleReset?: string;

  /* --- Sleep timer ------------------------------------------------------ */
  sleepTimer?: string;
  sleepTimerOptions?: string;
  sleepTimerCancel?: string;
  /** `{time}` is replaced with the countdown. */
  sleepTimerRemaining?: string;
  sleepTimerEndOfTrack?: string;
  /** `{minutes}` is replaced with the preset length. */
  sleepTimerMinutes?: string;
}

/**
 * Default English labels
 */
export const defaultLabels = {
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
  reelsFeed: 'Short video feed',
  nextReel: 'Next video',
  previousReel: 'Previous video',
  like: 'Like',
  unlike: 'Remove like',
  comment: 'Comments',
  share: 'Share',
  save: 'Save',
  unsave: 'Remove from saved',
  follow: 'Follow',
  following: 'Following',
  showMore: 'more',
  showLess: 'less',
  sponsored: 'Sponsored',
  adCountdown: '{seconds}s',
  loadingMore: 'Loading more videos',
  subtitleStyle: 'Subtitle style',
  subtitlePresets: 'Presets',
  subtitleFontSize: 'Font size',
  subtitleBackground: 'Background',
  subtitlePosition: 'Position',
  subtitlePositionTop: 'Top',
  subtitlePositionBottom: 'Bottom',
  subtitleReset: 'Reset to default',
  sleepTimer: 'Sleep timer',
  sleepTimerOptions: 'Sleep timer options',
  sleepTimerCancel: 'Cancel timer',
  sleepTimerRemaining: '{time} remaining',
  sleepTimerEndOfTrack: 'End of track',
  sleepTimerMinutes: '{minutes} min',
} satisfies PlayerLabels;

/**
 * A labels table with every value present.
 *
 * `PlayerLabels` carries optional keys — see the note on the subtitle block —
 * so a component that reads one directly would otherwise have to guard each
 * access. A plain spread is not enough either: a key explicitly set to
 * `undefined` would overwrite the default with nothing.
 */
export function resolveLabels(supplied: PlayerLabels): typeof defaultLabels {
  const resolved = { ...defaultLabels };

  for (const [key, value] of Object.entries(supplied)) {
    if (value !== undefined) {
      (resolved as Record<string, string>)[key] = value as string;
    }
  }

  return resolved;
}

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
