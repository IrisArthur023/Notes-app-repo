import React from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Table as TableIcon,
  Link as LinkIcon,
  Minus,
  Columns,
  Eye,
  FileCode2,
  Lock,
  MessageCircle,
} from 'lucide-react';
import { ViewMode, Role, DocumentStats } from '../types';

interface ToolbarProps {
  onInsertMarkdown: (prefix: string, suffix?: string, defaultText?: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  role: Role;
  stats?: DocumentStats;
  onAddCommentClick: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onInsertMarkdown,
  viewMode,
  onViewModeChange,
  role,
  stats,
  onAddCommentClick,
}) => {
  const isEditable = role === 'admin' || role === 'editor';

  return (
    <div className="w-full bg-zinc-50 border-b border-zinc-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 select-none text-xs">
      {/* Markdown action buttons (only enabled if user has edit rights) */}
      <div className="flex items-center flex-wrap gap-1">
        {/* Headings */}
        <div className="flex items-center bg-white rounded-md border border-zinc-200 p-0.5 shadow-2xs">
          <button
            onClick={() => onInsertMarkdown('# ', '', 'Heading 1')}
            disabled={!isEditable}
            title="Heading 1 (#)"
            className="p-1.5 hover:bg-zinc-100 rounded text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onInsertMarkdown('## ', '', 'Heading 2')}
            disabled={!isEditable}
            title="Heading 2 (##)"
            className="p-1.5 hover:bg-zinc-100 rounded text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onInsertMarkdown('### ', '', 'Heading 3')}
            disabled={!isEditable}
            title="Heading 3 (###)"
            className="p-1.5 hover:bg-zinc-100 rounded text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Heading3 className="w-4 h-4" />
          </button>
        </div>

        {/* Text styling */}
        <div className="flex items-center bg-white rounded-md border border-zinc-200 p-0.5 shadow-2xs">
          <button
            onClick={() => onInsertMarkdown('**', '**', 'bold text')}
            disabled={!isEditable}
            title="Bold (**text**)"
            className="p-1.5 hover:bg-zinc-100 rounded text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => onInsertMarkdown('*', '*', 'italic text')}
            disabled={!isEditable}
            title="Italic (*text*)"
            className="p-1.5 hover:bg-zinc-100 rounded text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => onInsertMarkdown('~~', '~~', 'strikethrough text')}
            disabled={!isEditable}
            title="Strikethrough (~~text~~)"
            className="p-1.5 hover:bg-zinc-100 rounded text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
          <button
            onClick={() => onInsertMarkdown('`', '`', 'code')}
            disabled={!isEditable}
            title="Inline Code (`code`)"
            className="p-1.5 hover:bg-zinc-100 rounded text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Code className="w-4 h-4" />
          </button>
        </div>

        {/* Lists & Tasks */}
        <div className="flex items-center bg-white rounded-md border border-zinc-200 p-0.5 shadow-2xs">
          <button
            onClick={() => onInsertMarkdown('* ', '', 'List item')}
            disabled={!isEditable}
            title="Bullet List (* item)"
            className="p-1.5 hover:bg-zinc-100 rounded text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => onInsertMarkdown('1. ', '', 'Numbered item')}
            disabled={!isEditable}
            title="Numbered List (1. item)"
            className="p-1.5 hover:bg-zinc-100 rounded text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            onClick={() => onInsertMarkdown('- [ ] ', '', 'Checklist task')}
            disabled={!isEditable}
            title="Checklist (- [ ] task)"
            className="p-1.5 hover:bg-zinc-100 rounded text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <CheckSquare className="w-4 h-4" />
          </button>
          <button
            onClick={() => onInsertMarkdown('> ', '', 'Quotation')}
            disabled={!isEditable}
            title="Blockquote (> quote)"
            className="p-1.5 hover:bg-zinc-100 rounded text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Quote className="w-4 h-4" />
          </button>
        </div>

        {/* Blocks: Table, Code Block, Link */}
        <div className="flex items-center bg-white rounded-md border border-zinc-200 p-0.5 shadow-2xs">
          <button
            onClick={() =>
              onInsertMarkdown(
                '\n| Column 1 | Column 2 | Column 3 |\n| :--- | :--- | :--- |\n| Value A | Value B | Value C |\n',
                ''
              )
            }
            disabled={!isEditable}
            title="Insert Markdown Table"
            className="p-1.5 hover:bg-zinc-100 rounded text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <TableIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onInsertMarkdown('```python\n', '\n```', '# code here')}
            disabled={!isEditable}
            title="Code Block (```)"
            className="p-1.5 hover:bg-zinc-100 rounded text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FileCode2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onInsertMarkdown('[', '](https://example.com)', 'Link text')}
            disabled={!isEditable}
            title="Insert Link"
            className="p-1.5 hover:bg-zinc-100 rounded text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <LinkIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onInsertMarkdown('\n---\n', '')}
            disabled={!isEditable}
            title="Horizontal Divider (---)"
            className="p-1.5 hover:bg-zinc-100 rounded text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        {/* Comment on Selection button (great for Commenters!) */}
        <button
          onClick={onAddCommentClick}
          title="Add comment to selected text"
          className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-md font-semibold transition-colors shadow-2xs"
        >
          <MessageCircle className="w-3.5 h-3.5 text-amber-600" />
          <span>Comment</span>
        </button>

        {/* RBAC notice if not editable */}
        {!isEditable && (
          <div className="flex items-center gap-1.5 text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-md border border-zinc-200">
            <Lock className="w-3.5 h-3.5 text-zinc-500" />
            <span className="font-medium text-[11px]">
              {role === 'commenter' ? 'Commenter mode (read & annotate)' : 'Viewer mode (read-only)'}
            </span>
          </div>
        )}
      </div>

      {/* Right: Metrics & View mode switcher */}
      <div className="flex items-center gap-3">
        {/* Document Stats */}
        {stats && (
          <div className="hidden xl:flex items-center gap-3 text-[11px] text-zinc-500 border-r border-zinc-200 pr-3">
            <span>
              <strong className="text-zinc-700 font-semibold">{stats.words}</strong> words
            </span>
            <span>
              <strong className="text-zinc-700 font-semibold">{stats.characters}</strong> chars
            </span>
            <span>
              ~<strong className="text-zinc-700 font-semibold">{stats.readingTimeMinutes}</strong> min read
            </span>
          </div>
        )}

        {/* View Mode Switcher */}
        <div className="flex items-center bg-zinc-200/80 p-0.5 rounded-lg">
          <button
            onClick={() => onViewModeChange('split')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
              viewMode === 'split'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
            title="Split dual-pane (Editor + Live Markdown Preview)"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Split</span>
          </button>
          <button
            onClick={() => onViewModeChange('edit')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
              viewMode === 'edit'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
            title="Editor pane only"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </button>
          <button
            onClick={() => onViewModeChange('preview')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
              viewMode === 'preview'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
            title="Rendered Markdown Preview only"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Preview</span>
          </button>
        </div>
      </div>
    </div>
  );
};
