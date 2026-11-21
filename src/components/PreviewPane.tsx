import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ListTree, ExternalLink, Check, Copy } from 'lucide-react';
import { DocumentStats } from '../types';

interface PreviewPaneProps {
  content: string;
  stats?: DocumentStats;
  onOutlineClick?: (line: number) => void;
}

export const PreviewPane: React.FC<PreviewPaneProps> = ({
  content,
  stats,
  onOutlineClick,
}) => {
  const [showOutline, setShowOutline] = useState(false);
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  const handleCopyCode = (codeText: string, index: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIndex(index);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  return (
    <div className="relative flex-1 flex flex-col h-full bg-zinc-50/50 overflow-hidden">
      {/* Header bar of Preview pane */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-zinc-200 text-xs text-zinc-600">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-800">Live Markdown Preview</span>
          {stats && (
            <span className="text-zinc-400 text-[11px]">
              ({stats.words} words, {stats.headings} sections)
            </span>
          )}
        </div>

        {stats && stats.outline && stats.outline.length > 0 && (
          <button
            onClick={() => setShowOutline(!showOutline)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
              showOutline
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <ListTree className="w-3.5 h-3.5" />
            <span>Outline ({stats.outline.length})</span>
          </button>
        )}
      </div>

      <div className="relative flex-1 flex overflow-hidden">
        {/* Rendered Markdown Body */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 max-w-4xl mx-auto w-full">
          <div className="markdown-render space-y-4 text-zinc-800 text-base leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 mt-6 mb-4 pb-2 border-b border-zinc-200">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 mt-6 mb-3 pb-1 border-b border-zinc-100">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg sm:text-xl font-semibold text-zinc-800 mt-5 mb-2">
                    {children}
                  </h3>
                ),
                p: ({ children }) => <p className="mb-4 leading-7 text-zinc-700">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1.5 text-zinc-700">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1.5 text-zinc-700">{children}</ol>,
                li: ({ children }) => <li className="leading-6">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-blue-500 bg-blue-50/40 px-4 py-2.5 rounded-r-lg my-4 italic text-zinc-700">
                    {children}
                  </blockquote>
                ),
                hr: () => <hr className="my-6 border-zinc-200" />,
                table: ({ children }) => (
                  <div className="my-5 overflow-x-auto rounded-lg border border-zinc-200 shadow-2xs">
                    <table className="w-full text-left text-sm divide-y divide-zinc-200">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-zinc-100/75 text-zinc-800 font-semibold">{children}</thead>,
                tbody: ({ children }) => <tbody className="divide-y divide-zinc-100 bg-white">{children}</tbody>,
                th: ({ children }) => <th className="px-4 py-2.5 font-semibold">{children}</th>,
                td: ({ children }) => <td className="px-4 py-2.5 text-zinc-700">{children}</td>,
                code: ({ className, children }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code className="bg-zinc-100 text-pink-600 font-mono text-xs px-1.5 py-0.5 rounded border border-zinc-200">
                        {children}
                      </code>
                    );
                  }
                  return (
                    <div className="relative my-4 rounded-lg bg-zinc-900 text-zinc-100 p-4 font-mono text-xs overflow-x-auto shadow-sm">
                      <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-2 border-b border-zinc-800 pb-1">
                        <span>{className?.replace('language-', '') || 'code'}</span>
                        <button
                          onClick={() => handleCopyCode(String(children), 1)}
                          className="hover:text-white flex items-center gap-1 transition-colors"
                        >
                          {copiedCodeIndex === 1 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedCodeIndex === 1 ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <code>{children}</code>
                    </div>
                  );
                },
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 font-medium hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>{children}</span>
                    <ExternalLink className="w-3 h-3 inline" />
                  </a>
                ),
              }}
            >
              {content || '_No content to preview._'}
            </ReactMarkdown>
          </div>
        </div>

        {/* Collapsible Table of Contents Sidebar */}
        {showOutline && stats && stats.outline && stats.outline.length > 0 && (
          <aside className="w-64 border-l border-zinc-200 bg-white p-4 overflow-y-auto hidden md:block shrink-0 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
              Table of Contents
            </h4>
            <nav className="space-y-1">
              {stats.outline.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => onOutlineClick?.(item.line)}
                  className={`w-full text-left truncate py-1 px-1.5 rounded hover:bg-zinc-100 text-xs text-zinc-700 transition-colors ${
                    item.level === 1
                      ? 'font-bold text-zinc-900'
                      : item.level === 2
                      ? 'pl-3 text-zinc-700'
                      : 'pl-5 text-zinc-500 text-[11px]'
                  }`}
                  title={`${item.title} (Line ${item.line})`}
                >
                  {item.title}
                </button>
              ))}
            </nav>
          </aside>
        )}
      </div>
    </div>
  );
};
