import React, { useState, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, CornerDownLeft, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { useEditorStore } from '../stores/editorStore';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  showCursor?: boolean;
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

const StreamingCursor: React.FC = () => (
  <span className="inline-flex items-center gap-0.5 ml-1 align-middle">
    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0ms]" />
    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:150ms]" />
    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:300ms]" />
  </span>
);

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(({ content, className, showCursor }) => {
  const { insertAtCursor, replaceSelection } = useEditorStore();
  const [copiedMap, setCopiedMap] = useState<Record<number, boolean>>({});

  const handleCopy = useCallback((code: string, blockIndex: number) => {
    navigator.clipboard.writeText(code);
    setCopiedMap((prev) => ({ ...prev, [blockIndex]: true }));
    setTimeout(() => {
      setCopiedMap((prev) => {
        const next = { ...prev };
        delete next[blockIndex];
        return next;
      });
    }, 2000);
  }, []);

  const justCopied = useCallback((blockIndex: number) => !!copiedMap[blockIndex], [copiedMap]);

  const markdownComponents: Components = useMemo(() => {
    let codeBlockIdx = 0;
    return {
      pre: ({ children }) => <>{children}</>,
      code: ({ className: codeClassName, children, ...props }) => {
        const match = /language-(\w+)/.exec(codeClassName || '');
        const isInline = !match;

        if (isInline) {
          return (
            <code
              className="text-[11px] bg-zinc-100 border border-zinc-200 rounded px-1 py-0.5 font-mono text-zinc-800 before:content-none after:content-none"
              {...props}
            >
              {children}
            </code>
          );
        }

        const code = String(children).replace(/\n$/, '');
        const idx = codeBlockIdx++;
        const language = match?.[1] || 'code';

        return (
          <div className="not-prose w-full bg-white border border-zinc-200 rounded-lg overflow-hidden my-2 shadow-sm">
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
    };
  }, [handleCopy, justCopied, insertAtCursor, replaceSelection]);

  return (
    <div
      className={cn(
        'prose prose-zinc max-w-none prose-chat',
        'prose-code:before:content-none prose-code:after:content-none',
        'prose-code:text-[11px] prose-code:bg-zinc-100 prose-code:border prose-code:border-zinc-200 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:font-mono',
        className,
      )}
    >
      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
      {showCursor && <StreamingCursor />}
    </div>
  );
});
