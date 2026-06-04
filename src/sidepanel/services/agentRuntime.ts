/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Provider as ProviderName, ToolDefinition, ToolCall, ToolResult, AgentMessage, AgentStep, TokenUsage, CodeAttachment, AgentRole, ToolContext } from '../../shared/types';
import { toolRegistry } from '../../shared/toolRegistry';
import { AGENT_ROLES } from '../../shared/agents';
import { providerRegistry } from '../../shared/providers/registry';
import type { Provider } from '../../shared/providers/types';
import { PROVIDERS } from '../../shared/constants';
import { useEditorStore } from '../stores/editorStore';
import { useChatStore } from '../stores/chatStore';
import { eventBus } from '../../shared/eventBus';

const MAX_STEPS = 25;
const TOOL_TIMEOUT = 10_000;
const DIFF_REVIEW_TIMEOUT = 300_000;
const CONTEXT_WARN_RATIO = 0.7;
const CONTEXT_CRITICAL_RATIO = 0.85;
const MAX_RETRIES = 3;

interface LLMCallResult {
  text: string;
  toolCalls: ToolCall[];
  usage?: TokenUsage;
}

interface LLMCallError {
  error: string;
  retriable: boolean;
}

function isLLMCallError(v: LLMCallResult | LLMCallError): v is LLMCallError {
  return 'error' in v && !('text' in v);
}

export interface AgentRuntimeCallbacks {
  onStep: (step: AgentStep) => void;
  onDone: (response: string) => void;
  onError: (error: string) => void;
  onStreamingText?: (text: string) => void;
  onReasoning?: (text: string) => void;
}

export class AgentRuntime {
  private cancelled = false;
  private totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  private lastPromptTokens = 0;
  private contextWindow = 128_000;
  private role: AgentRole;
  private stopRequested = false;
  private reasoningText = '';
  private currentProvider: Provider | null = null;
  private currentModel = '';
  private currentApiKey = '';

  constructor(role?: AgentRole) {
    this.role = role || AGENT_ROLES.build;
  }

  cancel(): void {
    this.cancelled = true;
    useEditorStore.getState().cancelDiffReview();
  }

  async run(
    prompt: string,
    provider: ProviderName,
    apiKey: string,
    model: string,
    editorContext: any,
    _scriptId: string,
    callbacks: AgentRuntimeCallbacks,
    attachments?: CodeAttachment[]
  ): Promise<void> {
    this.cancelled = false;
    this.totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    this.reasoningText = '';
    this.stopRequested = false;
    this.contextWindow = PROVIDERS[provider]?.contextWindow || 128_000;

    eventBus.emit('agent:status', { status: 'thinking', role: this.role.id });

    let promptWithContext = prompt;
    if (editorContext) {
      promptWithContext = `
Active File Code Context:
\`\`\`javascript
${editorContext.code}
\`\`\`

Cursor Position: Line ${editorContext.position?.line || 'unknown'}, Column ${editorContext.position?.col || 'unknown'}
Selected Text: ${editorContext.selectedText ? `\n\`\`\`javascript\n${editorContext.selectedText}\n\`\`\`` : 'none'}

User Prompt:
${prompt}
      `.trim();
    }

    if (attachments && attachments.length > 0) {
      let attachmentText = '\n\nAttached Code Context:\n';
      attachments.forEach((att) => {
        const lineLabel = att.lineStart ? ` (Lines ${att.lineStart}-${att.lineEnd})` : '';
        attachmentText += `\nFile: ${att.filename}${lineLabel}\n\`\`\`javascript\n${att.content}\n\`\`\`\n`;
      });
      promptWithContext += attachmentText;
    }

    const messages: AgentMessage[] = [
      { role: 'system', content: this.role.systemPrompt },
    ];

    const chatHistory = useChatStore.getState().messages;
    const recentHistory = chatHistory.slice(-6);
    for (const msg of recentHistory) {
      if (msg.role === 'user') {
        let msgContent = msg.content;
        if (msg.attachments && msg.attachments.length > 0) {
          let attachmentText = '\n\nAttached Code Context:\n';
          msg.attachments.forEach((att) => {
            const lineLabel = att.lineStart ? ` (Lines ${att.lineStart}-${att.lineEnd})` : '';
            attachmentText += `\nFile: ${att.filename}${lineLabel}\n\`\`\`javascript\n${att.content}\n\`\`\`\n`;
          });
          msgContent += attachmentText;
        }
        messages.push({ role: 'user', content: msgContent });
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    messages.push({ role: 'user', content: promptWithContext });

    const providerInstance = providerRegistry.get(provider, { apiKey, model });
    this.currentProvider = providerInstance;
    this.currentModel = model;
    this.currentApiKey = apiKey;

    const allowedTools = this.role.allowedTools === '*'
      ? undefined
      : this.role.allowedTools;

    for (let step = 0; step < MAX_STEPS; step++) {
      if (this.cancelled) {
        eventBus.emit('agent:status', { status: 'error', role: this.role.id });
        callbacks.onError('Cancelled');
        return;
      }

      if (this.stopRequested) {
        eventBus.emit('agent:status', { status: 'done', role: this.role.id });
        callbacks.onDone('Task finished.');
        return;
      }

      const contextRatio = this.lastPromptTokens / this.contextWindow;
      if (contextRatio >= CONTEXT_WARN_RATIO && step > 0) {
        callbacks.onStep({
          type: 'text',
          content: contextRatio >= CONTEXT_CRITICAL_RATIO
            ? `Context at ${(contextRatio * 100).toFixed(0)}% — trimming old messages to continue`
            : `Context at ${(contextRatio * 100).toFixed(0)}% — optimizing message history`,
          timestamp: Date.now(),
        });
      }
      await this.ensureContext(messages);

      const llmResponse = await this.callLLMWithRetry(providerInstance, model, messages, allowedTools, callbacks, apiKey);
      if (!llmResponse) {
        eventBus.emit('agent:status', { status: 'error', role: this.role.id });
        return;
      }

      const { text, toolCalls, usage } = llmResponse;

      if (usage) {
        this.totalUsage.promptTokens += usage.promptTokens;
        this.totalUsage.completionTokens += usage.completionTokens;
        this.totalUsage.totalTokens += usage.totalTokens;
        this.lastPromptTokens = usage.promptTokens;
      }

      const assistantMsg: AgentMessage = {
        role: 'assistant',
        content: text,
        tool_calls: toolCalls.length > 0
          ? toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            }))
          : undefined,
      };
      messages.push(assistantMsg);

      if (!toolCalls || toolCalls.length === 0) {
        callbacks.onStep({ type: 'text', content: text, timestamp: Date.now() });
        eventBus.emit('agent:status', { status: 'done', role: this.role.id });
        callbacks.onDone(text);
        return;
      }

      const finishCall = toolCalls.find((tc) => tc.name === 'finish');
      if (finishCall) {
        const summary = (finishCall.arguments?.summary as string) || '';
        const finalContent = text
          ? (summary && summary !== text ? `${text}\n\n**Summary:** ${summary}` : text)
          : summary || 'Task finished';
        callbacks.onStep({ type: 'text', content: finalContent, timestamp: Date.now() });
        eventBus.emit('agent:status', { status: 'done', role: this.role.id });
        callbacks.onDone(summary || text);
        return;
      }

      callbacks.onStep({
        type: 'tool_call',
        content: text,
        toolCalls,
        timestamp: Date.now(),
      });

      eventBus.emit('agent:status', { status: 'executing_tools', role: this.role.id });

      const toolResults: ToolResult[] = [];
      for (const tc of toolCalls) {
        if (this.cancelled) {
          eventBus.emit('agent:status', { status: 'error', role: this.role.id });
          callbacks.onError('Cancelled');
          return;
        }

        const result = await this.executeToolWithTimeout(tc);
        toolResults.push(result);

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }

      const rejected = toolResults.some((r) => r.error === 'USER_REJECTED');
      if (rejected) {
        callbacks.onStep({
          type: 'text',
          content: 'Changes rejected. Agent stopped.',
          timestamp: Date.now(),
        });
        eventBus.emit('agent:status', { status: 'done', role: this.role.id });
        callbacks.onDone('Changes rejected. Agent stopped.');
        return;
      }

      const modifiedFile = toolResults.some((r) => r.name === 'edit_file');
      if (modifiedFile) {
        const fresh = await this.tryReadFile();
        if (fresh) {
          const existingIdx = messages.findIndex(
            (m) => m.role === 'user' && m.content.startsWith('[System Context]')
          );
          if (existingIdx !== -1) {
            messages.splice(existingIdx, 1);
          }
          messages.push({
            role: 'user',
            content: `[System Context] Updated file content after modification:\n\`\`\`javascript\n${fresh}\n\`\`\``,
          });
        }
      }

      callbacks.onStep({
        type: 'tool_result',
        content: '',
        toolResults,
        timestamp: Date.now(),
      });
    }

    const currentTokens = this.totalUsage.totalTokens;
    eventBus.emit('agent:status', { status: 'error', role: this.role.id });
    callbacks.onError(`Max steps (${MAX_STEPS}) reached after ~${(currentTokens / 1000).toFixed(0)}K tokens`);
  }

  private toolContext(): ToolContext {
    const store = useEditorStore.getState();
    return {
      editorStore: {
        fetchContext: () => store.fetchContext(),
        editFile: (search, replace) => store.editFile(search, replace),
        editFileWithReview: (search, replace) => store.editFileWithReview(search, replace),
        listOpenFiles: () => store.listOpenFiles(),
        readFileByName: (filename) => store.readFileByName(filename),
        cancelDiffReview: () => store.cancelDiffReview(),
      },
      cancelDiffReview: () => store.cancelDiffReview(),
      signalStop: () => {
        this.stopRequested = true;
      },
    };
  }

  private async ensureContext(messages: AgentMessage[]): Promise<void> {
    const threshold = Math.floor(this.contextWindow * CONTEXT_WARN_RATIO);
    if (this.lastPromptTokens < threshold) return;

    const critical = this.lastPromptTokens >= Math.floor(this.contextWindow * CONTEXT_CRITICAL_RATIO);

    if (!critical && this.currentProvider && await this.trySummarize(messages)) {
      return;
    }

    const systemIndices: number[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === 'system') systemIndices.push(i);
    }
    if (systemIndices.length > 1) {
      for (let i = systemIndices.length - 2; i >= 0; i--) {
        messages.splice(systemIndices[i], 1);
      }
    }

    const assistantIndices = messages
      .map((m, i) => (m.role === 'assistant' ? i : -1))
      .filter((i) => i !== -1);

    if (assistantIndices.length > 2) {
      const keepFrom = assistantIndices[assistantIndices.length - 2];
      const userIdx = messages.findIndex((m) => m.role === 'user');
      if (userIdx >= 0 && keepFrom > userIdx) {
        messages.splice(userIdx + 1, keepFrom - userIdx - 1);
      }
    }
  }

  private async trySummarize(messages: AgentMessage[]): Promise<boolean> {
    if (!this.currentProvider) return false;

    const assistantIndices = messages
      .map((m, i) => (m.role === 'assistant' ? i : -1))
      .filter((i) => i !== -1);

    if (assistantIndices.length <= 3) return false;

    const summarizeUpTo = assistantIndices[assistantIndices.length - 3];
    const toSummarize = messages.slice(0, summarizeUpTo + 1);

    try {
      const summaryMessages: AgentMessage[] = [
        { role: 'system', content: 'Summarize the key points from this conversation history concisely.' },
        ...toSummarize,
        { role: 'user', content: 'Provide a one-paragraph summary of what was discussed and what was accomplished so far.' },
      ];

      const gen = this.currentProvider.stream(
        { model: this.currentModel, messages: summaryMessages },
        { apiKey: this.currentApiKey || '', model: this.currentModel }
      );

      let resultText = '';
      for await (const event of gen) {
        if (event.type === 'done') {
          resultText = event.text;
        } else if (event.type === 'error') {
          return false;
        }
      }

      if (resultText) {
        messages.splice(0, summarizeUpTo + 1);
        messages.unshift({
          role: 'user',
          content: `[Conversation Summary] ${resultText}`,
        });
        return true;
      }
    } catch {
      // summarization failed, fall back to truncation
    }
    return false;
  }

  private async callLLMStreaming(
    provider: Provider,
    model: string,
    messages: AgentMessage[],
    tools: ToolDefinition[],
    apiKey: string,
    onText?: (text: string) => void,
    onReasoning?: (text: string) => void
  ): Promise<LLMCallResult | LLMCallError> {
    try {
      const gen = provider.stream(
        { model, messages, tools },
        { apiKey, model }
      );

      let accumulatedText = '';
      let resultToolCalls: ToolCall[] = [];
      let resultUsage: TokenUsage | undefined;

      for await (const event of gen) {
        switch (event.type) {
          case 'text_delta':
            accumulatedText += event.delta;
            onText?.(event.delta);
            break;
          case 'reasoning_delta':
            this.reasoningText += event.delta;
            onReasoning?.(event.delta);
            break;
          case 'tool_call_start':
          case 'tool_call_delta':
          case 'tool_call_stop':
            break;
          case 'usage':
            resultUsage = event.usage;
            break;
          case 'done':
            resultToolCalls = event.toolCalls;
            return {
              text: event.text || accumulatedText,
              toolCalls: resultToolCalls,
              usage: resultUsage || event.usage,
            };
          case 'error':
            return { error: event.error, retriable: event.retriable };
        }
      }

      return { text: accumulatedText, toolCalls: [], usage: resultUsage };
    } catch (err: any) {
      return { error: err.message || String(err), retriable: true };
    }
  }

  private async callLLMWithRetry(
    provider: Provider,
    model: string,
    messages: AgentMessage[],
    allowedTools: string[] | undefined,
    callbacks: AgentRuntimeCallbacks,
    apiKey: string
  ): Promise<LLMCallResult | null> {
    const tools = toolRegistry.getAll(allowedTools);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (this.cancelled) return null;

      const result = await this.callLLMStreaming(provider, model, messages, tools, apiKey, callbacks.onStreamingText, callbacks.onReasoning);

      if (!isLLMCallError(result)) {
        return result;
      }

      if (!result.retriable) {
        callbacks.onError(result.error);
        return null;
      }

      if (attempt === MAX_RETRIES - 1) {
        callbacks.onError(`${result.error} (failed after ${MAX_RETRIES} attempts)`);
        return null;
      }

      const delay = Math.pow(2, attempt) * 1000;
      callbacks.onStep({
        type: 'text',
        content: `LLM call failed: ${result.error}. Retrying in ${delay / 1000}s... (attempt ${attempt + 2}/${MAX_RETRIES})`,
        timestamp: Date.now(),
      });
      await new Promise((r) => setTimeout(r, delay));
    }
    return null;
  }

  private async executeToolWithTimeout(tc: ToolCall): Promise<ToolResult> {
    const timeout = tc.name === 'edit_file' ? DIFF_REVIEW_TIMEOUT : TOOL_TIMEOUT;
    const timeoutPromise = new Promise<ToolResult>((_, reject) =>
      setTimeout(() => reject(new Error('Tool execution timed out')), timeout)
    );

    try {
      eventBus.emit('tool:start', { name: tc.name, args: tc.arguments });
      const startTime = Date.now();
      const ctx = this.toolContext();
      const result = await Promise.race([
        toolRegistry.execute(tc.name, tc.arguments, ctx),
        timeoutPromise,
      ]);
      const duration = Date.now() - startTime;
      eventBus.emit('tool:result', {
        name: tc.name,
        success: result.success,
        output: result.output,
        error: result.error,
        duration,
      });
      return { toolCallId: tc.id, name: tc.name, success: result.success, output: result.output, error: result.error };
    } catch (err: any) {
      const result = {
        toolCallId: tc.id,
        name: tc.name,
        success: false,
        output: '',
        error: err.message || String(err),
      };
      eventBus.emit('tool:result', {
        name: tc.name,
        success: false,
        output: '',
        error: result.error,
        duration: timeout,
      });
      return result;
    }
  }

  private async tryReadFile(): Promise<string | null> {
    try {
      const context = await useEditorStore.getState().fetchContext();
      return context?.code || null;
    } catch {
      return null;
    }
  }
}
