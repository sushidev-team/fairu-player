import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Track, RepeatMode, PlaylistState, PlaylistControls } from '@/types/player';

export interface UsePlaylistOptions {
  tracks?: Track[];
  initialIndex?: number;
  shuffle?: boolean;
  repeat?: RepeatMode;
  autoPlayNext?: boolean;
  onTrackChange?: (track: Track, index: number) => void;
  onQueueEnd?: () => void;
}

export interface UsePlaylistReturn {
  state: PlaylistState;
  controls: PlaylistControls;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Shuffle the indices, then bring `current` to the front.
 *
 * Traversal follows this array, and the cursor stays on whatever was already
 * playing when shuffle was switched on. If the permutation left that index at
 * the end, the very next `next()` would already be at the end of the order and
 * would end the queue after a single track — a one-in-N chance per session.
 *
 * Putting the current track first is also what listeners expect: hitting
 * shuffle keeps the current track playing and reorders what comes after it.
 */
function shuffleWithCurrentFirst(indices: number[], current: number): number[] {
  const shuffled = shuffleArray(indices);
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
 * Callers build the array inline (`[config.track]`), so it is a new reference
 * on every render and comparing by identity would resync endlessly. The ids are
 * what actually determine whether this is a different playlist.
 *
 * NUL separates them: it is the one character that cannot legitimately appear
 * in an id, so `['a', 'b']` and `['a b']` cannot collapse into one signature.
 */
function trackListSignature(tracks: Track[]): string {
  return tracks.map((track) => track.id).join('\u0000');
}

export function usePlaylist(options: UsePlaylistOptions = {}): UsePlaylistReturn {
  const {
    tracks: initialTracks = [],
    initialIndex = 0,
    shuffle: initialShuffle = false,
    repeat: initialRepeat = 'none',
    onTrackChange,
    onQueueEnd,
  } = options;

  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [shuffle, setShuffle] = useState(initialShuffle);
  const [repeat, setRepeat] = useState<RepeatMode>(initialRepeat);
  const [queue, setQueue] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [shuffledOrder, setShuffledOrder] = useState<number[]>([]);

  // `currentIndex` mirrored into a ref so the shuffle effect can read it
  // without listing it as a dependency — depending on it would reshuffle the
  // whole order every time the track advances.
  const currentIndexRef = useRef(currentIndex);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Adopt a genuinely different track list.
  //
  // This used to adopt only while `tracks` was empty, which handled the
  // async-fetch case but silently ignored a later playlist swap — changing
  // `config.track` did nothing. That is a sharp edge for the custom element in
  // particular, where rebinding `:config` / `[config]` is the ordinary way to
  // change media.
  //
  // Compared by content, not identity: callers build the array inline, so it is
  // a new reference on every render and an identity check would resync forever.
  //
  // (Both of these were `useMemo` calling setState. A memo runs during render
  // and may be discarded, so setState from inside one is an infinite-loop
  // hazard — and under StrictMode it fired twice, reshuffling on every pass.)
  const incomingSignature = useMemo(
    () => trackListSignature(initialTracks),
    [initialTracks]
  );
  const adoptedSignatureRef = useRef(incomingSignature);

  useEffect(() => {
    if (adoptedSignatureRef.current === incomingSignature) return;
    adoptedSignatureRef.current = incomingSignature;

    // Replacing a list that was already playing invalidates the cursor and
    // everything derived from it. Filling an empty list does not — that is the
    // late-fetch case, where `initialIndex` should still stand.
    const hadTracks = tracks.length > 0;
    setTracks(initialTracks);

    if (hadTracks) {
      setCurrentIndex(0);
      setHistory([]);
      setQueue([]);
    }
  }, [incomingSignature, initialTracks, tracks.length]);

  // Generate shuffled order when shuffle is enabled
  useEffect(() => {
    if (shuffle && tracks.length > 0) {
      const indices = tracks.map((_, i) => i);
      setShuffledOrder(shuffleWithCurrentFirst(indices, currentIndexRef.current));
    }
  }, [shuffle, tracks.length]);

  const currentTrack = useMemo(() => {
    if (tracks.length === 0) return null;
    return tracks[currentIndex] || null;
  }, [tracks, currentIndex]);


  // Go to specific track
  const goToTrack = useCallback((index: number) => {
    if (index < 0 || index >= tracks.length) return;

    const track = tracks[index];
    if (currentTrack) {
      setHistory((prev) => [...prev, currentTrack]);
    }
    setCurrentIndex(index);
    onTrackChange?.(track, index);
  }, [tracks, currentTrack, onTrackChange]);

  // Next track
  const next = useCallback(() => {
    // First check queue
    if (queue.length > 0) {
      const nextTrack = queue[0];
      setQueue((prev) => prev.slice(1));
      if (currentTrack) {
        setHistory((prev) => [...prev, currentTrack]);
      }
      // Find track in tracks array or add temporarily
      const trackIndex = tracks.findIndex((t) => t.id === nextTrack.id);
      if (trackIndex !== -1) {
        setCurrentIndex(trackIndex);
        onTrackChange?.(nextTrack, trackIndex);
      }
      return;
    }

    // Handle repeat modes
    if (repeat === 'one') {
      // Stay on current track, just restart it
      onTrackChange?.(tracks[currentIndex], currentIndex);
      return;
    }

    let nextIndex = currentIndex + 1;

    if (shuffle) {
      const currentShuffleIndex = shuffledOrder.indexOf(currentIndex);
      const nextShuffleIndex = currentShuffleIndex + 1;
      if (nextShuffleIndex >= shuffledOrder.length) {
        if (repeat === 'all') {
          // Read the index off the *new* order. It used to reshuffle and then
          // take `shuffledOrder[0]` from the old array, so the track that
          // played was not the one the fresh order started with.
          const reshuffled = shuffleArray(shuffledOrder);
          setShuffledOrder(reshuffled);
          nextIndex = reshuffled[0];
        } else {
          onQueueEnd?.();
          return;
        }
      } else {
        nextIndex = shuffledOrder[nextShuffleIndex];
      }
    } else {
      if (nextIndex >= tracks.length) {
        if (repeat === 'all') {
          nextIndex = 0;
        } else {
          onQueueEnd?.();
          return;
        }
      }
    }

    if (currentTrack) {
      setHistory((prev) => [...prev, currentTrack]);
    }
    setCurrentIndex(nextIndex);
    onTrackChange?.(tracks[nextIndex], nextIndex);
  }, [
    queue,
    repeat,
    shuffle,
    shuffledOrder,
    currentIndex,
    currentTrack,
    tracks,
    onTrackChange,
    onQueueEnd,
  ]);

  // Previous track
  const previous = useCallback(() => {
    // If we have history, go back to previous track
    if (history.length > 0) {
      const previousTrack = history[history.length - 1];
      setHistory((prev) => prev.slice(0, -1));
      const trackIndex = tracks.findIndex((t) => t.id === previousTrack.id);
      if (trackIndex !== -1) {
        setCurrentIndex(trackIndex);
        onTrackChange?.(previousTrack, trackIndex);
      }
      return;
    }

    // Otherwise, go to previous in order
    let prevIndex = currentIndex - 1;

    if (shuffle) {
      const currentShuffleIndex = shuffledOrder.indexOf(currentIndex);
      const prevShuffleIndex = currentShuffleIndex - 1;
      if (prevShuffleIndex < 0) {
        if (repeat === 'all') {
          prevIndex = shuffledOrder[shuffledOrder.length - 1];
        } else {
          return;
        }
      } else {
        prevIndex = shuffledOrder[prevShuffleIndex];
      }
    } else {
      if (prevIndex < 0) {
        if (repeat === 'all') {
          prevIndex = tracks.length - 1;
        } else {
          return;
        }
      }
    }

    setCurrentIndex(prevIndex);
    onTrackChange?.(tracks[prevIndex], prevIndex);
  }, [history, shuffle, shuffledOrder, currentIndex, repeat, tracks, onTrackChange]);

  // Toggle shuffle
  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => !prev);
  }, []);

  // Add to queue
  const addToQueue = useCallback((track: Track) => {
    setQueue((prev) => [...prev, track]);
  }, []);

  // Remove from queue
  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Clear queue
  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const state: PlaylistState = {
    tracks,
    currentIndex,
    currentTrack,
    shuffle,
    repeat,
    queue,
    history,
  };

  const controls: PlaylistControls = {
    next,
    previous,
    goToTrack,
    setRepeat,
    toggleShuffle,
    addToQueue,
    removeFromQueue,
    clearQueue,
  };

  return { state, controls };
}
