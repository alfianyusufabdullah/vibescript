import type { Provider } from './types';
import type { ToolDefinition, LLMResponse, AgentMessage, TokenUsage, ToolCall } from './types';
import { SYSTEM_PROMPT } from './constants';

export async function callLLM(
  provider: Provider,
  apiKey: string,
  model: string,
  messages: AgentMessage[],
  tools?: ToolDefinition[]
): Promise<LLMResponse> {
  if (!apiKey) {
    throw new Error(`API Key for ${provider.toUpperCase()} is not set. Please set it in the Settings tab.`);
  }

  switch (provider) {
    case 'openai':
      return callOpenAI(apiKey, model, messages, tools);
    case 'deepseek':
      return callDeepSeek(apiKey, model, messages, tools);
    case 'anthropic':
      return callAnthropic(apiKey, model, messages, tools);
    case 'gemini':
      return callGemini(apiKey, model, messages, tools);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// ── Tool Format Converters ────────────────────────────────────────────

function formatToolsOpenAI(tools: ToolDefinition[]) {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }));
}

function formatToolsAnthropic(tools: ToolDefinition[]) {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters
  }));
}

function formatToolsGemini(tools: ToolDefinition[]) {
  return {
    functionDeclarations: tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }))
  };
}

// ── Response Parsers ──────────────────────────────────────────────────

function parseOpenAIResponse(data: any): LLMResponse {
  const choice = data.choices?.[0];
  const message = choice?.message;
  const text = message?.content || '';
  const toolCalls: any[] = message?.tool_calls || [];
  const finishReason = choice?.finish_reason || 'stop';
  const raw = data.usage;

  return {
    text,
    toolCalls: toolCalls.map((tc: any) => {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
      return { id: tc.id, name: tc.function.name, arguments: args };
    }),
    finishReason: finishReason === 'tool_calls' ? 'tool_calls'
      : finishReason === 'length' ? 'length'
      : 'stop',
    usage: raw ? {
      promptTokens: raw.prompt_tokens ?? 0,
      completionTokens: raw.completion_tokens ?? 0,
      totalTokens: raw.total_tokens ?? 0
    } : undefined
  };
}

function parseAnthropicResponse(data: any): LLMResponse {
  const content = data.content || [];
  const text = content.find((b: any) => b.type === 'text')?.text || '';
  const toolUseBlocks = content.filter((b: any) => b.type === 'tool_use');
  const stopReason = data.stop_reason || 'end_turn';
  const raw = data.usage;

  return {
    text,
    toolCalls: toolUseBlocks.map((tb: any) => ({
      id: tb.id,
      name: tb.name,
      arguments: tb.input || {}
    })),
    finishReason: stopReason === 'tool_use' ? 'tool_calls'
      : stopReason === 'end_turn' ? 'stop'
      : stopReason === 'max_tokens' ? 'length'
      : 'error',
    usage: raw ? {
      promptTokens: raw.input_tokens ?? 0,
      completionTokens: raw.output_tokens ?? 0,
      totalTokens: (raw.input_tokens ?? 0) + (raw.output_tokens ?? 0)
    } : undefined
  };
}

function parseGeminiResponse(data: any): LLMResponse {
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
      arguments: fc.functionCall.args || {}
    })),
    finishReason: functionCalls.length > 0 ? 'tool_calls'
      : candidate?.finishReason === 'STOP' ? 'stop'
      : candidate?.finishReason === 'MAX_TOKENS' ? 'length'
      : 'error',
    usage: raw ? {
      promptTokens: raw.promptTokenCount ?? 0,
      completionTokens: raw.candidatesTokenCount ?? 0,
      totalTokens: raw.totalTokenCount ?? 0
    } : undefined
  };
}

// ── Anthropic Message Converter ───────────────────────────────────────

function toAnthropicMessages(messages: AgentMessage[]): any[] {
  const result: any[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') continue;

    if (msg.role === 'tool') {
      result.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: msg.tool_call_id,
          content: msg.content
        }]
      });
    } else if (msg.role === 'assistant') {
      const content: any[] = [];
      if (msg.content) content.push({ type: 'text', text: msg.content });
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
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

// ── Gemini Message Converter ──────────────────────────────────────────

function toGeminiContents(messages: AgentMessage[]): any[] {
  const contents: any[] = [];
  const toolCallMap = new Map<string, string>();

  for (const msg of messages) {
    if (msg.role === 'system') continue;

    if (msg.role === 'tool') {
      const funcName = toolCallMap.get(msg.tool_call_id || '') || 'unknown';
      contents.push({
        role: 'function',
        parts: [{
          functionResponse: {
            name: funcName,
            response: { output: msg.content }
          }
        }]
      });
    } else if (msg.role === 'assistant') {
      const parts: any[] = [];
      if (msg.content) parts.push({ text: msg.content });
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          toolCallMap.set(tc.id, tc.function.name);
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
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

// ── Provider-specific callers ─────────────────────────────────────────

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: AgentMessage[],
  tools?: ToolDefinition[],
  baseUrl = 'https://api.openai.com/v1'
): Promise<LLMResponse> {
  const url = `${baseUrl}/chat/completions`;

  const hasSystem = messages.some((m: AgentMessage) => m.role === 'system');

  const payload: Record<string, any> = {
    model,
    messages: [
      ...(hasSystem ? [] : [{ role: 'system' as const, content: SYSTEM_PROMPT }]),
      ...messages.map(m => {
        if (m.role === 'system') return null;
        if (m.role === 'tool') {
          return { role: 'tool', content: m.content, tool_call_id: m.tool_call_id };
        }
        if (m.role === 'assistant') {
          const msg: Record<string, any> = { role: 'assistant', content: m.content };
          if (m.tool_calls) msg.tool_calls = m.tool_calls;
          return msg;
        }
        return { role: m.role, content: m.content };
      }).filter(Boolean)
    ],
    temperature: 0.3
  };

  if (tools && tools.length > 0) {
    payload.tools = formatToolsOpenAI(tools);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return parseOpenAIResponse(data);
}

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: AgentMessage[],
  tools?: ToolDefinition[]
): Promise<LLMResponse> {
  const url = 'https://api.anthropic.com/v1/messages';

  const systemMsg = messages.find((m: AgentMessage) => m.role === 'system');

  const payload: Record<string, any> = {
    model,
    system: systemMsg ? systemMsg.content : SYSTEM_PROMPT,
    messages: toAnthropicMessages(messages),
    max_tokens: 4096
  };

  if (tools && tools.length > 0) {
    payload.tools = formatToolsAnthropic(tools);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return parseAnthropicResponse(data);
}

async function callGemini(
  apiKey: string,
  model: string,
  messages: AgentMessage[],
  tools?: ToolDefinition[]
): Promise<LLMResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemMsg = messages.find((m: AgentMessage) => m.role === 'system');

  const payload: Record<string, any> = {
    contents: toGeminiContents(messages.filter(m => m.role !== 'system')),
    systemInstruction: { parts: [{ text: systemMsg ? systemMsg.content : SYSTEM_PROMPT }] },
    generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
  };

  if (tools && tools.length > 0) {
    payload.tools = formatToolsGemini(tools);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return parseGeminiResponse(data);
}

async function callDeepSeek(
  apiKey: string,
  model: string,
  messages: AgentMessage[],
  tools?: ToolDefinition[]
): Promise<LLMResponse> {
  return callOpenAI(apiKey, model, messages, tools, 'https://api.deepseek.com');
}

// ── Streaming ────────────────────────────────────────────────────────────────

export interface LLMStreamCallbacks {
  onText: (text: string) => void;
  onDone: (text: string, toolCalls: ToolCall[], usage?: TokenUsage) => void;
  onError: (error: string) => void;
}

export async function callLLMStream(
  provider: Provider,
  apiKey: string,
  model: string,
  messages: AgentMessage[],
  tools: ToolDefinition[] | undefined,
  callbacks: LLMStreamCallbacks
): Promise<void> {
  switch (provider) {
    case 'openai':
      return callOpenAIStream(apiKey, model, messages, tools, callbacks);
    case 'deepseek':
      return callOpenAIStream(apiKey, model, messages, tools, callbacks, 'https://api.deepseek.com');
    case 'anthropic':
      return callAnthropicStream(apiKey, model, messages, tools, callbacks);
    case 'gemini':
      return callGeminiStream(apiKey, model, messages, tools, callbacks);
  }
}

async function callOpenAIStream(
  apiKey: string,
  model: string,
  messages: AgentMessage[],
  tools: ToolDefinition[] | undefined,
  callbacks: LLMStreamCallbacks,
  baseUrl = 'https://api.openai.com/v1'
): Promise<void> {
  const url = `${baseUrl}/chat/completions`;
  const hasSystem = messages.some((m: AgentMessage) => m.role === 'system');

  const payload: Record<string, any> = {
    model,
    messages: [
      ...(hasSystem ? [] : [{ role: 'system' as const, content: SYSTEM_PROMPT }]),
      ...messages.map(m => {
        if (m.role === 'system') return null;
        if (m.role === 'tool') return { role: 'tool', content: m.content, tool_call_id: m.tool_call_id };
        if (m.role === 'assistant') {
          const msg: Record<string, any> = { role: 'assistant', content: m.content };
          if (m.tool_calls) msg.tool_calls = m.tool_calls;
          return msg;
        }
        return { role: m.role, content: m.content };
      }).filter(Boolean)
    ],
    temperature: 0.3,
    stream: true,
    stream_options: { include_usage: true }
  };

  if (tools && tools.length > 0) payload.tools = formatToolsOpenAI(tools);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      callbacks.onError(`OpenAI API Error: ${response.status} - ${errorText}`);
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';
    const toolAcc: Record<number, { id?: string; name?: string; arguments: string }> = {};
    let usage: TokenUsage | undefined;

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
          const parsed = JSON.parse(json);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            accumulatedText += delta.content;
            callbacks.onText(delta.content);
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolAcc[idx]) toolAcc[idx] = { arguments: '' };
              if (tc.id) toolAcc[idx].id = tc.id;
              if (tc.function?.name) toolAcc[idx].name = tc.function.name;
              if (tc.function?.arguments) toolAcc[idx].arguments += tc.function.arguments;
            }
          }
          if (parsed.usage) {
            usage = {
              promptTokens: parsed.usage.prompt_tokens ?? 0,
              completionTokens: parsed.usage.completion_tokens ?? 0,
              totalTokens: parsed.usage.total_tokens ?? 0
            };
          }
        } catch { /* skip */ }
      }
    }

    const toolCalls: ToolCall[] = Object.values(toolAcc)
      .filter(tc => tc.name)
      .map(tc => ({
        id: tc.id || '',
        name: tc.name || '',
        arguments: (() => { try { return JSON.parse(tc.arguments); } catch { return {}; } })()
      }));

    callbacks.onDone(accumulatedText, toolCalls, usage);
  } catch (err: any) {
    callbacks.onError(err.message || String(err));
  }
}

async function callAnthropicStream(
  apiKey: string,
  model: string,
  messages: AgentMessage[],
  tools: ToolDefinition[] | undefined,
  callbacks: LLMStreamCallbacks
): Promise<void> {
  // Fallback: use non-streaming for Anthropic (tool calls in SSE are complex)
  try {
    const result = await callAnthropic(apiKey, model, messages, tools);
    if (result.text) callbacks.onText(result.text);
    callbacks.onDone(result.text, result.toolCalls, result.usage);
  } catch (err: any) {
    callbacks.onError(err.message || String(err));
  }
}

async function callGeminiStream(
  apiKey: string,
  model: string,
  messages: AgentMessage[],
  tools: ToolDefinition[] | undefined,
  callbacks: LLMStreamCallbacks
): Promise<void> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const systemMsg = messages.find((m: AgentMessage) => m.role === 'system');

  const payload: Record<string, any> = {
    contents: toGeminiContents(messages.filter(m => m.role !== 'system')),
    systemInstruction: { parts: [{ text: systemMsg ? systemMsg.content : SYSTEM_PROMPT }] },
    generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
  };

  if (tools && tools.length > 0) {
    payload.tools = formatToolsGemini(tools);
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      callbacks.onError(`Gemini API Error: ${response.status} - ${errorText}`);
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';
    let lastFunctionCalls: ToolCall[] = [];
    let usage: TokenUsage | undefined;

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
          const parsed = JSON.parse(json);
          const parts = parsed.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.text) {
              accumulatedText += part.text;
              callbacks.onText(part.text);
            }
            if (part.functionCall) {
              lastFunctionCalls.push({
                id: `fc_${lastFunctionCalls.length}`,
                name: part.functionCall.name,
                arguments: part.functionCall.args || {}
              });
            }
          }
          if (parsed.usageMetadata) {
            const m = parsed.usageMetadata;
            usage = {
              promptTokens: m.promptTokenCount ?? 0,
              completionTokens: m.candidatesTokenCount ?? 0,
              totalTokens: m.totalTokenCount ?? 0
            };
          }
        } catch { /* skip */ }
      }
    }

    callbacks.onDone(accumulatedText, lastFunctionCalls, usage);
  } catch (err: any) {
    callbacks.onError(err.message || String(err));
  }
}
