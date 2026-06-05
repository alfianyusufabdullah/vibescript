import React, { useMemo, useState } from 'react';
import type { ChatMessage, ToolCall, ToolResult, CodeAttachment } from '../../shared/types';
import { CombinedToolItem } from './ToolExecutionLog';
import { pairSteps } from '../utils/agent';
import { Sparkles, User, Code, X, FileText, Brain, ChevronDown } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageBubbleProps {
  message: ChatMessage;
}

const InlineToolWrapper: React.FC<{
  toolCall: ToolCall;
  toolResult?: ToolResult;
  isComplete: boolean;
}> = ({ toolCall, toolResult, isComplete }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <CombinedToolItem
      toolCall={toolCall}
      toolResult={toolResult}
      isComplete={isComplete}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
    />
  );
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isAssistant = message.role === 'assistant';
  const [selectedAttachment, setSelectedAttachment] = useState<CodeAttachment | null>(null);

  const pairedSteps = useMemo(() => {
    return message.agentSteps ? pairSteps(message.agentSteps) : [];
  }, [message.agentSteps]);

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
        pairedSteps.length === 0 ? (
          <MarkdownRenderer
            content={message.content}
            className="max-w-[88%] rounded-lg px-3.5 py-2.5 bg-white border border-zinc-200 rounded-tl-none shadow-sm"
          />
        ) : (
          <div className="max-w-[88%] rounded-lg px-3.5 py-2.5 bg-white border border-zinc-200 rounded-tl-none shadow-sm space-y-3">
            {pairedSteps.map((step, idx) => (
              <React.Fragment key={idx}>
                {step.reasoningText && (
                  <details className="group text-[11px]">
                    <summary className="flex items-center gap-1.5 cursor-pointer text-zinc-500 hover:text-zinc-700 font-medium select-none">
                      <ChevronDown className="w-3 h-3 group-open:rotate-0 -rotate-90 transition-transform" />
                      <Brain className="w-3.5 h-3.5" />
                      Thinking
                    </summary>
                    <div className="mt-1.5 p-2.5 rounded-md bg-zinc-50 border border-zinc-200 text-zinc-600 text-[10.5px] leading-relaxed">
                      <MarkdownRenderer content={step.reasoningText} />
                    </div>
                  </details>
                )}
                {step.content && <MarkdownRenderer content={step.content} />}
                {step.toolCalls.length > 0 && (
                  <div className="space-y-1.5 my-1.5">
                    {step.toolCalls.map((tc, i) => {
                      const result = step.toolResults.find(r => r.name === tc.name) || step.toolResults[i];
                      return (
                        <InlineToolWrapper
                          key={i}
                          toolCall={tc}
                          toolResult={result}
                          isComplete={step.isComplete}
                        />
                      );
                    })}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )
      ) : (
        <div className="max-w-[88%] rounded-lg px-3.5 py-2.5 bg-zinc-900 text-zinc-50 border border-zinc-900 rounded-tr-none shadow-sm">
          <div className="text-xs leading-relaxed whitespace-pre-wrap">{message.content}</div>
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-zinc-800/80">
              <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1 select-none">
                <Code className="w-3 h-3 text-zinc-400" />
                Attached Context
              </div>
              <div className="flex flex-wrap gap-1.5">
                {message.attachments.map((att, idx) => {
                  const label = att.lineStart ? `${att.filename}:${att.lineStart}-${att.lineEnd}` : att.filename;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedAttachment(att)}
                      className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 hover:bg-zinc-750 active:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded text-[10px] font-medium transition-colors cursor-pointer select-none"
                    >
                      <span className="truncate max-w-[160px]">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attachment Preview Modal */}
      {selectedAttachment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-850 bg-zinc-900/50">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <FileText className="w-4 h-4 text-zinc-400" />
                <span className="truncate">
                  {selectedAttachment.filename}
                  {selectedAttachment.lineStart && ` (Lines ${selectedAttachment.lineStart}-${selectedAttachment.lineEnd})`}
                </span>
              </div>
              <button
                onClick={() => setSelectedAttachment(null)}
                className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Code Content */}
            <div className="flex-1 overflow-auto p-4 bg-zinc-950 font-mono text-[11px] text-zinc-350 leading-relaxed select-text whitespace-pre">
              {selectedAttachment.content.split('\n').map((line, idx) => {
                const lineNum = selectedAttachment.lineStart ? selectedAttachment.lineStart + idx : idx + 1;
                return (
                  <div key={idx} className="flex hover:bg-zinc-900/50 px-1 rounded-sm">
                    <span className="text-zinc-600 w-7 select-none text-right pr-2 border-r border-zinc-850 mr-2">
                      {lineNum}
                    </span>
                    <span className="whitespace-pre-wrap break-all">{line || ' '}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
