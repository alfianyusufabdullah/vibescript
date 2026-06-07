import type { Provider, ProviderConfig, GenerateRequest, StreamRequest, GenerateResponse } from './types';
import type { ProviderEvent, ToolCall, AgentMessage, ToolDefinition } from '../types';

const DEFAULT_TEMPERATURE = 0.3;
const PERMANENT_HTTP_ERROR_CODES = [400, 401, 403, 404];

interface OpenAIToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

interface OpenAIStreamEvent {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

function toOpenAITools(tools: ToolDefinition[]): Record<string, unknown>[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export class OpenAIProvider implements Provider {
  readonly name = 'openai';
  private baseUrl: string;

  constructor(config?: ProviderConfig) {
    this.baseUrl = config?.baseUrl || 'https://api.openai.com/v1';
  }

  async generate(req: GenerateRequest, config: ProviderConfig): Promise<GenerateResponse> {
    const response = await this.fetchCompletion(req, config);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    return this.parseResponse(data);
  }

  async *stream(req: StreamRequest, config: ProviderConfig): AsyncGenerator<ProviderEvent> {
    const url = `${this.baseUrl}/chat/completions`;
    const systemMsg = req.messages.find((m) => m.role === 'system');

    const payload: Record<string, unknown> = {
      model: config.model,
      messages: [
        ...(systemMsg ? [] : [{ role: 'system' as const, content: '' }]),
        ...req.messages.map((m) => this.toMessagePayload(m)).filter(Boolean),
      ],
      temperature: config.temperature ?? DEFAULT_TEMPERATURE,
      stream: true,
      stream_options: { include_usage: true },
    };

    if (req.tools && req.tools.length > 0) {
      payload.tools = toOpenAITools(req.tools);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const isPermanent = PERMANENT_HTTP_ERROR_CODES.includes(response.status);
      yield { type: 'error', error: `OpenAI API Error: ${response.status} - ${errorText}`, retriable: !isPermanent };
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';
    const accumulatedToolCalls: Record<number, { id?: string; name?: string; arguments: string }> = {};
    let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const json = trimmed.slice(6);
        if (json === '[DONE]') continue;
        try {
          const parsed = JSON.parse(json) as OpenAIStreamEvent;
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            accumulatedText += delta.content;
            yield { type: 'text_delta', delta: delta.content };
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index as number;
              if (!accumulatedToolCalls[idx]) {
                accumulatedToolCalls[idx] = { arguments: '' };
              }
              if (tc.id) {
                accumulatedToolCalls[idx].id = tc.id;
              }
              if (tc.function?.name) {
                accumulatedToolCalls[idx].name = tc.function.name;
              }
              if (tc.function?.arguments) {
                accumulatedToolCalls[idx].arguments += tc.function.arguments;
              }
            }
          }
          if (parsed.usage) {
            usage = {
              promptTokens: parsed.usage.prompt_tokens ?? 0,
              completionTokens: parsed.usage.completion_tokens ?? 0,
              totalTokens: parsed.usage.total_tokens ?? 0,
            };
            yield { type: 'usage', usage };
          }
        } catch {
          // skip malformed JSON
        }
      }
    }

    const toolCalls: ToolCall[] = Object.values(accumulatedToolCalls)
      .filter((tc) => tc.name)
      .map((tc) => ({
        id: tc.id || '',
        name: tc.name || '',
        arguments: (() => {
          try {
            return JSON.parse(tc.arguments);
          } catch {
            return {};
          }
        })(),
      }));

    const finishReason = toolCalls.length > 0 ? 'tool_calls' : 'stop';
    yield { type: 'done', finishReason, text: accumulatedText, toolCalls, usage };
  }

  private async fetchCompletion(req: GenerateRequest, config: ProviderConfig): Promise<Response> {
    const url = `${this.baseUrl}/chat/completions`;
    const systemMsg = req.messages.find((m) => m.role === 'system');

    const payload: Record<string, unknown> = {
      model: config.model,
      messages: [
        ...(systemMsg ? [] : [{ role: 'system' as const, content: '' }]),
        ...req.messages.map((m) => this.toMessagePayload(m)).filter(Boolean),
      ],
      temperature: config.temperature ?? DEFAULT_TEMPERATURE,
    };

    if (req.tools && req.tools.length > 0) {
      payload.tools = toOpenAITools(req.tools);
    }

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  }

  private parseResponse(data: OpenAIResponse): GenerateResponse {
    const choice = data.choices?.[0];
    const message = choice?.message;
    const text = message?.content || '';
    const rawToolCalls: OpenAIToolCall[] = message?.tool_calls || [];
    const finishReason = choice?.finish_reason || 'stop';

    return {
      text,
      toolCalls: rawToolCalls.map((tc) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          // ignore
        }
        return { id: tc.id, name: tc.function.name, arguments: args };
      }),
      finishReason: finishReason === 'tool_calls' ? 'tool_calls' : finishReason === 'length' ? 'length' : 'stop',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
          }
        : undefined,
    };
  }

  private toMessagePayload(m: AgentMessage): Record<string, unknown> | null {
    if (m.role === 'tool') {
      return { role: 'tool', content: m.content, tool_call_id: m.tool_call_id };
    }
    if (m.role === 'assistant') {
      const msg: Record<string, unknown> = { role: 'assistant', content: m.content };
      if (m.tool_calls) msg.tool_calls = m.tool_calls;
      return msg;
    }
    return { role: m.role, content: m.content };
  }
}
