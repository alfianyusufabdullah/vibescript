import type { AgentStep, ToolCall, ToolResult } from '../../shared/types';

export interface PairedStep {
  type: 'text' | 'tool';
  content: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  isComplete: boolean;
  timestamp: number;
}

export function pairSteps(steps: AgentStep[]): PairedStep[] {
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
