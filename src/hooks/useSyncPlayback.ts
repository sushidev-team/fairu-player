import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  SyncEvent,
  SyncPeer,
  SyncConnectionState,
  SyncRoomInfo,
  UseSyncPlaybackOptions,
  UseSyncPlaybackReturn,
} from '@/types/sync';
import { WebSocketSyncTransport } from '@/services/SyncService';

function generatePeerId(): string {
  return `peer-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function generateRoomId(): string {
  return `room-${Math.random().toString(36).substring(2, 8)}`;
}

export function useSyncPlayback(options: UseSyncPlaybackOptions = {}): UseSyncPlaybackReturn {
  const {
    transport: customTransport,
    serverUrl,
    isLeader: initialIsLeader = false,
    onPeerJoin,
    onPeerLeave,
    onConnectionChange: onConnectionChangeCallback,
    onError,
  } = options;

  const [peerId] = useState(() => generatePeerId());
  const [isLeader, setIsLeader] = useState(initialIsLeader);
  const [connectionState, setConnectionState] = useState<SyncConnectionState>('disconnected');
  const [room, setRoom] = useState<SyncRoomInfo | null>(null);
  const [peers, setPeers] = useState<SyncPeer[]>([]);

  const transportRef = useRef(customTransport ?? (serverUrl ? new WebSocketSyncTransport(serverUrl) : null));

  // Stable refs for callbacks
  const onPeerJoinRef = useRef(onPeerJoin);
  onPeerJoinRef.current = onPeerJoin;
  const onPeerLeaveRef = useRef(onPeerLeave);
  onPeerLeaveRef.current = onPeerLeave;
  const onConnectionChangeRef = useRef(onConnectionChangeCallback);
  onConnectionChangeRef.current = onConnectionChangeCallback;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Set up transport listeners
  useEffect(() => {
    const transport = transportRef.current;
    if (!transport) return;

    transport.onConnectionChange((state) => {
      setConnectionState(state);
      onConnectionChangeRef.current?.(state);
    });

    transport.onMessage((event: SyncEvent) => {
      const data = event.data;

      switch (data.type) {
        case 'join': {
          const newPeer: SyncPeer = {
            id: data.peerId,
            isLeader: data.isLeader,
            joinedAt: Date.now(),
          };
          setPeers((prev) => {
            if (prev.some((p) => p.id === data.peerId)) return prev;
            return [...prev, newPeer];
          });
          onPeerJoinRef.current?.(newPeer);
          break;
        }

        case 'leave': {
          setPeers((prev) => prev.filter((p) => p.id !== data.peerId));
          onPeerLeaveRef.current?.(data.peerId);
          break;
        }

        default:
          break;
      }
    });
  }, []);

  const createRoom = useCallback(async (): Promise<string> => {
    const transport = transportRef.current;
    if (!transport) {
      throw new Error('No sync transport configured. Provide a transport or serverUrl.');
    }

    const roomId = generateRoomId();
    setIsLeader(true);

    try {
      await transport.connect(roomId, peerId);

      const selfPeer: SyncPeer = { id: peerId, isLeader: true, joinedAt: Date.now() };
      setPeers([selfPeer]);
      setRoom({ roomId, peers: [selfPeer], leaderId: peerId });

      // Announce join
      transport.send({
        type: 'join',
        timestamp: Date.now(),
        peerId,
        data: { type: 'join', peerId, isLeader: true },
      });

      return roomId;
    } catch (err) {
      onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [peerId]);

  const joinRoom = useCallback(async (roomId: string): Promise<void> => {
    const transport = transportRef.current;
    if (!transport) {
      throw new Error('No sync transport configured. Provide a transport or serverUrl.');
    }

    setIsLeader(false);

    try {
      await transport.connect(roomId, peerId);

      const selfPeer: SyncPeer = { id: peerId, isLeader: false, joinedAt: Date.now() };
      setPeers([selfPeer]);
      setRoom({ roomId, peers: [selfPeer], leaderId: null });

      // Announce join
      transport.send({
        type: 'join',
        timestamp: Date.now(),
        peerId,
        data: { type: 'join', peerId, isLeader: false },
      });
    } catch (err) {
      onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [peerId]);

  const leaveRoom = useCallback(() => {
    const transport = transportRef.current;
    if (!transport) return;

    transport.send({
      type: 'leave',
      timestamp: Date.now(),
      peerId,
      data: { type: 'leave', peerId },
    });

    transport.disconnect();
    setRoom(null);
    setPeers([]);
    setIsLeader(false);
  }, [peerId]);

  const syncPlay = useCallback((currentTime: number) => {
    transportRef.current?.send({
      type: 'play',
      timestamp: Date.now(),
      peerId,
      data: { type: 'play', currentTime },
    });
  }, [peerId]);

  const syncPause = useCallback((currentTime: number) => {
    transportRef.current?.send({
      type: 'pause',
      timestamp: Date.now(),
      peerId,
      data: { type: 'pause', currentTime },
    });
  }, [peerId]);

  const syncSeek = useCallback((currentTime: number) => {
    transportRef.current?.send({
      type: 'seek',
      timestamp: Date.now(),
      peerId,
      data: { type: 'seek', currentTime },
    });
  }, [peerId]);

  const syncPlaybackRate = useCallback((rate: number) => {
    transportRef.current?.send({
      type: 'playbackRate',
      timestamp: Date.now(),
      peerId,
      data: { type: 'playbackRate', rate },
    });
  }, [peerId]);

  const requestState = useCallback(() => {
    // Request full state from leader — leader should respond with a 'state' event
    transportRef.current?.send({
      type: 'state',
      timestamp: Date.now(),
      peerId,
      data: { type: 'state', currentTime: 0, isPlaying: false, playbackRate: 1 },
    });
  }, [peerId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      transportRef.current?.disconnect();
    };
  }, []);

  return {
    createRoom,
    joinRoom,
    leaveRoom,
    syncPlay,
    syncPause,
    syncSeek,
    syncPlaybackRate,
    requestState,
    connectionState,
    room,
    peerId,
    isLeader,
    peers,
  };
}
