import React, { useState, useEffect } from 'react';
import {
  Shield,
  X,
  Users,
  Check,
  ShieldAlert,
  Edit3,
  MessageSquare,
  Eye,
  Info,
} from 'lucide-react';
import { Role } from '../types';
import { ApiService } from '../services/api';

interface CollaboratorPermission {
  id: string;
  name: string;
  email: string;
  avatar: string;
  color: string;
  role: Role;
  is_owner: boolean;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
  docTitle: string;
  currentUserId: string;
  currentUserRole: Role;
  onRoleChanged: (userId: string, newRole: Role) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  docId,
  docTitle,
  currentUserId,
  currentUserRole,
  onRoleChanged,
}) => {
  const [collaborators, setCollaborators] = useState<CollaboratorPermission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const isAdmin = currentUserRole === 'admin';

  useEffect(() => {
    if (isOpen) {
      loadPermissions();
    }
  }, [isOpen, docId]);

  const loadPermissions = async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getPermissions(docId, currentUserId);
      setCollaborators(data);
    } catch (err) {
      console.error('Error fetching permissions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: Role) => {
    if (!isAdmin) {
      alert('Only Administrators can modify collaborator roles.');
      return;
    }

    try {
      await ApiService.updatePermission(docId, targetUserId, newRole, currentUserId);
      setCollaborators((prev) =>
        prev.map((c) => (c.id === targetUserId ? { ...c, role: newRole } : c))
      );
      onRoleChanged(targetUserId, newRole);
      setSuccessMessage('Permissions updated and broadcast in real-time.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update user permission');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-100/70 text-blue-700">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900">
                Role-Based Access Control (RBAC)
              </h3>
              <p className="text-[11px] text-zinc-500 truncate max-w-xs sm:max-w-sm">
                Manage roles and permissions for "{docTitle}"
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

        {/* Success toast */}
        {successMessage && (
          <div className="bg-emerald-50 text-emerald-800 px-4 py-2 text-xs flex items-center gap-1.5 border-b border-emerald-100 font-medium">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Roles Definition Reference Guide */}
        <div className="px-5 py-3 bg-blue-50/40 border-b border-zinc-100">
          <div className="flex items-start gap-2 text-[11px] text-zinc-600">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-zinc-800">Permission Hierarchy:</span>
              <p className="text-zinc-600">
                <strong>Admin:</strong> Full read/write, permissions management, version restoration.
                <br />
                <strong>Editor:</strong> Real-time editing, snapshot creation, and comments.
                <br />
                <strong>Commenter:</strong> Read-only editor with selection commenting.
                <br />
                <strong>Viewer:</strong> Read-only document access.
              </p>
            </div>
          </div>
        </div>

        {/* Collaborators List */}
        <div className="p-5 max-h-80 overflow-y-auto space-y-3">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Collaborators & Roles
          </div>

          {isLoading ? (
            <div className="text-center py-6 text-xs text-zinc-400">Loading collaborators...</div>
          ) : (
            collaborators.map((c) => {
              const isSelf = c.id === currentUserId;

              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-200 bg-white hover:border-zinc-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-2xs"
                      style={{ backgroundColor: c.color }}
                    >
                      {c.avatar}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-900">{c.name}</span>
                        {isSelf && (
                          <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1 rounded">You</span>
                        )}
                        {c.is_owner && (
                          <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1 rounded font-semibold">
                            Owner
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400">{c.email}</div>
                    </div>
                  </div>

                  {/* Role Selector or Badge */}
                  <div>
                    {isAdmin && !c.is_owner ? (
                      <select
                        value={c.role}
                        onChange={(e) => handleRoleChange(c.id, e.target.value as Role)}
                        className="text-xs font-medium border border-zinc-300 rounded-md px-2 py-1 bg-white text-zinc-800 outline-none focus:border-blue-500"
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="commenter">Commenter</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className="capitalize text-xs font-semibold px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-700">
                        {c.role}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-5 py-3 bg-zinc-50 border-t border-zinc-100">
          <span className="text-[11px] text-zinc-500">
            {isAdmin ? 'Changes take effect across active sessions immediately.' : 'Viewing in read-only permission mode.'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-900 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
