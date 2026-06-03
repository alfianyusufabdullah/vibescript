import React, { useState } from 'react';
import type { ChatMessage } from '../../shared/types';
import { useEditorStore } from '../stores/editorStore';
import { ToolExecutionLog } from './ToolExecutionLog';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './ui/collapsible';
import { Copy, Check, CornerDownLeft, FileText, Sparkles, User, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from './ui/button';
import type { Components } from 'react-markdown';

interface MessageBubbleProps {
  message: ChatMessage;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const { insertAtCursor, replaceSelection } = useEditorStore();
  const [copiedMap, setCopiedMap] = useState<Record<string, number>>({});

  const isAssistant = message.role === 'assistant';

  const handleCopy = (code: string, blockIndex: number) => {
    navigator.clipboard.writeText(code);
    setCopiedMap(prev => ({ ...prev, [blockIndex]: Date.now() }));
    setTimeout(() => {
      setCopiedMap(prev => {
        const next = { ...prev };
        delete next[blockIndex];
        return next;
      });
    }, 2000);
  };

  const justCopied = (blockIndex: number) => !!copiedMap[blockIndex];

  let codeBlockIndex = 0;

  const markdownComponents: Components = {
    code: ({ className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match;
      if (isInline) {
        return <code className="text-[11px] bg-zinc-100 border border-zinc-200 rounded px-1 py-0.5 font-mono text-zinc-800" {...props}>{children}</code>;
      }
      const code = String(children).replace(/\n$/, '');
      const idx = codeBlockIndex++;

      return (
        <div className="w-full bg-white border border-zinc-200 rounded-lg overflow-hidden mt-2 mb-2 shadow-sm">
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-50 border-b border-zinc-200 text-[10px] text-zinc-500 font-medium">
            <span className="text-[9px] text-zinc-400 font-mono">{match?.[1] || 'code'}</span>
            <div className="flex items-center gap-1.5">
              <Button
                onClick={() => handleCopy(code, idx)}
                variant="outline"
                className="h-6 px-1.5 py-0 text-[9px] font-sans font-medium text-zinc-600 bg-white"
              >
                {justCopied(idx) ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                {justCopied(idx) ? 'Copied' : 'Copy'}
              </Button>
              <Button
                onClick={() => insertAtCursor(code)}
                variant="outline"
                className="h-6 px-1.5 py-0 text-[9px] font-sans font-medium text-zinc-600 bg-white"
              >
                <CornerDownLeft className="w-3 h-3 text-zinc-400" />
                Insert
              </Button>
              <Button
                onClick={() => replaceSelection(code)}
                variant="outline"
                className="h-6 px-1.5 py-0 text-[9px] font-sans font-medium text-zinc-600 bg-white"
              >
                <FileText className="w-3 h-3 text-zinc-400" />
                Replace
              </Button>
            </div>
          </div>
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
    <div
      className={`flex flex-col gap-1 w-full animate-fade-in ${
        isAssistant ? 'items-start' : 'items-end'
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 px-1 font-medium tracking-tight">
        {isAssistant ? (
          <>
            <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-zinc-700 font-semibold">AI Assistant</span>
          </>
        ) : (
          <>
            <User className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-zinc-700 font-semibold">You</span>
          </>
        )}
        <span className="text-[9px] text-zinc-400 font-normal">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {isAssistant ? (
        <>
          <div className="max-w-[88%] rounded-lg px-3.5 py-2.5 bg-white border border-zinc-200 rounded-tl-none shadow-sm">
            <ReactMarkdown components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          </div>

          {message.agentSteps && message.agentSteps.length > 0 && (
            <div className="w-[88%] mt-2">
              <Collapsible className="border border-zinc-200 rounded-md overflow-hidden">
                <CollapsibleTrigger className="px-3 py-2 text-[10px] text-zinc-400 font-medium hover:text-zinc-600 hover:bg-zinc-50 transition-colors">
                  <ChevronRight className="w-3 h-3" />
                  Tool execution log ({message.agentSteps.length} steps)
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 py-2">
                  <ToolExecutionLog steps={message.agentSteps} />
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </>
      ) : (
        <div className="max-w-[88%] rounded-lg px-3.5 py-2.5 bg-zinc-900 text-zinc-50 border border-zinc-900 rounded-tr-none shadow-sm">
          <div className="text-xs leading-relaxed whitespace-pre-wrap">{message.content}</div>
        </div>
      )}
    </div>
  );
};
