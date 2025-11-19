# Demo Scenario: Building a Feature Together

This example shows Claude Code and Gemini CLI collaborating to build a user authentication feature.

## Setup

Both agents connected to session "auth-feature":

- **Claude Code** (VSCode extension): `COLLABFS_USER_ID=claude`
- **Gemini CLI** (terminal): `COLLABFS_USER_ID=gemini`

## Collaboration Flow

### Minute 1: Claude Creates Structure

```
User → Claude: "Create the basic auth module structure"

Claude calls:
collabfs_write_file(
  path="/src/auth.ts",
  content=`
export interface User {
  id: string;
  email: string;
  passwordHash: string;
}

export class AuthService {
  async login(email: string, password: string): Promise<User | null> {
    // TODO: Implement
    return null;
  }

  async register(email: string, password: string): Promise<User> {
    // TODO: Implement
    throw new Error("Not implemented");
  }
}
`
)
```

**Result:** File created, synced instantly to Gemini.

### Minute 2: Gemini Adds Tests

```
User → Gemini: "Read the auth file and create tests for it"

Gemini calls:
collabfs_read_file(path="/src/auth.ts")

Gemini sees Claude's code, then calls:
collabfs_write_file(
  path="/src/auth.test.ts",
  content=`
import { AuthService, User } from './auth';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
  });

  test('login with valid credentials', async () => {
    // TODO: Mock implementation
  });

  test('register new user', async () => {
    // TODO: Mock implementation
  });
});
`
)
```

**Result:** Test file created, Claude sees it instantly.

### Minute 3: Claude Implements Login

```
User → Claude: "Implement the login method"

Claude calls:
collabfs_read_file(path="/src/auth.ts")

Claude sees the latest version, then calls:
collabfs_write_file(
  path="/src/auth.ts",
  content=`
import bcrypt from 'bcrypt';
import { database } from './database';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
}

export class AuthService {
  async login(email: string, password: string): Promise<User | null> {
    const user = await database.users.findOne({ email });
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }

  async register(email: string, password: string): Promise<User> {
    // TODO: Implement
    throw new Error("Not implemented");
  }
}
`,
  mode="overwrite"
)
```

**Result:** Login implemented, Gemini sees the update.

### Minute 4: Gemini Updates Tests

```
User → Gemini: "Update tests to match the implementation"

Gemini calls:
collabfs_read_file(path="/src/auth.ts")

Gemini sees Claude's implementation, then calls:
collabfs_write_file(
  path="/src/auth.test.ts",
  content=`
import { AuthService, User } from './auth';
import { database } from './database';
import bcrypt from 'bcrypt';

jest.mock('./database');

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    jest.clearAllMocks();
  });

  test('login with valid credentials', async () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      passwordHash: await bcrypt.hash('password123', 10)
    };

    database.users.findOne.mockResolvedValue(mockUser);

    const result = await service.login('test@example.com', 'password123');
    expect(result).toEqual(mockUser);
  });

  test('login with invalid credentials returns null', async () => {
    database.users.findOne.mockResolvedValue(null);

    const result = await service.login('wrong@example.com', 'wrong');
    expect(result).toBeNull();
  });

  test('register new user', async () => {
    // TODO: Implement after register method is done
  });
});
`,
  mode="overwrite"
)
```

**Result:** Tests updated, Claude sees them.

### Minute 5: Both Work Simultaneously

```
User → Claude: "Implement the register method"
User → Gemini: "Add a database connection file"
```

**Claude edits /src/auth.ts** (register method)
**Gemini creates /src/database.ts**

**Both operations happen simultaneously:**
- No conflicts (different files)
- Both see each other's changes instantly
- Operation log shows both edits

### Minute 6: Check Activity

```
User → Claude: "What is Gemini working on?"

Claude calls:
collabfs_watch_activity()

Output:
Active collaborators: 1

gemini: editing /src/database.ts
  Last seen: 2025-11-18 10:35:20
```

### Minute 7: Conflict Resolution

```
User → Claude: "Add input validation to register"
User → Gemini: "Add error handling to register"
```

**Both edit the same register method simultaneously.**

**Yjs CRDT automatically merges:**
- Claude's validation code: inserted
- Gemini's error handling: inserted
- Result: Both changes preserved
- Humans review and clean up if needed

### Minute 8: Review

```
User → Claude: "List all files we created"

Claude calls:
collabfs_list_files()

Output:
Found 3 file(s):

/src/auth.ts
  Size: 1450 bytes
  Modified: 2025-11-18 10:35:45
  By: claude

/src/auth.test.ts
  Size: 980 bytes
  Modified: 2025-11-18 10:34:30
  By: gemini

/src/database.ts
  Size: 340 bytes
  Modified: 2025-11-18 10:35:20
  By: gemini
```

## What Made This Possible?

1. **Real-time sync**: Both agents see changes instantly
2. **CRDT conflict resolution**: Simultaneous edits merge automatically
3. **Activity awareness**: Agents know what others are doing
4. **No context switching**: Each user stays in their preferred interface
5. **Operation logging**: Full audit trail of who did what

## Key Takeaways

- ✅ **2x faster**: Two agents working in parallel
- ✅ **Zero merge conflicts**: CRDT handles it
- ✅ **Complete transparency**: Both agents see everything
- ✅ **Natural workflow**: Each agent uses their strengths
  - Claude: Implementation and architecture
  - Gemini: Testing and validation

## Try It Yourself

1. Start CollabFS server
2. Configure two different AI agents with same session ID
3. Give them complementary tasks
4. Watch them collaborate in real-time!
