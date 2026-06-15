import type { Provider, ProviderConfig, GenerateRequest, StreamRequest, GenerateResponse } from './types';
import type { ProviderEvent, ToolCall, AgentMessage, ToolDefinition } from '../types';

const DEFAULT_TEMPERATURE = 0.1;
const PERMANENT_HTTP_ERROR_CODES = [400, 401, 403, 404];
const SSE_READ_TIMEOUT = 30_000;
const BASE_URL = 'https://api.deepseek.com';

interface DeepSeekToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface DeepSeekResponse {
  choices?: Array<{
    message?: {
      content?: string;
      reasoning_content?: string;
      tool_calls?: DeepSeekToolCall[];
    };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

interface DeepSeekStreamEvent {
  choices?: Array<{
    delta?: {
      content?: string;
      reasoning_content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

function toDeepSeekTools(tools: ToolDefinition[]): Record<string, unknown>[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

async function readWithTimeout(reader: ReadableStreamDefaultReader<Uint8Array>, ms: number): Promise<ReadableStreamReadResult<Uint8Array>> {
  const result = await Promise.race([
    reader.read(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`SSE read timed out after ${ms}ms`)), ms)
    ),
  ]);
  return result as ReadableStreamReadResult<Uint8Array>;
}

export class DeepSeekProvider implements Provider {
  readonly name = 'deepseek';

  async generate(req: GenerateRequest, config: ProviderConfig): Promise<GenerateResponse> {
    const response = await this.fetchCompletion(req, config);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API Error: ${response.status} - ${errorText}`);
    }
    const data = await response.json() as DeepSeekResponse;
    return this.parseResponse(data);
  }

  async *stream(req: StreamRequest, config: ProviderConfig): AsyncGenerator<ProviderEvent> {
    const url = `${BASE_URL}/chat/completions`;
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
      payload.tools = toDeepSeekTools(req.tools);
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
      yield { type: 'error', error: `DeepSeek API Error: ${response.status} - ${errorText}`, retriable: !isPermanent };
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';
    let accumulatedReasoning = '';
    let rawFinishReason = '';
    const accumulatedToolCalls: Record<number, { id?: string; name?: string; arguments: string }> = {};
    let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;

    while (true) {
      const { done, value } = await readWithTimeout(reader, SSE_READ_TIMEOUT);
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
          const parsed = JSON.parse(json) as DeepSeekStreamEvent;
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.reasoning_content) {
            accumulatedReasoning += delta.reasoning_content;
            yield { type: 'reasoning_delta', delta: delta.reasoning_content };
          }
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
              const hasId = !!tc.id;
              const hasName = !!tc.function?.name;
              if ((hasId || hasName) && !accumulatedToolCalls[idx].name) {
                if (tc.id) accumulatedToolCalls[idx].id = tc.id;
                if (tc.function?.name) accumulatedToolCalls[idx].name = tc.function.name;
                yield { type: 'tool_call_start', index: idx, id: accumulatedToolCalls[idx].id || '', name: accumulatedToolCalls[idx].name || '' };
              }
              if (tc.id) {
                accumulatedToolCalls[idx].id = tc.id;
              }
              if (tc.function?.name) {
                accumulatedToolCalls[idx].name = tc.function.name;
              }
              if (tc.function?.arguments) {
                accumulatedToolCalls[idx].arguments += tc.function.arguments;
                yield { type: 'tool_call_delta', index: idx, delta: tc.function.arguments };
              }
            }
          }
          const chunkFinishReason = parsed.choices?.[0]?.finish_reason;
          if (chunkFinishReason) rawFinishReason = chunkFinishReason;
          if (chunkFinishReason === 'tool_calls') {
            for (const idx of Object.keys(accumulatedToolCalls)) {
              if (accumulatedToolCalls[Number(idx)]?.name) {
                yield { type: 'tool_call_stop', index: Number(idx) };
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

    // DeepSeek-specific: insufficient_system_resource means server ran out of capacity
    let finishReason: import('../types').FinishReason = toolCalls.length > 0 ? 'tool_calls' : 'stop';
    if (/insufficient_system_resource/i.test(rawFinishReason)) {
      yield { type: 'error', error: 'DeepSeek: insufficient system resource — try again', retriable: true };
      finishReason = 'error';
    }
    yield { type: 'done', finishReason, text: accumulatedText, toolCalls, usage, reasoningText: accumulatedReasoning || undefined };
  }

  private async fetchCompletion(req: GenerateRequest, config: ProviderConfig): Promise<Response> {
    const url = `${BASE_URL}/chat/completions`;
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
      payload.tools = toDeepSeekTools(req.tools);
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

  private parseResponse(data: DeepSeekResponse): GenerateResponse {
    const choice = data.choices?.[0];
    const message = choice?.message;
    const text = message?.content || '';
    const rawToolCalls: DeepSeekToolCall[] = message?.tool_calls || [];
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
      finishReason:
        finishReason === 'tool_calls' ? 'tool_calls' :
        finishReason === 'stop' ? 'stop' :
        finishReason === 'length' ? 'length' :
        /insufficient_system_resource/i.test(finishReason) ? 'error' :
        'stop',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
          }
        : undefined,
    };
  }

  // DeepSeek-specific: assistant messages must carry reasoning_content
  // back to the API in all subsequent turns when tool calls were made.
  private toMessagePayload(m: AgentMessage): Record<string, unknown> | null {
    if (m.role === 'tool') {
      return { role: 'tool', content: m.content, tool_call_id: m.tool_call_id };
    }
    if (m.role === 'assistant') {
      const msg: Record<string, unknown> = { role: 'assistant', content: m.content };
      if (m.tool_calls) msg.tool_calls = m.tool_calls;
      if (m.reasoning_content) msg.reasoning_content = m.reasoning_content;
      return msg;
    }
    return { role: m.role, content: m.content };
  }

}
