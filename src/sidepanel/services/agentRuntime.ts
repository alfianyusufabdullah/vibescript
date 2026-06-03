import type { Provider, ToolDefinition, ToolCall, ToolResult, AgentMessage, AgentStep, TokenUsage } from '../../shared/types';
import { AVAILABLE_TOOLS } from '../../shared/tools';
import { AGENT_SYSTEM_PROMPT, PROVIDERS } from '../../shared/constants';
import { useEditorStore } from '../stores/editorStore';
import { useChatStore } from '../stores/chatStore';

const MAX_STEPS = 25;
const TOOL_TIMEOUT = 10_000;
const CONTEXT_WARN_RATIO = 0.7;
const CONTEXT_CRITICAL_RATIO = 0.85;

export interface AgentRuntimeCallbacks {
  onStep: (step: AgentStep) => void;
  onDone: (response: string) => void;
  onError: (error: string) => void;
  onStreamingText?: (text: string) => void;
}

export class AgentRuntime {
  private cancelled = false;
  private totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  private contextWindow = 128_000;

  cancel() {
    this.cancelled = true;
  }

  async run(
    prompt: string,
    provider: Provider,
    apiKey: string,
    model: string,
    editorContext: any,
    _scriptId: string,
    callbacks: AgentRuntimeCallbacks
  ): Promise<void> {
    this.cancelled = false;
    this.totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    this.contextWindow = PROVIDERS[provider]?.contextWindow || 128_000;

    // Enrich prompt with editor context
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

    const messages: AgentMessage[] = [
      { role: 'system', content: AGENT_SYSTEM_PROMPT },
    ];

    // Load previous chat history for context
    const chatHistory = useChatStore.getState().messages;
    const recentHistory = chatHistory.slice(-6); // last 6 messages
    for (const msg of recentHistory) {
      if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    // Add the current prompt
    messages.push({ role: 'user', content: promptWithContext });

    const tools: ToolDefinition[] = AVAILABLE_TOOLS;

    for (let step = 0; step < MAX_STEPS; step++) {
      // Check cancellation
      if (this.cancelled) {
        callbacks.onError('Cancelled');
        return;
      }

      // Ensure context window has room
      const contextRatio = this.totalUsage.totalTokens / this.contextWindow;
      if (contextRatio >= CONTEXT_WARN_RATIO && step > 0) {
        callbacks.onStep({
          type: 'text',
          content: contextRatio >= CONTEXT_CRITICAL_RATIO
            ? `Context at ${(contextRatio * 100).toFixed(0)}% — trimming old messages to continue`
            : `Context at ${(contextRatio * 100).toFixed(0)}% — optimizing message history`,
          timestamp: Date.now()
        });
      }
      this.ensureContext(messages);

      // Call LLM with streaming when available
      const llmResponse = await this.callLLMStreaming(provider, apiKey, model, messages, tools, callbacks.onStreamingText);
      if (!llmResponse) return;

      const { text, toolCalls, usage } = llmResponse;

      // Accumulate usage
      if (usage) {
        this.totalUsage.promptTokens += usage.promptTokens;
        this.totalUsage.completionTokens += usage.completionTokens;
        this.totalUsage.totalTokens += usage.totalTokens;
      }

      // Push assistant response to messages
      const assistantMsg: AgentMessage = {
        role: 'assistant',
        content: text,
        tool_calls: toolCalls.length > 0 ? toolCalls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments)
          }
        })) : undefined
      };
      messages.push(assistantMsg);

      // No tool calls → done (final text goes to onDone, not as a step)
      if (!toolCalls || toolCalls.length === 0) {
        callbacks.onDone(text);
        return;
      }

      // Check for finish tool
      const finishCall = toolCalls.find(tc => tc.name === 'finish');
      if (finishCall) {
        const summary = (finishCall.arguments?.summary as string) || text;
        callbacks.onDone(summary);
        return;
      }

      // Emit step with tool calls
      callbacks.onStep({
        type: 'tool_call',
        content: text,
        toolCalls,
        timestamp: Date.now()
      });

      // Execute each tool
      const toolResults: ToolResult[] = [];
      for (const tc of toolCalls) {
        if (this.cancelled) {
          callbacks.onError('Cancelled');
          return;
        }
        const result = await this.executeToolWithTimeout(tc);
        toolResults.push(result);

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result)
        });
      }

      // After any edit/write, re-read file and inject fresh context
      const modifiedFile = toolResults.some(r => r.name === 'edit_file' || r.name === 'write_file');
      if (modifiedFile) {
        const fresh = await this.tryReadFile();
        if (fresh) {
          messages.push({
            role: 'system',
            content: `Updated file content after modification:\n\`\`\`javascript\n${fresh}\n\`\`\``
          });
        }
      }

      // Emit step with tool results
      callbacks.onStep({
        type: 'tool_result',
        content: '',
        toolResults,
        timestamp: Date.now()
      });
    }

    const currentTokens = this.totalUsage.totalTokens;
    callbacks.onError(`Max steps (${MAX_STEPS}) reached after ~${(currentTokens / 1000).toFixed(0)}K tokens`);
  }

  /**
   * Trim messages when approaching context window limit.
   * Keeps: system messages, user prompt, and last 2 complete agent iterations.
   */
  private ensureContext(messages: AgentMessage[]): void {
    const threshold = Math.floor(this.contextWindow * CONTEXT_WARN_RATIO);
    if (this.totalUsage.totalTokens < threshold) return;

    // Remove duplicate system messages: keep only the last one (most recent code state)
    const systemIndices: number[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === 'system') systemIndices.push(i);
    }
    if (systemIndices.length > 1) {
      for (let i = systemIndices.length - 2; i >= 0; i--) {
        messages.splice(systemIndices[i], 1);
      }
    }

    // Find indices of all assistant messages
    const assistantIndices = messages
      .map((m, i) => m.role === 'assistant' ? i : -1)
      .filter(i => i !== -1);

    // Keep only last 2 assistant rounds (assistant + their tool results)
    if (assistantIndices.length > 2) {
      const keepFrom = assistantIndices[assistantIndices.length - 2];
      const userIdx = messages.findIndex(m => m.role === 'user');
      if (userIdx >= 0 && keepFrom > userIdx) {
        messages.splice(userIdx + 1, keepFrom - userIdx - 1);
      }
    }
  }

  private async callLLM(
    provider: Provider,
    apiKey: string,
    model: string,
    messages: AgentMessage[],
    tools: ToolDefinition[]
  ): Promise<{ text: string; toolCalls: ToolCall[]; usage?: TokenUsage } | null> {
    // Fallback: non-streaming via sendMessage
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            source: 'vibescript-sidepanel',
            action: 'LLM_REQUEST',
            payload: { provider, apiKey, model, messages, tools }
          },
          (response) => {
            if (chrome.runtime.lastError) { resolve(null); return; }
            if (response && response.success) {
              resolve({
                text: response.text || '',
                toolCalls: response.toolCalls || [],
                usage: response.usage
              });
            } else { resolve(null); }
          }
        );
      });
    }
    return null;
  }

  private async callLLMStreaming(
    provider: Provider,
    apiKey: string,
    model: string,
    messages: AgentMessage[],
    tools: ToolDefinition[],
    onText?: (text: string) => void
  ): Promise<{ text: string; toolCalls: ToolCall[]; usage?: TokenUsage } | null> {
    if (typeof chrome === 'undefined' || !chrome.runtime) return null;

    try {
      return await new Promise((resolve) => {
        const port = chrome.runtime.connect({ name: 'llm-stream' });
        let accumulatedText = '';
        let resultToolCalls: ToolCall[] = [];
        let resultUsage: TokenUsage | undefined;
        let settled = false;

        port.onMessage.addListener((msg) => {
          if (settled) return;

          if (msg.type === 'text') {
            accumulatedText += msg.text;
            onText?.(msg.text);
          } else if (msg.type === 'done') {
            settled = true;
            resultToolCalls = msg.toolCalls || [];
            resultUsage = msg.usage;
            port.disconnect();
            resolve({
              text: msg.text || accumulatedText,
              toolCalls: resultToolCalls,
              usage: resultUsage
            });
          } else if (msg.type === 'error') {
            settled = true;
            port.disconnect();
            resolve(null);
          }
        });

        port.postMessage({
          type: 'start',
          provider, apiKey, model, messages, tools
        });

        // Timeout safety
        setTimeout(() => {
          if (!settled) {
            settled = true;
            port.disconnect();
            resolve(null);
          }
        }, 60000);
      });
    } catch {
      // Fallback to non-streaming
      return this.callLLM(provider, apiKey, model, messages, tools);
    }
  }

  private async executeToolWithTimeout(tc: ToolCall): Promise<ToolResult> {
    const timeoutPromise = new Promise<ToolResult>((_, reject) =>
      setTimeout(() => reject(new Error('Tool execution timed out')), TOOL_TIMEOUT)
    );

    try {
      const result = await Promise.race([
        this.executeTool(tc),
        timeoutPromise
      ]);
      return result;
    } catch (err: any) {
      return {
        toolCallId: tc.id,
        name: tc.name,
        success: false,
        output: '',
        error: err.message || String(err)
      };
    }
  }

  private async executeTool(tc: ToolCall): Promise<ToolResult> {
    const editorStore = useEditorStore.getState();

    switch (tc.name) {
      case 'read_active_file': {
        const context = await editorStore.fetchContext();
        return {
          toolCallId: tc.id,
          name: tc.name,
          success: !!context,
          output: context ? JSON.stringify(context) : 'No active editor'
        };
      }

      case 'write_file': {
        const code = tc.arguments?.code as string;
        if (!code) {
          return { toolCallId: tc.id, name: tc.name, success: false, output: '', error: 'Missing code argument' };
        }
        await editorStore.setCode(code);
        return {
          toolCallId: tc.id,
          name: tc.name,
          success: true,
          output: `File replaced successfully (${code.length} chars)`
        };
      }

      case 'edit_file': {
        const search = tc.arguments?.search as string;
        const replace = tc.arguments?.replace as string;
        if (!search || replace === undefined) {
          return { toolCallId: tc.id, name: tc.name, success: false, output: '', error: 'Missing search or replace argument' };
        }
        const result = await editorStore.editFile(search, replace);
        return {
          toolCallId: tc.id,
          name: tc.name,
          success: result.success,
          output: result.success
            ? `Applied edit: replaced "${search}" with "${replace}"`
            : '',
          error: result.success ? undefined : (result.error || `Edit failed (${result.matchCount} matches found)`)
        };
      }

      case 'list_open_files': {
        const files = await editorStore.listOpenFiles();
        return {
          toolCallId: tc.id,
          name: tc.name,
          success: true,
          output: JSON.stringify(files)
        };
      }

      case 'read_file_by_name': {
        const filename = tc.arguments?.filename as string;
        if (!filename) {
          return { toolCallId: tc.id, name: tc.name, success: false, output: '', error: 'Missing filename argument' };
        }
        const context = await editorStore.readFileByName(filename);
        return {
          toolCallId: tc.id,
          name: tc.name,
          success: !!context,
          output: context ? JSON.stringify(context) : `File "${filename}" not found`
        };
      }

      default:
        return {
          toolCallId: tc.id,
          name: tc.name,
          success: false,
          output: '',
          error: `Unknown tool: ${tc.name}`
        };
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
