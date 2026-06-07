import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { Copy, Check, CornerDownLeft, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { useEditorStore } from '../stores/editorStore';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

interface CodeBlockHeaderProps {
  language: string;
  code: string;
  blockIndex: number;
  isCopied: boolean;
  onCopy: (code: string, blockIndex: number) => void;
  onInsert: (code: string) => void;
  onReplace: (code: string) => void;
}

const CodeBlockHeader: React.FC<CodeBlockHeaderProps> = ({
  language,
  code,
  blockIndex,
  isCopied,
  onCopy,
  onInsert,
  onReplace,
}) => (
  <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-50 border-b border-zinc-200 text-[10px] text-zinc-500 font-medium">
    <span className="text-[9px] text-zinc-400 font-mono">{language}</span>
    <div className="flex items-center gap-1.5">
      <Button
        onClick={() => onCopy(code, blockIndex)}
        variant="outline"
        className="h-6 px-1.5 py-0 text-[9px] font-sans font-medium text-zinc-600 bg-white"
      >
        {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-zinc-400" />}
        {isCopied ? 'Copied' : 'Copy'}
      </Button>
      <Button
        onClick={() => onInsert(code)}
        variant="outline"
        className="h-6 px-1.5 py-0 text-[9px] font-sans font-medium text-zinc-600 bg-white"
      >
        <CornerDownLeft className="w-3 h-3 text-zinc-400" />
        Insert
      </Button>
      <Button
        onClick={() => onReplace(code)}
        variant="outline"
        className="h-6 px-1.5 py-0 text-[9px] font-sans font-medium text-zinc-600 bg-white"
      >
        <FileText className="w-3 h-3 text-zinc-400" />
        Replace
      </Button>
    </div>
  </div>
);

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  const { insertAtCursor, replaceSelection } = useEditorStore();
  const [copiedMap, setCopiedMap] = useState<Record<number, boolean>>({});

  const handleCopy = (code: string, blockIndex: number) => {
    navigator.clipboard.writeText(code);
    setCopiedMap((prev) => ({ ...prev, [blockIndex]: true }));
    setTimeout(() => {
      setCopiedMap((prev) => {
        const next = { ...prev };
        delete next[blockIndex];
        return next;
      });
    }, 2000);
  };

  const justCopied = (blockIndex: number) => !!copiedMap[blockIndex];

  let codeBlockIndex = 0;

  const markdownComponents: Components = {
    code: ({ className: codeClassName, children, ...props }) => {
      const match = /language-(\w+)/.exec(codeClassName || '');
      const isInline = !match;

      if (isInline) {
        return (
          <code
            className="text-[11px] bg-zinc-100 border border-zinc-200 rounded px-1 py-0.5 font-mono text-zinc-800"
            {...props}
          >
            {children}
          </code>
        );
      }

      const code = String(children).replace(/\n$/, '');
      const idx = codeBlockIndex++;
      const language = match?.[1] || 'code';

      return (
        <div className="w-full bg-white border border-zinc-200 rounded-lg overflow-hidden mt-2 mb-2 shadow-sm">
          <CodeBlockHeader
            language={language}
            code={code}
            blockIndex={idx}
            isCopied={justCopied(idx)}
            onCopy={handleCopy}
            onInsert={insertAtCursor}
            onReplace={replaceSelection}
          />
          <div className="p-3 bg-zinc-50 overflow-x-auto">
            <pre className="text-xs text-zinc-800 font-mono whitespace-pre bg-transparent border-0 p-0 m-0 leading-relaxed select-text">
              <code>{code}</code>
            </pre>
          </div>
        </div>
      );
    },
    p: ({ children }) => <p className="text-xs leading-relaxed my-1.5 text-zinc-800">{children}</p>,
    ul: ({ children }) => <ul className="text-xs leading-relaxed my-1.5 list-disc pl-5 text-zinc-800">{children}</ul>,
    ol: ({ children }) => <ol className="text-xs leading-relaxed my-1.5 list-decimal pl-5 text-zinc-800">{children}</ol>,
    li: ({ children }) => <li className="my-0.5">{children}</li>,
    h1: ({ children }) => <h1 className="text-sm font-bold my-2 text-zinc-900">{children}</h1>,
    h2: ({ children }) => <h2 className="text-xs font-bold my-1.5 text-zinc-900">{children}</h2>,
    h3: ({ children }) => <h3 className="text-xs font-semibold my-1 text-zinc-900">{children}</h3>,
    strong: ({ children }) => <strong className="font-semibold text-zinc-900">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
  };

  return (
    <div className={className}>
      <ReactMarkdown components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
};
