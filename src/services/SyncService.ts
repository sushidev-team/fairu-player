import type { SyncEvent } from '@/core/playbackSync';
import type { SyncConnectionState, SyncTransport } from '@/hooks/useSyncPlayback';

/**
 * A reference transport over a WebSocket relay.
 *
 * Ported from PR #16. It is deliberately a *reference*: a relay server is
 * outside this package, and every host already has one shape or another — a
 * realtime database, a peer connection, an existing socket. What matters is the
 * {@link SyncTransport} interface; this is one way to satisfy it, and a place
 * to read what the protocol has to do.
 *
 * The server has to relay a `broadcast` to every other client in the room:
 *
 * ```
 * → { action: 'join', roomId, peerId }
 * → { action: 'leave' }
 * → { action: 'broadcast', event }
 * ← { event }
 * ```
 */
export interface WebSocketSyncOptions {
  /** How often to retry a dropped connection before giving up. Default `5`. */
  maxRetries?: number;
  /** First retry delay in ms; doubles each time. Default `1000`. */
  retryDelayMs?: number;
}

export function createWebSocketSyncTransport(
  serverUrl: string,
  options: WebSocketSyncOptions = {}
): SyncTransport {
  const { maxRetries = 5, retryDelayMs = 1000 } = options;

  let socket: WebSocket | null = null;
  let room: string | null = null;
  let peer: string | null = null;
  let retries = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let closedOnPurpose = false;

  const messageListeners = new Set<(event: SyncEvent) => void>();
  const stateListeners = new Set<(state: SyncConnectionState) => void>();

  const setState = (state: SyncConnectionState) => {
    stateListeners.forEach((listener) => listener(state));
  };

  const open = (): Promise<void> =>
    new Promise((resolve, reject) => {
      setState('connecting');
      socket = new WebSocket(serverUrl);

      socket.onopen = () => {
        retries = 0;
        setState('connected');
        socket?.send(JSON.stringify({ action: 'join', roomId: room, peerId: peer }));
        resolve();
      };

      socket.onmessage = (message) => {
        try {
          const parsed = JSON.parse(String(message.data)) as { event?: SyncEvent };
          // A relay can send anything; only well-formed events are passed on,
          // and the hook still ignores its own.
          if (parsed.event && typeof parsed.event.type === 'string') {
            messageListeners.forEach((listener) => listener(parsed.event as SyncEvent));
          }
        } catch {
          // A frame that is not JSON is not ours.
        }
      };

      socket.onerror = () => {
        setState('error');
        reject(new Error(`Sync transport could not reach ${serverUrl}`));
      };

      socket.onclose = () => {
        if (closedOnPurpose) {
          setState('disconnected');
          return;
        }

        // Backing off rather than hammering: a relay that is down stays down
        // for a while, and a tight retry loop is how one client becomes a
        // denial of service.
        if (retries >= maxRetries) {
          setState('error');
          return;
        }

        setState('connecting');
        const delay = retryDelayMs * 2 ** retries;
        retries += 1;
        retryTimer = setTimeout(() => {
          void open().catch(() => {});
        }, delay);
      };
    });

  return {
    async connect(roomId, peerId) {
      closedOnPurpose = false;
      room = roomId;
      peer = peerId;
      await open();
    },

    disconnect() {
      closedOnPurpose = true;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;

      try {
        socket?.send(JSON.stringify({ action: 'leave' }));
      } catch {
        // Already gone.
      }
      socket?.close();
      socket = null;
      setState('disconnected');
    },

    send(event) {
      if (socket?.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ action: 'broadcast', event }));
    },

    onMessage(listener) {
      messageListeners.add(listener);
      return () => messageListeners.delete(listener);
    },

    onConnectionChange(listener) {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
  };
}
