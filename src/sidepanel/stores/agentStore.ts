import { create } from 'zustand';
import type { AgentStatus, AgentStep, Provider, CodeAttachment } from '../../shared/types';
import { AgentRuntime } from '../services/agentRuntime';
import { useChatStore } from './chatStore';

interface ContextInfo {
  provider: Provider;
  apiKey: string;
  model: string;
  editorContext: any;
  scriptId: string;
  attachments?: CodeAttachment[];
}

interface AgentState {
  status: AgentStatus;
  steps: AgentStep[];
  finalResponse: string | null;
  error: string | null;
  streamingText: string;
  currentStepText: string;

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
  currentStepText: '',

  run: async (prompt: string, contextInfo: ContextInfo) => {
    const { provider, apiKey, model, editorContext, scriptId, attachments } = contextInfo;

    // Cancel any existing runtime before starting a new one
    if (currentRuntime) {
      currentRuntime.cancel();
      currentRuntime = null;
    }

    set({ status: 'thinking', steps: [], finalResponse: null, error: null, streamingText: '', currentStepText: '' });

    const runtime = new AgentRuntime();
    currentRuntime = runtime;

    await runtime.run(prompt, provider, apiKey, model, editorContext, scriptId, {
      onStreamingText: (text: string) => {
        set((state) => ({
          streamingText: state.streamingText + text,
          currentStepText: state.currentStepText + text
        }));
      },
      onStep: (step: AgentStep) => {
        set((state) => ({
          steps: [...state.steps, step],
          currentStepText: '',
          status: step.type === 'tool_call' ? 'executing_tools' as AgentStatus : 'thinking' as AgentStatus
        }));
      },
      onDone: (response: string) => {
        const state = useAgentStore.getState();
        // Use accumulated streaming text (full conversation) when available,
        // fall back to final response (e.g. when finish tool provides summary)
        const content = state.streamingText || response;
        set({ status: 'done', finalResponse: response, currentStepText: '' });
        useChatStore.getState().addAgentResult(scriptId, content, state.steps);
        currentRuntime = null;
      },
      onError: (error: string) => {
        set({ status: 'error', error, currentStepText: '' });
        currentRuntime = null;
      }
    }, attachments);
  },

  cancel: () => {
    if (currentRuntime) {
      currentRuntime.cancel();
      currentRuntime = null;
    }
    set({ status: 'cancelled', currentStepText: '' });
  },

  reset: () => {
    currentRuntime = null;
    set({ status: 'idle', steps: [], finalResponse: null, error: null, streamingText: '', currentStepText: '' });
  }
}));
