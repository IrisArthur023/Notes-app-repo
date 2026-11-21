import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  CheckCircle,
  Quote,
  Clock,
  User as UserIcon,
} from 'lucide-react';
import { CommentItem, Role, User } from '../types';
import { ApiService } from '../services/api';

interface CommentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
  currentUser: User;
  currentUserRole: Role;
  selectedSnippet?: { text: string; line: number } | null;
  onCommentAdded: (comment: CommentItem) => void;
}

export const CommentsDrawer: React.FC<CommentsDrawerProps> = ({
  isOpen,
  onClose,
  docId,
  currentUser,
  currentUserRole,
  selectedSnippet,
  onCommentAdded,
}) => {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canComment = currentUserRole !== 'viewer';

  const loadComments = async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getComments(docId, currentUser.id);
      setComments(data);
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadComments();
    }
  }, [isOpen, docId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !canComment) return;

    setIsSubmitting(true);
    try {
      const added = await ApiService.addComment(
        docId,
        {
          text: newCommentText.trim(),
          selection_text: selectedSnippet?.text,
          line_number: selectedSnippet?.line,
        },
        currentUser.id
      );

      setComments((prev) => [...prev, added]);
      onCommentAdded(added);
      setNewCommentText('');
    } catch (err: any) {
      alert(err.message || 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-40 flex flex-col border-l border-zinc-200 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 bg-zinc-50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-amber-600" />
          <div>
            <h3 className="font-bold text-sm text-zinc-900">Document Comments</h3>
            <p className="text-[11px] text-zinc-500">
              {comments.length} collaborative note{comments.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Comment List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/50">
        {isLoading ? (
          <div className="text-center py-8 text-xs text-zinc-400">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 text-xs">
            No comments on this document yet. Select text in the editor to leave contextual feedback!
          </div>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className="p-3 bg-white border border-zinc-200 rounded-lg shadow-2xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-2xs"
                    style={{ backgroundColor: c.user_color }}
                  >
                    {c.user_name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-zinc-900">{c.user_name}</span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {new Date(c.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {c.selection_text && (
                <div className="flex items-start gap-1.5 bg-amber-50/70 border-l-2 border-amber-400 px-2 py-1 rounded-r text-[11px] text-amber-900 italic font-mono">
                  <Quote className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                  <span className="truncate">"{c.selection_text}"</span>
                </div>
              )}

              <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap">
                {c.text}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Add Comment Input Form */}
      {canComment ? (
        <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-zinc-200 space-y-2">
          {selectedSnippet && (
            <div className="flex items-center justify-between text-[11px] bg-amber-50 px-2.5 py-1 rounded border border-amber-200 text-amber-800">
              <span className="truncate max-w-xs">Annotating: "{selectedSnippet.text}"</span>
            </div>
          )}

          <div className="relative">
            <textarea
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Write a suggestion or comment..."
              rows={3}
              className="w-full p-2.5 text-xs border border-zinc-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newCommentText.trim()}
              className="absolute bottom-2.5 right-2.5 p-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-md shadow-xs transition-colors"
              title="Post comment"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      ) : (
        <div className="p-4 bg-zinc-50 border-t border-zinc-200 text-center text-xs text-zinc-400">
          Viewer accounts cannot submit comments.
        </div>
      )}
    </div>
  );
};
