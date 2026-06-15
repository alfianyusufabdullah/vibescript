import type { Provider, ProviderConfig, GenerateRequest, StreamRequest, GenerateResponse } from './types';
import type { ProviderEvent, ToolCall, AgentMessage, ToolDefinition } from '../types';

const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;
const THINKING_BUDGET = 8192;
const PERMANENT_HTTP_ERROR_CODES = [400, 401, 403, 404];
const SSE_READ_TIMEOUT = 30_000;

interface GeminiPart {
  text?: string;
  thought?: boolean;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
}

interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts: GeminiPart[] };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

function toGeminiFunctionDeclarations(tools: ToolDefinition[]): Record<string, unknown>[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
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

export class GeminiProvider implements Provider {
  readonly name = 'gemini';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config?: ProviderConfig) { }

  async generate(req: GenerateRequest, config: ProviderConfig): Promise<GenerateResponse> {
    const url = this.buildUrl(config.model, config.apiKey);
    const systemMsg = req.messages.find((m) => m.role === 'system');

    const payload: Record<string, unknown> = {
      contents: this.toGeminiContents(req.messages),
      systemInstruction: { parts: [{ text: systemMsg?.content || '' }] },
      generationConfig: {
        temperature: config.temperature ?? DEFAULT_TEMPERATURE,
        maxOutputTokens: config.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      },
    };

    if (req.tools && req.tools.length > 0) {
      payload.tools = [{ functionDeclarations: toGeminiFunctionDeclarations(req.tools) }];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return this.parseResponse(data);
  }

  private isThinkingCapable(model: string): boolean {
    return /gemini-2\.5/i.test(model);
  }

  async *stream(req: StreamRequest, config: ProviderConfig): AsyncGenerator<ProviderEvent> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`;
    const systemMsg = req.messages.find((m) => m.role === 'system');

    const hasTools = req.tools && req.tools.length > 0;

    const generationConfig: Record<string, unknown> = {
      temperature: config.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: config.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    };

    if (this.isThinkingCapable(config.model)) {
      generationConfig.thinkingConfig = { includeThoughts: true, thinkingBudget: THINKING_BUDGET };
    }

    const payload: Record<string, unknown> = {
      contents: this.toGeminiContents(req.messages),
      systemInstruction: { parts: [{ text: systemMsg?.content || '' }] },
      generationConfig,
    };

    if (hasTools) {
      payload.tools = [{ functionDeclarations: toGeminiFunctionDeclarations(req.tools!) }];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const isPermanent = PERMANENT_HTTP_ERROR_CODES.includes(response.status);
      yield { type: 'error', error: `Gemini API Error: ${response.status} - ${errorText}`, retriable: !isPermanent };
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';
    const toolCalls: ToolCall[] = [];
    let functionCallIndex = 0;
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
        try {
          const parsed = JSON.parse(json) as GeminiResponse;
          const parts = parsed.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.thought === true && part.text) {
              yield { type: 'reasoning_delta', delta: part.text };
            } else if (part.text) {
              accumulatedText += part.text;
              yield { type: 'text_delta', delta: part.text };
            }
            if (part.functionCall) {
              const fc = part.functionCall;
              toolCalls.push({
                id: `fc_${functionCallIndex++}`,
                name: fc.name,
                arguments: fc.args || {},
              });
            }
          }
          if (parsed.usageMetadata) {
            const m = parsed.usageMetadata;
            usage = {
              promptTokens: m.promptTokenCount ?? 0,
              completionTokens: m.candidatesTokenCount ?? 0,
              totalTokens: m.totalTokenCount ?? 0,
            };
            yield { type: 'usage', usage };
          }
        } catch {
          // skip malformed JSON
        }
      }
    }

    const finishReason = toolCalls.length > 0 ? 'tool_calls' : 'stop';
    yield { type: 'done', finishReason, text: accumulatedText, toolCalls, usage };
  }

  private buildUrl(model: string, apiKey: string): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  }

  private parseResponse(data: GeminiResponse): GenerateResponse {
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const text = parts.find((p) => p.text)?.text || '';
    const functionCalls = parts.filter((p) => p.functionCall);
    const raw = data.usageMetadata;

    return {
      text,
      toolCalls: functionCalls.map((fc, i) => ({
        id: `fc_${i}`,
        name: fc.functionCall!.name,
        arguments: fc.functionCall!.args || {},
      })),
      finishReason:
        functionCalls.length > 0 ? 'tool_calls' :
        candidate?.finishReason === 'STOP' ? 'stop' :
        candidate?.finishReason === 'MAX_TOKENS' ? 'length' :
        'error',
      usage: raw
        ? {
            promptTokens: raw.promptTokenCount ?? 0,
            completionTokens: raw.candidatesTokenCount ?? 0,
            totalTokens: raw.totalTokenCount ?? 0,
          }
        : undefined,
    };
  }

  private toGeminiContents(messages: AgentMessage[]): GeminiContent[] {
    const contents: GeminiContent[] = [];
    const toolCallMap = new Map<string, string>();

    for (const msg of messages) {
      if (msg.role === 'system') continue;

      if (msg.role === 'tool') {
        const funcName = toolCallMap.get(msg.tool_call_id || '') || 'unknown';
        contents.push({
          role: 'function',
          parts: [{ functionResponse: { name: funcName, response: { output: msg.content } } }],
        });
      } else if (msg.role === 'assistant') {
        const parts: GeminiPart[] = [];
        if (msg.content) parts.push({ text: msg.content });
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            toolCallMap.set(tc.id, tc.function.name);
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.function.arguments);
            } catch {
              // ignore
            }
            parts.push({ functionCall: { name: tc.function.name, args } });
          }
        }
        contents.push({ role: 'model', parts });
      } else {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
      }
    }
    return contents;
  }
}
