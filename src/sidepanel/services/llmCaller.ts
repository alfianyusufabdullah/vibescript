import type { ToolDefinition, ToolCall, AgentMessage, AgentStep, TokenUsage } from '../../shared/types';
import type { Provider } from '../../shared/providers/types';
import { toolRegistry } from '../../shared/toolRegistry';

const MAX_RETRIES = 3;

export interface LLMCallResult {
  text: string;
  toolCalls: ToolCall[];
  usage?: TokenUsage;
}

export interface LLMCallError {
  error: string;
  retriable: boolean;
}

export function isLLMCallError(v: LLMCallResult | LLMCallError): v is LLMCallError {
  return 'error' in v && !('text' in v);
}

export async function callLLMStreaming(
  provider: Provider,
  model: string,
  messages: AgentMessage[],
  tools: ToolDefinition[],
  apiKey: string,
  onText?: (text: string) => void,
  onReasoning?: (text: string) => void,
  isCancelled?: () => boolean
): Promise<LLMCallResult | LLMCallError> {
  try {
    const gen = provider.stream({ model, messages, tools }, { apiKey, model });

    let accumulatedText = '';
    let resultToolCalls: ToolCall[] = [];
    let resultUsage: TokenUsage | undefined;

    for await (const event of gen) {
      if (isCancelled?.()) break;
      switch (event.type) {
        case 'text_delta':
          accumulatedText += event.delta;
          onText?.(event.delta);
          break;
        case 'reasoning_delta':
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg, retriable: true };
  }
}

export async function callLLMWithRetry(
  provider: Provider,
  model: string,
  messages: AgentMessage[],
  allowedTools: string[] | undefined,
  apiKey: string,
  callbacks: {
    onError: (msg: string) => void;
    onStep: (step: AgentStep) => void;
    onStreamingText?: (text: string) => void;
    onReasoning?: (text: string) => void;
    onResetStreaming?: () => void;
  },
  isCancelled: () => boolean,
  onReasoningReset: () => void
): Promise<LLMCallResult | null> {
  const tools = toolRegistry.getAll(allowedTools);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (isCancelled()) return null;

    if (attempt > 0) {
      onReasoningReset();
      callbacks.onResetStreaming?.();
    }

    const streamText = attempt === 0 ? callbacks.onStreamingText : undefined;
    const streamReasoning = attempt === 0 ? callbacks.onReasoning : undefined;

    const result = await callLLMStreaming(provider, model, messages, tools, apiKey, streamText, streamReasoning, isCancelled);

    if (!isLLMCallError(result)) {
      // Empty response (no text, no tool calls) — rare with thinking models when the
      // thinking budget consumes available token capacity. Retry bare after a delay.
      if (!result.text && result.toolCalls.length === 0 && attempt < MAX_RETRIES - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
        continue;
      }
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

    await new Promise<void>((resolve) => {
      const POLL_INTERVAL_MS = 50;
      const POLL_CLEANUP_BUFFER_MS = 100;
      const timer = setTimeout(resolve, delay);
      const poll = setInterval(() => {
        if (isCancelled()) {
          clearTimeout(timer);
          clearInterval(poll);
          resolve();
        }
      }, POLL_INTERVAL_MS);
      setTimeout(() => clearInterval(poll), delay + POLL_CLEANUP_BUFFER_MS);
    });
  }
  return null;
}
