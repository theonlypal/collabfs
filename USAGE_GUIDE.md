# CollabFS Usage Guide

Complete guide for using CollabFS v1.3.0 to collaborate on real projects with AI agents.

## Quick Start: 1-Minute Setup

### Both You and Your Friend

1. Add to Claude Code MCP config (`~/.config/claude-code/mcp.json`):

```json
{
  "mcpServers": {
    "collabfs": {
      "command": "npx",
      "args": ["collabfs-mcp@latest"],
      "env": {
        "COLLABFS_SERVER_URL": "wss://collabfs-server-production.up.railway.app"
      }
    }
  }
}
```

2. Restart Claude Code

### Host (You)

Tell Claude:
```
Start CollabFS session on /Users/me/my-project
```

Claude responds with a join code like: `purple-tiger-2025-11-18-abc123`

Share this code with your friend.

### Friend (Collaborator)

Tell their AI agent:
```
Join CollabFS with code purple-tiger-2025-11-18-abc123
Download all files to /Users/friend/downloaded-project
```

That's it! No manual session ID configuration needed.

## Complete Workflow

### Scenario: Two Developers, Two AI Agents, One Codebase

**Setup:**
- Developer A (Host): Has existing project at `/Users/devA/webapp`
- Developer B (Friend): Wants to collaborate remotely

**Host Actions:**

```
You: Start CollabFS session on /Users/devA/webapp

Claude: 🎉 CollabFS session started!

╔════════════════════════════════════════════════════════════╗
║  JOIN CODE: crimson-falcon-2025-11-18-xyz456              ║
╚════════════════════════════════════════════════════════════╝

Share this code with your friend so they can join!

Your friend should tell their AI agent:
"Join CollabFS with code crimson-falcon-2025-11-18-xyz456"

Server: wss://collabfs-server-production.up.railway.app
Host User ID: user_abc123

Synced 47 file(s) from /Users/devA/webapp

File watcher active: Local changes will automatically sync to CollabFS

Auto-sync active: Remote changes will automatically sync to disk
```

**What just happened:**
1. Unique session ID auto-generated: `crimson-falcon-2025-11-18-xyz456`
2. All 47 files loaded into CRDT (including binary assets)
3. File watcher started: any local edit → syncs to CRDT → broadcasts to friend
4. Auto-sync started: any friend edit → syncs from CRDT → writes to your disk

**Friend Actions:**

```
Friend: Join CollabFS with code crimson-falcon-2025-11-18-xyz456

Gemini: ✅ Connected to CollabFS session!

Join Code: crimson-falcon-2025-11-18-xyz456
User ID: user_def789
Server: wss://collabfs-server-production.up.railway.app

You can now collaborate in real-time!

Friend: Download all files to /Users/devB/webapp-copy

Gemini: Synced 47 file(s) to /Users/devB/webapp-copy

Friend: List all files

Gemini: Found 47 file(s):

/src/index.ts
  Size: 234 bytes
  Modified: 2025-11-19...
  By: user_abc123

/assets/logo.png
  Size: 1523 bytes (binary)
  Modified: 2025-11-19...
  By: user_abc123
...
```

**Collaborative Editing:**

Host edits `/src/index.ts` locally in VSCode:
1. File watcher detects change (debounced 300ms)
2. Content synced to CRDT
3. Broadcasted via WebSocket
4. Friend's auto-sync writes to `/Users/devB/webapp-copy/src/index.ts`

Friend tells Gemini to edit `/src/api.ts`:
```
Friend: Update /src/api.ts to add error handling

Gemini: (calls collabfs_write_file)
Updated file: /src/api.ts
Mode: overwrite
Size: 456 bytes

Changes automatically synced with all collaborators!
```

Host's auto-sync immediately writes changes to `/Users/devA/webapp/src/api.ts`

## Tool Reference

### collabfs_host_session

Start a NEW collaborative session and get a join code.

**Parameters:**
- `localPath` (optional): Absolute path to directory to sync immediately
- `watch` (optional, default: true): Enable file watching if localPath provided
- `autoSync` (optional, default: true): Enable automatic remote-to-disk sync if localPath provided
- `exclude` (optional): Patterns to exclude if localPath provided

**Example:**
```javascript
collabfs_host_session({
  localPath: "/Users/me/my-project"
})
```

**Output:**
```
🎉 CollabFS session started!

╔════════════════════════════════════════════════════════════╗
║  JOIN CODE: purple-tiger-2025-11-18-abc123                ║
╚════════════════════════════════════════════════════════════╝

Share this code with your friend!

Synced 47 file(s) from /Users/me/my-project
File watcher active: Local changes will automatically sync to CollabFS
Auto-sync active: Remote changes will automatically sync to disk
```

---

### collabfs_connect

Connect to an EXISTING collaborative session using a join code.

**Parameters:**
- `joinCode` (required): Join code from the host
- `userId` (optional): Your user identifier (auto-generated if not provided)

**Example:**
```javascript
collabfs_connect({
  joinCode: "purple-tiger-2025-11-18-abc123"
})
```

**Output:**
```
✅ Connected to CollabFS session!

Join Code: purple-tiger-2025-11-18-abc123
User ID: user_abc123
Server: wss://collabfs-server-production.up.railway.app

You can now collaborate in real-time!
```

---

### collabfs_sync_directory

Load local directory into collaborative session.

**Parameters:**
- `localPath` (required): Absolute path to directory
- `watch` (optional, default: false): Enable file watcher for local changes
- `autoSync` (optional, default: false): Enable automatic remote-to-disk sync
- `exclude` (optional, default: `['node_modules', '.git', 'dist', 'build', '.DS_Store']`): Exclusion patterns

**Example:**
```javascript
collabfs_sync_directory({
  localPath: "/Users/me/my-project",
  watch: true,
  autoSync: true,
  exclude: ["node_modules", ".git", "dist", "*.log"]
})
```

**Output:**
```
Synced 52 file(s) from /Users/me/my-project

File watcher active: Local changes will automatically sync to CollabFS

Auto-sync active: Remote changes will automatically sync to disk
```

**Use Cases:**
- **Host sharing project:** `watch=true, autoSync=true` for full bidirectional sync
- **Friend joining project:** `watch=false, autoSync=false` then sync_from_crdt
- **One-time upload:** `watch=false, autoSync=false`

---

### collabfs_sync_from_crdt

Download all files from CRDT to local disk.

**Parameters:**
- `localPath` (required): Absolute path to directory
- `overwrite` (optional, default: true): Overwrite existing files

**Example:**
```javascript
collabfs_sync_from_crdt({
  localPath: "/Users/me/downloaded-project",
  overwrite: true
})
```

**Output:**
```
Synced 52 file(s) to /Users/me/downloaded-project
```

---

### collabfs_write_to_disk

Write single file from CRDT to disk.

**Parameters:**
- `collabPath` (required): Path in collaborative session (e.g., "/src/auth.ts")
- `localPath` (required): Absolute local path to write to

**Example:**
```javascript
collabfs_write_to_disk({
  collabPath: "/src/auth.ts",
  localPath: "/Users/me/project/src/auth.ts"
})
```

**Output:**
```
Written /src/auth.ts to /Users/me/project/src/auth.ts
Size: 1234 bytes
```

---

### collabfs_read_file

Read file from collaborative session.

**Parameters:**
- `path` (required): File path (e.g., "/src/index.ts")

**Example:**
```javascript
collabfs_read_file({
  path: "/src/index.ts"
})
```

**Output:**
```typescript
// File content returned as text
import express from 'express';

const app = express();
...
```

---

### collabfs_write_file

Write or update file in collaborative session.

**Parameters:**
- `path` (required): File path
- `content` (required): File content
- `mode` (optional, default: 'overwrite'): Write mode ('overwrite' or 'append')

**Example:**
```javascript
collabfs_write_file({
  path: "/README.md",
  content: "# My Project\n\nCollaborative development with AI agents.",
  mode: "overwrite"
})
```

**Output:**
```
Created file: /README.md
Mode: overwrite
Size: 58 bytes

Changes automatically synced with all collaborators!
```

---

### collabfs_list_files

List all files in session.

**Parameters:**
- `prefix` (optional): Filter files by path prefix

**Example:**
```javascript
collabfs_list_files({
  prefix: "/src"
})
```

**Output:**
```
Found 12 file(s) in /src:

/src/index.ts
  Size: 234 bytes
  Modified: Tue Nov 19 2025 04:30:00
  By: host-user

/src/api.ts
  Size: 456 bytes
  Modified: Tue Nov 19 2025 04:31:15
  By: friend-user
```

---

### collabfs_watch_activity

See what collaborators are doing.

**Parameters:** None

**Example:**
```javascript
collabfs_watch_activity()
```

**Output:**
```
Active collaborators: 2

friend-user: editing /src/api.ts
  Last seen: Tue Nov 19 2025 04:31:15

other-user: reading /README.md
  Last seen: Tue Nov 19 2025 04:30:45
```

---

### collabfs_move_file

Move or rename file.

**Parameters:**
- `oldPath` (required): Current file path
- `newPath` (required): New file path

**Example:**
```javascript
collabfs_move_file({
  oldPath: "/utils.ts",
  newPath: "/src/utils.ts"
})
```

**Output:**
```
Moved file: /utils.ts → /src/utils.ts

Change synced with all collaborators!
```

---

### collabfs_delete_file

Delete file from session.

**Parameters:**
- `path` (required): File path to delete

**Example:**
```javascript
collabfs_delete_file({
  path: "/temp.txt"
})
```

**Output:**
```
Deleted file: /temp.txt

Change synced with all collaborators!
```

---

### collabfs_disconnect

Leave collaborative session.

**Parameters:** None

**Example:**
```javascript
collabfs_disconnect()
```

**Output:**
```
Disconnected from session: my-project-session
```

## Advanced Usage

### Binary Files

CollabFS automatically handles binary files via base64 encoding.

**Supported Types:**
- Images: png, jpg, gif, svg, webp, bmp, ico
- Archives: zip, tar, gz, 7z, rar
- Media: mp3, mp4, avi, mov, wav
- Fonts: woff, woff2, ttf, eot
- Documents: pdf
- Executables: exe, dll, so, dylib
- Compiled: pyc, class, o, a

**Usage:** Completely transparent - no special handling needed.

```
You: Sync directory /Users/me/webapp with watch=true

Claude: Synced 47 file(s) from /Users/me/webapp
- 42 text files
- 5 binary files (logo.png, font.woff2, data.pdf, etc.)
```

### Exclusion Patterns

Exclude files/directories from sync:

```javascript
collabfs_sync_directory({
  localPath: "/Users/me/project",
  exclude: [
    "node_modules",
    ".git",
    "dist",
    "build",
    "*.log",
    "*.tmp",
    ".env*"
  ]
})
```

### Session Management

**Session IDs:** Use descriptive, unique IDs:
- ✅ `"webapp-feature-auth-2025-11-19"`
- ✅ `"ai-collab-session-abc123"`
- ❌ `"session"` (too generic)
- ❌ `"test"` (name collisions)

**User IDs:** Identify participants clearly:
- ✅ `"claude-user-john"`
- ✅ `"gemini-user-sarah"`
- ❌ `"user1"` (unclear)

## Troubleshooting

### "Not connected to CollabFS"

**Cause:** Tool called before `collabfs_connect`

**Solution:**
```
You: Connect to CollabFS session "my-session"
(wait for confirmation)
You: (now call other tools)
```

### "File not found in collaborative session"

**Cause:** File doesn't exist in CRDT

**Solution:**
```
You: List all files
(verify file exists with correct path)
```

### "Directory does not exist"

**Cause:** Invalid localPath in sync_directory

**Solution:**
```
You: Sync directory /Users/me/correct-path
(use absolute paths, verify directory exists)
```

### Changes not syncing

**Checklist:**
1. Both users connected to same `COLLABFS_SESSION_ID`
2. Server URL matches: `wss://collabfs-server-production.up.railway.app`
3. File watcher enabled: `watch=true`
4. Auto-sync enabled: `autoSync=true`
5. File not in exclusion list

**Debug:**
```
You: Watch activity
(verify other user is connected and active)
```

### Binary files corrupted

**Cause:** Text encoding applied to binary file

**Solution:** File extension not in binary whitelist

**Check:** Does file extension appear in `isBinaryFile()` method?

**Workaround:** Rename file with supported extension

## Performance Tips

### Large Projects

For projects with 1000+ files:

1. **Use exclusions aggressively:**
```javascript
exclude: [
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "*.log",
  "*.cache",
  ".next",
  ".nuxt"
]
```

2. **Sync specific subdirectories:**
```
You: Sync directory /Users/me/project/src
(instead of entire project)
```

### Bandwidth Optimization

Debouncing is automatic (300ms), but you can reduce sync frequency:

- Disable file watcher when not actively editing
- Use `autoSync=false` and manually sync_from_crdt periodically
- Exclude large binary assets if not needed

### Memory Management

Large files (>10MB) load entirely into memory:

- Exclude large datasets from sync
- Use external storage for media files
- Keep collaborative workspace lean

## Security Considerations

### Session Access

**Risk:** Anyone with session ID can join

**Mitigation:**
- Use complex, random session IDs
- Don't share session IDs publicly
- Rotate session IDs after each collaboration
- Use private deployment for sensitive projects

### Server Persistence

**Risk:** Session snapshots stored on server disk

**Mitigation:**
- Use ephemeral session IDs
- Delete snapshots after collaboration: `rm /tmp/collabfs-snapshots/*.snapshot`
- Deploy private server for sensitive work

### File Contents

**Risk:** All file contents transmitted over WebSocket

**Mitigation:**
- Server uses WSS (encrypted WebSocket)
- Don't commit secrets to collaborative workspace
- Use `.env` exclusion patterns

## Examples

### Example 1: Quick Code Review

**Reviewer shares code:**
```
Reviewer: Start CollabFS session on /Users/reviewer/project/src/auth
→ Gets join code: orange-hawk-2025-11-18-qrs234
```

**Colleague reviews:**
```
Colleague: Join CollabFS with code orange-hawk-2025-11-18-qrs234
Colleague: List all files
Colleague: Read file /auth.ts
Colleague: (provides feedback via chat, not editing files)
```

### Example 2: Pair Programming

**Driver:**
```
Driver: Start CollabFS session on /Users/driver/project
→ Gets join code: emerald-wolf-2025-11-18-tuv789
```

**Navigator:**
```
Navigator: Join CollabFS with code emerald-wolf-2025-11-18-tuv789
Navigator: Download all files to /Users/navigator/project-copy
Navigator: Read file /src/feature-x.ts
Navigator: (suggests changes, driver implements)
```

### Example 3: AI Agent Collaboration

**Claude writes tests:**
```
You: Start CollabFS session on /Users/me/project
→ Gets join code: amber-dragon-2025-11-18-wxy012
You: Write tests for all functions in /src/utils.ts
```

**Gemini reviews and refactors:**
```
Friend: Join CollabFS with code amber-dragon-2025-11-18-wxy012
Friend: Download all files to /tmp/project-review
Friend: Review all test files and suggest improvements
```

Both AIs see each other's work in real-time through CRDT.

## FAQ

**Q: Does this work with any AI agent?**
A: Yes, any agent that supports MCP protocol (Claude Code, Gemini with MCP, custom agents)

**Q: How many collaborators can join one session?**
A: No hard limit, tested with 10+ concurrent users

**Q: What happens if two people edit the same line simultaneously?**
A: Yjs CRDT merges changes automatically - both edits preserved

**Q: Can I collaborate across different AI providers?**
A: Yes! Claude + Gemini + custom agents in same session

**Q: Does the server store my code?**
A: Server stores session snapshots (every 5 min) in `/tmp` - ephemeral on Railway

**Q: What if server restarts?**
A: Sessions restored from last snapshot (max 5 min data loss)

**Q: Can I self-host the server?**
A: Yes! Docker image available, deploy to any platform

**Q: Does this work offline?**
A: No, requires WebSocket connection to server

**Q: Can I use this with Git?**
A: Yes! CollabFS syncs files, Git tracks history - complementary tools

**Q: What's the max file size?**
A: Technically unlimited, practically ~10MB per file (memory constraints)
