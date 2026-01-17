import { useCallback, useMemo, useState } from 'react';
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

  // Update tracks when initialTracks changes
  useMemo(() => {
    if (initialTracks.length > 0 && tracks.length === 0) {
      setTracks(initialTracks);
    }
  }, [initialTracks, tracks.length]);

  // Generate shuffled order when shuffle is enabled
  useMemo(() => {
    if (shuffle && tracks.length > 0) {
      const indices = tracks.map((_, i) => i);
      setShuffledOrder(shuffleArray(indices));
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
          setShuffledOrder(shuffleArray([...shuffledOrder]));
          nextIndex = shuffledOrder[0];
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
