# CollabFS

Real-time collaborative filesystem protocol for AI agent coordination through the Model Context Protocol (MCP).

## Overview

CollabFS provides infrastructure for multiple AI agents to collaborate on a shared codebase through real-time synchronization. The system uses Conflict-free Replicated Data Types (CRDTs) via Yjs to handle concurrent edits without manual conflict resolution.

## Problem Statement

Current AI development tools operate in isolation. When multiple AI agents or users with different LLM tools need to work on the same codebase, manual synchronization is required. This creates coordination overhead and limits collaborative workflows.

## Solution

CollabFS implements a WebSocket-based server with CRDT synchronization, exposing filesystem operations through the Model Context Protocol. Any MCP-compatible AI tool can connect and collaborate in real-time.

### Technical Features

- **Conflict-free merging**: CRDT implementation automatically resolves concurrent edits
- **Race condition prevention**: Fencing tokens for structural operations (move, delete, rename)
- **Universal compatibility**: Works with any MCP-compatible AI tool
- **Real-time synchronization**: WebSocket-based bidirectional updates
- **Session management**: Multi-user sessions with activity tracking

## Architecture

```
Central Server (Node.js + WebSocket)
    - Yjs CRDT document management
    - Session coordination
    - Real-time broadcasting
    |
    | WebSocket + Yjs protocol
    |
    +-- MCP Client (User A) -- Claude Code
    +-- MCP Client (User B) -- Gemini CLI
```

### Core Components

**Server** (`packages/server`):
- WebSocket server with Yjs synchronization
- HTTP endpoints for health checks and stats
- Session management and coordination
- Operation logging with fencing tokens

**MCP Client** (`packages/mcp-client`):
- MCP protocol implementation
- Yjs client with automatic sync
- Filesystem operation tools
- Connection management with automatic reconnection

## Deployment

### Server Deployment

Deploy the central server to any platform supporting WebSocket connections:

**Railway**:
```bash
railway up
```

**Render**:
- Connect repository
- Use included `render.yaml` configuration

**Fly.io**:
```bash
fly launch
```

**Docker**:
```bash
cd packages/server
docker build -t collabfs-server .
docker run -p 8080:8080 collabfs-server
```

See [DEPLOY.md](./DEPLOY.md) for detailed deployment instructions.

### Client Configuration

Configure your AI tool's MCP settings to connect to the deployed server.

**Claude Code** (`~/.config/claude-code/mcp.json`):
```json
{
  "mcpServers": {
    "collabfs": {
      "command": "npx",
      "args": ["collabfs-mcp@latest"],
      "env": {
        "COLLABFS_SERVER_URL": "wss://your-server.railway.app",
        "COLLABFS_SESSION_ID": "project-name",
        "COLLABFS_USER_ID": "user-identifier"
      }
    }
  }
}
```

Replace `wss://your-server.railway.app` with your deployed server URL.

## Usage

### Connecting to a Session

Both collaborators configure their MCP client with the same `COLLABFS_SESSION_ID`:

```
collabfs_connect(sessionId="project-alpha")
```

### File Operations

**Read file**:
```
collabfs_read_file(path="/src/auth.ts")
```

**Write file** (with automatic conflict resolution):
```
collabfs_write_file(
  path="/src/auth.ts",
  content="...",
  mode="overwrite"
)
```

**Move file** (with race condition protection):
```
collabfs_move_file(
  oldPath="/old.ts",
  newPath="/new.ts"
)
```

**Delete file**:
```
collabfs_delete_file(path="/temp.ts")
```

**List files**:
```
collabfs_list_files(prefix="/src")
```

**Monitor activity**:
```
collabfs_watch_activity()
```

## Technical Details

### Conflict Resolution

**Content Edits**: Yjs CRDT automatically merges concurrent character-level edits. Each character has a unique identifier, enabling deterministic merge without data loss.

**Structural Operations**: Fencing tokens provide total ordering for operations like move, delete, and rename. Operations receive sequential tokens; late operations that conflict return errors with current state.

### Synchronization Protocol

The system implements the Yjs synchronization protocol over WebSocket:

1. **Sync Step 1**: Client sends state vector to server
2. **Sync Step 2**: Server responds with missing updates
3. **Incremental Updates**: Ongoing changes broadcast to all clients

### Data Model

**File Tree** (`Y.Map<FileMetadata>`):
```typescript
{
  "/auth.ts": {
    type: "file",
    lastModified: 1732000000000,
    lastModifiedBy: "user-id",
    token: 42,
    size: 1024
  }
}
```

**File Contents** (`Y.Map<Y.Text>`):
```typescript
{
  "/auth.ts": Y.Text("export const ..."),
  "/config.json": Y.Text("{ ... }")
}
```

**Operation Log** (`Y.Array<Operation>`):
```typescript
[
  {
    token: 1,
    type: "create",
    path: "/auth.ts",
    by: "user-a",
    timestamp: 1732000000000,
    success: true
  }
]
```

## Performance Characteristics

- **File read**: O(1) map lookup
- **File write**: O(n) where n = content length
- **List files**: O(m) where m = number of files
- **Initial sync**: O(total file size)
- **Incremental updates**: O(change size)

## Current Limitations

- No persistence (in-memory only, sessions lost on restart)
- No authentication or authorization
- No encryption (plain WebSocket in development, WSS recommended for production)
- Recommended file size limit: 1MB per file
- Tested with 2-10 concurrent users per session

## Production Considerations

### Security
- Implement JWT-based authentication
- Add rate limiting per user/session
- Enable WSS (WebSocket Secure) with TLS
- Implement access control for sessions

### Persistence
- Add PostgreSQL or MongoDB for session storage
- Implement periodic Yjs document snapshots
- Add session recovery on server restart

### Scaling
- Use Redis for session state synchronization
- Deploy multiple server instances with load balancing
- Implement sticky sessions or distributed state

### Monitoring
- Track `/health` endpoint for uptime
- Monitor `/stats` endpoint for usage metrics
- Log operation counts and error rates
- Track WebSocket connection metrics

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Building

```bash
# Build server
cd packages/server
npm install
npm run build

# Build MCP client
cd packages/mcp-client
npm install
npm run build
```

### Running Locally

```bash
# Start server
cd packages/server
npm run dev

# Configure MCP client to point to ws://localhost:8080
```

### Testing

```bash
# Start server
npm run dev

# In separate terminal, test health endpoint
curl http://localhost:8080/health

# Configure two MCP clients with same session ID
# Verify real-time synchronization
```

## Documentation

- [DEPLOY.md](./DEPLOY.md) - Production deployment guide
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - Technical architecture details
- [docs/SETUP.md](./docs/SETUP.md) - Configuration and setup
- [examples/demo-scenario.md](./examples/demo-scenario.md) - Usage examples

## Technology Stack

- **Server**: Node.js, TypeScript, WebSocket (ws), Yjs, lib0
- **Client**: Node.js, TypeScript, MCP SDK, Yjs, WebSocket
- **Protocol**: Model Context Protocol (MCP), Yjs sync protocol

## References

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Yjs CRDT Implementation](https://docs.yjs.dev/)
- [Distributed Systems Research](https://martin.kleppmann.com/)

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Contributing

Issues and pull requests are welcome. For major changes, please open an issue first to discuss proposed changes.

## Repository

https://github.com/theonlypal/collabfs
