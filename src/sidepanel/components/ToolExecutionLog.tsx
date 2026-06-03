import React, { useState, useMemo } from 'react';
import type { AgentStep, ToolCall, ToolResult } from '../../shared/types';
import { Loader2, Check, X, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';

interface ToolExecutionLogProps {
  steps: AgentStep[];
}

interface PairedStep {
  type: 'text' | 'tool';
  content: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  isComplete: boolean;
  timestamp: number;
}

export const ToolExecutionLog: React.FC<ToolExecutionLogProps> = ({ steps }) => {
  const pairedSteps = useMemo(() => pairSteps(steps), [steps]);

  if (pairedSteps.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 animate-fade-in">
      {pairedSteps.map((step, idx) => (
        <StepItem key={idx} step={step} isLatest={idx === pairedSteps.length - 1} />
      ))}
    </div>
  );
};

function pairSteps(steps: AgentStep[]): PairedStep[] {
  const result: PairedStep[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    if (step.type === 'text') {
      result.push({
        type: 'text',
        content: step.content,
        toolCalls: [],
        toolResults: [],
        isComplete: true,
        timestamp: step.timestamp
      });
    } else if (step.type === 'tool_call') {
      // Look ahead for tool_result that follows
      const nextStep = steps[i + 1];
      if (nextStep?.type === 'tool_result') {
        result.push({
          type: 'tool',
          content: step.content,
          toolCalls: step.toolCalls || [],
          toolResults: nextStep.toolResults || [],
          isComplete: true,
          timestamp: step.timestamp
        });
        i++; // skip the tool_result step
      } else {
        // No result yet — still pending
        result.push({
          type: 'tool',
          content: step.content,
          toolCalls: step.toolCalls || [],
          toolResults: [],
          isComplete: false,
          timestamp: step.timestamp
        });
      }
    }
    // tool_result without preceding tool_call (shouldn't happen, but handle gracefully)
    else if (step.type === 'tool_result') {
      result.push({
        type: 'tool',
        content: step.content,
        toolCalls: [],
        toolResults: step.toolResults || [],
        isComplete: true,
        timestamp: step.timestamp
      });
    }
  }

  return result;
}

const StepItem: React.FC<{ step: PairedStep; isLatest: boolean }> = ({ step, isLatest }) => {
  const [expanded, setExpanded] = useState(isLatest);

  if (step.type === 'text') {
    return (
      <div className="flex items-start gap-2 text-[11px] text-zinc-600 animate-fade-in">
        <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-zinc-400 shrink-0" />
        <span className="flex-1 leading-relaxed">{step.content}</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {step.toolCalls.map((tc, i) => {
        const result = step.toolResults.find(r => r.name === tc.name) || step.toolResults[i];
        return (
          <CombinedToolItem
            key={i}
            toolCall={tc}
            toolResult={result}
            isComplete={step.isComplete}
            expanded={expanded}
            onToggle={() => setExpanded(!expanded)}
          />
        );
      })}
    </div>
  );
};

const CombinedToolItem: React.FC<{
  toolCall: ToolCall;
  toolResult?: ToolResult;
  isComplete: boolean;
  expanded: boolean;
  onToggle: () => void;
}> = ({ toolCall, toolResult, isComplete, expanded, onToggle }) => {
  const success = toolResult?.success;
  const statusLabel = isComplete
    ? (success ? 'done' : 'failed')
    : 'running';

  const borderColor = isComplete
    ? (success ? 'border-emerald-200' : 'border-red-200')
    : 'border-zinc-200';

  const bgColor = isComplete
    ? (success ? 'bg-emerald-50' : 'bg-red-50')
    : 'bg-zinc-50';

  const statusColor = isComplete
    ? (success ? 'text-emerald-700' : 'text-red-600')
    : 'text-amber-600';

  return (
    <div className={`border rounded-md overflow-hidden text-[11px] ${borderColor} ${bgColor}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-black/[0.02] transition-colors cursor-pointer"
      >
        <span className="shrink-0">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
        <span className="shrink-0">
          {!isComplete ? (
            <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
          ) : success ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <X className="w-3.5 h-3.5 text-red-500" />
          )}
        </span>
        <span className="font-mono font-medium text-zinc-800">{toolCall.name}</span>
        <span className={`ml-auto text-[10px] ${statusColor}`}>
          {statusLabel}
        </span>
      </button>
      {expanded && (
        <div className="px-2.5 pb-2 border-t border-zinc-200 pt-1.5 space-y-1.5">
          <div>
            <div className="text-[10px] text-zinc-500 font-medium mb-0.5">Arguments:</div>
            <pre className="text-[10px] text-zinc-700 bg-white border border-zinc-200 rounded p-1.5 overflow-x-auto font-mono leading-relaxed">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>
          {toolResult && (
            <div>
              <div className="text-[10px] text-zinc-500 font-medium mb-0.5">Output:</div>
              <pre className="text-[10px] text-zinc-700 bg-white border border-zinc-200 rounded p-1.5 overflow-x-auto font-mono leading-relaxed max-h-[120px] overflow-y-auto">
                {toolResult.output || toolResult.error || '(empty)'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
