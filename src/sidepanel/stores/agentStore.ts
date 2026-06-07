/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import type { AgentStatus, AgentStep, Provider, CodeAttachment, AgentRole } from '../../shared/types';
import { registerBuiltinTools } from '../../shared/tools';

let toolsRegistered = false;
function ensureTools(): void {
  if (!toolsRegistered) {
    registerBuiltinTools();
    toolsRegistered = true;
  }
}
import { agentOrchestrator } from '../services/agentOrchestrator';
import { useChatStore } from './chatStore';
import { resolveAgentFromPrompt } from '../../shared/agents';
import { sessionManager } from '../services/sessionManager';
import { useEditorStore } from './editorStore';

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
  currentRole: AgentRole | null;
  reasoningText: string;

  run: (prompt: string, contextInfo: ContextInfo) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  status: 'idle',
  steps: [],
  finalResponse: null,
  error: null,
  streamingText: '',
  currentStepText: '',
  currentRole: null,
  reasoningText: '',

  run: async (prompt: string, contextInfo: ContextInfo) => {
    ensureTools();

    const { provider, apiKey, model, editorContext, scriptId, attachments } = contextInfo;

    agentOrchestrator.cancel();

    const { role, cleanPrompt } = resolveAgentFromPrompt(prompt);

    set({
      status: 'thinking',
      steps: [],
      finalResponse: null,
      error: null,
      streamingText: '',
      currentStepText: '',
      currentRole: role,
      reasoningText: '',
    });

    // Try to set up session; errors must not prevent the agent from running
    try {
      const scriptLabel = editorContext?.scriptId || 'global';
      const existingSessions = await sessionManager.listSessions(scriptLabel);
      const currentSessionId = sessionManager.getCurrentSessionId();
      const currentSession = currentSessionId
        ? await sessionManager.loadSession(scriptLabel, currentSessionId)
        : null;
      if (!currentSession) {
        if (existingSessions.length === 0) {
          await sessionManager.createSession(scriptLabel, `Conversation`, role.id);
        } else {
          const latest = existingSessions.sort((a, b) => b.updatedAt - a.updatedAt)[0];
          await sessionManager.loadSession(scriptLabel, latest.id);
          await sessionManager.deactivateOtherSessions(scriptLabel, latest.id);
        }
      }
    } catch (err) {
      console.error('[VibeScript] Session setup failed (agent will still run):', err);
    }

    await agentOrchestrator.runAgent(
      role,
      cleanPrompt,
      provider,
      apiKey,
      model,
      editorContext,
      scriptId,
      {
        onStreamingText: (text: string) => {
          set((state) => ({
            streamingText: state.streamingText + text,
            currentStepText: state.currentStepText + text,
          }));
        },
        onReasoning: (text: string) => {
          set((state) => ({
            reasoningText: state.reasoningText + text,
          }));
        },
        onResetStreaming: () => {
          set({ streamingText: '', currentStepText: '', reasoningText: '' });
        },
        onStep: (step: AgentStep) => {
          set((state) => ({
            steps: [...state.steps, step],
            currentStepText: '',
            reasoningText: step.reasoningText !== undefined ? '' : state.reasoningText,
            status: step.type === 'tool_call'
              ? ('executing_tools' as AgentStatus)
              : ('thinking' as AgentStatus),
          }));
        },
        onDone: async (response: string, usage) => {
          const state = useAgentStore.getState();
          const content = response || state.streamingText;

          // Save session — errors must not break the UI
          try {
            const sid = useEditorStore.getState().scriptId || 'global';
            const sessId = sessionManager.getCurrentSessionId();
            if (sessId) {
              const sess = await sessionManager.loadSession(sid, sessId);
              if (sess) {
                const chatMessages = useChatStore.getState().messages;
                sess.status = 'active';
                await sessionManager.deactivateOtherSessions(sid, sess.id);
                await sessionManager.updateSessionMessages(
                  sess,
                  chatMessages,
                  state.steps,
                  usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
                );
              }
            }
          } catch (err) {
            console.error('[VibeScript] Failed to save session on done:', err);
          }

          set({ status: 'done', finalResponse: response, currentStepText: '', currentRole: null });
          useChatStore.getState().addAgentResult(scriptId, content, state.steps);
        },
        onError: (error: string) => {
          set({ status: 'error', error, currentStepText: '', currentRole: null });
        },
      },
      attachments
    );
  },

  cancel: () => {
    agentOrchestrator.cancel();
    set({ status: 'cancelled', currentStepText: '', currentRole: null });
  },

  reset: () => {
    agentOrchestrator.cancel();
    set({
      status: 'idle',
      steps: [],
      finalResponse: null,
      error: null,
      streamingText: '',
      currentStepText: '',
      currentRole: null,
      reasoningText: '',
    });
  },
}));
