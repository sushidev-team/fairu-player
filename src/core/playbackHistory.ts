/**
 * "Continue watching" — what was played, how far, and when.
 *
 * Ported from PR #16. Pure by construction: `now` is passed in rather than
 * read, so expiry is a decision the caller times and a test can drive without
 * mocking the clock.
 *
 * The entries come back out of storage, which means they outlive the schema
 * that wrote them — so reading is mostly a matter of refusing what no longer
 * makes sense rather than trusting a cast.
 */

export interface PlaybackHistoryEntry {
  trackId: string;
  title?: string;
  artist?: string;
  artwork?: string;
  /** Where playback stopped, in seconds. */
  lastPosition: number;
  duration: number;
  /** 0–100. */
  progress: number;
  completed: boolean;
  /** Epoch milliseconds. */
  lastPlayedAt: number;
  playCount: number;
}

/** What a caller supplies; the bookkeeping fields are ours. */
export type PlaybackRecord = Omit<PlaybackHistoryEntry, 'lastPlayedAt' | 'playCount'>;

export interface HistoryLimits {
  maxEntries: number;
  expiryMs: number;
}

export const DEFAULT_HISTORY_LIMITS: HistoryLimits = {
  maxEntries: 100,
  expiryMs: 90 * 24 * 60 * 60 * 1000,
};

/** Newest first — the order every list that shows this wants. */
function byRecency(a: PlaybackHistoryEntry, b: PlaybackHistoryEntry): number {
  return b.lastPlayedAt - a.lastPlayedAt;
}

/**
 * An entry, or `null` if it is not one.
 *
 * A stored list is the one input nobody reviews. An entry from an older release
 * — or one edited by hand — is rendered straight into a list, so anything
 * without an id or a usable timestamp is dropped rather than displayed as a
 * blank row.
 */
export function parseEntry(value: unknown): PlaybackHistoryEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const entry = value as Record<string, unknown>;

  const trackId = entry.trackId;
  if (typeof trackId !== 'string' || !trackId) return null;

  const lastPlayedAt = num(entry.lastPlayedAt);
  if (lastPlayedAt === null || lastPlayedAt <= 0) return null;

  const duration = num(entry.duration) ?? 0;
  const lastPosition = clamp(num(entry.lastPosition) ?? 0, 0, duration > 0 ? duration : Infinity);

  return {
    trackId,
    title: str(entry.title),
    artist: str(entry.artist),
    artwork: str(entry.artwork),
    lastPosition,
    duration: Math.max(0, duration),
    progress: clamp(num(entry.progress) ?? 0, 0, 100),
    completed: entry.completed === true,
    lastPlayedAt,
    playCount: Math.max(1, Math.floor(num(entry.playCount) ?? 1)),
  };
}

/**
 * A stored value → a usable history.
 *
 * Expiry and the cap are applied on the way in, so nothing downstream has to
 * remember to.
 */
export function normalizeHistory(
  value: unknown,
  now: number,
  limits: HistoryLimits = DEFAULT_HISTORY_LIMITS
): PlaybackHistoryEntry[] {
  if (!Array.isArray(value)) return [];

  const parsed: PlaybackHistoryEntry[] = [];

  for (const candidate of value) {
    const entry = parseEntry(candidate);
    if (!entry) continue;
    if (now - entry.lastPlayedAt >= limits.expiryMs) continue;
    parsed.push(entry);
  }

  // Sort first, then deduplicate. One row per track — but *which* row matters:
  // taking the first in storage order would keep whichever copy happened to be
  // written first, and with it a resume position the viewer has already moved
  // past.
  const entries: PlaybackHistoryEntry[] = [];
  const seen = new Set<string>();

  for (const entry of parsed.sort(byRecency)) {
    if (seen.has(entry.trackId)) continue;
    seen.add(entry.trackId);
    entries.push(entry);
  }

  return entries.slice(0, limits.maxEntries);
}

/**
 * Note a play.
 *
 * Replaying something already in the list bumps its count and moves it to the
 * top rather than adding a second row.
 */
export function record(
  entries: readonly PlaybackHistoryEntry[],
  played: PlaybackRecord,
  now: number,
  limits: HistoryLimits = DEFAULT_HISTORY_LIMITS
): PlaybackHistoryEntry[] {
  const existing = entries.find((entry) => entry.trackId === played.trackId);

  const updated: PlaybackHistoryEntry = {
    ...played,
    lastPlayedAt: now,
    playCount: (existing?.playCount ?? 0) + 1,
  };

  const rest = entries.filter((entry) => entry.trackId !== played.trackId);
  return [updated, ...rest]
    .filter((entry) => now - entry.lastPlayedAt < limits.expiryMs)
    .sort(byRecency)
    .slice(0, limits.maxEntries);
}

export function removeEntry(
  entries: readonly PlaybackHistoryEntry[],
  trackId: string
): PlaybackHistoryEntry[] {
  return entries.filter((entry) => entry.trackId !== trackId);
}

/**
 * What "continue watching" shows: started, not finished.
 *
 * `progress > 0` keeps out anything that was opened and abandoned in the first
 * second — a row offering to resume at 0:00 is noise.
 */
export function resumeList(
  entries: readonly PlaybackHistoryEntry[]
): PlaybackHistoryEntry[] {
  return entries.filter((entry) => !entry.completed && entry.progress > 0).sort(byRecency);
}

export function findEntry(
  entries: readonly PlaybackHistoryEntry[],
  trackId: string
): PlaybackHistoryEntry | null {
  return entries.find((entry) => entry.trackId === trackId) ?? null;
}

/* -------------------------------------------------------------------------- */

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
