# CollabFS Architecture

## Overview

CollabFS enables real-time collaboration between multiple AI agents working on the same codebase through a WebSocket-based server with Conflict-free Replicated Data Types (CRDTs).

## System Components

```
┌─────────────────────────────────────────┐
│    Central WebSocket Server (Node.js)   │
│  ┌────────────────────────────────────┐ │
│  │  Yjs CRDT Document                 │ │
│  │  - fileTree: Y.Map<FileMetadata>   │ │
│  │  - fileContents: Y.Map<Y.Text>     │ │
│  │  - opLog: Y.Array<Operation>       │ │
│  │  - activity: Y.Map<Activity>       │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
              ↕ WebSocket + Yjs Protocol
    ┌─────────┴─────────┐
    ↓                   ↓
┌─────────────┐   ┌─────────────┐
│ MCP Client  │   │ MCP Client  │
│   (User A)  │   │   (User B)  │
│             │   │             │
│ Local Y.Doc │   │ Local Y.Doc │
└─────────────┘   └─────────────┘
    ↕                   ↕
┌─────────────┐   ┌─────────────┐
│ Claude Code │   │ Gemini CLI  │
└─────────────┘   └─────────────┘
```

## Core Technologies

### Yjs (CRDT Implementation)

**What it solves:** Concurrent edits to the same file by multiple collaborators.

**How it works:**
- Each character in a file has a unique ID
- Edits are expressed as CRDT operations
- Operations are commutative (order-independent)
- Automatic conflict-free merging

**Example:**
```
Initial: "hello world"

User A edits: inserts "beautiful " at position 6
User B edits: inserts "the " at position 6

Without CRDT: Conflict! Which edit wins?

With CRDT:
- Both edits have unique IDs
- Yjs automatically merges: "hello beautiful the world"
- Both users converge to same state
```

### Fencing Tokens

**What it solves:** Race conditions on structural operations (move, delete, rename).

**How it works:**
- Monotonic counter (1, 2, 3, ...) for each structural operation
- Operations logged in order
- Late operations can detect conflicts

**Example:**
```
T1: Claude: move("/old.ts", "/new.ts") → token 5
T2: Gemini: delete("/old.ts") → token 6

Execution:
1. Token 5: Move succeeds (/old.ts → /new.ts)
2. Token 6: Delete fails (file no longer at /old.ts)
3. Gemini receives error, can query current state
```

### WebSocket Protocol

**Message Types:**

1. **Sync Messages (Type 0)**
   - Step 1: Client requests state (sends state vector)
   - Step 2: Server sends missing updates
   - Update: Incremental changes

2. **Awareness Messages (Type 1)**
   - User presence
   - Cursor positions
   - Activity updates

3. **Custom Messages (Type 2)**
   - Join/leave session
   - Activity updates
   - Heartbeats

## Data Structures

### File Tree (Y.Map)

Stores file metadata:

```typescript
{
  "/auth.ts": {
    type: "file",
    lastModified: 1732000000000,
    lastModifiedBy: "claude_user_a",
    token: 42,
    size: 1024
  }
}
```

### File Contents (Y.Map<Y.Text>)

Stores actual file content as CRDTs:

```typescript
{
  "/auth.ts": Y.Text("export const token = ..."),
  "/config.json": Y.Text("{ ... }")
}
```

Each `Y.Text` is a CRDT that automatically merges concurrent edits.

### Operation Log (Y.Array)

Audit trail of all structural operations:

```typescript
[
  {
    token: 1,
    type: "create",
    path: "/auth.ts",
    by: "claude_user_a",
    timestamp: 1732000000000,
    success: true
  },
  {
    token: 2,
    type: "move",
    path: "/old.ts",
    newPath: "/new.ts",
    by: "gemini_user_b",
    timestamp: 1732000001000,
    success: true
  }
]
```

### Activity Map (Y.Map)

Real-time user activity:

```typescript
{
  "claude_user_a": {
    userId: "claude_user_a",
    currentFile: "/auth.ts",
    action: "editing",
    timestamp: 1732000000000
  },
  "gemini_user_b": {
    userId: "gemini_user_b",
    currentFile: "/test.ts",
    action: "reading",
    timestamp: 1732000000000
  }
}
```

## Conflict Resolution

### Content Edits (CRDT)

**Scenario:** Both users edit the same line simultaneously.

**Resolution:** Yjs automatically merges based on character-level CRDTs.

**Result:** Both edits preserved, humans can manually resolve if needed.

### Structural Operations (Fencing Tokens)

**Scenario:** User A renames file, User B deletes it simultaneously.

**Resolution:**
1. Operations get sequential tokens
2. First operation executes
3. Second operation fails with error
4. User receives error, can query current state

### Network Partitions

**Scenario:** Client disconnects for 2 minutes.

**Resolution:**
1. Client reconnects
2. Yjs sync protocol kicks in
3. Client sends state vector
4. Server sends missing updates
5. Full consistency restored automatically

## Performance Characteristics

### File Operations

- **Read:** O(1) map lookup
- **Write:** O(n) where n = content length
- **List:** O(m) where m = number of files
- **Move/Delete:** O(1) map operations

### Network

- **Initial Sync:** O(total file size)
- **Incremental Updates:** O(change size)
- **Bandwidth:** Minimal (only deltas transmitted)

### Memory

- **Server:** O(total session content + operation log)
- **Client:** O(session content)

### Scalability

- **Users per session:** 2-10 (tested)
- **Files per session:** 1000s (limited by memory)
- **File size:** Recommended < 1MB per file
- **Sessions per server:** 100s (depends on resources)

## Security Considerations

### Current Implementation

- **No authentication:** Trust-based (development)
- **No encryption:** Plain WebSocket
- **No authorization:** Any user can join any session

### Production Recommendations

1. **Authentication:**
   - JWT tokens for user identity
   - Session join requires authorization

2. **Encryption:**
   - Use WSS (WebSocket Secure)
   - TLS 1.3+

3. **Authorization:**
   - Role-based access control
   - Permission system for file operations

4. **Rate Limiting:**
   - Prevent abuse
   - Per-user operation limits

5. **Audit Logging:**
   - All operations logged
   - Compliance requirements

## Failure Modes

### Server Crash

**Impact:** All active sessions lost.

**Mitigation:**
- Persist sessions to database
- Implement session recovery
- Checkpoint Yjs documents periodically

### Client Crash

**Impact:** User disconnected, others unaffected.

**Mitigation:**
- Automatic reconnection (implemented)
- Exponential backoff
- Session state preserved on server

### Network Partition

**Impact:** Client can't sync.

**Mitigation:**
- Local operations continue
- Automatic sync on reconnection
- CRDT guarantees eventual consistency

### Concurrent Conflicting Operations

**Impact:** Race conditions on structural operations.

**Mitigation:**
- Fencing tokens enforce ordering
- Error messages guide recovery
- Operation log provides audit trail

## Future Enhancements

### 1. Persistence Layer

Store sessions in database (PostgreSQL, MongoDB) for durability.

### 2. Conflict Resolution UI

Visual diff tool for manual conflict resolution.

### 3. Branching

Git-like branches for experimental changes.

### 4. Access Control

Fine-grained permissions (read/write/admin).

### 5. Compression

Gzip/brotli for large file transfers.

### 6. Diff Streaming

Send minimal diffs instead of full sync.

### 7. History & Time Travel

Browse past states, revert changes.

### 8. Multi-Region

Deploy servers globally, route to nearest.

## Comparison with Alternatives

### vs Git

| Feature | CollabFS | Git |
|---------|----------|-----|
| Real-time sync | ✅ Instant | ❌ Manual push/pull |
| Conflict resolution | ✅ Automatic (CRDT) | ❌ Manual merge |
| Concurrent edits | ✅ Supported | ⚠️ Requires branches |
| LLM-friendly | ✅ MCP native | ⚠️ CLI-based |

### vs Google Docs

| Feature | CollabFS | Google Docs |
|---------|----------|-------------|
| Code files | ✅ Optimized | ❌ Not designed for code |
| LLM integration | ✅ MCP protocol | ❌ No API for AI |
| Filesystem | ✅ Multiple files | ⚠️ Single document |
| Self-hosted | ✅ Yes | ❌ Cloud only |

### vs VS Code Live Share

| Feature | CollabFS | Live Share |
|---------|----------|------------|
| Editor-agnostic | ✅ Any MCP client | ❌ VS Code only |
| LLM collaboration | ✅ AI-first design | ❌ Human-first |
| Offline sync | ✅ CRDT-based | ⚠️ Requires host online |

## References

- [Yjs Documentation](https://docs.yjs.dev/)
- [Martin Kleppmann: Distributed Locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)
- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [CRDTs: The Hard Parts](https://youtu.be/x7drE24geUw)
