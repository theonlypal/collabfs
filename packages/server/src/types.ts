/**
 * CollabFS Server Types
 * Core type definitions for the collaborative filesystem
 */

export interface FileMetadata {
  type: 'file' | 'directory';
  lastModified: number;
  lastModifiedBy: string;
  token: number;
  size?: number;
}

export interface FileTreeEntry extends FileMetadata {
  path: string;
  children?: string[];
}

export interface Operation {
  token: number;
  type: 'create' | 'write' | 'move' | 'delete' | 'mkdir';
  path: string;
  newPath?: string;
  by: string;
  timestamp: number;
  success: boolean;
  error?: string;
}

export interface Activity {
  userId: string;
  currentFile?: string;
  action: 'idle' | 'reading' | 'editing' | 'moving' | 'deleting';
  timestamp: number;
}

export interface Session {
  sessionId: string;
  createdAt: number;
  participants: Set<string>;
  tokenCounter: number;
}

export interface ClientMessage {
  type: 'join' | 'leave' | 'heartbeat' | 'update_activity';
  userId: string;
  sessionId: string;
  activity?: Partial<Activity>;
}

export interface ServerMessage {
  type: 'joined' | 'participant_joined' | 'participant_left' | 'activity_update' | 'error';
  data?: any;
  error?: string;
}
