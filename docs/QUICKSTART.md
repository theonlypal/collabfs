# Quick Start Guide

This guide covers local development setup and basic usage of CollabFS.

## Step 1: Install Node.js

```bash
# macOS
brew install node

# Verify
node --version  # Should be 18+
```

## Step 2: Build CollabFS

```bash
cd /Users/johncox/collabfs

# Build server
cd packages/server
npm install
npm run build

# Build MCP client
cd ../mcp-client
npm install
npm run build
```

## Step 3: Start Server

```bash
cd packages/server
npm run dev
```

Leave this running. You should see:
```
CollabFS Server
Server running on ws://localhost:8080
```

## Step 4: Configure Claude Code

Add to `~/.config/claude-code/mcp.json` (or your Claude Code config location):

```json
{
  "mcpServers": {
    "collabfs": {
      "command": "node",
      "args": ["/Users/johncox/collabfs/packages/mcp-client/dist/index.js"],
      "env": {
        "COLLABFS_SERVER_URL": "ws://localhost:8080",
        "COLLABFS_SESSION_ID": "demo-session",
        "COLLABFS_USER_ID": "claude-user"
      }
    }
  }
}
```

Restart Claude Code.

## Step 5: Test It!

### In Claude Code:

```
You: Connect to CollabFS session "demo-session"
```

Claude will call `collabfs_connect` and join the session.

```
You: Create a file called /hello.txt with content "Hello from Claude!"
```

Claude will call `collabfs_write_file`.

```
You: List all files
```

Claude will call `collabfs_list_files` and show:
```
Found 1 file(s):

/hello.txt
  Size: 19 bytes
  Modified: ...
  By: claude-user
```

### In Another AI Agent (Gemini, etc.):

Configure similarly with same `COLLABFS_SESSION_ID` but different `COLLABFS_USER_ID`.

```
You: Connect to CollabFS session "demo-session"
You: Read file /hello.txt
```

Gemini will see Claude's file!

```
You: Update /hello.txt to say "Hello from Claude and Gemini!"
```

Both agents now see the updated content in real-time.

## Summary

At this point:

1. Both AI agents connected to the same session
2. File changes synchronized in real-time via WebSocket
3. CRDT automatically handled concurrent edits
4. Both agents have identical view of the filesystem

## Next Steps

- [Setup Guide](./SETUP.md) - Detailed configuration
- [Architecture](./ARCHITECTURE.md) - How it works
- [Examples](../examples/) - More use cases

## Common Commands

```javascript
// Connect
collabfs_connect(sessionId="my-project")

// Create/update file
collabfs_write_file(path="/src/index.ts", content="...", mode="overwrite")

// Read file
collabfs_read_file(path="/src/index.ts")

// List files
collabfs_list_files(prefix="/src")

// Move file
collabfs_move_file(oldPath="/old.ts", newPath="/new.ts")

// Delete file
collabfs_delete_file(path="/temp.ts")

// See what others are doing
collabfs_watch_activity()

// Disconnect
collabfs_disconnect()
```

## Troubleshooting

**"Not connected to CollabFS"**: Run `collabfs_connect` first

**"Server error: Session not found"**: Ensure server is running (Step 3)

**Changes not syncing**: Verify both clients use the same `COLLABFS_SESSION_ID`

**Node.js not found**: Install Node.js (Step 1)
