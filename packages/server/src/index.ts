/**
 * CollabFS Server Entry Point
 */

import { CollabFSServer } from './server.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

const server = new CollabFSServer(PORT);

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);
  try {
    await server.close();
    console.log('[Server] Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('[Server] Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled rejection at:', promise, 'reason:', reason);
  shutdown('unhandledRejection');
});

const protocol = NODE_ENV === 'production' ? 'wss' : 'ws';
const host = NODE_ENV === 'production' ? process.env.RAILWAY_STATIC_URL || process.env.RENDER_EXTERNAL_HOSTNAME || 'your-domain.com' : 'localhost';

console.log(`
╔═══════════════════════════════════════════════════════╗
║                    CollabFS Server                    ║
║          Real-time Collaborative Filesystem           ║
╚═══════════════════════════════════════════════════════╝

Environment: ${NODE_ENV}
WebSocket: ${protocol}://${host}:${PORT}
Health: http://${host === 'localhost' ? 'localhost' : host}:${PORT}/health
Stats: http://${host === 'localhost' ? 'localhost' : host}:${PORT}/stats

Ready for connections!
Press Ctrl+C to stop
`);
