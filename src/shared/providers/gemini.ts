/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Provider, ProviderConfig, GenerateRequest, StreamRequest, GenerateResponse } from './types';
import type { ProviderEvent, ToolCall, AgentMessage } from '../types';

export class GeminiProvider implements Provider {
  readonly name = 'gemini';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config?: ProviderConfig) {}

  async generate(req: GenerateRequest, config: ProviderConfig): Promise<GenerateResponse> {
    const url = this.buildUrl(config.model, config.apiKey);
    const systemMsg = req.messages.find((m) => m.role === 'system');

    const payload: Record<string, unknown> = {
      contents: this.toGeminiContents(req.messages),
      systemInstruction: { parts: [{ text: systemMsg?.content || '' }] },
      generationConfig: { temperature: config.temperature ?? 0.3, maxOutputTokens: config.maxTokens ?? 8192 },
    };

    if (req.tools && req.tools.length > 0) {
      payload.tools = [{
        functionDeclarations: req.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      }];
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

  async *stream(req: StreamRequest, config: ProviderConfig): AsyncGenerator<ProviderEvent> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`;
    const systemMsg = req.messages.find((m) => m.role === 'system');

    const payload: Record<string, unknown> = {
      contents: this.toGeminiContents(req.messages),
      systemInstruction: { parts: [{ text: systemMsg?.content || '' }] },
      generationConfig: { temperature: config.temperature ?? 0.3, maxOutputTokens: config.maxTokens ?? 8192 },
    };

    if (req.tools && req.tools.length > 0) {
      payload.tools = [{
        functionDeclarations: req.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      }];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const isPermanent = /\b(401|400|403|404)\b/.test(String(response.status));
      yield { type: 'error', error: `Gemini API Error: ${response.status} - ${errorText}`, retriable: !isPermanent };
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';
    const toolCalls: ToolCall[] = [];
    let fcIndex = 0;
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
        try {
          const parsed = JSON.parse(json) as any;
          const parts = parsed.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.text) {
              accumulatedText += part.text;
              yield { type: 'text_delta', delta: part.text };
            }
            if (part.functionCall) {
              const fc = part.functionCall;
              toolCalls.push({
                id: `fc_${fcIndex++}`,
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

  private parseResponse(data: any): GenerateResponse {
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const text = parts.find((p: any) => p.text)?.text || '';
    const functionCalls = parts.filter((p: any) => p.functionCall);
    const raw = data.usageMetadata;

    return {
      text,
      toolCalls: functionCalls.map((fc: any, i: number) => ({
        id: `fc_${i}`,
        name: fc.functionCall.name,
        arguments: fc.functionCall.args || {},
      })),
      finishReason: functionCalls.length > 0 ? 'tool_calls' : candidate?.finishReason === 'STOP' ? 'stop' : candidate?.finishReason === 'MAX_TOKENS' ? 'length' : 'error',
      usage: raw
        ? {
            promptTokens: raw.promptTokenCount ?? 0,
            completionTokens: raw.candidatesTokenCount ?? 0,
            totalTokens: raw.totalTokenCount ?? 0,
          }
        : undefined,
    };
  }

  private toGeminiContents(messages: AgentMessage[]): any[] {
    const contents: any[] = [];
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
        const parts: any[] = [];
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
