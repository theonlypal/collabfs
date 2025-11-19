/**
 * CollabFS Client
 * Connects to CollabFS server and maintains local Yjs document
 */

import WebSocket from 'ws';
import * as Y from 'yjs';
import { encoding, decoding } from 'lib0';

interface ClientConfig {
  serverUrl: string;
  userId: string;
  sessionId: string;
}

export class CollabFSClient {
  private ws: WebSocket | null = null;
  private doc: Y.Doc;
  private config: ClientConfig;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;

  public readonly fileTree: Y.Map<any>;
  public readonly fileContents: Y.Map<Y.Text>;
  public readonly opLog: Y.Array<any>;
  public readonly activity: Y.Map<any>;

  private readonly messageSync = 0;
  private readonly messageAwareness = 1;
  private readonly messageCustom = 2;

  constructor(config: ClientConfig) {
    this.config = config;
    this.doc = new Y.Doc();

    // Initialize CRDT structures
    this.fileTree = this.doc.getMap('fileTree');
    this.fileContents = this.doc.getMap('fileContents');
    this.opLog = this.doc.getArray('opLog');
    this.activity = this.doc.getMap('activity');

    // Listen for local changes to broadcast to server
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== this && this.connected) {
        this.sendUpdate(update);
      }
    });
  }

  /**
   * Connect to CollabFS server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.serverUrl);

        this.ws.on('open', () => {
          console.log(`[Client] Connected to ${this.config.serverUrl}`);
          this.connected = true;
          this.reconnectAttempts = 0;
          this.sendJoin();
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          this.handleMessage(data);
        });

        this.ws.on('close', () => {
          console.log('[Client] Disconnected from server');
          this.connected = false;
          this.attemptReconnect();
        });

        this.ws.on('error', (error) => {
          console.error('[Client] WebSocket error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(data: Buffer): void {
    try {
      const decoder = decoding.createDecoder(data);
      const messageType = decoding.readVarUint(decoder);

      if (messageType === this.messageSync) {
        this.handleSyncMessage(decoder);
      } else if (messageType === this.messageAwareness) {
        this.handleAwarenessMessage(decoder);
      } else if (messageType === this.messageCustom) {
        this.handleCustomMessage(decoder);
      }
    } catch (error) {
      console.error('[Client] Error handling message:', error);
    }
  }

  private handleSyncMessage(decoder: decoding.Decoder): void {
    const syncMessageType = decoding.readVarUint(decoder);

    switch (syncMessageType) {
      case 0: // Sync Step 1: Server requests state
        this.handleSyncStep1(decoder);
        break;
      case 1: // Sync Step 2: Server sends state
        this.handleSyncStep2(decoder);
        break;
      case 2: // Update: Server sends incremental update
        this.handleUpdate(decoder);
        break;
    }
  }

  private handleSyncStep1(decoder: decoding.Decoder): void {
    const stateVector = decoding.readVarUint8Array(decoder);

    // Send our missing updates
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, this.messageSync);
    encoding.writeVarUint(encoder, 1); // Sync Step 2
    const update = Y.encodeStateAsUpdate(this.doc, stateVector);
    encoding.writeVarUint8Array(encoder, update);

    this.send(encoding.toUint8Array(encoder));
  }

  private handleSyncStep2(decoder: decoding.Decoder): void {
    const update = decoding.readVarUint8Array(decoder);
    Y.applyUpdate(this.doc, update, this);
    console.log('[Client] Synced with server');
  }

  private handleUpdate(decoder: decoding.Decoder): void {
    const update = decoding.readVarUint8Array(decoder);
    Y.applyUpdate(this.doc, update, this);
  }

  private handleAwarenessMessage(decoder: decoding.Decoder): void {
    // Handle awareness updates (user presence, cursors, etc.)
    const awarenessUpdate = decoding.readVarUint8Array(decoder);
    // Could implement awareness protocol here
  }

  private handleCustomMessage(decoder: decoding.Decoder): void {
    const messageStr = decoding.readVarString(decoder);
    const message = JSON.parse(messageStr);

    console.log(`[Client] Custom message: ${message.type}`);

    switch (message.type) {
      case 'joined':
        console.log('[Client] Successfully joined session:', message.data);
        break;
      case 'participant_joined':
        console.log(`[Client] Participant joined: ${message.data.userId}`);
        break;
      case 'participant_left':
        console.log(`[Client] Participant left: ${message.data.userId}`);
        break;
      case 'activity_update':
        console.log(`[Client] Activity update from ${message.data.userId}`);
        break;
      case 'error':
        console.error('[Client] Server error:', message.error);
        break;
    }
  }

  private sendJoin(): void {
    const message = {
      type: 'join',
      userId: this.config.userId,
      sessionId: this.config.sessionId
    };
    this.sendCustomMessage(message);
  }

  private sendUpdate(update: Uint8Array): void {
    if (!this.connected || !this.ws) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, this.messageSync);
    encoding.writeVarUint(encoder, 2); // Update message
    encoding.writeVarUint8Array(encoder, update);

    this.send(encoding.toUint8Array(encoder));
  }

  private sendCustomMessage(message: any): void {
    if (!this.connected || !this.ws) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, this.messageCustom);
    encoding.writeVarString(encoder, JSON.stringify(message));

    this.send(encoding.toUint8Array(encoder));
  }

  private send(data: Uint8Array): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Client] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[Client] Attempting reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(err => {
        console.error('[Client] Reconnection failed:', err);
      });
    }, delay);
  }

  /**
   * Update user activity
   */
  updateActivity(activity: { currentFile?: string; action: string }): void {
    this.sendCustomMessage({
      type: 'update_activity',
      userId: this.config.userId,
      sessionId: this.config.sessionId,
      activity
    });
  }

  /**
   * Send heartbeat to keep connection alive
   */
  sendHeartbeat(): void {
    this.sendCustomMessage({
      type: 'heartbeat',
      userId: this.config.userId,
      sessionId: this.config.sessionId
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.ws) {
      this.sendCustomMessage({
        type: 'leave',
        userId: this.config.userId,
        sessionId: this.config.sessionId
      });
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get user ID
   */
  getUserId(): string {
    return this.config.userId;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.config.sessionId;
  }

  /**
   * Destroy client and cleanup
   */
  destroy(): void {
    this.disconnect();
    this.doc.destroy();
  }
}
