import type { SyncTransport, SyncEvent, SyncConnectionState } from '@/types/sync';

/**
 * Default WebSocket-based sync transport.
 * Expects a WebSocket server that relays messages between room peers.
 *
 * Protocol:
 * - Client sends: { action: 'join', roomId, peerId } to join a room
 * - Client sends: { action: 'leave' } to leave
 * - Client sends: { action: 'broadcast', event: SyncEvent } to broadcast to room
 * - Server relays broadcast events to all other peers in the room
 */
export class WebSocketSyncTransport implements SyncTransport {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private messageCallback: ((event: SyncEvent) => void) | null = null;
  private connectionCallback: ((state: SyncConnectionState) => void) | null = null;
  private state: SyncConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private roomId: string | null = null;
  private peerId: string | null = null;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  async connect(roomId: string, peerId: string): Promise<void> {
    this.roomId = roomId;
    this.peerId = peerId;
    this.reconnectAttempts = 0;

    return new Promise((resolve, reject) => {
      try {
        this.setState('connecting');
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          this.setState('connected');
          this.reconnectAttempts = 0;
          // Join the room
          this.ws?.send(JSON.stringify({
            action: 'join',
            roomId,
            peerId,
          }));
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event && this.messageCallback) {
              this.messageCallback(data.event as SyncEvent);
            }
          } catch {
            // Invalid message - ignore
          }
        };

        this.ws.onclose = () => {
          this.setState('disconnected');
          this.attemptReconnect();
        };

        this.ws.onerror = () => {
          this.setState('error');
          reject(new Error('WebSocket connection failed'));
        };
      } catch (err) {
        this.setState('error');
        reject(err);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnect

    if (this.ws) {
      try {
        this.ws.send(JSON.stringify({ action: 'leave' }));
      } catch {
        // Ignore
      }
      this.ws.close();
      this.ws = null;
    }

    this.roomId = null;
    this.peerId = null;
    this.setState('disconnected');
  }

  send(event: SyncEvent): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'broadcast',
        event,
      }));
    }
  }

  onMessage(callback: (event: SyncEvent) => void): void {
    this.messageCallback = callback;
  }

  onConnectionChange(callback: (state: SyncConnectionState) => void): void {
    this.connectionCallback = callback;
  }

  getConnectionState(): SyncConnectionState {
    return this.state;
  }

  private setState(state: SyncConnectionState): void {
    this.state = state;
    this.connectionCallback?.(state);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.roomId || !this.peerId) {
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);

    this.reconnectTimeout = setTimeout(() => {
      if (this.roomId && this.peerId) {
        this.connect(this.roomId, this.peerId).catch(() => {
          // Reconnect failed, will retry via onclose
        });
      }
    }, delay);
  }
}
