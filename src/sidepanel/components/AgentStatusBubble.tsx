import React, { useMemo } from 'react';
import { Sparkles, Loader2, StopCircle, ChevronDown, Brain } from 'lucide-react';
import { CombinedToolItem } from './ToolExecutionLog';
import { MarkdownRenderer } from './MarkdownRenderer';
import { preprocessStreamingMarkdown } from '../utils/markdown';
import type { AgentRole } from '../../shared/types';
import type { PairedStep } from '../utils/agent';

interface AgentRunningBubbleProps {
  pairedAgentSteps: PairedStep[];
  currentStepText: string;
  reasoningText: string;
  agentStatus: string;
  currentRole: AgentRole | null;
  pendingToolCallName: string | null;
  onCancel: () => void;
}

interface AgentErrorBubbleProps {
  pairedAgentSteps: PairedStep[];
  agentError: string | null;
  currentRole: AgentRole | null;
}

const ReasoningDetails: React.FC<{ content: string; open?: boolean }> = ({ content, open = false }) => (
  <details open={open} className="group text-[11px]">
    <summary className="flex items-center gap-1.5 cursor-pointer text-zinc-500 hover:text-zinc-700 font-medium select-none">
      <ChevronDown className="w-3 h-3 group-open:rotate-0 -rotate-90 transition-transform" />
      <Brain className="w-3.5 h-3.5" />
      Thinking
    </summary>
    <div className="mt-1.5 p-2.5 rounded-md bg-zinc-50 border border-zinc-200 text-zinc-600 text-[10.5px] leading-relaxed">
      <MarkdownRenderer content={content} />
    </div>
  </details>
);

export const AgentRunningBubble: React.FC<AgentRunningBubbleProps> = React.memo(({
  pairedAgentSteps,
  currentStepText,
  reasoningText,
  agentStatus,
  currentRole,
  pendingToolCallName,
  onCancel,
}) => {
  const sparklesColor =
    currentRole?.id === 'explore'
      ? 'text-blue-500'
      : currentRole?.id === 'plan'
        ? 'text-purple-500'
        : 'text-amber-500';

  const statusSuffix = agentStatus === 'thinking' ? '(thinking)' : '(executing tools)';
  const isEmpty = pairedAgentSteps.length === 0 && !currentStepText && !reasoningText && !pendingToolCallName;

  const processedMarkdown = useMemo(
    () => preprocessStreamingMarkdown(currentStepText),
    [currentStepText]
  );

  return (
    <div className="flex flex-col gap-1 w-full animate-fade-in items-start">
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 px-1 font-medium tracking-tight">
        <Sparkles className={`w-3.5 h-3.5 ${sparklesColor} animate-pulse`} />
        <span className="text-zinc-700 font-semibold">
          {currentRole?.label || 'AI Assistant'} {statusSuffix}
        </span>
        <button
          onClick={onCancel}
          className="ml-2 flex items-center gap-0.5 text-[10px] text-red-650 hover:text-red-700 hover:underline cursor-pointer"
        >
          <StopCircle className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>

      <div className="max-w-[88%] w-full rounded-lg px-3.5 py-2.5 bg-white border border-zinc-200 rounded-tl-none shadow-sm space-y-3">
        {isEmpty ? (
          <div className="flex items-center gap-2 text-zinc-500 text-[11.5px] py-0.5 font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
            Thinking...
          </div>
        ) : (
          <>
            {pairedAgentSteps.map((step, idx) => (
              <React.Fragment key={idx}>
                {step.reasoningText && (
                  <ReasoningDetails content={step.reasoningText} open />
                )}
                {step.content && (step.type !== 'text' || !currentStepText) && <MarkdownRenderer content={step.content} />}
                {step.toolCalls.length > 0 && (
                  <div className="space-y-1.5 my-1.5">
                    {step.toolCalls.map((tc, i) => {
                      const result = step.toolResults.find((r) => r.name === tc.name) || step.toolResults[i];
                      return (
                        <CombinedToolItem
                          key={i}
                          toolCall={tc}
                          toolResult={result}
                          isComplete={step.isComplete}
                          expanded={idx === pairedAgentSteps.length - 1}
                          onToggle={() => {}}
                        />
                      );
                    })}
                  </div>
                )}
              </React.Fragment>
            ))}
            {reasoningText && (
              <ReasoningDetails content={reasoningText} open />
            )}
            {currentStepText && (
              <MarkdownRenderer content={processedMarkdown} showCursor={!pendingToolCallName} />
            )}
            {pendingToolCallName && (
              <div className="space-y-1.5 my-1.5">
                <CombinedToolItem
                  toolCall={{ id: 'pending', name: pendingToolCallName, arguments: {} }}
                  isComplete={false}
                  expanded={false}
                  onToggle={() => {}}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

export const AgentErrorBubble: React.FC<AgentErrorBubbleProps> = ({ pairedAgentSteps, agentError, currentRole }) => (
  <div className="flex flex-col gap-1 w-full animate-fade-in items-start">
    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 px-1 font-medium tracking-tight">
      <Sparkles className="w-3.5 h-3.5 text-red-500" />
      <span className="text-zinc-700 font-semibold">{currentRole?.label || 'AI Assistant'} (failed)</span>
    </div>
    <div className="max-w-[88%] w-full rounded-lg px-3.5 py-2.5 bg-white border border-zinc-200 rounded-tl-none shadow-sm space-y-3">
      {pairedAgentSteps.map((step, idx) => (
        <React.Fragment key={idx}>
          {step.content && <MarkdownRenderer content={step.content} />}
          {step.toolCalls.length > 0 && (
            <div className="space-y-1.5 my-1.5">
              {step.toolCalls.map((tc, i) => {
                const result = step.toolResults.find((r) => r.name === tc.name) || step.toolResults[i];
                return (
                  <CombinedToolItem
                    key={i}
                    toolCall={tc}
                    toolResult={result}
                    isComplete={step.isComplete}
                    expanded={idx === pairedAgentSteps.length - 1}
                    onToggle={() => {}}
                  />
                );
              })}
            </div>
          )}
        </React.Fragment>
      ))}
      <div className="p-3 rounded-md border border-red-200 bg-red-50 text-[11px] font-medium leading-relaxed text-red-800">
        <span className="font-bold text-red-650 mr-1">Agent Error:</span> {agentError}
      </div>
    </div>
  </div>
);
