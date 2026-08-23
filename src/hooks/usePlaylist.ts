import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Track, RepeatMode, PlaylistState, PlaylistControls } from '@/types/player';
import * as core from '@/core/playlist';

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

/**
 * React binding over the framework-neutral playlist core.
 *
 * All the queue rules — traversal, shuffle order, history, repeat — live in
 * `@/core/playlist` as plain functions. This file is what is left once they are
 * gone: state React owns, callbacks announced after a transition, and the
 * effect that adopts a list arriving late. A Vue or Angular binding would be
 * the same shape and the same size, over the identical core.
 *
 * That split is the point of Phase 3 in ROADMAP.md. It also means the rules are
 * testable without a renderer, and cannot drift between frameworks because
 * there is only one copy of them.
 */
export function usePlaylist(options: UsePlaylistOptions = {}): UsePlaylistReturn {
  const {
    tracks: initialTracks = [],
    initialIndex = 0,
    shuffle: initialShuffle = false,
    repeat: initialRepeat = 'none',
    onTrackChange,
    onQueueEnd,
  } = options;

  const [state, setState] = useState<core.PlaylistCoreState>(() =>
    core.reshuffle(
      core.createPlaylistState({
        tracks: initialTracks,
        initialIndex,
        shuffle: initialShuffle,
        repeat: initialRepeat,
      })
    )
  );

  /**
   * The current state, readable synchronously.
   *
   * A transition needs the state it starts from, and reading it out of the
   * `setState` updater would mean announcing callbacks from inside one — which
   * React may run more than once, firing `onTrackChange` more than once with
   * it. Every mutation goes through `commit`, so the ref and the state never
   * disagree.
   */
  const stateRef = useRef(state);

  const commit = useCallback((nextState: core.PlaylistCoreState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  // Callbacks are held in refs so a caller passing inline arrow functions —
  // which is every caller — does not have to memoise them to keep the controls
  // stable.
  const onTrackChangeRef = useRef(onTrackChange);
  const onQueueEndRef = useRef(onQueueEnd);
  useEffect(() => {
    onTrackChangeRef.current = onTrackChange;
    onQueueEndRef.current = onQueueEnd;
  }, [onTrackChange, onQueueEnd]);

  /** Apply a transition and announce what it produced, synchronously. */
  const apply = useCallback(
    (transition: (s: core.PlaylistCoreState) => core.PlaylistTransition) => {
      const { state: nextState, effect } = transition(stateRef.current);
      commit(nextState);

      if (effect.trackChanged) {
        onTrackChangeRef.current?.(effect.trackChanged.track, effect.trackChanged.index);
      }
      if (effect.queueEnded) {
        onQueueEndRef.current?.();
      }
    },
    [commit]
  );

  /** Apply a plain state change with nothing to announce. */
  const update = useCallback(
    (change: (s: core.PlaylistCoreState) => core.PlaylistCoreState) => {
      commit(change(stateRef.current));
    },
    [commit]
  );

  // Adopt a genuinely different track list — see `adoptTracks` for why the
  // comparison is by content rather than by identity.
  const incomingSignature = useMemo(
    () => core.trackListSignature(initialTracks),
    [initialTracks]
  );
  const adoptedSignatureRef = useRef(incomingSignature);

  useEffect(() => {
    if (adoptedSignatureRef.current === incomingSignature) return;
    adoptedSignatureRef.current = incomingSignature;
    commit(core.adoptTracks(stateRef.current, initialTracks));
  }, [incomingSignature, initialTracks, commit]);

  const controls = useMemo<PlaylistControls>(
    () => ({
      next: () => apply((s) => core.next(s)),
      previous: () => apply(core.previous),
      goToTrack: (index) => apply((s) => core.goToTrack(s, index)),
      setRepeat: (mode) => update((s) => core.setRepeat(s, mode)),
      toggleShuffle: () => update((s) => core.toggleShuffle(s)),
      addToQueue: (track) => update((s) => core.addToQueue(s, track)),
      removeFromQueue: (index) => update((s) => core.removeFromQueue(s, index)),
      clearQueue: () => update(core.clearQueue),
    }),
    [apply, update]
  );

  return { state, controls };
}
