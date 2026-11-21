import React, { useState, useEffect } from 'react';
import {
  Clock,
  X,
  RotateCcw,
  CheckCircle2,
  Tag,
  Plus,
  ArrowRight,
  GitCommit,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Version, Role, DiffLine } from '../types';
import { ApiService } from '../services/api';

interface VersionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
  currentContent: string;
  currentUserRole: Role;
  userId: string;
  onRestoreSuccess: (newContent: string, newVersion: number) => void;
  onVersionCreated: (version: Version) => void;
}

export const VersionHistoryDrawer: React.FC<VersionHistoryDrawerProps> = ({
  isOpen,
  onClose,
  docId,
  currentContent,
  currentUserRole,
  userId,
  onRestoreSuccess,
  onVersionCreated,
}) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [diffRecords, setDiffRecords] = useState<DiffLine[]>([]);
  const [isComputingDiff, setIsComputingDiff] = useState(false);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneSummary, setMilestoneSummary] = useState('');

  const canRestore = currentUserRole === 'admin';
  const canCreateMilestone = currentUserRole === 'admin' || currentUserRole === 'editor';

  // Load versions
  const loadVersions = async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getVersions(docId, userId);
      setVersions(data);
      if (data.length > 0 && !selectedVersion) {
        setSelectedVersion(data[0]);
      }
    } catch (err) {
      console.error('Error fetching version history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, docId]);

  // Compute diff when selectedVersion changes
  useEffect(() => {
    if (!selectedVersion) return;
    const fetchDiff = async () => {
      setIsComputingDiff(true);
      try {
        const res = await ApiService.getDiff(selectedVersion.content, currentContent, userId);
        setDiffRecords(res.diff);
      } catch (err) {
        console.error('Error computing diff:', err);
      } finally {
        setIsComputingDiff(false);
      }
    };
    fetchDiff();
  }, [selectedVersion, currentContent, userId]);

  const handleRestore = async (version: Version) => {
    if (!canRestore) {
      alert('Only Administrators can restore earlier versions of this document.');
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to restore Version ${version.version_number} ("${version.title}")? This will update the live document and create a restoration checkpoint.`
    );
    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const res = await ApiService.restoreVersion(docId, version.id, userId);
      onRestoreSuccess(res.restored_content, res.new_version);
      loadVersions();
    } catch (err: any) {
      alert(err.message || 'Failed to restore version');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneTitle.trim()) return;

    try {
      const newVer = await ApiService.createVersion(
        docId,
        {
          title: milestoneTitle.trim(),
          summary: milestoneSummary.trim() || 'Manual tagged milestone',
          type: 'milestone',
        },
        userId
      );
      onVersionCreated(newVer);
      setMilestoneTitle('');
      setMilestoneSummary('');
      setIsMilestoneModalOpen(false);
      loadVersions();
    } catch (err: any) {
      alert(err.message || 'Failed to create milestone version');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-130 md:w-160 bg-white shadow-2xl z-40 flex flex-col border-l border-zinc-200 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 bg-zinc-50">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-bold text-zinc-900">Automated Version History</h2>
            <p className="text-[11px] text-zinc-500">
              Auto-saved snapshots, milestones, and unified line diffs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canCreateMilestone && (
            <button
              onClick={() => setIsMilestoneModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tag Milestone</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content: Split Timeline & Diff View */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Timeline Column */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-zinc-200 overflow-y-auto bg-zinc-50/40 p-3 space-y-2 shrink-0">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider px-1">
            Timeline ({versions.length})
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-xs text-zinc-400">Loading history...</div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-400">No version snapshots recorded yet.</div>
          ) : (
            versions.map((ver) => {
              const isSelected = selectedVersion?.id === ver.id;
              const dateFormatted = new Date(ver.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={ver.id}
                  onClick={() => setSelectedVersion(ver)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-white border-blue-400 shadow-xs ring-1 ring-blue-400/30'
                      : 'bg-white border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-xs text-zinc-900">
                      v{ver.version_number} - {ver.title}
                    </span>
                    <span className="text-[10px] text-zinc-400">{dateFormatted}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="truncate">{ver.author_name}</span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full uppercase ${
                        ver.snapshot_type === 'milestone'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ver.snapshot_type === 'restore'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {ver.snapshot_type}
                    </span>
                  </div>

                  {ver.diff_summary && (
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-emerald-600">+{ver.diff_summary.added}</span>
                      <span className="text-rose-600">-{ver.diff_summary.removed}</span>
                      {ver.summary && <span className="truncate text-zinc-400 font-sans text-[10px]">• {ver.summary}</span>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Diff & Snapshot Inspector Column */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {selectedVersion ? (
            <>
              {/* Version Detail Banner */}
              <div className="p-4 border-b border-zinc-200 bg-white flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-900">
                      v{selectedVersion.version_number}: {selectedVersion.title}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      {new Date(selectedVersion.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Authored by <strong className="text-zinc-700">{selectedVersion.author_name}</strong>
                    {selectedVersion.summary && ` — ${selectedVersion.summary}`}
                  </p>
                </div>

                {canRestore ? (
                  <button
                    onClick={() => handleRestore(selectedVersion)}
                    disabled={isRestoring}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs shrink-0"
                    title="Restore document to this version"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isRestoring ? 'Restoring...' : 'Restore Version'}</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-zinc-400 italic">
                    Restoring requires Admin role
                  </span>
                )}
              </div>

              {/* Visual Diff View vs Current Document */}
              <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-5">
                <div className="text-[11px] text-zinc-500 font-sans mb-3 flex items-center gap-2 bg-zinc-50 p-2 rounded border border-zinc-200">
                  <GitCommit className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    Diff comparison: <strong>Version {selectedVersion.version_number}</strong> compared to <strong>Current Live Buffer</strong>.
                  </span>
                </div>

                {isComputingDiff ? (
                  <div className="text-center py-10 text-zinc-400 font-sans text-xs">
                    Computing line-by-line diff via Python backend...
                  </div>
                ) : (
                  <div className="space-y-0.5 border border-zinc-200 rounded-lg overflow-hidden divide-y divide-zinc-100">
                    {diffRecords.map((line, idx) => {
                      if (line.type === 'add') {
                        return (
                          <div key={idx} className="bg-emerald-50 text-emerald-900 px-3 py-1 flex items-start gap-2">
                            <span className="text-emerald-600 font-bold select-none">+</span>
                            <span className="whitespace-pre-wrap break-all">{line.text || ' '}</span>
                          </div>
                        );
                      }
                      if (line.type === 'remove') {
                        return (
                          <div key={idx} className="bg-rose-50 text-rose-900 px-3 py-1 flex items-start gap-2">
                            <span className="text-rose-600 font-bold select-none">-</span>
                            <span className="whitespace-pre-wrap break-all">{line.text || ' '}</span>
                          </div>
                        );
                      }
                      return (
                        <div key={idx} className="bg-white text-zinc-600 px-3 py-0.5 flex items-start gap-2">
                          <span className="text-zinc-300 select-none"> </span>
                          <span className="whitespace-pre-wrap break-all">{line.text || ' '}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-400 text-xs">
              Select a version on the left to inspect diffs and changes.
            </div>
          )}
        </div>
      </div>

      {/* Milestone Modal */}
      {isMilestoneModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateMilestone}
            className="bg-white rounded-xl shadow-2xl border border-zinc-200 max-w-md w-full p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-zinc-900">Create Tagged Milestone</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMilestoneModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Milestone Name / Tag
              </label>
              <input
                type="text"
                required
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
                placeholder="e.g., Release Candidate v1.0, Final Signoff"
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Change Summary / Notes
              </label>
              <textarea
                value={milestoneSummary}
                onChange={(e) => setMilestoneSummary(e.target.value)}
                placeholder="Describe key modifications made in this milestone..."
                rows={3}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsMilestoneModalOpen(false)}
                className="px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              >
                Save Milestone
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
