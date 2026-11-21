import React, { useState } from 'react';
import {
  FileText,
  Clock,
  Users,
  MessageSquare,
  Download,
  Wifi,
  WifiOff,
  RefreshCw,
  FolderOpen,
  ChevronDown,
  ShieldAlert,
  ShieldCheck,
  Edit3,
  Eye,
  Check,
} from 'lucide-react';
import { User, CollaboratorPeer, Role, SyncState } from '../types';

interface HeaderProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  currentUser: User;
  onUserChange: (user: User) => void;
  availableUsers: User[];
  collaborators: CollaboratorPeer[];
  syncState: SyncState;
  offlineCount: number;
  isSimulatingOffline: boolean;
  onToggleSimulateOffline: () => void;
  onSyncNow: () => void;
  onOpenHistory: () => void;
  onOpenShare: () => void;
  onOpenComments: () => void;
  onOpenDocList: () => void;
  versionCount: number;
  commentsCount: number;
  onExport: (format: 'md' | 'html' | 'txt') => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onTitleChange,
  currentUser,
  onUserChange,
  availableUsers,
  collaborators,
  syncState,
  offlineCount,
  isSimulatingOffline,
  onToggleSimulateOffline,
  onSyncNow,
  onOpenHistory,
  onOpenShare,
  onOpenComments,
  onOpenDocList,
  versionCount,
  commentsCount,
  onExport,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(title);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  const canEditTitle = currentUser.defaultRole === 'admin' || currentUser.defaultRole === 'editor';

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim() && titleInput !== title) {
      onTitleChange(titleInput.trim());
    } else {
      setTitleInput(title);
    }
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <ShieldCheck className="w-3 h-3 text-blue-600" /> Admin
          </span>
        );
      case 'editor':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Edit3 className="w-3 h-3 text-emerald-600" /> Editor
          </span>
        );
      case 'commenter':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <MessageSquare className="w-3 h-3 text-amber-600" /> Commenter
          </span>
        );
      case 'viewer':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            <Eye className="w-3 h-3 text-purple-600" /> Viewer
          </span>
        );
    }
  };

  return (
    <header className="w-full bg-white border-b border-zinc-200 sticky top-0 z-30 select-none">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        {/* Left: Brand Icon & Title & Doc Switcher */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenDocList}
            title="Browse & switch documents"
            className="p-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <FolderOpen className="w-5 h-5 text-blue-600" />
            <span className="hidden sm:inline text-xs font-semibold text-zinc-700">Docs</span>
          </button>

          <div className="h-5 w-px bg-zinc-200 hidden sm:block" />

          {/* Title Area */}
          <div className="min-w-0 flex items-center gap-2">
            {isEditingTitle && canEditTitle ? (
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSubmit();
                  if (e.key === 'Escape') {
                    setTitleInput(title);
                    setIsEditingTitle(false);
                  }
                }}
                autoFocus
                className="text-base sm:text-lg font-semibold text-zinc-900 border border-blue-400 rounded px-2 py-0.5 outline-none bg-blue-50/20 max-w-xs sm:max-w-md"
              />
            ) : (
              <div
                onClick={() => {
                  if (canEditTitle) {
                    setTitleInput(title);
                    setIsEditingTitle(true);
                  }
                }}
                className={`flex items-center gap-1.5 truncate group ${
                  canEditTitle ? 'cursor-pointer' : 'cursor-default'
                }`}
                title={canEditTitle ? 'Click to rename document' : 'Read-only title'}
              >
                <h1 className="text-base sm:text-lg font-bold text-zinc-900 truncate tracking-tight">
                  {title}
                </h1>
                {canEditTitle && (
                  <span className="text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                    (rename)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center: Real-Time Collaborator Avatars & Live Status */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Status Indicator */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-50 border border-zinc-200 text-xs">
            {isSimulatingOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-zinc-500" />
                <span className="font-medium text-zinc-600">Offline Mode</span>
              </>
            ) : syncState === 'synced' ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-medium text-zinc-700">Live Sync</span>
              </>
            ) : syncState === 'syncing' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                <span className="font-medium text-blue-700">Syncing...</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                <span className="font-medium text-amber-700">Pending Changes</span>
              </>
            )}

            {offlineCount > 0 && (
              <button
                onClick={onSyncNow}
                className="ml-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 transition-colors"
                title="Synchronize offline changes with cloud"
              >
                Sync ({offlineCount})
              </button>
            )}
          </div>

          {/* Connected Peers Stack */}
          {collaborators.length > 0 && (
            <div className="flex items-center -space-x-1.5 overflow-hidden pl-1">
              {collaborators.map((c) => (
                <div
                  key={c.userId}
                  className="relative group"
                  title={`${c.name} (${c.role}) - Active`}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-2 ring-white"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.avatar || c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span
                    className="absolute bottom-0 right-0 w-2 h-2 rounded-full ring-1 ring-white"
                    style={{ backgroundColor: c.color }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Actions, RBAC Role Simulation Switcher & Tools */}
        <div className="flex items-center gap-2">
          {/* Offline Toggle Simulator */}
          <button
            onClick={onToggleSimulateOffline}
            title={isSimulatingOffline ? 'Switch back to online mode' : 'Simulate going offline to test offline editing'}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              isSimulatingOffline
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
            }`}
          >
            {isSimulatingOffline ? <WifiOff className="w-3.5 h-3.5 text-amber-700" /> : <Wifi className="w-3.5 h-3.5 text-zinc-600" />}
            <span>{isSimulatingOffline ? 'Go Online' : 'Simulate Offline'}</span>
          </button>

          {/* Automated Version History */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 rounded-lg border border-zinc-200 transition-colors"
            title="Open Automated Version History"
          >
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="hidden md:inline">History</span>
            <span className="bg-zinc-100 text-zinc-600 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
              v{versionCount}
            </span>
          </button>

          {/* Comments Trigger */}
          <button
            onClick={onOpenComments}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 rounded-lg border border-zinc-200 transition-colors relative"
            title="Collaborative Comments & Annotations"
          >
            <MessageSquare className="w-4 h-4 text-amber-600" />
            <span className="hidden md:inline">Comments</span>
            {commentsCount > 0 && (
              <span className="bg-amber-500 text-white px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                {commentsCount}
              </span>
            )}
          </button>

          {/* Share & RBAC */}
          <button
            onClick={onOpenShare}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
            title="Manage Permissions & Role-Based Access Control"
          >
            <Users className="w-4 h-4" />
            <span>Share</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="p-1.5 text-zinc-600 hover:bg-zinc-100 rounded-lg border border-zinc-200 transition-colors"
              title="Export Document"
            >
              <Download className="w-4 h-4" />
            </button>
            {isExportDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-lg shadow-lg py-1.5 z-50 text-xs text-zinc-700 animate-in fade-in zoom-in-95 duration-100"
                onMouseLeave={() => setIsExportDropdownOpen(false)}
              >
                <div className="px-3 py-1 font-semibold text-zinc-400 uppercase text-[10px] tracking-wider">
                  Export Document
                </div>
                <button
                  onClick={() => {
                    onExport('md');
                    setIsExportDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center justify-between"
                >
                  <span>Markdown File (.md)</span>
                  <span className="text-[10px] font-mono text-zinc-400">MD</span>
                </button>
                <button
                  onClick={() => {
                    onExport('html');
                    setIsExportDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center justify-between"
                >
                  <span>HTML Document (.html)</span>
                  <span className="text-[10px] font-mono text-zinc-400">HTML</span>
                </button>
                <button
                  onClick={() => {
                    onExport('txt');
                    setIsExportDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center justify-between"
                >
                  <span>Plain Text (.txt)</span>
                  <span className="text-[10px] font-mono text-zinc-400">TXT</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-zinc-200 mx-1" />

          {/* Switch User (RBAC Simulation Control) */}
          <div className="relative">
            <button
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
              title="Switch user identity to test RBAC roles"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: currentUser.color }}
              >
                {currentUser.avatar}
              </div>
              <div className="hidden sm:flex flex-col items-start text-left">
                <span className="text-xs font-semibold text-zinc-800 leading-none">
                  {currentUser.name.split(' ')[0]}
                </span>
                <span className="text-[10px] text-zinc-400 capitalize leading-tight">
                  {currentUser.defaultRole}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {isUserDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-64 bg-white border border-zinc-200 rounded-lg shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                onMouseLeave={() => setIsUserDropdownOpen(false)}
              >
                <div className="px-3 py-1.5 border-b border-zinc-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Switch User / RBAC Role
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Test how permissions affect editing, restoring & commenting.
                  </p>
                </div>

                <div className="py-1">
                  {availableUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        onUserChange(u);
                        setIsUserDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-zinc-50 transition-colors ${
                        u.id === currentUser.id ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: u.color }}
                        >
                          {u.avatar}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-zinc-800">{u.name}</div>
                          <div className="text-[10px] text-zinc-400">{u.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {getRoleBadge(u.defaultRole)}
                        {u.id === currentUser.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
