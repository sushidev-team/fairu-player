import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_TOLERANCES,
  applyMembership,
  decideCorrection,
  hasWork,
  successorLeader,
  type Correction,
  type PlaybackSnapshot,
  type SyncEvent,
  type SyncPeer,
  type SyncTolerances,
} from '@/core/playbackSync';

export type SyncConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * How events reach the other clients.
 *
 * Deliberately an interface with no implementation opinion: a relay server is
 * outside this package's scope, and hosts already have one — a WebSocket, a
 * realtime database, a peer connection. `createWebSocketSyncTransport` is a
 * reference, not a requirement.
 */
export interface SyncTransport {
  connect: (roomId: string, peerId: string) => Promise<void>;
  disconnect: () => void;
  send: (event: SyncEvent) => void;
  onMessage: (listener: (event: SyncEvent) => void) => () => void;
  onConnectionChange: (listener: (state: SyncConnectionState) => void) => () => void;
}

export interface UseSyncPlaybackOptions {
  transport: SyncTransport;
  /** The local player, read whenever something needs sending or comparing. */
  getSnapshot: () => PlaybackSnapshot;
  /** Applied to the local player when the leader has moved on. */
  applyCorrection: (correction: Correction) => void;
  /** Start as the one everyone follows. */
  isLeader?: boolean;
  tolerances?: Partial<SyncTolerances>;
  onPeerJoin?: (peer: SyncPeer) => void;
  onPeerLeave?: (peerId: string) => void;
  onError?: (error: Error) => void;
}

export interface UseSyncPlaybackReturn {
  peerId: string;
  roomId: string | null;
  peers: SyncPeer[];
  isLeader: boolean;
  connectionState: SyncConnectionState;
  createRoom: (roomId?: string) => Promise<string>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
  /** Tell the room where this player is. Only the leader is followed. */
  broadcast: (type: 'play' | 'pause' | 'seek' | 'rate' | 'state') => void;
}

let counter = 0;
function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/**
 * Watch-together, from the client side.
 *
 * The decisions live in `@/core/playbackSync`; the transport is the host's.
 * What is here is the wiring, and one thing that is easy to get wrong: applying
 * a correction moves the local player, which is exactly what would normally be
 * broadcast. Without a guard, two clients bounce a seek back and forth for as
 * long as they are connected.
 */
export function useSyncPlayback(options: UseSyncPlaybackOptions): UseSyncPlaybackReturn {
  const {
    transport,
    getSnapshot,
    applyCorrection,
    isLeader: initialIsLeader = false,
    tolerances,
    onPeerJoin,
    onPeerLeave,
    onError,
  } = options;

  const [peerId] = useState(() => makeId('peer'));
  const [roomId, setRoomId] = useState<string | null>(null);
  const [peers, setPeers] = useState<SyncPeer[]>([]);
  const [isLeader, setIsLeader] = useState(initialIsLeader);
  /**
   * Whether a leader has ever announced itself here.
   *
   * Succession cannot be derived from the peer list alone: a client that has
   * just joined is also the only peer it knows about, and would crown itself
   * while the actual leader — who joined before it and whose announcement it
   * never saw — is still there. Two leaders is worse than none.
   */
  const [sawLeader, setSawLeader] = useState(false);
  const [connectionState, setConnectionState] = useState<SyncConnectionState>('disconnected');

  const live = useRef({
    getSnapshot,
    applyCorrection,
    onPeerJoin,
    onPeerLeave,
    onError,
    isLeader: initialIsLeader,
  });

  /** Set while a remote correction is being applied — see the note above. */
  const applyingRef = useRef(false);
  /** The peer list, readable from the message handler without a stale closure. */
  const peersRef = useRef<SyncPeer[]>([]);

  const limits = useMemo<SyncTolerances>(
    () => ({ ...DEFAULT_TOLERANCES, ...tolerances }),
    [tolerances]
  );

  useEffect(() => {
    const offMessage = transport.onMessage((event) => {
      if (event.peerId === peerId) return;

      if (event.type === 'join' || event.type === 'leave') {
        // Computed here rather than inside the updater. React may run an
        // updater more than once for one queued update — in StrictMode it
        // always does — and a host counting `onPeerJoin` would see the same
        // arrival twice with no way to tell from outside.
        const next = applyMembership(peersRef.current, event, Date.now());
        if (next === peersRef.current) return;

        peersRef.current = next;
        setPeers(next);

        if (event.type === 'join') {
          const joined = next.find((peer) => peer.id === event.peerId);
          if (joined?.isLeader) setSawLeader(true);
          if (joined) live.current.onPeerJoin?.(joined);
        } else {
          live.current.onPeerLeave?.(event.peerId);
        }
        return;
      }

      /*
        Follow the leader — which means checking who *sent* this, not merely
        that the receiver is not leading.

        `broadcast` sends on any local play, pause or seek, so in an ordinary
        room every follower announces its own moves. Testing only "am I the
        leader" made every follower obey every other follower, and two of them
        pulling the playhead against each other is not something the echo guard
        can help with.
      */
      if (!event.isLeader || live.current.isLeader || !event.snapshot) return;

      const correction = decideCorrection(
        live.current.getSnapshot(),
        event.snapshot,
        event.timestamp,
        Date.now(),
        limits
      );
      if (!hasWork(correction)) return;

      applyingRef.current = true;
      try {
        live.current.applyCorrection(correction);
      } finally {
        applyingRef.current = false;
      }
    });

    const offState = transport.onConnectionChange(setConnectionState);

    return () => {
      offMessage();
      offState();
    };
  }, [transport, peerId, limits]);

  /**
   * Leadership, derived rather than tracked.
   *
   * Claimed on creating a room — and inherited when nobody in the room claims
   * it, which is what happens once the leader leaves. Deriving it means every
   * client reaches the same answer from the same peer list, with no round of
   * agreement that the room has no channel for.
   */
  const effectiveIsLeader =
    isLeader ||
    (sawLeader && peers.length > 0 && !peers.some((peer) => peer.isLeader)
      ? successorLeader(peers) === peerId
      : false);

  useEffect(() => {
    live.current = {
      getSnapshot,
      applyCorrection,
      onPeerJoin,
      onPeerLeave,
      onError,
      isLeader: effectiveIsLeader,
    };
  });

  const announce = useCallback(
    (type: SyncEvent['type'], leader: boolean) => {
      transport.send({
        type,
        timestamp: Date.now(),
        peerId,
        isLeader: leader,
        snapshot: type === 'join' || type === 'leave' ? undefined : live.current.getSnapshot(),
      });
    },
    [transport, peerId]
  );

  const enter = useCallback(
    async (room: string, leader: boolean) => {
      try {
        await transport.connect(room, peerId);
        setIsLeader(leader);
        setRoomId(room);
        setSawLeader(leader);
        peersRef.current = [{ id: peerId, isLeader: leader, joinedAt: Date.now() }];
        setPeers(peersRef.current);
        announce('join', leader);
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error(String(cause));
        live.current.onError?.(error);
        setConnectionState('error');
        throw error;
      }
    },
    [transport, peerId, announce]
  );

  const createRoom = useCallback(
    async (room?: string) => {
      const id = room ?? makeId('room');
      await enter(id, true);
      return id;
    },
    [enter]
  );

  const joinRoom = useCallback((room: string) => enter(room, false), [enter]);

  const leaveRoom = useCallback(() => {
    if (!roomId) return;
    announce('leave', effectiveIsLeader);
    transport.disconnect();
    setRoomId(null);
    peersRef.current = [];
    setPeers([]);
    setIsLeader(false);
    setSawLeader(false);
  }, [roomId, effectiveIsLeader, announce, transport]);

  const broadcast = useCallback(
    (type: 'play' | 'pause' | 'seek' | 'rate' | 'state') => {
      // The echo guard. A correction moves the local player, and moving the
      // local player is what would normally be announced.
      if (applyingRef.current || !roomId) return;
      announce(type, effectiveIsLeader);
    },
    [announce, roomId, effectiveIsLeader]
  );

  return useMemo(
    () => ({
      peerId,
      roomId,
      peers,
      isLeader: effectiveIsLeader,
      connectionState,
      createRoom,
      joinRoom,
      leaveRoom,
      broadcast,
    }),
    [
      peerId,
      roomId,
      peers,
      effectiveIsLeader,
      connectionState,
      createRoom,
      joinRoom,
      leaveRoom,
      broadcast,
    ]
  );
}
