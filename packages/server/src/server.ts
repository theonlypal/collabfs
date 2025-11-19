/**
 * CollabFS WebSocket Server
 * Central coordination server with Yjs synchronization
 */

import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import { encoding, decoding, map } from 'lib0';
import { CollabSession } from './session.js';
import { ClientMessage, ServerMessage } from './types.js';
import http from 'http';

interface Client {
  ws: WebSocket;
  userId: string;
  sessionId: string;
}

export class CollabFSServer {
  private httpServer: http.Server;
  private wss: WebSocketServer;
  private sessions: Map<string, CollabSession> = new Map();
  private clients: Map<WebSocket, Client> = new Map();
  private port: number;
  private startTime: number;

  // Message types for Yjs sync protocol
  private readonly messageSync = 0;
  private readonly messageAwareness = 1;
  private readonly messageCustom = 2;

  constructor(port: number = 8080) {
    this.port = port;
    this.startTime = Date.now();

    // Create HTTP server for health checks
    this.httpServer = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    // Create WebSocket server on top of HTTP server
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.setupServer();

    // Start listening
    this.httpServer.listen(port);
  }

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // CORS headers for production
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === '/health') {
      const health = {
        status: 'ok',
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        sessions: this.sessions.size,
        clients: this.clients.size,
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health));
      return;
    }

    if (req.url === '/stats') {
      const stats = {
        sessions: Array.from(this.sessions.values()).map(s => s.getStats()),
        totalClients: this.clients.size,
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        memory: process.memoryUsage()
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
      return;
    }

    if (req.url === '/' || req.url === '') {
      const info = {
        name: 'CollabFS Server',
        version: '1.0.0',
        status: 'running',
        websocket: `ws://${req.headers.host}`,
        endpoints: {
          health: '/health',
          stats: '/stats'
        }
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(info));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('[Server] New WebSocket connection');

      ws.on('message', (data: Buffer) => {
        this.handleMessage(ws, data);
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('[Server] WebSocket error:', error);
      });
    });

    console.log(`[Server] CollabFS server listening on port ${this.port}`);
  }

  private handleMessage(ws: WebSocket, data: Buffer): void {
    try {
      const decoder = decoding.createDecoder(data);
      const messageType = decoding.readVarUint(decoder);

      if (messageType === this.messageSync) {
        this.handleSyncMessage(ws, decoder);
      } else if (messageType === this.messageAwareness) {
        this.handleAwarenessMessage(ws, decoder);
      } else if (messageType === this.messageCustom) {
        this.handleCustomMessage(ws, decoder);
      }
    } catch (error) {
      console.error('[Server] Error handling message:', error);
      this.sendError(ws, 'Invalid message format');
    }
  }

  private handleSyncMessage(ws: WebSocket, decoder: decoding.Decoder): void {
    const client = this.clients.get(ws);
    if (!client) {
      console.error('[Server] Sync message from unregistered client');
      return;
    }

    const session = this.sessions.get(client.sessionId);
    if (!session) {
      console.error('[Server] Session not found:', client.sessionId);
      return;
    }

    const syncMessageType = decoding.readVarUint(decoder);

    switch (syncMessageType) {
      case 0: // Sync Step 1: Client requests state
        this.handleSyncStep1(ws, session, decoder);
        break;
      case 1: // Sync Step 2: Client sends missing updates
        this.handleSyncStep2(ws, session, decoder);
        break;
      case 2: // Update: Client sends incremental update
        this.handleUpdate(ws, session, decoder);
        break;
    }
  }

  private handleSyncStep1(ws: WebSocket, session: CollabSession, decoder: decoding.Decoder): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, this.messageSync);
    encoding.writeVarUint(encoder, 1); // Sync Step 2

    const stateVector = decoding.readVarUint8Array(decoder);
    const update = Y.encodeStateAsUpdate(session.doc, stateVector);
    encoding.writeVarUint8Array(encoder, update);

    ws.send(encoding.toUint8Array(encoder));
    console.log(`[Server] Sent sync step 2 to client in session ${session.sessionId}`);
  }

  private handleSyncStep2(ws: WebSocket, session: CollabSession, decoder: decoding.Decoder): void {
    const update = decoding.readVarUint8Array(decoder);
    Y.applyUpdate(session.doc, update);
    console.log(`[Server] Applied sync step 2 update in session ${session.sessionId}`);

    // Broadcast to other clients
    this.broadcastUpdate(session.sessionId, update, ws);
  }

  private handleUpdate(ws: WebSocket, session: CollabSession, decoder: decoding.Decoder): void {
    const update = decoding.readVarUint8Array(decoder);
    Y.applyUpdate(session.doc, update);
    console.log(`[Server] Applied update in session ${session.sessionId}`);

    // Broadcast to other clients
    this.broadcastUpdate(session.sessionId, update, ws);
  }

  private broadcastUpdate(sessionId: string, update: Uint8Array, excludeWs?: WebSocket): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, this.messageSync);
    encoding.writeVarUint(encoder, 2); // Update message
    encoding.writeVarUint8Array(encoder, update);
    const message = encoding.toUint8Array(encoder);

    this.clients.forEach((client, ws) => {
      if (client.sessionId === sessionId && ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  private handleAwarenessMessage(ws: WebSocket, decoder: decoding.Decoder): void {
    // Awareness messages for cursor positions, user presence, etc.
    const client = this.clients.get(ws);
    if (!client) return;

    // Broadcast awareness to other clients in session
    const awarenessUpdate = decoding.readVarUint8Array(decoder);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, this.messageAwareness);
    encoding.writeVarUint8Array(encoder, awarenessUpdate);
    const message = encoding.toUint8Array(encoder);

    this.clients.forEach((c, w) => {
      if (c.sessionId === client.sessionId && w !== ws && w.readyState === WebSocket.OPEN) {
        w.send(message);
      }
    });
  }

  private handleCustomMessage(ws: WebSocket, decoder: decoding.Decoder): void {
    const messageStr = decoding.readVarString(decoder);
    const message: ClientMessage = JSON.parse(messageStr);

    console.log(`[Server] Custom message: ${message.type} from ${message.userId}`);

    switch (message.type) {
      case 'join':
        this.handleJoin(ws, message);
        break;
      case 'leave':
        this.handleLeave(ws, message);
        break;
      case 'update_activity':
        this.handleUpdateActivity(ws, message);
        break;
      case 'heartbeat':
        this.handleHeartbeat(ws, message);
        break;
    }
  }

  private handleJoin(ws: WebSocket, message: ClientMessage): void {
    let session = this.sessions.get(message.sessionId);

    if (!session) {
      session = new CollabSession(message.sessionId);
      this.sessions.set(message.sessionId, session);
      console.log(`[Server] Created new session: ${message.sessionId}`);
    }

    session.addParticipant(message.userId);

    this.clients.set(ws, {
      ws,
      userId: message.userId,
      sessionId: message.sessionId
    });

    // Send joined confirmation
    this.sendCustomMessage(ws, {
      type: 'joined',
      data: {
        sessionId: message.sessionId,
        stats: session.getStats()
      }
    });

    // Send initial sync
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, this.messageSync);
    encoding.writeVarUint(encoder, 0); // Sync Step 1
    encoding.writeVarUint8Array(encoder, Y.encodeStateVector(session.doc));
    ws.send(encoding.toUint8Array(encoder));

    // Notify other participants
    this.broadcastCustomMessage(message.sessionId, {
      type: 'participant_joined',
      data: { userId: message.userId }
    }, ws);

    console.log(`[Server] ${message.userId} joined session ${message.sessionId}`);
  }

  private async handleLeave(ws: WebSocket, message: ClientMessage): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) return;

    const session = this.sessions.get(client.sessionId);
    if (session) {
      session.removeParticipant(client.userId);

      // Notify other participants
      this.broadcastCustomMessage(client.sessionId, {
        type: 'participant_left',
        data: { userId: client.userId }
      }, ws);

      // Cleanup empty sessions
      if (session.getStats().participants.length === 0) {
        await session.destroy();
        this.sessions.delete(client.sessionId);
        console.log(`[Server] Removed empty session: ${client.sessionId}`);
      }
    }

    this.clients.delete(ws);
  }

  private handleUpdateActivity(ws: WebSocket, message: ClientMessage): void {
    const client = this.clients.get(ws);
    if (!client) return;

    const session = this.sessions.get(client.sessionId);
    if (!session || !message.activity) return;

    session.updateActivity(message.userId, message.activity);

    // Broadcast activity update
    this.broadcastCustomMessage(client.sessionId, {
      type: 'activity_update',
      data: {
        userId: message.userId,
        activity: message.activity
      }
    }, ws);
  }

  private handleHeartbeat(ws: WebSocket, message: ClientMessage): void {
    // Keep connection alive
    const client = this.clients.get(ws);
    if (client) {
      const session = this.sessions.get(client.sessionId);
      if (session) {
        session.updateActivity(message.userId, { action: 'idle' });
      }
    }
  }

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const client = this.clients.get(ws);
    if (client) {
      console.log(`[Server] Client disconnected: ${client.userId}`);
      await this.handleLeave(ws, {
        type: 'leave',
        userId: client.userId,
        sessionId: client.sessionId
      });
    }
  }

  private sendCustomMessage(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState !== WebSocket.OPEN) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, this.messageCustom);
    encoding.writeVarString(encoder, JSON.stringify(message));
    ws.send(encoding.toUint8Array(encoder));
  }

  private broadcastCustomMessage(sessionId: string, message: ServerMessage, excludeWs?: WebSocket): void {
    this.clients.forEach((client, ws) => {
      if (client.sessionId === sessionId && ws !== excludeWs) {
        this.sendCustomMessage(ws, message);
      }
    });
  }

  private sendError(ws: WebSocket, error: string): void {
    this.sendCustomMessage(ws, {
      type: 'error',
      error
    });
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): CollabSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getSessions(): Map<string, CollabSession> {
    return this.sessions;
  }

  /**
   * Shutdown server
   */
  async close(): Promise<void> {
    console.log('[Server] Shutting down gracefully...');

    // Close all client connections
    this.clients.forEach((client, ws) => {
      ws.close();
    });

    // Destroy all sessions
    const destroyPromises = Array.from(this.sessions.values()).map(session => session.destroy());
    await Promise.all(destroyPromises);

    // Close WebSocket server
    return new Promise((resolve) => {
      this.wss.close(() => {
        // Close HTTP server
        this.httpServer.close(() => {
          console.log('[Server] Server closed successfully');
          resolve();
        });
      });
    });
  }

  /**
   * Get server port
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Get server stats
   */
  getStats() {
    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      sessions: this.sessions.size,
      clients: this.clients.size,
      memory: process.memoryUsage()
    };
  }
}
