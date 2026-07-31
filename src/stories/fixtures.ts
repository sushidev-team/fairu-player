/**
 * Shared demo media for Storybook.
 *
 * ## Why this file exists
 *
 * The stories used to point directly at
 * `storage.googleapis.com/gtv-videos-bucket/sample/*` (Big Buck Bunny, Sintel,
 * ForBigger*). Google has since restricted that bucket: every one of those URLs
 * now answers **HTTP 403 with an XML error body**, which Chrome's Opaque
 * Response Blocking rejects (`ERR_BLOCKED_BY_ORB`). The `<video>` element ends
 * up with `error.code === 4` (`MEDIA_ERR_SRC_NOT_SUPPORTED`) and renders a black
 * box — with no console error, because a media element reports load failures on
 * the element rather than throwing.
 *
 * That silently broke every video story in the repo, not just the Reels ones.
 * Centralising the URLs here means the next dead CDN is a one-line fix.
 *
 * ## Choosing replacements
 *
 * Everything below is CC0 or explicitly published for testing, and was verified
 * to answer `200` with a `video/*` content type. Prefer `mdn.github.io/
 * shared-assets` — it is versioned in a public repo and unlikely to disappear
 * quietly.
 */

/**
 * Progressive MP4 clips. Short, small, and reliably hosted.
 *
 * Durations were measured, not guessed — a VAST fixture whose `<Duration>`
 * disagrees with its media file makes the ad UI look broken (the remaining-time
 * badge counts the real length while the skip offset uses the declared one), so
 * {@link SAMPLE_DURATIONS} exists to keep the two in sync.
 */
export const SAMPLE_VIDEOS = {
  /** 5.1s · 960×540 */
  flower: 'https://mdn.github.io/shared-assets/videos/flower.mp4',
  /** 6.2s · 640×480 */
  friday: 'https://mdn.github.io/shared-assets/videos/friday.mp4',
  /** 70.5s · 800×333 — the only long one; good for seek/chapter stories */
  tearsOfSteel:
    'https://mdn.github.io/shared-assets/videos/tears-of-steel-battle-clip-medium.mp4',
  /** 10.0s · 640×360 */
  bigBuckBunny:
    'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
  /** 10.0s · 640×360 */
  jellyfish:
    'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4',
  /** 10.0s · 320×176 */
  sintel: 'https://www.w3schools.com/html/mov_bbb.mp4',
} as const;

/** Measured durations in seconds, keyed like {@link SAMPLE_VIDEOS}. */
export const SAMPLE_DURATIONS = {
  flower: 5.1,
  friday: 6.2,
  tearsOfSteel: 70.5,
  bigBuckBunny: 10,
  jellyfish: 10,
  sintel: 10,
} as const;

/** HLS manifests, for the streaming and quality-selector stories. */
export const SAMPLE_HLS = {
  /** Multi-bitrate, well-known test stream. */
  multiBitrate: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  /** Mux-hosted VOD. */
  mux: 'https://stream.mux.com/v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM.m3u8',
} as const;

/** Ordered list, for feeds that need N distinct clips. */
export const VIDEO_POOL: string[] = [
  SAMPLE_VIDEOS.flower,
  SAMPLE_VIDEOS.friday,
  SAMPLE_VIDEOS.tearsOfSteel,
  SAMPLE_VIDEOS.bigBuckBunny,
  SAMPLE_VIDEOS.jellyfish,
  SAMPLE_VIDEOS.sintel,
];

/**
 * Deterministic placeholder image.
 *
 * `picsum.photos` does not answer `HEAD` (405) but serves `GET` fine — worth
 * knowing before concluding it is down.
 */
export function poster(seed: string | number, width = 405, height = 720): string {
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

/** Deterministic avatar. */
export function avatar(n: number): string {
  return `https://i.pravatar.cc/80?img=${n}`;
}
