import React, { useState } from 'react';
import type { ChatMessage } from '../../shared/types';
import { useEditorStore } from '../stores/editorStore';
import { Copy, Check, CornerDownLeft, FileText, Sparkles, User } from 'lucide-react';
import { Button } from './ui/button';

interface MessageBubbleProps {
  message: ChatMessage;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const { insertAtCursor, replaceSelection } = useEditorStore();
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});

  const isAssistant = message.role === 'assistant';

  // Helper to extract javascript/gscript code blocks from markdown
  const parseCodeBlocks = (text: string) => {
    // Regex to match code blocks starting with ```javascript or ```gscript or ```js
    const regex = /```(?:javascript|gscript|js)\n([\s\S]*?)```/g;
    const blocks: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      blocks.push(match[1].trim());
    }
    return blocks;
  };

  // Strip code blocks from text to avoid double-rendering if we render custom boxes
  const cleanMarkdownText = (text: string) => {
    return text.replace(/```(?:javascript|gscript|js)\n([\s\S]*?)```/g, '').trim();
  };

  const codeBlocks = parseCodeBlocks(message.content);
  const textWithoutCode = cleanMarkdownText(message.content);

  const handleCopy = (code: string, blockIndex: number) => {
    navigator.clipboard.writeText(code);
    setCopiedMap(prev => ({ ...prev, [blockIndex]: true }));
    setTimeout(() => {
      setCopiedMap(prev => ({ ...prev, [blockIndex]: false }));
    }, 2000);
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

      <div
        className={`max-w-[88%] rounded-lg px-3.5 py-2.5 text-xs leading-relaxed transition-all ${
          isAssistant
            ? 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-none shadow-sm'
            : 'bg-zinc-900 text-zinc-50 border border-zinc-900 rounded-tr-none shadow-sm'
        }`}
      >
        {textWithoutCode ? (
          <div className="whitespace-pre-wrap">{textWithoutCode}</div>
        ) : (
          isAssistant && codeBlocks.length > 0 && (
            <div className="text-zinc-400 font-medium flex items-center gap-1 uppercase tracking-wider text-[9px]">
              Generated code output:
            </div>
          )
        )}
      </div>

      {codeBlocks.map((code, index) => (
        <div
          key={index}
          className="w-[88%] bg-white border border-zinc-200 overflow-hidden mt-1.5 rounded-lg shadow-sm animate-fade-in"
        >
          {/* Header Action Panel */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-50 border-b border-zinc-200 text-[10px] text-zinc-500 font-medium">
            <span className="text-[9px] text-zinc-400 font-mono">apps script</span>
            
            <div className="flex items-center gap-1.5">
              <Button
                onClick={() => handleCopy(code, index)}
                variant="outline"
                className="h-6 px-1.5 py-0 text-[9px] font-sans font-medium text-zinc-600 bg-white"
                title="Copy Code"
              >
                {copiedMap[index] ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                {copiedMap[index] ? 'Copied' : 'Copy'}
              </Button>
              
              <Button
                onClick={() => insertAtCursor(code)}
                variant="outline"
                className="h-6 px-1.5 py-0 text-[9px] font-sans font-medium text-zinc-600 bg-white"
                title="Insert at cursor position"
              >
                <CornerDownLeft className="w-3 h-3 text-zinc-400" />
                Insert
              </Button>
              
              <Button
                onClick={() => replaceSelection(code)}
                variant="outline"
                className="h-6 px-1.5 py-0 text-[9px] font-sans font-medium text-zinc-600 bg-white"
                title="Replace current selection"
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
      ))}
    </div>
  );
};
