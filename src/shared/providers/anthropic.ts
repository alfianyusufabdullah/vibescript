import type { Provider, ProviderConfig, GenerateRequest, StreamRequest, GenerateResponse } from './types';
import type { ProviderEvent, ToolCall, AgentMessage, ToolDefinition } from '../types';

const ANTHROPIC_API_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4096;
const PERMANENT_HTTP_ERROR_CODES = [400, 401, 403, 404];
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

interface AnthropicContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
  stop_reason: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

interface AnthropicStreamEvent {
  type: string;
  content_block?: AnthropicContentBlock;
  delta?: {
    type: string;
    text?: string;
    thinking?: string;
    partial_json?: string;
    stop_reason?: string;
  };
  usage?: { output_tokens?: number };
  message?: { usage?: { input_tokens?: number } };
}

type AnthropicMessageContent =
  | { type: 'text'; text: string }
  | { type: 'tool_result'; tool_use_id: string | undefined; content: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

interface AnthropicMessage {
  role: string;
  content: string | AnthropicMessageContent[];
}

function toAnthropicTools(tools: ToolDefinition[]): Record<string, unknown>[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

export class AnthropicProvider implements Provider {
  readonly name = 'anthropic';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config?: ProviderConfig) { }

  async generate(req: GenerateRequest, config: ProviderConfig): Promise<GenerateResponse> {
    const response = await this.fetchCompletion(req, config);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API Error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    return this.parseResponse(data);
  }

  private isThinkingCapable(model: string): boolean {
    return /claude-(3-7|opus-4|sonnet-4|haiku-4)/i.test(model);
  }

  async *stream(req: StreamRequest, config: ProviderConfig): AsyncGenerator<ProviderEvent> {
    const systemMsg = req.messages.find((m) => m.role === 'system');
    const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;

    const payload: Record<string, unknown> = {
      model: config.model,
      system: systemMsg?.content || '',
      messages: this.toAnthropicMessages(req.messages),
      max_tokens: maxTokens,
      stream: true,
    };

    if (this.isThinkingCapable(config.model)) {
      payload.thinking = { type: 'adaptive' };
    }

    if (req.tools && req.tools.length > 0) {
      payload.tools = toAnthropicTools(req.tools);
    }

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const isPermanent = PERMANENT_HTTP_ERROR_CODES.includes(response.status);
      yield { type: 'error', error: `Anthropic API Error: ${response.status} - ${errorText}`, retriable: !isPermanent };
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';
    const toolCalls: ToolCall[] = [];
    let currentToolCall: { id?: string; name?: string; arguments: string; index: number } | null = null;
    let toolCallIndex = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let inThinkingBlock = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);
        if (jsonStr === '[DONE]') continue;
        try {
          const rawEvent = JSON.parse(jsonStr) as AnthropicStreamEvent;
          const eventType = rawEvent.type as string;

          switch (eventType) {
            case 'content_block_start': {
              const block = rawEvent.content_block;
              if (!block) break;
              if (block.type === 'thinking') {
                inThinkingBlock = true;
              } else if (block.type === 'text') {
                inThinkingBlock = false;
              } else if (block.type === 'tool_use') {
                inThinkingBlock = false;
                yield { type: 'tool_call_start', index: toolCallIndex, id: block.id ?? '', name: block.name ?? '' };
                currentToolCall = {
                  id: block.id,
                  name: block.name,
                  arguments: block.input ? JSON.stringify(block.input) : '',
                  index: toolCallIndex,
                };
                toolCallIndex++;
              }
              break;
            }
            case 'content_block_delta': {
              const delta = rawEvent.delta;
              if (!delta) break;
              if (delta.type === 'thinking_delta' && delta.thinking) {
                yield { type: 'reasoning_delta', delta: delta.thinking };
              } else if (delta.type === 'text_delta') {
                accumulatedText += delta.text ?? '';
                yield { type: 'text_delta', delta: delta.text ?? '' };
              } else if (delta.type === 'input_json_delta') {
                if (currentToolCall) {
                  currentToolCall.arguments += delta.partial_json ?? '';
                  yield { type: 'tool_call_delta', index: currentToolCall.index, delta: delta.partial_json ?? '' };
                }
              }
              break;
            }
            case 'content_block_stop': {
              if (inThinkingBlock) {
                inThinkingBlock = false;
              } else if (currentToolCall) {
                yield { type: 'tool_call_stop', index: currentToolCall.index };
                try {
                  toolCalls.push({
                    id: currentToolCall.id || '',
                    name: currentToolCall.name || '',
                    arguments: JSON.parse(currentToolCall.arguments),
                  });
                } catch {
                  console.warn(
                    `[VibeScript] Failed to parse tool call arguments for "${currentToolCall.name}". Raw: ${currentToolCall.arguments.slice(0, 100)}`
                  );
                  toolCalls.push({
                    id: currentToolCall.id || '',
                    name: currentToolCall.name || '',
                    arguments: {},
                  });
                }
                currentToolCall = null;
              }
              break;
            }
            case 'message_delta': {
              if (rawEvent.usage) {
                outputTokens = rawEvent.usage.output_tokens ?? 0;
              }
              if (rawEvent.delta?.stop_reason === 'end_turn' || rawEvent.delta?.stop_reason === 'stop') {
                // message completed
              }
              break;
            }
            case 'message_start': {
              if (rawEvent.message?.usage) {
                inputTokens = rawEvent.message.usage.input_tokens ?? 0;
              }
              break;
            }
          }
        } catch {
          // skip malformed JSON
        }
      }
    }

    const usage = { promptTokens: inputTokens, completionTokens: outputTokens, totalTokens: inputTokens + outputTokens };
    yield { type: 'usage', usage };
    const finishReason = toolCalls.length > 0 ? 'tool_calls' : 'stop';
    yield { type: 'done', finishReason, text: accumulatedText, toolCalls, usage };
  }

  private async fetchCompletion(req: GenerateRequest, config: ProviderConfig): Promise<Response> {
    const systemMsg = req.messages.find((m) => m.role === 'system');
    const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;

    const payload: Record<string, unknown> = {
      model: config.model,
      system: systemMsg?.content || '',
      messages: this.toAnthropicMessages(req.messages),
      max_tokens: maxTokens,
    };

    if (req.tools && req.tools.length > 0) {
      payload.tools = toAnthropicTools(req.tools);
    }

    return fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(payload),
    });
  }

  private parseResponse(data: AnthropicResponse): GenerateResponse {
    const content = data.content || [];
    const text = content.find((b) => b.type === 'text')?.text || '';
    const toolUseBlocks = content.filter((b) => b.type === 'tool_use');
    const stopReason = data.stop_reason || 'end_turn';
    const raw = data.usage;

    return {
      text,
      toolCalls: toolUseBlocks.map((tb) => ({
        id: tb.id || '',
        name: tb.name || '',
        arguments: tb.input || {},
      })),
      finishReason:
        stopReason === 'tool_use' ? 'tool_calls' :
        stopReason === 'end_turn' ? 'stop' :
        stopReason === 'max_tokens' ? 'length' :
        'error',
      usage: raw
        ? {
            promptTokens: raw.input_tokens ?? 0,
            completionTokens: raw.output_tokens ?? 0,
            totalTokens: (raw.input_tokens ?? 0) + (raw.output_tokens ?? 0),
          }
        : undefined,
    };
  }

  private toAnthropicMessages(messages: AgentMessage[]): AnthropicMessage[] {
    const result: AnthropicMessage[] = [];
    for (const msg of messages) {
      if (msg.role === 'system') continue;
      if (msg.role === 'tool') {
        result.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: msg.tool_call_id, content: msg.content }],
        });
      } else if (msg.role === 'assistant') {
        const content: AnthropicMessageContent[] = [];
        if (msg.content) content.push({ type: 'text', text: msg.content });
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.function.arguments);
            } catch {
              // ignore
            }
            content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input: args });
          }
        }
        result.push({ role: 'assistant', content });
      } else {
        result.push({ role: 'user', content: msg.content });
      }
    }
    return result;
  }
}
