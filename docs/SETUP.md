# CollabFS Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Terminal access
- Claude Code, Gemini CLI, or any MCP-compatible AI tool

## Installation

### 1. Install Node.js

If you don't have Node.js installed:

**macOS (using Homebrew):**
```bash
brew install node
```

**Or download from:** https://nodejs.org/

### 2. Install Dependencies

```bash
# Install server dependencies
cd packages/server
npm install
npm run build

# Install MCP client dependencies
cd ../mcp-client
npm install
npm run build
```

### 3. Start the Central Server

```bash
cd packages/server
npm run dev
```

You should see:
```
╔═══════════════════════════════════════════════════════╗
║                    CollabFS Server                    ║
║          Real-time Collaborative Filesystem           ║
╚═══════════════════════════════════════════════════════╝

Server running on ws://localhost:8080
```

## Configuration

### For Claude Code

Add to your Claude Code MCP configuration (`~/.config/claude-code/mcp.json` or similar):

```json
{
  "mcpServers": {
    "collabfs": {
      "command": "node",
      "args": ["/Users/johncox/collabfs/packages/mcp-client/dist/index.js"],
      "env": {
        "COLLABFS_SERVER_URL": "ws://localhost:8080",
        "COLLABFS_SESSION_ID": "my-session",
        "COLLABFS_USER_ID": "claude-user"
      }
    }
  }
}
```

### For Gemini CLI

Similar configuration for Gemini's MCP settings.

### Environment Variables

- `COLLABFS_SERVER_URL`: WebSocket server URL (default: `ws://localhost:8080`)
- `COLLABFS_SESSION_ID`: Session to join (default: `default`)
- `COLLABFS_USER_ID`: Your user identifier (default: auto-generated)

## Usage

### 1. Connect to a Session

Both collaborators join the same session:

```
User 1 (Claude): collabfs_connect(sessionId="project-alpha")
User 2 (Gemini): collabfs_connect(sessionId="project-alpha")
```

### 2. Collaborate

```
User 1: collabfs_write_file(path="/auth.ts", content="export const token...")
User 2: collabfs_read_file(path="/auth.ts")  // Sees User 1's changes in real-time!
User 2: collabfs_write_file(path="/auth.test.ts", content="import { token }...")
User 1: collabfs_list_files()  // Sees both files
```

### 3. Watch Activity

```
collabfs_watch_activity()
```

Output:
```
Active collaborators: 1

gemini-user: editing /auth.test.ts
  Last seen: 2025-11-18 10:30:45
```

### 4. Disconnect

```
collabfs_disconnect()
```

## Testing

### Manual Test (Two Terminal Windows)

**Terminal 1:**
```bash
cd packages/server
npm run dev
```

**Terminal 2:**
```bash
cd packages/mcp-client
COLLABFS_SESSION_ID=test-session COLLABFS_USER_ID=user1 npm run dev
```

**Terminal 3:**
```bash
cd packages/mcp-client
COLLABFS_SESSION_ID=test-session COLLABFS_USER_ID=user2 npm run dev
```

Both clients will connect to the same session and can collaborate!

## Deployment

### Deploy Central Server

The central server can be deployed to any platform supporting WebSockets:

- **Railway:** `railway up` (from packages/server)
- **Render:** Connect repo, deploy as Web Service
- **Fly.io:** `fly launch` (from packages/server)
- **AWS/GCP:** Deploy as containerized service

Update `COLLABFS_SERVER_URL` to your deployed URL (e.g., `wss://collabfs.railway.app`)

### Publish MCP Client

```bash
cd packages/mcp-client
npm publish
```

Then users can install globally:
```bash
npm install -g collabfs-mcp
```

## Troubleshooting

### Connection Failed

- Ensure server is running (`ws://localhost:8080` is accessible)
- Check firewall settings
- Verify WebSocket support

### File Not Syncing

- Check both clients are in the same session ID
- Verify network connectivity
- Check server logs for errors

### Performance Issues

- Large files (>1MB) may sync slowly
- Consider splitting into smaller files
- Check network latency

## Architecture Notes

- **CRDT (Yjs)**: Handles concurrent edits to file content automatically
- **Fencing Tokens**: Prevents race conditions on structural operations (move, delete)
- **WebSocket**: Real-time bidirectional sync
- **No Locks**: System is lock-free, uses eventual consistency

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical information.
