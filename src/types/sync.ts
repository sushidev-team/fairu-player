/**
 * Sync event types sent between peers
 */
export type SyncEventType = 'play' | 'pause' | 'seek' | 'playbackRate' | 'join' | 'leave' | 'state';

export interface SyncEvent {
  type: SyncEventType;
  /** Timestamp when this event was created (for latency compensation) */
  timestamp: number;
  /** The peer who originated this event */
  peerId: string;
  /** Event payload */
  data: SyncEventData;
}

export type SyncEventData =
  | { type: 'play'; currentTime: number }
  | { type: 'pause'; currentTime: number }
  | { type: 'seek'; currentTime: number }
  | { type: 'playbackRate'; rate: number }
  | { type: 'join'; peerId: string; isLeader: boolean }
  | { type: 'leave'; peerId: string }
  | { type: 'state'; currentTime: number; isPlaying: boolean; playbackRate: number };

export interface SyncPeer {
  id: string;
  isLeader: boolean;
  joinedAt: number;
}

export type SyncConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SyncRoomInfo {
  roomId: string;
  peers: SyncPeer[];
  leaderId: string | null;
}

/**
 * Transport interface — users can implement their own transport
 * (WebSocket, WebRTC, Firebase, etc.)
 */
export interface SyncTransport {
  /** Connect to a room */
  connect(roomId: string, peerId: string): Promise<void>;
  /** Disconnect from the room */
  disconnect(): void;
  /** Send a sync event to all peers in the room */
  send(event: SyncEvent): void;
  /** Register a listener for incoming sync events */
  onMessage(callback: (event: SyncEvent) => void): void;
  /** Register a listener for connection state changes */
  onConnectionChange(callback: (state: SyncConnectionState) => void): void;
  /** Get current connection state */
  getConnectionState(): SyncConnectionState;
}

export interface UseSyncPlaybackOptions {
  /** Transport implementation. If not provided, uses default WebSocket transport. */
  transport?: SyncTransport;
  /** WebSocket server URL (only used if no custom transport is provided) */
  serverUrl?: string;
  /** Whether this peer should be the leader. Default: false (auto-detect) */
  isLeader?: boolean;
  /** Callbacks */
  onPeerJoin?: (peer: SyncPeer) => void;
  onPeerLeave?: (peerId: string) => void;
  onConnectionChange?: (state: SyncConnectionState) => void;
  onError?: (error: Error) => void;
}

export interface UseSyncPlaybackReturn {
  /** Create a new room and return the room ID */
  createRoom: () => Promise<string>;
  /** Join an existing room */
  joinRoom: (roomId: string) => Promise<void>;
  /** Leave the current room */
  leaveRoom: () => void;
  /** Send a play event to all peers */
  syncPlay: (currentTime: number) => void;
  /** Send a pause event to all peers */
  syncPause: (currentTime: number) => void;
  /** Send a seek event to all peers */
  syncSeek: (currentTime: number) => void;
  /** Send a playback rate change to all peers */
  syncPlaybackRate: (rate: number) => void;
  /** Request full state from the leader */
  requestState: () => void;
  /** Current connection state */
  connectionState: SyncConnectionState;
  /** Current room info */
  room: SyncRoomInfo | null;
  /** This peer's ID */
  peerId: string;
  /** Whether this peer is the leader */
  isLeader: boolean;
  /** List of peers in the room */
  peers: SyncPeer[];
}
