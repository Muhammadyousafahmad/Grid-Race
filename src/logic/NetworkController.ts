import Peer, { DataConnection, PeerOptions } from 'peerjs';
import { Board } from './Board';
import { OpponentController, GameAction } from './TurnManager';

export interface NetworkPayload {
  type: 'ACTION' | 'READY';
  action?: GameAction;
}

/**
 * Checks whether the application is running on localhost during local development.
 */
export function isLocalhost(): boolean {
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname === ''
    );
  }
  return false;
}

/**
 * Returns the PeerJS configuration options based on environment:
 * - Localhost: host 'localhost', port 9000, path '/myapp', secure false
 * - Production: host '0.peerjs.com', port 443, path '/', secure true
 * Both include public Google STUN servers.
 */
export function getPeerConfig(forceLocal?: boolean): PeerOptions {
  const isLocal = forceLocal !== undefined ? forceLocal : isLocalhost();

  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  if (isLocal) {
    return {
      host: 'localhost',
      port: 9000,
      path: '/myapp',
      secure: false,
      pingInterval: 5000,
      debug: 1,
      config: {
        iceServers
      }
    };
  }

  return {
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    pingInterval: 5000,
    debug: 1,
    config: {
      iceServers
    }
  };
}

export class NetworkController implements OpponentController {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private pendingActionResolver: ((action: GameAction) => void) | null = null;
  public readonly isHost: boolean;
  public readonly roomCode: string;
  public readonly forceLocal?: boolean;

  constructor(isHost: boolean, roomCode: string, forceLocal?: boolean) {
    this.isHost = isHost;
    this.roomCode = roomCode.toUpperCase().trim();
    this.forceLocal = forceLocal;
  }

  public async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const hostPeerId = `grid-race-${this.roomCode}`;
      const peerOptions = getPeerConfig(this.forceLocal);

      try {
        // Host uses designated room ID; Guest receives an auto-assigned ID
        this.peer = this.isHost
          ? new Peer(hostPeerId, peerOptions)
          : new Peer(peerOptions);
      } catch (err) {
        return reject(err);
      }

      let isSettled = false;
      const safeResolve = () => {
        if (!isSettled) {
          isSettled = true;
          resolve();
        }
      };

      const safeReject = (err: unknown) => {
        if (!isSettled) {
          isSettled = true;
          reject(err);
        }
      };

      // 1. Connection established with the signaling server
      this.peer.on('open', (id) => {
        console.log(`[PeerJS] Connected to signaling server with ID: ${id}`);

        if (!this.isHost) {
          console.log(`[PeerJS] Guest connecting to Host (${hostPeerId})...`);
          this.conn = this.peer!.connect(hostPeerId, { reliable: true });
          this.setupConnectionHandlers(safeResolve, safeReject);
        }
      });

      // 2. Host handles incoming guest connection
      if (this.isHost) {
        this.peer.on('connection', (connection) => {
          console.log('[PeerJS] Incoming connection received from guest!');
          this.conn = connection;
          this.setupConnectionHandlers(safeResolve, safeReject);
        });
      }

      // 3. Signaling server error handling
      this.peer.on('error', (err: any) => {
        console.error('[PeerJS Error]:', err?.type || err);
        safeReject(err);
      });
    });
  }

  /**
   * Sets up connection event listeners on the DataConnection.
   * Checks conn.open first to prevent race-condition connection drops.
   */
  private setupConnectionHandlers(onReady: () => void, onError: (err: unknown) => void): void {
    if (!this.conn) return;

    let readyHandled = false;
    const handleReady = () => {
      if (readyHandled) return;
      readyHandled = true;
      console.log('[PeerJS] Direct P2P tunnel active!');
      onReady();
    };

    // Ensure connection event listeners (conn.on('open')) check conn.open first
    // to prevent race-condition connection drops
    if (this.conn.open) {
      handleReady();
    } else {
      this.conn.on('open', handleReady);
      if (this.conn.open) {
        handleReady();
      }
    }

    this.conn.on('data', (data: unknown) => {
      const payload = data as NetworkPayload;
      if (payload.type === 'ACTION' && payload.action && this.pendingActionResolver) {
        const resolver = this.pendingActionResolver;
        this.pendingActionResolver = null;
        resolver(payload.action);
      }
    });

    this.conn.on('error', (err) => {
      console.error('[PeerJS DataConnection Error]:', err);
      onError(err);
    });

    this.conn.on('close', () => {
      console.log('[PeerJS] DataConnection closed');
    });
  }

  public requestAction(_board: Board): Promise<GameAction> {
    return new Promise((resolve) => {
      this.pendingActionResolver = resolve;
    });
  }

  public sendAction(action: GameAction): void {
    if (this.conn && this.conn.open) {
      this.conn.send({ type: 'ACTION', action });
    } else {
      console.warn('[PeerJS] Cannot send action, DataConnection is not open');
    }
  }

  public disconnect(): void {
    this.conn?.close();
    this.peer?.destroy();
    this.conn = null;
    this.peer = null;
    this.pendingActionResolver = null;
  }
}