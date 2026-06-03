import { create } from 'zustand';
import type { AgentStatus, AgentStep, Provider } from '../../shared/types';
import { AgentRuntime } from '../services/agentRuntime';
import { useChatStore } from './chatStore';

interface ContextInfo {
  provider: Provider;
  apiKey: string;
  model: string;
  editorContext: any;
  scriptId: string;
}

interface AgentState {
  status: AgentStatus;
  steps: AgentStep[];
  finalResponse: string | null;
  error: string | null;
  streamingText: string;

  run: (prompt: string, contextInfo: ContextInfo) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

let currentRuntime: AgentRuntime | null = null;

export const useAgentStore = create<AgentState>((set) => ({
  status: 'idle',
  steps: [],
  finalResponse: null,
  error: null,
  streamingText: '',

  run: async (prompt: string, contextInfo: ContextInfo) => {
    const { provider, apiKey, model, editorContext, scriptId } = contextInfo;

    set({ status: 'thinking', steps: [], finalResponse: null, error: null, streamingText: '' });

    const runtime = new AgentRuntime();
    currentRuntime = runtime;

    await runtime.run(prompt, provider, apiKey, model, editorContext, scriptId, {
      onStreamingText: (text: string) => {
        set((state) => ({ streamingText: state.streamingText + text }));
      },
      onStep: (step: AgentStep) => {
        set((state) => ({
          steps: [...state.steps, step],
          status: step.type === 'tool_call' ? 'executing_tools' as AgentStatus : 'thinking' as AgentStatus
        }));
      },
      onDone: (response: string) => {
        // Capture steps before they're lost on next run
        const currentSteps = useAgentStore.getState().steps;
        set({ status: 'done', finalResponse: response });
        // Sync to chat history with tool execution steps
        useChatStore.getState().addAgentResult(scriptId, response, currentSteps);
        currentRuntime = null;
      },
      onError: (error: string) => {
        set({ status: 'error', error });
        currentRuntime = null;
      }
    });
  },

  cancel: () => {
    if (currentRuntime) {
      currentRuntime.cancel();
      currentRuntime = null;
    }
    set({ status: 'cancelled' });
  },

  reset: () => {
    currentRuntime = null;
    set({ status: 'idle', steps: [], finalResponse: null, error: null, streamingText: '' });
  }
}));
