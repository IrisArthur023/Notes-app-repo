import React, { useRef, useEffect, useState } from 'react';
import { CollaboratorPeer, Role } from '../types';
import { Lock, ShieldAlert } from 'lucide-react';

interface EditorPaneProps {
  content: string;
  onChange: (newContent: string) => void;
  role: Role;
  collaborators: CollaboratorPeer[];
  onCursorChange: (cursor: { line: number; ch: number }, selection?: { start: { line: number; ch: number }; end: { line: number; ch: number } }) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const EditorPane: React.FC<EditorPaneProps> = ({
  content,
  onChange,
  role,
  collaborators,
  onCursorChange,
  textareaRef,
}) => {
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [activeLine, setActiveLine] = useState<number>(1);
  const isEditable = role === 'admin' || role === 'editor';

  // Calculate lines
  const lines = content.split('\n');
  const lineCount = lines.length;

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const updateCursorAndSelection = () => {
    const el = textareaRef.current;
    if (!el) return;

    const val = el.value;
    const selStart = el.selectionStart;
    const selEnd = el.selectionEnd;

    // Calculate line and character
    const beforeCursor = val.substring(0, selStart);
    const lineSplits = beforeCursor.split('\n');
    const line = lineSplits.length;
    const ch = lineSplits[lineSplits.length - 1].length;

    setActiveLine(line);

    let selectionRange;
    if (selStart !== selEnd) {
      const beforeEnd = val.substring(0, selEnd);
      const endSplits = beforeEnd.split('\n');
      selectionRange = {
        start: { line, ch },
        end: { line: endSplits.length, ch: endSplits[endSplits.length - 1].length },
      };
    }

    onCursorChange({ line, ch }, selectionRange);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isEditable) return;

    // Handle Tab key
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;

      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      onChange(newContent);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
          updateCursorAndSelection();
        }
      }, 0);
    }

    // Shortcuts: Ctrl+B / Cmd+B, Ctrl+I / Cmd+I
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      wrapSelection('**', '**');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      wrapSelection('*', '*');
    }
  };

  const wrapSelection = (prefix: string, suffix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.substring(start, end) || 'text';
    const newContent = content.substring(0, start) + prefix + selected + suffix + content.substring(end);
    onChange(newContent);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = start + prefix.length;
        textareaRef.current.selectionEnd = start + prefix.length + selected.length;
        updateCursorAndSelection();
      }
    }, 0);
  };

  // Map peer cursors by line
  const peerCursorsByLine = new Map<number, CollaboratorPeer[]>();
  collaborators.forEach((peer) => {
    if (peer.cursor && peer.cursor.line) {
      const list = peerCursorsByLine.get(peer.cursor.line) || [];
      list.push(peer);
      peerCursorsByLine.set(peer.cursor.line, list);
    }
  });

  return (
    <div className="relative flex-1 flex flex-col h-full bg-white overflow-hidden border-r border-zinc-200">
      {/* RBAC lock warning if read-only */}
      {!isEditable && (
        <div className="bg-amber-50/90 backdrop-blur-xs border-b border-amber-200 px-4 py-2 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {role === 'commenter'
                ? 'Commenter Role: You have read & annotation access. Direct document modifications are disabled.'
                : 'Viewer Role: Read-only access. You cannot make edits to this document.'}
            </span>
          </div>
          <span className="text-[11px] text-amber-700 underline font-medium">
            Contact Owner for Editor access
          </span>
        </div>
      )}

      {/* Editor Main Surface */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Line Numbers Column */}
        <div
          ref={lineNumbersRef}
          aria-hidden="true"
          className="w-12 sm:w-14 bg-zinc-50 border-r border-zinc-200 py-4 select-none overflow-hidden text-right font-mono text-xs text-zinc-400 shrink-0"
        >
          {Array.from({ length: lineCount }).map((_, idx) => {
            const lineNum = idx + 1;
            const hasPeers = peerCursorsByLine.has(lineNum);
            const isActive = lineNum === activeLine;

            return (
              <div
                key={lineNum}
                className={`relative px-2 h-6 leading-6 transition-colors ${
                  isActive ? 'text-blue-600 font-bold bg-blue-50/60' : ''
                }`}
              >
                {lineNum}
                {hasPeers && (
                  <div className="absolute left-1 top-1.5 flex flex-col gap-0.5">
                    {peerCursorsByLine.get(lineNum)?.map((p) => (
                      <span
                        key={p.userId}
                        title={`${p.name} is on line ${lineNum}`}
                        className="w-1.5 h-1.5 rounded-full ring-1 ring-white"
                        style={{ backgroundColor: p.color }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Textarea Input Column */}
        <div className="relative flex-1 h-full overflow-hidden">
          <textarea
            ref={textareaRef}
            value={content}
            readOnly={!isEditable}
            onChange={(e) => {
              if (isEditable) {
                onChange(e.target.value);
                updateCursorAndSelection();
              }
            }}
            onKeyUp={updateCursorAndSelection}
            onMouseUp={updateCursorAndSelection}
            onSelect={updateCursorAndSelection}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            spellCheck={false}
            placeholder={isEditable ? 'Start typing Markdown or paste document text...' : 'Document is read-only...'}
            className={`w-full h-full p-4 font-mono text-sm leading-6 resize-none outline-none border-none bg-transparent overflow-y-auto text-zinc-800 ${
              !isEditable ? 'cursor-default' : ''
            }`}
            style={{ tabSize: 2 }}
          />

          {/* Active Collaborators Cursor Banners (Floating tags) */}
          {collaborators.length > 0 && (
            <div className="absolute top-2 right-4 pointer-events-none flex flex-col items-end gap-1.5 z-20">
              {collaborators.map((peer) => (
                <div
                  key={peer.userId}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold text-white shadow-xs backdrop-blur-xs transition-transform duration-200"
                  style={{ backgroundColor: peer.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span>{peer.name}</span>
                  <span className="opacity-75 font-mono text-[10px]">
                    L{peer.cursor?.line || 1}:C{peer.cursor?.ch || 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
