/**
 * Types for the Media Session integration (OS lock-screen / Now Playing UI).
 */

/** One artwork entry offered to the OS. */
export interface MediaSessionArtwork {
  src: string;
  /**
   * `"512x512"`, or several space-separated sizes. The OS picks what it needs,
   * so offering more than one size is worthwhile: lock screens want large
   * artwork, notification shades want small.
   */
  sizes?: string;
  /** MIME type, e.g. `"image/png"`. */
  type?: string;
}

/** What the OS shows while this media plays. */
export interface MediaSessionMetadata {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: MediaSessionArtwork[];
}

export interface MediaSessionConfig {
  /**
   * Turn the OS integration off. Worth doing for background/ambient video and
   * for ad-only surfaces, which should not take over the user's Now Playing
   * slot from whatever they were actually listening to.
   *
   * @default true
   */
  enabled?: boolean;
  /**
   * Default seek distance in seconds for the OS skip actions, used when the
   * platform does not supply its own offset.
   *
   * @default 10
   */
  seekOffset?: number;
}
