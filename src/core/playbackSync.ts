/**
 * Keeping two players on the same frame.
 *
 * Ported from PR #16 — or rather, written for it: the hook there connects
 * peers, tracks who is in the room, and then handles `play`, `pause` and `seek`
 * with `default: break`. The membership worked; the synchronising was never
 * implemented.
 *
 * These are the decisions that part needs, and they are all pure. A follower
 * has to work out where the leader *is now* from a message describing where
 * they *were* when it was sent, and then decide whether the difference is worth
 * a correction — a seek is visible and audible, so it must not fire for
 * milliseconds of jitter.
 */

export interface PlaybackSnapshot {
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
}

export interface Correction {
  /** Jump here, or leave the playhead alone. */
  seekTo?: number;
  /** Start or stop, when the leader's state differs. */
  setPlaying?: boolean;
  setRate?: number;
}

/**
 * A correction that changes nothing. Shared so callers can compare by identity.
 */
export const NO_CORRECTION: Correction = {};

export interface SyncTolerances {
  /**
   * Seconds of drift a follower tolerates before seeking.
   *
   * Under about half a second a correction is more disruptive than the drift:
   * the jump is audible, and network jitter alone would trigger it repeatedly.
   */
  driftThreshold: number;
  /** Ignore a message older than this; the state it describes is stale. */
  maxAgeMs: number;
}

export const DEFAULT_TOLERANCES: SyncTolerances = {
  driftThreshold: 0.5,
  maxAgeMs: 10_000,
};

/**
 * Where the sender is now, given where they were when they sent.
 *
 * A paused sender has not moved. A playing one has advanced by the elapsed time
 * scaled by their rate — a leader at 1.5× covers more ground per second, and
 * ignoring that makes every correction land short.
 */
export function projectedTime(
  snapshot: PlaybackSnapshot,
  sentAt: number,
  now: number
): number {
  if (!snapshot.isPlaying) return snapshot.currentTime;

  const elapsed = Math.max(0, now - sentAt) / 1000;
  return snapshot.currentTime + elapsed * (snapshot.playbackRate || 1);
}

/**
 * What a follower should do about a message from the leader.
 *
 * Returns {@link NO_CORRECTION} when nothing needs doing, so a caller can skip
 * the work without comparing fields.
 */
export function decideCorrection(
  local: PlaybackSnapshot,
  remote: PlaybackSnapshot,
  sentAt: number,
  now: number,
  tolerances: SyncTolerances = DEFAULT_TOLERANCES
): Correction {
  // A message that spent ten seconds in flight describes a moment that has
  // passed; acting on it would seek to the wrong place with confidence.
  if (now - sentAt > tolerances.maxAgeMs) return NO_CORRECTION;

  const correction: Correction = {};

  const target = projectedTime(remote, sentAt, now);
  if (Math.abs(target - local.currentTime) > tolerances.driftThreshold) {
    correction.seekTo = Math.max(0, target);
  }

  if (remote.isPlaying !== local.isPlaying) {
    correction.setPlaying = remote.isPlaying;
  }

  if (remote.playbackRate !== local.playbackRate) {
    correction.setRate = remote.playbackRate;
  }

  return hasWork(correction) ? correction : NO_CORRECTION;
}

export function hasWork(correction: Correction): boolean {
  return (
    correction.seekTo !== undefined ||
    correction.setPlaying !== undefined ||
    correction.setRate !== undefined
  );
}

/* -------------------------------------------------------------------------- */

export type SyncEventType = 'play' | 'pause' | 'seek' | 'rate' | 'state' | 'join' | 'leave';

export interface SyncEvent {
  type: SyncEventType;
  /** When the sender created it, for the projection above. */
  timestamp: number;
  peerId: string;
  snapshot?: PlaybackSnapshot;
  isLeader?: boolean;
}

export interface SyncPeer {
  id: string;
  isLeader: boolean;
  joinedAt: number;
}

/** Apply a membership event to the peer list. */
export function applyMembership(
  peers: readonly SyncPeer[],
  event: SyncEvent,
  now: number
): SyncPeer[] {
  if (event.type === 'join') {
    if (peers.some((peer) => peer.id === event.peerId)) return peers as SyncPeer[];
    return [...peers, { id: event.peerId, isLeader: event.isLeader === true, joinedAt: now }];
  }

  if (event.type === 'leave') {
    return peers.filter((peer) => peer.id !== event.peerId);
  }

  return peers as SyncPeer[];
}

/**
 * Who leads once the current leader is gone.
 *
 * The earliest remaining peer, so every client picks the same one without
 * having to agree on anything — the room would otherwise need a negotiation it
 * has no channel for.
 */
export function successorLeader(peers: readonly SyncPeer[]): string | null {
  if (peers.length === 0) return null;

  // A plain relational comparison, not `localeCompare`: that one uses the host
  // locale, whose ordering of punctuation against digits is not guaranteed to
  // match between two clients — and peer ids contain hyphens. Two clients
  // ordering a tie differently is two leaders.
  return [...peers].sort((a, b) => {
    if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
  })[0].id;
}
