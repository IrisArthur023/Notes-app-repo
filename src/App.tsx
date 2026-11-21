import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { EditorPane } from './components/EditorPane';
import { PreviewPane } from './components/PreviewPane';
import { VersionHistoryDrawer } from './components/VersionHistoryDrawer';
import { ShareModal } from './components/ShareModal';
import { CommentsDrawer } from './components/CommentsDrawer';
import { DocumentListModal } from './components/DocumentListModal';
import {
  DocumentDetail,
  User,
  Role,
  CollaboratorPeer,
  ViewMode,
  SyncState,
  Version,
  CommentItem,
} from './types';
import { ApiService } from './services/api';
import { CollabWebSocket } from './services/websocket';

export default function App() {
  // Current active user
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'u1',
    name: 'Sarah Connor',
    email: 'sarah@nexus.corp',
    avatar: 'SC',
    color: '#2563eb',
    defaultRole: 'admin',
  });
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  // Active document state
  const [docId, setDocId] = useState<string>('doc-alpha-01');
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [content, setContent] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<Role>('admin');

  // Real-time Collaboration & Peers
  const [collaborators, setCollaborators] = useState<CollaboratorPeer[]>([]);
  const collabWsRef = useRef<CollabWebSocket | null>(null);

  // View mode and UI drawers
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState<boolean>(false);
  const [isDocListOpen, setIsDocListOpen] = useState<boolean>(false);

  // Offline editing and cloud synchronization
  const [isSimulatingOffline, setIsSimulatingOffline] = useState<boolean>(false);
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  // Comments and Selection
  const [commentsCount, setCommentsCount] = useState<number>(1);
  const [selectedSnippet, setSelectedSnippet] = useState<{ text: string; line: number } | null>(null);

  // References
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const autoSaveTimerRef = useRef<any>(null);
  const lastSavedContentRef = useRef<string>('');
  const isRemoteUpdateRef = useRef<boolean>(false);

  // Load available users
  useEffect(() => {
    ApiService.getUsers(currentUser.id).then((users) => {
      setAvailableUsers(users);
      const matched = users.find((u) => u.id === currentUser.id);
      if (matched) {
        setCurrentUser(matched);
      }
    });
  }, []);

  // Update offline queue count
  const refreshOfflineCount = () => {
    const queue = ApiService.getOfflineQueue();
    setOfflineQueueCount(queue.length);
  };

  // Load active document
  const loadDoc = useCallback(
    async (id: string, user: User) => {
      try {
        const doc = await ApiService.getDocument(id, user.id);
        setDocument(doc);
        setContent(doc.content);
        setTitle(doc.title);
        setCurrentUserRole(doc.currentUserRole);
        lastSavedContentRef.current = doc.content;

        // Fetch comments count
        try {
          const coms = await ApiService.getComments(id, user.id);
          setCommentsCount(coms.length);
        } catch {}

        refreshOfflineCount();
      } catch (err) {
        console.error('Error loading document:', err);
      }
    },
    []
  );

  useEffect(() => {
    loadDoc(docId, currentUser);
  }, [docId, currentUser, loadDoc]);

  // WebSocket lifecycle management
  useEffect(() => {
    if (isSimulatingOffline) {
      if (collabWsRef.current) {
        collabWsRef.current.disconnect();
        collabWsRef.current = null;
      }
      setCollaborators([]);
      setSyncState('offline');
      return;
    }

    const ws = new CollabWebSocket(
      docId,
      {
        id: currentUser.id,
        name: currentUser.name,
        color: currentUser.color,
        role: currentUserRole,
        avatar: currentUser.avatar,
      },
      {
        onRoomState: (peers) => {
          // Filter out self
          setCollaborators(peers.filter((p) => p.userId !== currentUser.id));
        },
        onUserJoined: (peer) => {
          if (peer.userId !== currentUser.id) {
            setCollaborators((prev) => {
              const without = prev.filter((p) => p.userId !== peer.userId);
              return [...without, peer];
            });
          }
        },
        onUserLeft: (leavingUserId) => {
          setCollaborators((prev) => prev.filter((p) => p.userId !== leavingUserId));
        },
        onCursorUpdate: (peerId, cursor, selection) => {
          setCollaborators((prev) =>
            prev.map((p) => (p.userId === peerId ? { ...p, cursor, selection, lastActive: Date.now() } : p))
          );
        },
        onTextChange: (incomingContent, senderId, version) => {
          if (senderId !== currentUser.id) {
            isRemoteUpdateRef.current = true;
            setContent(incomingContent);
            lastSavedContentRef.current = incomingContent;
            setDocument((prev) =>
              prev ? { ...prev, content: incomingContent, version_counter: version } : null
            );
            setTimeout(() => {
              isRemoteUpdateRef.current = false;
            }, 50);
          }
        },
        onCommentAdded: () => {
          setCommentsCount((c) => c + 1);
        },
        onVersionCreated: () => {
          setDocument((prev) =>
            prev ? { ...prev, version_counter: prev.version_counter + 1 } : null
          );
        },
        onRoleUpdated: (userId, newRole) => {
          if (userId === currentUser.id) {
            setCurrentUserRole(newRole);
            setCurrentUser((u) => ({ ...u, defaultRole: newRole }));
          }
          setCollaborators((prev) =>
            prev.map((p) => (p.userId === userId ? { ...p, role: newRole } : p))
          );
        },
        onStatusChange: (status) => {
          if (status === 'connected') {
            setSyncState('synced');
          } else if (status === 'connecting') {
            setSyncState('syncing');
          } else {
            setSyncState('offline');
          }
        },
      }
    );

    ws.connect();
    collabWsRef.current = ws;

    return () => {
      ws.disconnect();
    };
  }, [docId, currentUser.id, currentUserRole, isSimulatingOffline]);

  // Handle local content changes
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setSyncState('pending');

    // Broadcast change to peers over WebSocket if not a remote update
    if (!isRemoteUpdateRef.current && !isSimulatingOffline && collabWsRef.current) {
      collabWsRef.current.sendTextChange(newContent, (document?.version_counter || 1) + 1);
    }

    // Debounced cloud save & automated snapshot
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      saveContent(newContent, false);
    }, 1500);
  };

  // Perform Save / Cloud Sync
  const saveContent = async (textToSave: string, isManualSnapshot: boolean = false) => {
    if (isSimulatingOffline) {
      // Queue offline mutation
      ApiService.queueOfflineMutation({
        docId,
        content: textToSave,
        title,
        timestamp: Date.now(),
        baseVersion: document?.version_counter || 1,
      });
      refreshOfflineCount();
      setSyncState('offline');
      return;
    }

    try {
      setSyncState('syncing');
      const res = await ApiService.updateDocument(
        docId,
        {
          content: textToSave,
          title,
          create_auto_version: isManualSnapshot || Math.abs(textToSave.length - lastSavedContentRef.current.length) > 30,
        },
        currentUser.id
      );
      lastSavedContentRef.current = textToSave;
      setDocument((prev) => (prev ? { ...prev, version_counter: res.version_counter } : null));
      setSyncState('synced');
    } catch (err: any) {
      console.warn('Auto-save error, queueing offline:', err);
      ApiService.queueOfflineMutation({
        docId,
        content: textToSave,
        title,
        timestamp: Date.now(),
        baseVersion: document?.version_counter || 1,
      });
      refreshOfflineCount();
      setSyncState('offline');
    }
  };

  // Sync offline queue with cloud
  const handleSyncNow = async () => {
    const queue = ApiService.getOfflineQueue();
    if (queue.length === 0) return;

    setSyncState('syncing');
    for (const item of queue) {
      try {
        const res = await ApiService.syncOfflineItem(item, currentUser.id);
        if (item.docId === docId) {
          setDocument((prev) => (prev ? { ...prev, version_counter: res.new_version } : null));
        }
      } catch (err) {
        console.error('Failed syncing offline item:', err);
      }
    }
    refreshOfflineCount();
    setSyncState('synced');
    loadDoc(docId, currentUser);
  };

  // Title change handler
  const handleTitleChange = async (newTitle: string) => {
    setTitle(newTitle);
    if (!isSimulatingOffline) {
      try {
        await ApiService.updateDocument(docId, { title: newTitle }, currentUser.id);
        setDocument((prev) => (prev ? { ...prev, title: newTitle } : null));
      } catch (err: any) {
        alert(err.message || 'Failed to rename document');
      }
    } else {
      ApiService.queueOfflineMutation({
        docId,
        content,
        title: newTitle,
        timestamp: Date.now(),
        baseVersion: document?.version_counter || 1,
      });
      refreshOfflineCount();
    }
  };

  // Markdown tool actions
  const handleInsertMarkdown = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end) || defaultText;

    const replacement = prefix + selectedText + suffix;
    const newContent = content.substring(0, start) + replacement + content.substring(end);

    handleContentChange(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + prefix.length;
      textarea.selectionEnd = start + prefix.length + selectedText.length;
    }, 0);
  };

  // Cursor move handler
  const handleCursorChange = (
    cursor: { line: number; ch: number },
    selection?: { start: { line: number; ch: number }; end: { line: number; ch: number } }
  ) => {
    if (!isSimulatingOffline && collabWsRef.current) {
      collabWsRef.current.sendCursor(cursor, selection);
    }
  };

  // Switch User Profile (for testing RBAC)
  const handleUserChange = (newUser: User) => {
    setCurrentUser(newUser);
    setCurrentUserRole(newUser.defaultRole);
  };

  // Add Comment on selected text
  const handleAddCommentClick = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = content.substring(start, end).trim();
      const line = content.substring(0, start).split('\n').length;
      if (text) {
        setSelectedSnippet({ text: text.slice(0, 100), line });
      } else {
        setSelectedSnippet(null);
      }
    }
    setIsCommentsOpen(true);
  };

  // Export document
  const handleExport = (format: 'md' | 'html' | 'txt') => {
    const safeTitle = (title || 'document').toLowerCase().replace(/\s+/g, '-');
    let blob: Blob;
    let filename: string;

    if (format === 'md') {
      blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      filename = `${safeTitle}.md`;
    } else if (format === 'txt') {
      blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      filename = `${safeTitle}.txt`;
    } else {
      const htmlString = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1f2937; }
    pre { background: #f3f4f6; padding: 16px; border-radius: 8px; overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 12px; }
    th { background: #f9fafb; font-weight: 600; }
    blockquote { border-left: 4px solid #3b82f6; padding-left: 16px; color: #4b5563; }
  </style>
</head>
<body>
  ${content
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>')
    .replace(/\*(.*?)\*/gim, '<i>$1</i>')
    .replace(/~~(.*?)~~/gim, '<del>$1</del>')
    .replace(/\n$/gim, '<br />')}
</body>
</html>`;
      blob = new Blob([htmlString], { type: 'text/html;charset=utf-8' });
      filename = `${safeTitle}.html`;
    }

    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = filename;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-white text-zinc-900 overflow-hidden font-sans">
      {/* Top Application Header */}
      <Header
        title={title}
        onTitleChange={handleTitleChange}
        currentUser={currentUser}
        onUserChange={handleUserChange}
        availableUsers={availableUsers}
        collaborators={collaborators}
        syncState={syncState}
        offlineCount={offlineQueueCount}
        isSimulatingOffline={isSimulatingOffline}
        onToggleSimulateOffline={() => {
          const next = !isSimulatingOffline;
          setIsSimulatingOffline(next);
          if (!next) {
            handleSyncNow();
          }
        }}
        onSyncNow={handleSyncNow}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenShare={() => setIsShareOpen(true)}
        onOpenComments={() => setIsCommentsOpen(true)}
        onOpenDocList={() => setIsDocListOpen(true)}
        versionCount={document?.version_counter || 1}
        commentsCount={commentsCount}
        onExport={handleExport}
      />

      {/* Formatting & View Toolbar */}
      <Toolbar
        onInsertMarkdown={handleInsertMarkdown}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        role={currentUserRole}
        stats={document?.stats}
        onAddCommentClick={handleAddCommentClick}
      />

      {/* Main Dual-Pane Editing Workspace */}
      <main className="flex-1 flex overflow-hidden relative">
        {(viewMode === 'split' || viewMode === 'edit') && (
          <EditorPane
            content={content}
            onChange={handleContentChange}
            role={currentUserRole}
            collaborators={collaborators}
            onCursorChange={handleCursorChange}
            textareaRef={textareaRef}
          />
        )}

        {(viewMode === 'split' || viewMode === 'preview') && (
          <PreviewPane
            content={content}
            stats={document?.stats}
            onOutlineClick={(line) => {
              if (textareaRef.current) {
                const lines = content.split('\n');
                let charPos = 0;
                for (let i = 0; i < Math.min(line - 1, lines.length); i++) {
                  charPos += lines[i].length + 1;
                }
                textareaRef.current.focus();
                textareaRef.current.selectionStart = charPos;
                textareaRef.current.selectionEnd = charPos;
              }
            }}
          />
        )}
      </main>

      {/* Automated Version History Drawer */}
      <VersionHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        docId={docId}
        currentContent={content}
        currentUserRole={currentUserRole}
        userId={currentUser.id}
        onRestoreSuccess={(restoredContent, newVersion) => {
          setContent(restoredContent);
          lastSavedContentRef.current = restoredContent;
          setDocument((prev) =>
            prev ? { ...prev, content: restoredContent, version_counter: newVersion } : null
          );
          if (collabWsRef.current) {
            collabWsRef.current.sendTextChange(restoredContent, newVersion);
          }
        }}
        onVersionCreated={(ver) => {
          if (collabWsRef.current) {
            collabWsRef.current.broadcastVersion(ver);
          }
        }}
      />

      {/* RBAC Share & Permissions Modal */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        docId={docId}
        docTitle={title}
        currentUserId={currentUser.id}
        currentUserRole={currentUserRole}
        onRoleChanged={(targetUserId, newRole) => {
          if (targetUserId === currentUser.id) {
            setCurrentUserRole(newRole);
          }
          if (collabWsRef.current) {
            collabWsRef.current.broadcastRoleChange(targetUserId, newRole);
          }
        }}
      />

      {/* Collaborative Comments Drawer */}
      <CommentsDrawer
        isOpen={isCommentsOpen}
        onClose={() => {
          setIsCommentsOpen(false);
          setSelectedSnippet(null);
        }}
        docId={docId}
        currentUser={currentUser}
        currentUserRole={currentUserRole}
        selectedSnippet={selectedSnippet}
        onCommentAdded={(c) => {
          setCommentsCount((prev) => prev + 1);
          if (collabWsRef.current) {
            collabWsRef.current.broadcastComment(c);
          }
        }}
      />

      {/* Document Switcher & Creator Modal */}
      <DocumentListModal
        isOpen={isDocListOpen}
        onClose={() => setIsDocListOpen(false)}
        activeDocId={docId}
        onSelectDocument={(newId) => {
          setDocId(newId);
          if (collabWsRef.current) {
            collabWsRef.current.switchDocument(newId);
          }
        }}
        currentUser={currentUser}
      />
    </div>
  );
}
