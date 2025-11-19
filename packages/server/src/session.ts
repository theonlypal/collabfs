/**
 * Session Management
 * Manages collaborative sessions with Yjs CRDT documents
 */

import * as Y from 'yjs';
import { Session, Operation, Activity, FileMetadata } from './types.js';

export class CollabSession {
  public readonly sessionId: string;
  public readonly doc: Y.Doc;
  public readonly fileTree: Y.Map<FileMetadata>;
  public readonly fileContents: Y.Map<Y.Text>;
  public readonly opLog: Y.Array<Operation>;
  public readonly activity: Y.Map<Activity>;

  private session: Session;
  private tokenCounter: number = 0;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.doc = new Y.Doc();

    // Initialize CRDT structures
    this.fileTree = this.doc.getMap('fileTree');
    this.fileContents = this.doc.getMap('fileContents');
    this.opLog = this.doc.getArray('opLog');
    this.activity = this.doc.getMap('activity');

    this.session = {
      sessionId,
      createdAt: Date.now(),
      participants: new Set(),
      tokenCounter: 0
    };

    console.log(`[Session] Created session: ${sessionId}`);
  }

  /**
   * Add a participant to the session
   */
  addParticipant(userId: string): void {
    this.session.participants.add(userId);
    console.log(`[Session] ${userId} joined session ${this.sessionId}`);
  }

  /**
   * Remove a participant from the session
   */
  removeParticipant(userId: string): void {
    this.session.participants.delete(userId);
    this.activity.delete(userId);
    console.log(`[Session] ${userId} left session ${this.sessionId}`);
  }

  /**
   * Get next fencing token for structural operations
   */
  getNextToken(): number {
    return ++this.tokenCounter;
  }

  /**
   * Log an operation to the operation log
   */
  logOperation(op: Omit<Operation, 'token'>): number {
    const token = this.getNextToken();
    const operation: Operation = { ...op, token };

    this.doc.transact(() => {
      this.opLog.push([operation]);
    });

    console.log(`[Session] Operation logged: ${op.type} ${op.path} (token: ${token})`);
    return token;
  }

  /**
   * Update user activity
   */
  updateActivity(userId: string, activityUpdate: Partial<Activity>): void {
    this.doc.transact(() => {
      const current = this.activity.get(userId) || {
        userId,
        action: 'idle' as const,
        timestamp: Date.now()
      };

      const updated: Activity = {
        ...current,
        ...activityUpdate,
        timestamp: Date.now()
      };

      this.activity.set(userId, updated);
    });
  }

  /**
   * Check if a file exists
   */
  fileExists(path: string): boolean {
    return this.fileContents.has(path);
  }

  /**
   * Get file content as string
   */
  getFileContent(path: string): string | null {
    const ytext = this.fileContents.get(path);
    return ytext ? ytext.toString() : null;
  }

  /**
   * Create or update a file
   */
  writeFile(path: string, content: string, userId: string, mode: 'overwrite' | 'append' = 'overwrite'): number {
    let ytext = this.fileContents.get(path);
    const isNew = !ytext;

    this.doc.transact(() => {
      if (!ytext) {
        ytext = new Y.Text();
        this.fileContents.set(path, ytext);
      }

      if (mode === 'overwrite') {
        ytext.delete(0, ytext.length);
        ytext.insert(0, content);
      } else {
        ytext.insert(ytext.length, content);
      }

      // Update file tree metadata
      this.fileTree.set(path, {
        type: 'file',
        lastModified: Date.now(),
        lastModifiedBy: userId,
        token: this.tokenCounter + 1,
        size: content.length
      });
    });

    return this.logOperation({
      type: isNew ? 'create' : 'write',
      path,
      by: userId,
      timestamp: Date.now(),
      success: true
    });
  }

  /**
   * Move/rename a file
   */
  moveFile(oldPath: string, newPath: string, userId: string): { success: boolean; token?: number; error?: string } {
    if (!this.fileExists(oldPath)) {
      const token = this.logOperation({
        type: 'move',
        path: oldPath,
        newPath,
        by: userId,
        timestamp: Date.now(),
        success: false,
        error: `File ${oldPath} does not exist`
      });
      return { success: false, token, error: `File ${oldPath} does not exist` };
    }

    if (this.fileExists(newPath)) {
      const token = this.logOperation({
        type: 'move',
        path: oldPath,
        newPath,
        by: userId,
        timestamp: Date.now(),
        success: false,
        error: `File ${newPath} already exists`
      });
      return { success: false, token, error: `File ${newPath} already exists` };
    }

    this.doc.transact(() => {
      const content = this.fileContents.get(oldPath)!;
      const metadata = this.fileTree.get(oldPath);

      this.fileContents.set(newPath, content);
      this.fileContents.delete(oldPath);

      if (metadata) {
        this.fileTree.set(newPath, {
          ...metadata,
          lastModified: Date.now(),
          lastModifiedBy: userId,
          token: this.tokenCounter + 1
        });
      }
      this.fileTree.delete(oldPath);
    });

    const token = this.logOperation({
      type: 'move',
      path: oldPath,
      newPath,
      by: userId,
      timestamp: Date.now(),
      success: true
    });

    return { success: true, token };
  }

  /**
   * Delete a file
   */
  deleteFile(path: string, userId: string): { success: boolean; token?: number; error?: string } {
    if (!this.fileExists(path)) {
      const token = this.logOperation({
        type: 'delete',
        path,
        by: userId,
        timestamp: Date.now(),
        success: false,
        error: `File ${path} does not exist`
      });
      return { success: false, token, error: `File ${path} does not exist` };
    }

    this.doc.transact(() => {
      this.fileContents.delete(path);
      this.fileTree.delete(path);
    });

    const token = this.logOperation({
      type: 'delete',
      path,
      by: userId,
      timestamp: Date.now(),
      success: true
    });

    return { success: true, token };
  }

  /**
   * List all files
   */
  listFiles(prefix?: string): Array<{ path: string; metadata: FileMetadata }> {
    const files: Array<{ path: string; metadata: FileMetadata }> = [];

    this.fileContents.forEach((_, path) => {
      if (!prefix || path.startsWith(prefix)) {
        const metadata = this.fileTree.get(path);
        if (metadata) {
          files.push({ path, metadata });
        }
      }
    });

    return files;
  }

  /**
   * Get all current activities
   */
  getActivities(): Activity[] {
    const activities: Activity[] = [];
    this.activity.forEach((activity) => {
      activities.push(activity);
    });
    return activities;
  }

  /**
   * Get session statistics
   */
  getStats() {
    return {
      sessionId: this.sessionId,
      createdAt: this.session.createdAt,
      participants: Array.from(this.session.participants),
      fileCount: this.fileContents.size,
      operationCount: this.opLog.length,
      activeUsers: this.activity.size
    };
  }

  /**
   * Cleanup session resources
   */
  destroy(): void {
    this.doc.destroy();
    console.log(`[Session] Destroyed session: ${this.sessionId}`);
  }
}
