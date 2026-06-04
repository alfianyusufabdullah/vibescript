import React, { useMemo, useState } from 'react';
import type { ChatMessage, ToolCall, ToolResult } from '../../shared/types';
import { CombinedToolItem } from './ToolExecutionLog';
import { pairSteps } from '../utils/agent';
import { Sparkles, User } from 'lucide-react';
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
        </div>
      )}
    </div>
  );
};
