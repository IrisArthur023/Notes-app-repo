import { DocumentDetail, DocumentMeta, Version, CommentItem, User, Role, DiffLine, OfflineMutation } from '../types';

const OFFLINE_QUEUE_KEY = 'collab_word_proc_offline_queue';
const DOC_CACHE_PREFIX = 'collab_word_proc_doc_';

export class ApiService {
  private static getHeaders(userId: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    };
  }

  // Users
  static async getUsers(userId: string): Promise<User[]> {
    try {
      const res = await fetch('/api/users', {
        headers: this.getHeaders(userId),
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      return data.users;
    } catch {
      return [
        { id: 'u1', name: 'Sarah Connor', email: 'sarah@nexus.corp', avatar: 'SC', color: '#2563eb', defaultRole: 'admin' },
        { id: 'u2', name: 'Alex Rivera', email: 'alex.r@nexus.corp', avatar: 'AR', color: '#10b981', defaultRole: 'editor' },
        { id: 'u3', name: 'Maya Lin', email: 'maya.l@nexus.corp', avatar: 'ML', color: '#f59e0b', defaultRole: 'commenter' },
        { id: 'u4', name: 'David Chen', email: 'david.c@nexus.corp', avatar: 'DC', color: '#8b5cf6', defaultRole: 'viewer' },
      ];
    }
  }

  // Documents
  static async getDocuments(userId: string): Promise<DocumentMeta[]> {
    try {
      const res = await fetch('/api/documents', {
        headers: this.getHeaders(userId),
      });
      if (!res.ok) throw new Error('Failed to fetch documents');
      const data = await res.json();
      return data.documents;
    } catch (e) {
      console.warn('[API] Could not fetch documents from server, using offline cache', e);
      // Read any locally cached documents
      const docs: DocumentMeta[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(DOC_CACHE_PREFIX)) {
          try {
            const cached = JSON.parse(localStorage.getItem(key) || '{}');
            if (cached && cached.id) {
              docs.push({
                id: cached.id,
                title: cached.title,
                owner_id: cached.owner_id || userId,
                owner_name: cached.owner_name || 'Current User',
                created_at: cached.created_at || Date.now(),
                updated_at: cached.updated_at || Date.now(),
                version_counter: cached.version_counter || 1,
                user_role: cached.currentUserRole || 'editor',
                version_count: 1,
              });
            }
          } catch {}
        }
      }
      return docs;
    }
  }

  static async getDocument(id: string, userId: string): Promise<DocumentDetail> {
    try {
      const res = await fetch(`/api/documents/${id}`, {
        headers: this.getHeaders(userId),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      const doc = data.document as DocumentDetail;
      // Cache locally for offline availability
      localStorage.setItem(`${DOC_CACHE_PREFIX}${id}`, JSON.stringify(doc));
      return doc;
    } catch (e) {
      console.warn('[API] Fetch document failed, reading local cache for', id, e);
      const cached = localStorage.getItem(`${DOC_CACHE_PREFIX}${id}`);
      if (cached) {
        return JSON.parse(cached);
      }
      throw e;
    }
  }

  static async createDocument(title: string, content: string, userId: string): Promise<DocumentDetail> {
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: this.getHeaders(userId),
      body: JSON.stringify({ title, content }),
    });
    if (!res.ok) throw new Error('Failed to create document');
    const data = await res.json();
    return this.getDocument(data.document.id, userId);
  }

  static async updateDocument(
    id: string,
    payload: { title?: string; content?: string; create_auto_version?: boolean },
    userId: string
  ): Promise<{ success: boolean; version_counter: number }> {
    const res = await fetch(`/api/documents/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(userId),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update document');
    }
    return res.json();
  }

  static async deleteDocument(id: string, userId: string): Promise<void> {
    const res = await fetch(`/api/documents/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(userId),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete document');
    }
  }

  // Automated Version History
  static async getVersions(docId: string, userId: string): Promise<Version[]> {
    const res = await fetch(`/api/documents/${docId}/versions`, {
      headers: this.getHeaders(userId),
    });
    if (!res.ok) throw new Error('Failed to fetch versions');
    const data = await res.json();
    return data.versions;
  }

  static async createVersion(
    docId: string,
    payload: { title: string; summary?: string; type: 'milestone' | 'auto' },
    userId: string
  ): Promise<Version> {
    const res = await fetch(`/api/documents/${docId}/versions`, {
      method: 'POST',
      headers: this.getHeaders(userId),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create version');
    }
    const data = await res.json();
    return data.version;
  }

  static async restoreVersion(docId: string, versionId: string, userId: string): Promise<{ success: boolean; restored_content: string; new_version: number }> {
    const res = await fetch(`/api/documents/${docId}/restore`, {
      method: 'POST',
      headers: this.getHeaders(userId),
      body: JSON.stringify({ version_id: versionId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to restore version');
    }
    return res.json();
  }

  // Diffs
  static async getDiff(textA: string, textB: string, userId: string): Promise<{ diff: DiffLine[]; summary: { added: number; removed: number } }> {
    const res = await fetch('/api/markdown/diff', {
      method: 'POST',
      headers: this.getHeaders(userId),
      body: JSON.stringify({ text_a: textA, text_b: textB }),
    });
    if (!res.ok) throw new Error('Failed to compute diff');
    return res.json();
  }

  // Permissions & RBAC
  static async getPermissions(docId: string, userId: string): Promise<Array<{ id: string; name: string; email: string; avatar: string; color: string; role: Role; is_owner: boolean }>> {
    const res = await fetch(`/api/documents/${docId}/permissions`, {
      headers: this.getHeaders(userId),
    });
    if (!res.ok) throw new Error('Failed to fetch permissions');
    const data = await res.json();
    return data.permissions;
  }

  static async updatePermission(docId: string, targetUserId: string, newRole: Role, userId: string): Promise<void> {
    const res = await fetch(`/api/documents/${docId}/permissions`, {
      method: 'POST',
      headers: this.getHeaders(userId),
      body: JSON.stringify({ user_id: targetUserId, role: newRole }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update permission');
    }
  }

  // Comments
  static async getComments(docId: string, userId: string): Promise<CommentItem[]> {
    const res = await fetch(`/api/documents/${docId}/comments`, {
      headers: this.getHeaders(userId),
    });
    if (!res.ok) throw new Error('Failed to fetch comments');
    const data = await res.json();
    return data.comments;
  }

  static async addComment(
    docId: string,
    comment: { text: string; selection_text?: string; line_number?: number },
    userId: string
  ): Promise<CommentItem> {
    const res = await fetch(`/api/documents/${docId}/comments`, {
      method: 'POST',
      headers: this.getHeaders(userId),
      body: JSON.stringify(comment),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add comment');
    }
    const data = await res.json();
    return data.comment;
  }

  // Cloud Synchronization for Offline Editing
  static getOfflineQueue(): OfflineMutation[] {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static queueOfflineMutation(mutation: OfflineMutation): void {
    const queue = this.getOfflineQueue();
    // Replace if same document already has a pending mutation, else append
    const existingIdx = queue.findIndex((m) => m.docId === mutation.docId);
    if (existingIdx >= 0) {
      queue[existingIdx] = mutation;
    } else {
      queue.push(mutation);
    }
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  }

  static clearOfflineQueueItem(docId: string): void {
    const queue = this.getOfflineQueue().filter((m) => m.docId !== docId);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  }

  static async syncOfflineItem(mutation: OfflineMutation, userId: string): Promise<{ success: boolean; new_version: number; conflict_resolved?: boolean }> {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: this.getHeaders(userId),
      body: JSON.stringify({
        doc_id: mutation.docId,
        content: mutation.content,
        title: mutation.title,
        client_timestamp: mutation.timestamp,
        base_version: mutation.baseVersion,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to sync offline item');
    }
    const data = await res.json();
    this.clearOfflineQueueItem(mutation.docId);
    return data;
  }
}
