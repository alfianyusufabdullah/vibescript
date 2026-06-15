import { create } from 'zustand';
import type { AgentStatus, AgentStep, Provider, CodeAttachment, AgentRole, MonacoEditorContext } from '../../shared/types';
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
  editorContext: MonacoEditorContext | null;
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
  pendingToolCallName: string | null;

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
  pendingToolCallName: null,

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
      const scriptLabel = scriptId || 'global';
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

    // Batched streaming: accumulate text deltas and flush after each event-loop tick.
    // Uses setTimeout(0) instead of requestAnimationFrame because RAF's ~16ms delay
    // means fast models can complete within a single frame, showing no streaming at all.
    let pendingStreamText = '';
    let pendingReasoningText = '';
    let flushTimerId: ReturnType<typeof setTimeout> | null = null;

    const flushStream = () => {
      const stream = pendingStreamText;
      const reasoning = pendingReasoningText;
      pendingStreamText = '';
      pendingReasoningText = '';
      flushTimerId = null;
      set((state) => ({
        ...(stream ? { streamingText: state.streamingText + stream, currentStepText: state.currentStepText + stream } : {}),
        ...(reasoning ? { reasoningText: state.reasoningText + reasoning } : {}),
      }));
    };

    const scheduleFlush = () => {
      if (flushTimerId === null) {
        flushTimerId = setTimeout(flushStream, 0);
      }
    };

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
          pendingStreamText += text;
          scheduleFlush();
        },
        onReasoning: (text: string) => {
          pendingReasoningText += text;
          scheduleFlush();
        },
        onResetStreaming: () => {
          if (flushTimerId !== null) {
            clearTimeout(flushTimerId);
            flushTimerId = null;
          }
          pendingStreamText = '';
          pendingReasoningText = '';
          set({ streamingText: '', currentStepText: '', reasoningText: '' });
        },
        onToolCallStart: (name: string) => {
          // finish is not a real tool execution — the text streamed before it IS the
          // final response, so keep it visible and don't show a pending indicator.
          if (name === 'finish') return;
          // For real tools: clear any streaming text (may contain raw tool-call JSON
          // the model emitted as content) and show a pending spinner immediately.
          if (flushTimerId !== null) {
            clearTimeout(flushTimerId);
            flushTimerId = null;
          }
          pendingStreamText = '';
          set({ streamingText: '', currentStepText: '', status: 'executing_tools' as AgentStatus, pendingToolCallName: name });
        },
        onStep: (step: AgentStep) => {
          if (flushTimerId !== null) {
            clearTimeout(flushTimerId);
            flushTimerId = null;
            flushStream();
          }
          set((state) => ({
            steps: [...state.steps, step],
            currentStepText: '',
            pendingToolCallName: null,
            reasoningText: step.reasoningText !== undefined ? '' : state.reasoningText,
            status: step.type === 'tool_call'
              ? ('executing_tools' as AgentStatus)
              : ('thinking' as AgentStatus),
          }));
        },
        onDone: async (response: string, usage) => {
          if (flushTimerId !== null) {
            clearTimeout(flushTimerId);
            flushTimerId = null;
            flushStream();
          }
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

          set({ status: 'done', finalResponse: response, currentStepText: '', currentRole: null, pendingToolCallName: null });
          useChatStore.getState().addAgentResult(scriptId, content, state.steps);
        },
        onError: (error: string) => {
          if (flushTimerId !== null) {
            clearTimeout(flushTimerId);
            flushTimerId = null;
            flushStream();
          }
          set({ status: 'error', error, currentStepText: '', currentRole: null, pendingToolCallName: null });
        },
      },
      attachments
    );
  },

  cancel: () => {
    agentOrchestrator.cancel();
    set({ status: 'cancelled', currentStepText: '', currentRole: null, pendingToolCallName: null });
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
      pendingToolCallName: null,
    });
  },
}));
