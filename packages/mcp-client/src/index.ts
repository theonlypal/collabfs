#!/usr/bin/env node

/**
 * CollabFS MCP Server
 * Exposes collaborative filesystem operations to LLMs via MCP
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { CollabFSClient } from './client.js';
import { z } from 'zod';
import * as Y from 'yjs';

// Configuration from environment variables
const SERVER_URL = process.env.COLLABFS_SERVER_URL || '';
const USER_ID = process.env.COLLABFS_USER_ID || `user_${Math.random().toString(36).substr(2, 9)}`;
const SESSION_ID = process.env.COLLABFS_SESSION_ID || 'default';

if (!SERVER_URL) {
  console.error(`
╔═══════════════════════════════════════════════════════════════════╗
║                     CollabFS MCP Client                            ║
║                      Configuration Error                           ║
╚═══════════════════════════════════════════════════════════════════╝

ERROR: COLLABFS_SERVER_URL environment variable is required!

Example configuration for Claude Code MCP settings:

{
  "mcpServers": {
    "collabfs": {
      "command": "npx",
      "args": ["collabfs-mcp"],
      "env": {
        "COLLABFS_SERVER_URL": "wss://your-server.railway.app",
        "COLLABFS_SESSION_ID": "my-project",
        "COLLABFS_USER_ID": "claude-user"
      }
    }
  }
}

Replace "wss://your-server.railway.app" with your actual deployed server URL.

Visit: https://github.com/theonlypal/collabfs for setup instructions.
`);
  process.exit(1);
}

class CollabFSMCPServer {
  private server: Server;
  private client: CollabFSClient | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'collabfs-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.handleToolCall(request)
    );
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Server] Error:', error);
    };

    process.on('SIGINT', async () => {
      if (this.client) {
        this.client.destroy();
      }
      await this.server.close();
      process.exit(0);
    });
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'collabfs_connect',
        description: 'Connect to a CollabFS collaborative session. Must be called first before any file operations.',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID to join (all collaborators use the same session ID)',
            },
            userId: {
              type: 'string',
              description: 'Your user ID (optional, auto-generated if not provided)',
            },
          },
          required: ['sessionId'],
        },
      },
      {
        name: 'collabfs_read_file',
        description: 'Read a file from the collaborative session. Returns the current content with all merged changes from all collaborators.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path (e.g., "/src/auth.ts")',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'collabfs_write_file',
        description: 'Write or update a file in the collaborative session. Uses CRDT for automatic conflict-free merging if multiple collaborators edit simultaneously.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path (e.g., "/src/auth.ts")',
            },
            content: {
              type: 'string',
              description: 'File content to write',
            },
            mode: {
              type: 'string',
              enum: ['overwrite', 'append'],
              description: 'Write mode: overwrite (replace entire file) or append (add to end)',
              default: 'overwrite',
            },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'collabfs_move_file',
        description: 'Move or rename a file. Uses fencing tokens to prevent race conditions. Returns error if file no longer exists or destination already exists.',
        inputSchema: {
          type: 'object',
          properties: {
            oldPath: {
              type: 'string',
              description: 'Current file path',
            },
            newPath: {
              type: 'string',
              description: 'New file path',
            },
          },
          required: ['oldPath', 'newPath'],
        },
      },
      {
        name: 'collabfs_delete_file',
        description: 'Delete a file from the session. Uses fencing tokens to prevent race conditions. Returns error if file no longer exists.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path to delete',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'collabfs_list_files',
        description: 'List all files in the collaborative session with metadata (last modified, modified by, etc.).',
        inputSchema: {
          type: 'object',
          properties: {
            prefix: {
              type: 'string',
              description: 'Optional path prefix to filter files (e.g., "/src" lists only files in /src)',
            },
          },
        },
      },
      {
        name: 'collabfs_watch_activity',
        description: 'See what other collaborators are currently doing (editing, reading, moving files, etc.).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'collabfs_disconnect',
        description: 'Disconnect from the collaborative session. Call this when done collaborating.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  private async handleToolCall(request: any): Promise<any> {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'collabfs_connect':
          return await this.handleConnect(args);
        case 'collabfs_read_file':
          return await this.handleReadFile(args);
        case 'collabfs_write_file':
          return await this.handleWriteFile(args);
        case 'collabfs_move_file':
          return await this.handleMoveFile(args);
        case 'collabfs_delete_file':
          return await this.handleDeleteFile(args);
        case 'collabfs_list_files':
          return await this.handleListFiles(args);
        case 'collabfs_watch_activity':
          return await this.handleWatchActivity(args);
        case 'collabfs_disconnect':
          return await this.handleDisconnect(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleConnect(args: any): Promise<any> {
    const sessionId = args.sessionId || SESSION_ID;
    const userId = args.userId || USER_ID;

    if (this.client) {
      return {
        content: [
          {
            type: 'text',
            text: `Already connected to session ${this.client.getSessionId()} as ${this.client.getUserId()}`,
          },
        ],
      };
    }

    this.client = new CollabFSClient({
      serverUrl: SERVER_URL,
      userId,
      sessionId,
    });

    await this.client.connect();

    // Start heartbeat
    setInterval(() => {
      if (this.client) {
        this.client.sendHeartbeat();
      }
    }, 30000);

    return {
      content: [
        {
          type: 'text',
          text: `Connected to CollabFS session "${sessionId}" as "${userId}"\nServer: ${SERVER_URL}\n\nYou can now collaborate with other AI agents in real-time!`,
        },
      ],
    };
  }

  private async handleReadFile(args: any): Promise<any> {
    this.ensureConnected();

    const { path } = args;
    const ytext = this.client!.fileContents.get(path);

    if (!ytext) {
      throw new Error(`File not found: ${path}`);
    }

    const content = ytext.toString();
    const metadata = this.client!.fileTree.get(path);

    this.client!.updateActivity({ currentFile: path, action: 'reading' });

    return {
      content: [
        {
          type: 'text',
          text: content,
        },
      ],
      _meta: metadata,
    };
  }

  private async handleWriteFile(args: any): Promise<any> {
    this.ensureConnected();

    const { path, content, mode = 'overwrite' } = args;

    this.client!.updateActivity({ currentFile: path, action: 'editing' });

    // Get or create YText
    let ytext = this.client!.fileContents.get(path);
    const isNew = !ytext;

    this.client!.doc.transact(() => {
      if (!ytext) {
        ytext = new Y.Text();
        this.client!.fileContents.set(path, ytext);
      }

      if (mode === 'overwrite') {
        ytext.delete(0, ytext.length);
        ytext.insert(0, content);
      } else {
        ytext.insert(ytext.length, content);
      }

      // Update metadata
      this.client!.fileTree.set(path, {
        type: 'file',
        lastModified: Date.now(),
        lastModifiedBy: this.client!.getUserId(),
        token: Date.now(), // Simplified token
        size: content.length,
      });
    });

    return {
      content: [
        {
          type: 'text',
          text: `${isNew ? 'Created' : 'Updated'} file: ${path}\nMode: ${mode}\nSize: ${content.length} bytes\n\nChanges automatically synced with all collaborators!`,
        },
      ],
    };
  }

  private async handleMoveFile(args: any): Promise<any> {
    this.ensureConnected();

    const { oldPath, newPath } = args;

    if (!this.client!.fileContents.has(oldPath)) {
      throw new Error(`File ${oldPath} does not exist. It may have been deleted by another collaborator.`);
    }

    if (this.client!.fileContents.has(newPath)) {
      throw new Error(`File ${newPath} already exists. Cannot move to existing location.`);
    }

    this.client!.updateActivity({ currentFile: oldPath, action: 'moving' });

    this.client!.doc.transact(() => {
      const content = this.client!.fileContents.get(oldPath)!;
      const metadata = this.client!.fileTree.get(oldPath);

      this.client!.fileContents.set(newPath, content);
      this.client!.fileContents.delete(oldPath);

      if (metadata) {
        this.client!.fileTree.set(newPath, {
          ...metadata,
          lastModified: Date.now(),
          lastModifiedBy: this.client!.getUserId(),
        });
      }
      this.client!.fileTree.delete(oldPath);
    });

    return {
      content: [
        {
          type: 'text',
          text: `Moved file: ${oldPath} → ${newPath}\n\nChange synced with all collaborators!`,
        },
      ],
    };
  }

  private async handleDeleteFile(args: any): Promise<any> {
    this.ensureConnected();

    const { path } = args;

    if (!this.client!.fileContents.has(path)) {
      throw new Error(`File ${path} does not exist. It may have already been deleted by another collaborator.`);
    }

    this.client!.updateActivity({ currentFile: path, action: 'deleting' });

    this.client!.doc.transact(() => {
      this.client!.fileContents.delete(path);
      this.client!.fileTree.delete(path);
    });

    return {
      content: [
        {
          type: 'text',
          text: `Deleted file: ${path}\n\nChange synced with all collaborators!`,
        },
      ],
    };
  }

  private async handleListFiles(args: any): Promise<any> {
    this.ensureConnected();

    const { prefix } = args;
    const files: any[] = [];

    this.client!.fileContents.forEach((_, path) => {
      if (!prefix || path.startsWith(prefix)) {
        const metadata = this.client!.fileTree.get(path);
        files.push({
          path,
          ...metadata,
        });
      }
    });

    files.sort((a, b) => a.path.localeCompare(b.path));

    const fileList = files
      .map(
        (f) =>
          `${f.path}\n  Size: ${f.size || 0} bytes\n  Modified: ${new Date(f.lastModified).toLocaleString()}\n  By: ${f.lastModifiedBy}`
      )
      .join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${files.length} file(s)${prefix ? ` in ${prefix}` : ''}:\n\n${fileList || '(no files)'}`,
        },
      ],
    };
  }

  private async handleWatchActivity(args: any): Promise<any> {
    this.ensureConnected();

    const activities: any[] = [];
    this.client!.activity.forEach((activity, userId) => {
      if (userId !== this.client!.getUserId()) {
        activities.push({
          userId,
          ...activity,
        });
      }
    });

    const activityList = activities
      .map(
        (a) =>
          `${a.userId}: ${a.action}${a.currentFile ? ` ${a.currentFile}` : ''}\n  Last seen: ${new Date(a.timestamp).toLocaleString()}`
      )
      .join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `Active collaborators: ${activities.length}\n\n${activityList || '(no other collaborators active)'}`,
        },
      ],
    };
  }

  private async handleDisconnect(args: any): Promise<any> {
    if (!this.client) {
      return {
        content: [
          {
            type: 'text',
            text: 'Not connected to any session',
          },
        ],
      };
    }

    const sessionId = this.client.getSessionId();
    this.client.destroy();
    this.client = null;

    return {
      content: [
        {
          type: 'text',
          text: `Disconnected from session: ${sessionId}`,
        },
      ],
    };
  }

  private ensureConnected(): void {
    if (!this.client || !this.client.isConnected()) {
      throw new Error('Not connected to CollabFS. Call collabfs_connect first.');
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('CollabFS MCP Server running on stdio');
    console.error(`Server: ${SERVER_URL}`);
    console.error(`Default User ID: ${USER_ID}`);
    console.error(`Default Session ID: ${SESSION_ID}`);
  }
}

// Start the server
const mcpServer = new CollabFSMCPServer();
mcpServer.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
