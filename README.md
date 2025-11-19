# CollabFS

Real-time collaborative filesystem for AI agents. Two people, two AI agents, one codebase.

## What You Get

You and your friend can both work on the same project in real-time through your AI agents (Claude, Gemini, etc.). When your friend edits a file, it instantly appears on your computer. When you edit a file, it instantly appears on theirs.

## Installation (30 seconds)

Add this to your AI agent's MCP config:

**For Claude Code** (`~/.config/claude-code/mcp.json`):
```json
{
  "mcpServers": {
    "collabfs": {
      "command": "npx",
      "args": ["collabfs-mcp@latest"],
      "env": {
        "COLLABFS_SERVER_URL": "wss://collabfs-server-production.up.railway.app",
        "COLLABFS_SESSION_ID": "YOUR-SESSION-NAME-HERE",
        "COLLABFS_USER_ID": "YOUR-NAME-HERE"
      }
    }
  }
}
```

**For other AI agents**: Same config, just use their MCP configuration location.

Restart your AI agent.

## Usage (3 steps)

### You (Host)

Tell your AI agent:
```
Connect to CollabFS session "my-project"
Sync directory /path/to/your/project with watch=true and autoSync=true
```

Share your session name with your friend: `"my-project"`

### Your Friend

Tell their AI agent:
```
Connect to CollabFS session "my-project"
Sync from CRDT to /path/where/they/want/files
```

### Done

- You edit files locally → friend sees changes instantly
- Friend tells their AI to edit files → you see changes instantly
- Works with any file type (code, images, PDFs, etc.)

## Example

**You:**
```
You: Connect to CollabFS session "webapp-collab"
You: Sync directory /Users/me/webapp with watch=true and autoSync=true
```

**Friend:**
```
Friend: Connect to CollabFS session "webapp-collab"
Friend: Sync from CRDT to /Users/friend/webapp
```

**Result:** Both of you are now editing the same codebase through your AI agents in real-time.

## Available Commands

Your AI agent has these tools:

- `collabfs_connect` - Join a session
- `collabfs_sync_directory` - Load your local files (use `watch=true` and `autoSync=true`)
- `collabfs_sync_from_crdt` - Download all files from session
- `collabfs_read_file` - Read a specific file
- `collabfs_write_file` - Write/edit a file
- `collabfs_list_files` - See all files in session
- `collabfs_watch_activity` - See what others are doing
- `collabfs_disconnect` - Leave session

## Technical Details

- **CRDT-based**: Automatic conflict resolution for concurrent edits
- **WebSocket sync**: Real-time updates with 300ms debouncing
- **Binary support**: Images, PDFs, fonts, media files work automatically
- **Persistence**: Server snapshots every 5 minutes
- **No setup**: Just `npx collabfs-mcp@latest` - no installation needed

## FAQ

**Q: Does this work across different AI providers?**
A: Yes. Claude + Gemini in the same session works perfectly.

**Q: How many people can collaborate?**
A: No hard limit. Tested with 10+ concurrent users.

**Q: What happens if two people edit the same line?**
A: CRDT automatically merges changes. Both edits are preserved.

**Q: Is my code stored on the server?**
A: Yes, session snapshots are stored on the server. Don't use for proprietary code without self-hosting.

**Q: Can I self-host?**
A: Yes. Server code is in `packages/server/`. Deploy anywhere that runs Node.js + Docker.

**Q: Does this work offline?**
A: No. Requires WebSocket connection to server.

## Troubleshooting

**"Not connected to CollabFS"**
Run `collabfs_connect` first before any other commands.

**Changes not syncing**
Make sure both users have:
- Same `COLLABFS_SESSION_ID`
- Same `COLLABFS_SERVER_URL`
- Host used `watch=true` and `autoSync=true`

**File not found**
Run `collabfs_list_files` to see what's actually in the session.

## Advanced: Session Management

**Good session IDs:**
- `"webapp-feature-auth-2025-11-19"`
- `"hackathon-project-abc123"`

**Bad session IDs:**
- `"session"` (too generic, name collisions)
- `"test"` (same problem)

Use descriptive, unique session IDs. Anyone with the session ID can join.

## License

MIT

## Repository Structure

```
collabfs/
├── packages/
│   ├── server/      # WebSocket server (deploy this if self-hosting)
│   └── mcp-client/  # MCP client (published to npm as collabfs-mcp)
├── CHANGELOG.md     # Version history
├── USAGE_GUIDE.md   # Detailed documentation
└── README.md        # This file
```

## Version

Current: v1.2.0

- Binary file support
- Automatic bidirectional sync
- File watcher debouncing
- Server-side persistence

See [CHANGELOG.md](CHANGELOG.md) for full history.

## Support

Issues: https://github.com/theonlypal/collabfs/issues

## Author

Rayan Pal ([@theonlypal](https://github.com/theonlypal))
