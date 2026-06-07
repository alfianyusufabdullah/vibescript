import type { Provider as ProviderName, ToolCall, ToolResult, AgentMessage, AgentStep, TokenUsage, CodeAttachment, AgentRole, ToolContext, MonacoEditorContext } from '../../shared/types';
import { toolRegistry } from '../../shared/toolRegistry';
import { AGENT_ROLES } from '../../shared/agents';
import { providerRegistry } from '../../shared/providers/registry';
import type { Provider } from '../../shared/providers/types';
import { PROVIDERS } from '../../shared/constants';
import { useEditorStore } from '../stores/editorStore';
import { useChatStore } from '../stores/chatStore';
import { eventBus } from '../../shared/eventBus';
import { callLLMWithRetry } from './llmCaller';
import { ensureContext, CONTEXT_WARN_RATIO, CONTEXT_CRITICAL_RATIO } from './contextManager';

const MAX_STEPS = 25;
const TOOL_TIMEOUT = 10_000;
const LONG_TOOL_TIMEOUT = 30_000;

const MUTATING_TOOLS = new Set(['edit_file']);
const NO_TIMEOUT_TOOLS = new Set(['edit_file']);
const LONG_TIMEOUT_TOOL_NAMES = new Set(['search_code', 'batch_read_files', 'list_open_files']);

export interface AgentRuntimeCallbacks {
  onStep: (step: AgentStep) => void;
  onDone: (response: string, usage?: TokenUsage) => void;
  onError: (error: string) => void;
  onStreamingText?: (text: string) => void;
  onReasoning?: (text: string) => void;
  onResetStreaming?: () => void;
}

export class AgentRuntime {
  private cancelled = false;
  private totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  private lastLlmPromptTokens = 0;
  private contextWindow = 128_000;
  private role: AgentRole;
  private stopRequested = false;
  private reasoningText = '';
  private currentProvider: Provider | null = null;
  private currentProviderName: ProviderName | null = null;
  private currentModel = '';
  private currentApiKey = '';

  constructor(role?: AgentRole) {
    this.role = role || AGENT_ROLES.build;
  }

  cancel(): void {
    this.cancelled = true;
    useEditorStore.getState().cancelDiffReview();
  }

  // _scriptId is received from the orchestrator for context identification but
  // is not directly consumed inside this method — kept for API compatibility.
  async run(
    prompt: string,
    provider: ProviderName,
    apiKey: string,
    model: string,
    editorContext: MonacoEditorContext | null,
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

    const promptWithContext = this.buildPromptWithContext(prompt, editorContext, attachments);

    const messages: AgentMessage[] = [{ role: 'system', content: this.role.systemPrompt }];

    const chatHistory = useChatStore.getState().messages;
    // Exclude the last message — it's the current user message just added by addUserMessage,
    // and we'll push it below as promptWithContext (which may include editor context).
    const historyMessages = chatHistory.slice(0, -1).slice(-10);
    for (const msg of historyMessages) {
      if (msg.role === 'user') {
        const msgContent = this.buildPromptWithContext(msg.content, null, msg.attachments);
        messages.push({ role: 'user', content: msgContent });
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    messages.push({ role: 'user', content: promptWithContext });

    const providerInstance = providerRegistry.get(provider, { apiKey, model });
    this.currentProvider = providerInstance;
    this.currentProviderName = provider;
    this.currentModel = model;
    this.currentApiKey = apiKey;

    const allowedTools = this.role.allowedTools === '*' ? undefined : this.role.allowedTools;
    const maxSteps = this.role.maxSteps || MAX_STEPS;

    for (let step = 0; step < maxSteps; step++) {
      if (this.cancelled) {
        eventBus.emit('agent:status', { status: 'error', role: this.role.id });
        callbacks.onError('Cancelled');
        return;
      }

      if (this.stopRequested) {
        eventBus.emit('agent:status', { status: 'done', role: this.role.id });
        callbacks.onDone('Task finished.', this.totalUsage);
        return;
      }

      const contextRatio = this.lastLlmPromptTokens / this.contextWindow;
      if (contextRatio >= CONTEXT_WARN_RATIO && step > 0) {
        const contextPct = `${(contextRatio * 100).toFixed(0)}%`;
        const contextMessage = contextRatio >= CONTEXT_CRITICAL_RATIO
          ? `Context at ${contextPct} — trimming old messages to continue`
          : `Context at ${contextPct} — optimizing message history`;
        callbacks.onStep({
          type: 'text',
          content: contextMessage,
          timestamp: Date.now(),
        });
      }

      await ensureContext(
        messages,
        this.lastLlmPromptTokens,
        this.contextWindow,
        this.currentProvider,
        this.currentProviderName,
        this.currentModel,
        this.currentApiKey
      );

      const llmResponse = await callLLMWithRetry(
        providerInstance,
        model,
        messages,
        allowedTools,
        apiKey,
        {
          ...callbacks,
          onReasoning: (text: string) => {
            this.reasoningText += text;
            callbacks.onReasoning?.(text);
          },
        },
        () => this.cancelled,
        () => { this.reasoningText = ''; }
      );

      if (!llmResponse) {
        if (!this.cancelled) {
          eventBus.emit('agent:status', { status: 'error', role: this.role.id });
          callbacks.onError('LLM call failed');
        }
        return;
      }

      const { text, toolCalls, usage } = llmResponse;

      if (usage) {
        this.totalUsage.promptTokens += usage.promptTokens;
        this.totalUsage.completionTokens += usage.completionTokens;
        this.totalUsage.totalTokens += usage.totalTokens;
        this.lastLlmPromptTokens = usage.promptTokens;
      } else {
        const totalChars = messages.reduce((sum, m) => {
          const c = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '');
          return sum + c.length;
        }, 0);
        this.lastLlmPromptTokens = Math.ceil(totalChars / 3.5);
      }

      const serializedToolCalls = toolCalls.length > 0
        ? toolCalls.map((toolCall) => ({
            id: toolCall.id,
            type: 'function' as const,
            function: { name: toolCall.name, arguments: JSON.stringify(toolCall.arguments) },
          }))
        : undefined;
      const assistantMsg: AgentMessage = {
        role: 'assistant',
        content: text,
        tool_calls: serializedToolCalls,
      };
      messages.push(assistantMsg);

      if (!toolCalls || toolCalls.length === 0) {
        const finalText = text || 'Task completed.';
        callbacks.onStep({
          type: 'text',
          content: finalText,
          reasoningText: this.reasoningText || undefined,
          timestamp: Date.now(),
        });
        this.reasoningText = '';
        eventBus.emit('agent:status', { status: 'done', role: this.role.id });
        callbacks.onDone(finalText, this.totalUsage);
        return;
      }

      const finishCall = toolCalls.find((toolCall) => toolCall.name === 'finish');
      const executableTools = finishCall
        ? toolCalls.filter((toolCall) => toolCall.name !== 'finish')
        : toolCalls;

      if (executableTools.length === 0) {
        const summary = (finishCall?.arguments?.summary as string) || '';
        const finalContent = text
          ? (summary && summary !== text ? `${text}\n\n**Summary:** ${summary}` : text)
          : summary || 'Task finished';
        callbacks.onStep({
          type: 'text',
          content: finalContent,
          reasoningText: this.reasoningText || undefined,
          timestamp: Date.now(),
        });
        this.reasoningText = '';
        eventBus.emit('agent:status', { status: 'done', role: this.role.id });
        callbacks.onDone(finalContent, this.totalUsage);
        return;
      }

      callbacks.onStep({
        type: 'tool_call',
        content: text,
        toolCalls: executableTools,
        reasoningText: this.reasoningText || undefined,
        timestamp: Date.now(),
      });
      this.reasoningText = '';

      eventBus.emit('agent:status', { status: 'executing_tools', role: this.role.id });

      if (this.cancelled) {
        eventBus.emit('agent:status', { status: 'error', role: this.role.id });
        callbacks.onError('Cancelled');
        return;
      }

      const toolResults = await this.executeToolsWithParallelism(executableTools);

      for (let i = 0; i < executableTools.length; i++) {
        messages.push({
          role: 'tool',
          tool_call_id: executableTools[i].id,
          content: JSON.stringify(toolResults[i]),
        });
      }

      const rejected = toolResults.some((r) => r.error === 'USER_REJECTED');
      if (rejected) {
        callbacks.onStep({
          type: 'tool_result',
          content: '',
          toolResults,
          timestamp: Date.now(),
        });
        callbacks.onStep({
          type: 'text',
          content: 'Changes rejected. Agent stopped.',
          timestamp: Date.now(),
        });
        eventBus.emit('agent:status', { status: 'done', role: this.role.id });
        callbacks.onDone('Changes rejected. Agent stopped.', this.totalUsage);
        return;
      }

      const modifiedFile = toolResults.some((r) => r.name === 'edit_file' && r.success === true);
      if (modifiedFile) {
        const fresh = await this.tryReadFile();
        if (fresh) {
          const existingIdx = messages.findIndex((m) => m.role === 'user' && m.content.startsWith('[System Context]'));
          if (existingIdx !== -1) messages.splice(existingIdx, 1);
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

      if (finishCall) {
        const summary = (finishCall.arguments?.summary as string) || '';
        const finalContent = text
          ? (summary && summary !== text ? `${text}\n\n**Summary:** ${summary}` : text)
          : summary || 'Task finished';
        callbacks.onStep({
          type: 'text',
          content: finalContent,
          reasoningText: this.reasoningText || undefined,
          timestamp: Date.now(),
        });
        this.reasoningText = '';
        eventBus.emit('agent:status', { status: 'done', role: this.role.id });
        callbacks.onDone(finalContent, this.totalUsage);
        return;
      }
    }

    const tokensUsedK = `~${(this.totalUsage.totalTokens / 1000).toFixed(0)}K`;
    eventBus.emit('agent:status', { status: 'error', role: this.role.id });
    callbacks.onError(`Max steps (${maxSteps}) reached after ${tokensUsedK} tokens`);
  }

  private buildPromptWithContext(
    prompt: string,
    editorContext: MonacoEditorContext | null,
    attachments?: CodeAttachment[]
  ): string {
    let result = prompt;

    if (editorContext) {
      const selectedTextBlock = editorContext.selectedText
        ? `\n\`\`\`javascript\n${editorContext.selectedText}\n\`\`\``
        : 'none';
      result = `
Active File Code Context:
\`\`\`javascript
${editorContext.code}
\`\`\`

Cursor Position: Line ${editorContext.position?.line || 'unknown'}, Column ${editorContext.position?.col || 'unknown'}
Selected Text: ${selectedTextBlock}

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
      result += attachmentText;
    }

    return result;
  }

  private async executeToolsWithParallelism(tools: ToolCall[]): Promise<ToolResult[]> {
    const readOnlyWithIdx: Array<{ toolCall: ToolCall; idx: number }> = [];
    const mutatingWithIdx: Array<{ toolCall: ToolCall; idx: number }> = [];

    for (let i = 0; i < tools.length; i++) {
      const bucket = MUTATING_TOOLS.has(tools[i].name) ? mutatingWithIdx : readOnlyWithIdx;
      bucket.push({ toolCall: tools[i], idx: i });
    }

    const readOnlySettled = await Promise.allSettled(
      readOnlyWithIdx.map(({ toolCall }) => this.executeToolWithTimeout(toolCall))
    );

    const mutatingResults: ToolResult[] = [];
    for (const { toolCall } of mutatingWithIdx) {
      if (this.cancelled) {
        mutatingResults.push({
          toolCallId: toolCall.id,
          name: toolCall.name,
          success: false,
          output: '',
          error: 'Cancelled',
        });
        continue;
      }
      mutatingResults.push(await this.executeToolWithTimeout(toolCall));
    }

    const results = new Array<ToolResult>(tools.length);
    let readOnlyIdx = 0;
    let mutatingIdx = 0;
    for (let i = 0; i < tools.length; i++) {
      if (MUTATING_TOOLS.has(tools[i].name)) {
        results[i] = mutatingResults[mutatingIdx++];
      } else {
        const settled = readOnlySettled[readOnlyIdx++];
        if (settled.status === 'fulfilled') {
          results[i] = settled.value;
        } else {
          const reason = (settled as PromiseRejectedResult).reason?.message || 'Tool execution failed';
          results[i] = {
            toolCallId: tools[i].id,
            name: tools[i].name,
            success: false,
            output: '',
            error: String(reason),
          };
        }
      }
    }
    return results;
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
      signalStop: () => { this.stopRequested = true; },
    };
  }

  private async executeToolWithTimeout(tc: ToolCall): Promise<ToolResult> {
    let timeout: number | undefined;
    if (NO_TIMEOUT_TOOLS.has(tc.name)) {
      timeout = undefined;
    } else if (LONG_TIMEOUT_TOOL_NAMES.has(tc.name)) {
      timeout = LONG_TOOL_TIMEOUT;
    } else {
      timeout = TOOL_TIMEOUT;
    }

    const exec = toolRegistry.execute(tc.name, tc.arguments, this.toolContext());
    if (timeout !== undefined) {
      // Suppress unhandled-rejection if the race rejects first
      exec.catch(() => {});
    }

    const raced = timeout !== undefined
      ? Promise.race([
          exec,
          new Promise<ToolResult>((_, reject) =>
            setTimeout(() => reject(new Error('Tool execution timed out')), timeout)
          ),
        ])
      : exec;

    eventBus.emit('tool:start', { name: tc.name, args: tc.arguments });
    const startTime = Date.now();

    try {
      const result = await raced;
      const duration = Date.now() - startTime;
      eventBus.emit('tool:result', { name: tc.name, success: result.success, output: result.output, error: result.error, duration });
      return { toolCallId: tc.id, name: tc.name, success: result.success, output: result.output, error: result.error };
    } catch (err: unknown) {
      const duration = Date.now() - startTime;
      const result = { toolCallId: tc.id, name: tc.name, success: false, output: '', error: err instanceof Error ? err.message : String(err) };
      eventBus.emit('tool:result', { name: tc.name, success: false, output: '', error: result.error, duration });
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
