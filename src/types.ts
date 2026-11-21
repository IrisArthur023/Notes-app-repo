export type Role = 'admin' | 'editor' | 'commenter' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  color: string;
  defaultRole: Role;
}

export interface DocumentStats {
  words: number;
  characters: number;
  lines: number;
  readingTimeMinutes: number;
  headings: number;
  outline: Array<{
    line: number;
    level: number;
    title: string;
    id: string;
  }>;
}

export interface DocumentMeta {
  id: string;
  title: string;
  owner_id: string;
  owner_name: string;
  created_at: number;
  updated_at: number;
  version_counter: number;
  user_role: Role;
  version_count: number;
}

export interface DocumentDetail {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  owner_name: string;
  created_at: number;
  updated_at: number;
  version_counter: number;
  currentUserRole: Role;
  stats: DocumentStats;
}

export interface VersionDiffSummary {
  added: number;
  removed: number;
}

export interface Version {
  id: string;
  doc_id: string;
  version_number: number;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  created_at: number;
  snapshot_type: 'auto' | 'milestone' | 'restore';
  summary?: string;
  diff_summary?: VersionDiffSummary;
}

export interface CommentItem {
  id: string;
  doc_id: string;
  user_id: string;
  user_name: string;
  user_color: string;
  selection_text?: string;
  line_number?: number;
  text: string;
  resolved: number;
  created_at: number;
}

export interface CollaboratorPeer {
  userId: string;
  name: string;
  color: string;
  role: Role;
  avatar?: string;
  cursor?: { line: number; ch: number };
  selection?: { start: { line: number; ch: number }; end: { line: number; ch: number } };
  lastActive: number;
}

export interface DiffLine {
  type: 'equal' | 'add' | 'remove';
  text: string;
}

export interface OfflineMutation {
  docId: string;
  content: string;
  title: string;
  timestamp: number;
  baseVersion: number;
}

export type ViewMode = 'split' | 'edit' | 'preview';
export type SyncState = 'synced' | 'syncing' | 'offline' | 'pending';
