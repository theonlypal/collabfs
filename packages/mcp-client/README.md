# collabfs-mcp

Real-time collaborative filesystem for AI agents. Two people, two AI agents, one codebase.

## What You Get

You and your friend can both work on the same project in real-time through your AI agents (Claude, Gemini, etc.). When your friend edits a file, it instantly appears on your computer. When you edit a file, it instantly appears on theirs.

## Installation (10 seconds)

Add this to your AI agent's MCP config:

**For Claude Code** (`~/.config/claude-code/mcp.json`):
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

**For other AI agents**: Same config, just use their MCP configuration location.

Restart your AI agent.

## Usage (2 steps)

### You (Host)

Tell your AI agent:
```
Start CollabFS session on /path/to/your/project
```

Your AI will respond with a **join code** like: `purple-tiger-2025-11-18-abc123`

Share this code with your friend.

### Your Friend

Tell their AI agent:
```
Join CollabFS with code purple-tiger-2025-11-18-abc123
Download all files to /path/where/they/want/files
```

### Done

- You edit files locally - friend sees changes instantly
- Friend tells their AI to edit files - you see changes instantly
- Works with any file type (code, images, PDFs, etc.)
- No manual session ID configuration needed

## Example

**You:**
```
You: Start CollabFS session on /Users/me/webapp

AI: CollabFS session started!

    JOIN CODE: purple-tiger-2025-11-18-abc123

    Share this code with your friend!
```

**Friend:**
```
Friend: Join CollabFS with code purple-tiger-2025-11-18-abc123
Friend: Download all files to /Users/friend/webapp

AI: Connected! Synced 47 files to /Users/friend/webapp
```

**Result:** Both of you are now editing the same codebase through your AI agents in real-time.

## Available Commands

Your AI agent has these tools:

- `collabfs_host_session` - Start a NEW session and get a join code (host only)
- `collabfs_connect` - Join an EXISTING session with a join code (collaborators)
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
A: Yes. Server code is in the GitHub repository. Deploy anywhere that runs Node.js + Docker.

**Q: Does this work offline?**
A: No. Requires WebSocket connection to server.

## Troubleshooting

**"Not connected to CollabFS"**
- Host: Run `collabfs_host_session` to start a new session
- Collaborator: Run `collabfs_connect` with the join code from the host

**Changes not syncing**
Make sure:
- Both users are using the same join code
- Same `COLLABFS_SERVER_URL` in MCP config
- Host used `watch=true` and `autoSync=true` when syncing directory

**File not found**
Run `collabfs_list_files` to see what's actually in the session.

## Advanced: Session Management

Join codes are auto-generated with format: `{adjective}-{animal}-{date}-{random}`

Examples:
- `purple-tiger-2025-11-18-abc123`
- `golden-dragon-2025-11-18-xyz789`

Anyone with the join code can connect to your session. Keep join codes private.

## Version

Current: v1.3.0

- Zero-config join codes (no manual session ID setup)
- `collabfs_host_session` tool for starting sessions
- Human-readable session IDs
- Binary file support
- Automatic bidirectional sync
- File watcher debouncing
- Server-side persistence

See [CHANGELOG](https://github.com/theonlypal/collabfs/blob/main/CHANGELOG.md) for full history.

## Links

- **GitHub**: https://github.com/theonlypal/collabfs
- **Documentation**: https://github.com/theonlypal/collabfs/blob/main/USAGE_GUIDE.md
- **Issues**: https://github.com/theonlypal/collabfs/issues

## License

MIT

## Author

Rayan Pal ([@theonlypal](https://github.com/theonlypal))
