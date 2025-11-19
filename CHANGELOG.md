# CollabFS Changelog

## [1.2.0] - 2025-11-19

### Production-Grade Enhancements

This release transforms CollabFS from MVP to production-ready system with enterprise features and performance optimizations.

### Added - MCP Client

**Binary File Support**
- Base64 encoding/decoding for 27 binary file types
- Automatic detection via file extension
- Support for images (png, jpg, gif, svg, webp, bmp, ico)
- Support for archives (zip, tar, gz, 7z, rar)
- Support for media (mp3, mp4, avi, mov, wav)
- Support for fonts (woff, woff2, ttf, eot)
- Support for documents (pdf)
- Support for executables and compiled files

**Automatic Bidirectional Sync**
- New `autoSync` parameter in `collabfs_sync_directory`
- Remote CRDT changes automatically write back to local disk
- Eliminates manual `collabfs_sync_from_crdt` calls
- Real-time collaboration: see friend's changes instantly on your filesystem

**File Watcher Debouncing**
- 300ms debounce window for file changes
- Prevents network flooding on rapid edits (auto-save, etc.)
- Per-file debounce keys for parallel editing
- Significantly reduces bandwidth usage

**Helper Methods**
- `readFileContent()`: Unified text/binary file reading
- `writeFileContent()`: Unified text/binary file writing
- `isBinaryFile()`: Extension-based binary detection
- `setupAutoSync()`: CRDT update listener for remote changes

### Added - Server

**Automatic Persistence**
- 5-minute automatic snapshot intervals
- Session state snapshots to disk
- Automatic restoration on server restart
- Configurable persistence path (default: `/tmp/collabfs-snapshots`)
- Yjs state encoding with `Y.encodeStateAsUpdate()`

**Graceful Shutdown**
- Final snapshot save before session destroy
- Async cleanup for all sessions
- Proper resource cleanup with interval clearing

### Fixed

**Server Architecture**
- Async/await consistency in shutdown flow
- `handleLeave()` now properly async
- `handleDisconnect()` now properly async
- `close()` awaits all session destroy operations

**MCP Client Architecture**
- Binary file metadata tracking with `isBinary` flag
- Debounced sync prevents rapid file change storms
- Origin filtering in CRDT update listener (remote-only sync)

### Technical Details

**Yjs Integration**
- State snapshots using `Y.encodeStateAsUpdate()`
- State restoration using `Y.applyUpdate()`
- Binary data stored as base64 in Y.Text

**Performance Optimizations**
- Debounce timer map: `Map<string, NodeJS.Timeout>`
- 300ms debounce window (configurable via `DEBOUNCE_MS`)
- Per-file debounce keys prevent batch delays

**File Operations**
- Binary detection via extension whitelist
- Buffer-based binary I/O with base64 encoding
- Recursive directory creation with `{ recursive: true }`

### Breaking Changes

None - fully backward compatible with v1.1.0

### Migration Guide

No migration needed. Existing v1.1.0 users can upgrade immediately.

New features are opt-in via parameters:
```typescript
// Enable auto-sync for bidirectional collaboration
collabfs_sync_directory({
  localPath: "/path/to/project",
  watch: true,
  autoSync: true  // NEW: remote changes write to disk
})
```

### Known Limitations

**Large Files**
- No chunking for files >10MB
- Entire file content loaded into memory
- Suitable for source code, not suitable for multi-GB datasets

**File Watchers**
- Platform-dependent recursive watch support
- macOS/Linux: works natively
- Windows: may require polyfill

**Persistence**
- In-memory snapshots (no distributed database)
- Railway ephemeral filesystem (snapshots lost on redeploy)
- Suitable for development, not suitable for production at scale

### Deployment

**npm Package**: `collabfs-mcp@1.2.0`
```bash
npx collabfs-mcp@latest
```

**Server**: Auto-deployed to Railway on git push
- URL: `wss://collabfs-server-production.up.railway.app`
- Health: `/health` endpoint
- Stats: `/stats` endpoint

### Contributors

- Rayan Pal (theonlypal)
- Claude (noreply@anthropic.com)

---

## [1.1.0] - 2025-11-19

### Added

**Filesystem Bridge**
- `collabfs_sync_directory`: Load local directory into CRDT
- `collabfs_write_to_disk`: Write single CRDT file to disk
- `collabfs_sync_from_crdt`: Write all CRDT files to directory
- Recursive directory scanning with exclusion patterns
- File watcher for local changes
- Bidirectional sync capability

### Fixed

- Dockerfile: Changed from `npm ci` to `npm install` (no lockfile)
- TypeScript: Changed `client.doc` from private to public readonly

### Deployment

- Published to npm as `collabfs-mcp@1.1.0`
- Deployed to Railway at `wss://collabfs-server-production.up.railway.app`

---

## [1.0.0] - 2025-11-19

### Initial Release

**Server**
- WebSocket server with Yjs CRDT synchronization
- Three-phase sync protocol (SyncStep1, SyncStep2, Updates)
- Session management with participant tracking
- Operation log with fencing tokens
- HTTP health and stats endpoints

**MCP Client**
- 8 collaborative filesystem tools
- MCP protocol integration
- Automatic reconnection with exponential backoff
- Activity tracking and awareness

**Tools**
- `collabfs_connect`: Join collaborative session
- `collabfs_read_file`: Read file from CRDT
- `collabfs_write_file`: Write file to CRDT
- `collabfs_move_file`: Move/rename file
- `collabfs_delete_file`: Delete file
- `collabfs_list_files`: List all files
- `collabfs_watch_activity`: See collaborator activity
- `collabfs_disconnect`: Leave session

**Deployment**
- Docker containerization
- Railway, Render, Fly.io deployment configs
- Published to npm as `collabfs-mcp@1.0.0`
