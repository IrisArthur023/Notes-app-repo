import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  X,
  Calendar,
  Clock,
  Check,
  FolderOpen,
} from 'lucide-react';
import { DocumentMeta, Role, User } from '../types';
import { ApiService } from '../services/api';

interface DocumentListModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDocId: string;
  onSelectDocument: (docId: string) => void;
  currentUser: User;
}

export const DocumentListModal: React.FC<DocumentListModalProps> = ({
  isOpen,
  onClose,
  activeDocId,
  onSelectDocument,
  currentUser,
}) => {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const list = await ApiService.getDocuments(currentUser.id);
      setDocuments(list);
    } catch (err) {
      console.error('Failed to load document list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen, currentUser.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const template = `# ${newTitle.trim()}\n\nWelcome to your new collaborative document. Start typing or formatting your notes.\n`;
      const created = await ApiService.createDocument(newTitle.trim(), template, currentUser.id);
      setNewTitle('');
      setIsCreating(false);
      onSelectDocument(created.id);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to create document');
    }
  };

  const handleDelete = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this document and all its version history?')) {
      return;
    }

    try {
      await ApiService.deleteDocument(docId, currentUser.id);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (activeDocId === docId) {
        // switch to first remaining doc if any
        const remaining = documents.filter((d) => d.id !== docId);
        if (remaining.length > 0) {
          onSelectDocument(remaining[0].id);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete document');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-sm text-zinc-900">Your Documents</h3>
              <p className="text-[11px] text-zinc-500">
                Synced with Python SQLite database
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Create new document trigger / form */}
        <div className="p-4 border-b border-zinc-100 bg-white">
          {isCreating ? (
            <form onSubmit={handleCreate} className="flex gap-2">
              <input
                type="text"
                autoFocus
                placeholder="Document title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-zinc-300 rounded-lg text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-xs"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-100 rounded-lg text-xs"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-zinc-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-lg text-xs font-semibold text-zinc-700 hover:text-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Document</span>
            </button>
          )}
        </div>

        {/* Documents list */}
        <div className="p-4 max-h-80 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="text-center py-8 text-xs text-zinc-400">Loading documents...</div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-400">No documents found.</div>
          ) : (
            documents.map((doc) => {
              const isActive = doc.id === activeDocId;
              const canDelete = doc.user_role === 'admin' || currentUser.defaultRole === 'admin';

              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    onSelectDocument(doc.id);
                    onClose();
                  }}
                  className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                    isActive
                      ? 'bg-blue-50/50 border-blue-400 shadow-xs'
                      : 'bg-white border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText
                      className={`w-5 h-5 shrink-0 ${
                        isActive ? 'text-blue-600' : 'text-zinc-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-zinc-900 truncate">
                          {doc.title}
                        </h4>
                        {isActive && (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                        <span>Owner: {doc.owner_name}</span>
                        <span>•</span>
                        <span>v{doc.version_counter}</span>
                        <span>•</span>
                        <span>{new Date(doc.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">
                      {doc.user_role}
                    </span>
                    {canDelete && (
                      <button
                        onClick={(e) => handleDelete(doc.id, e)}
                        title="Delete document"
                        className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
