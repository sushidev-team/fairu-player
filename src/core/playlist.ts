import type { Track, RepeatMode, PlaylistState } from '@/types/player';

/**
 * The playlist, as plain state and plain functions.
 *
 * This is the first slice of the framework-neutral core described in Phase 3 of
 * ROADMAP.md. Nothing here imports React: every operation takes the current
 * state and returns the next one, plus whatever the caller should announce.
 * The React hook becomes a thin binding over it, and a Vue or Angular adapter
 * would be an equally thin one — the queue rules stop being reimplemented once
 * per framework, which is the whole point.
 *
 * Pure by construction. The functions never mutate their input and never invoke
 * a callback themselves; they *describe* what happened and let the binding
 * dispatch it. That is what makes the rules testable without a renderer.
 */

/** Everything the playlist keeps, including the parts the UI never shows. */
export interface PlaylistCoreState extends PlaylistState {
  /**
   * Traversal order while shuffling — indices into `tracks`, current first.
   *
   * Empty while shuffle is off. Kept in state rather than derived because it
   * has to stay stable between two `next()` calls; deriving it would reshuffle
   * on every read.
   */
  shuffledOrder: number[];
}

/** What a transition wants the caller to announce. */
export interface PlaylistEffect {
  /** A track became current. */
  trackChanged?: { track: Track; index: number };
  /** Traversal ran out and nothing repeats. */
  queueEnded?: true;
}

export interface PlaylistTransition {
  state: PlaylistCoreState;
  effect: PlaylistEffect;
}

/** A transition that changed nothing worth announcing. */
function unchanged(state: PlaylistCoreState): PlaylistTransition {
  return { state, effect: {} };
}

/**
 * Fisher–Yates. `random` is injectable so a test can pin the permutation —
 * shuffle behaviour is otherwise only assertable as a probability.
 */
export function shuffleArray<T>(array: T[], random: () => number = Math.random): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Shuffle the indices, then bring `current` to the front.
 *
 * Traversal follows this array and the cursor stays where it was, so a
 * permutation that left the current index at the end would end the queue on the
 * very next step. Front-loading it is also what a listener expects: hitting
 * shuffle keeps this track playing and reorders what comes after.
 */
export function shuffleWithCurrentFirst(
  indices: number[],
  current: number,
  random: () => number = Math.random
): number[] {
  const shuffled = shuffleArray(indices, random);
  const position = shuffled.indexOf(current);
  if (position <= 0) return shuffled;

  const reordered = [...shuffled];
  reordered.splice(position, 1);
  reordered.unshift(current);
  return reordered;
}

/**
 * A content-based identity for a track list.
 *
 * Callers build the array inline, so it is a new reference on every render and
 * comparing by identity would resync forever. `src` counts as much as `id`:
 * signed URLs expire and get re-issued under the same id, and an id-only
 * signature would leave the player pointed at a dead source.
 *
 * NUL separates the fields — the one character that cannot appear in an id or a
 * URL, so two different lists cannot collapse into one signature.
 */
export function trackListSignature(tracks: Track[]): string {
  return tracks.map((track) => `${track.id}\u0000${track.src}`).join('\u0000');
}


export interface CreatePlaylistOptions {
  tracks?: Track[];
  initialIndex?: number;
  shuffle?: boolean;
  repeat?: RepeatMode;
}

export function createPlaylistState(options: CreatePlaylistOptions = {}): PlaylistCoreState {
  const { tracks = [], initialIndex = 0, shuffle = false, repeat = 'none' } = options;

  return {
    tracks,
    currentIndex: initialIndex,
    currentTrack: tracks[initialIndex] ?? null,
    shuffle,
    repeat,
    queue: [],
    history: [],
    shuffledOrder: [],
  };
}

/** Recompute `currentTrack` after anything that moves the cursor. */
function withCursor(state: PlaylistCoreState, currentIndex: number): PlaylistCoreState {
  return {
    ...state,
    currentIndex,
    currentTrack: state.tracks[currentIndex] ?? null,
  };
}

/** Rebuild the shuffled order for the current list and cursor. */
export function reshuffle(state: PlaylistCoreState, random?: () => number): PlaylistCoreState {
  if (!state.shuffle || state.tracks.length === 0) {
    return { ...state, shuffledOrder: [] };
  }

  const indices = state.tracks.map((_, i) => i);
  return {
    ...state,
    shuffledOrder: shuffleWithCurrentFirst(indices, state.currentIndex, random),
  };
}

/**
 * Adopt a replacement track list.
 *
 * Filling an empty list is the late-fetch case and leaves the cursor alone.
 * Replacing a list that was already playing invalidates the cursor and
 * everything derived from it, so history and queue go with it.
 */
export function adoptTracks(
  state: PlaylistCoreState,
  tracks: Track[],
  random?: () => number
): PlaylistCoreState {
  const hadTracks = state.tracks.length > 0;

  const next: PlaylistCoreState = hadTracks
    ? { ...state, tracks, currentIndex: 0, history: [], queue: [] }
    : { ...state, tracks };

  return reshuffle(withCursor(next, next.currentIndex), random);
}

export function goToTrack(state: PlaylistCoreState, index: number): PlaylistTransition {
  if (index < 0 || index >= state.tracks.length) return unchanged(state);

  const track = state.tracks[index];
  const history = state.currentTrack ? [...state.history, state.currentTrack] : state.history;

  return {
    state: withCursor({ ...state, history }, index),
    effect: { trackChanged: { track, index } },
  };
}

export function next(state: PlaylistCoreState, random?: () => number): PlaylistTransition {
  // The queue jumps the ordinary order.
  if (state.queue.length > 0) {
    const queued = state.queue[0];
    const queue = state.queue.slice(1);
    const index = state.tracks.findIndex((t) => t.id === queued.id);

    if (index === -1) {
      // A queued track that is not in the list has nothing to switch to; drop
      // it rather than leaving it stuck at the head forever.
      return unchanged({ ...state, queue });
    }

    const history = state.currentTrack ? [...state.history, state.currentTrack] : state.history;
    return {
      state: withCursor({ ...state, queue, history }, index),
      effect: { trackChanged: { track: queued, index } },
    };
  }

  // Repeat-one restarts rather than advancing, but still announces — which is
  // what makes the track begin again instead of sitting at its end.
  if (state.repeat === 'one') {
    const track = state.tracks[state.currentIndex];
    return track
      ? { state, effect: { trackChanged: { track, index: state.currentIndex } } }
      : unchanged(state);
  }

  let nextIndex: number;
  let nextState = state;

  if (state.shuffle) {
    const position = state.shuffledOrder.indexOf(state.currentIndex);
    const following = position + 1;

    if (following >= state.shuffledOrder.length) {
      if (state.repeat !== 'all') return { state, effect: { queueEnded: true } };

      // Read the index off the *new* order, not the one being replaced.
      const reshuffled = shuffleArray(state.shuffledOrder, random);
      nextState = { ...state, shuffledOrder: reshuffled };
      nextIndex = reshuffled[0];
    } else {
      nextIndex = state.shuffledOrder[following];
    }
  } else {
    nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.tracks.length) {
      if (state.repeat !== 'all') return { state, effect: { queueEnded: true } };
      nextIndex = 0;
    }
  }

  const track = nextState.tracks[nextIndex];
  if (!track) return unchanged(state);

  const history = state.currentTrack ? [...state.history, state.currentTrack] : state.history;
  return {
    state: withCursor({ ...nextState, history }, nextIndex),
    effect: { trackChanged: { track, index: nextIndex } },
  };
}

export function previous(state: PlaylistCoreState): PlaylistTransition {
  // History wins: "previous" means where the listener came from, which is not
  // necessarily the track before this one in the list.
  if (state.history.length > 0) {
    const previousTrack = state.history[state.history.length - 1];
    const history = state.history.slice(0, -1);
    const index = state.tracks.findIndex((t) => t.id === previousTrack.id);

    if (index === -1) return unchanged({ ...state, history });

    return {
      state: withCursor({ ...state, history }, index),
      effect: { trackChanged: { track: previousTrack, index } },
    };
  }

  let prevIndex: number;

  if (state.shuffle) {
    const position = state.shuffledOrder.indexOf(state.currentIndex);
    const preceding = position - 1;

    if (preceding < 0) {
      if (state.repeat !== 'all') return unchanged(state);
      prevIndex = state.shuffledOrder[state.shuffledOrder.length - 1];
    } else {
      prevIndex = state.shuffledOrder[preceding];
    }
  } else {
    prevIndex = state.currentIndex - 1;
    if (prevIndex < 0) {
      if (state.repeat !== 'all') return unchanged(state);
      prevIndex = state.tracks.length - 1;
    }
  }

  const track = state.tracks[prevIndex];
  if (!track) return unchanged(state);

  return {
    state: withCursor(state, prevIndex),
    effect: { trackChanged: { track, index: prevIndex } },
  };
}

export function setRepeat(state: PlaylistCoreState, repeat: RepeatMode): PlaylistCoreState {
  return { ...state, repeat };
}

export function toggleShuffle(
  state: PlaylistCoreState,
  random?: () => number
): PlaylistCoreState {
  return reshuffle({ ...state, shuffle: !state.shuffle }, random);
}

export function addToQueue(state: PlaylistCoreState, track: Track): PlaylistCoreState {
  return { ...state, queue: [...state.queue, track] };
}

export function removeFromQueue(state: PlaylistCoreState, index: number): PlaylistCoreState {
  return { ...state, queue: state.queue.filter((_, i) => i !== index) };
}

export function clearQueue(state: PlaylistCoreState): PlaylistCoreState {
  return { ...state, queue: [] };
}
