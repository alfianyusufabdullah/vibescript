import type { AgentMessage, Provider as ProviderName } from '../../shared/types';
import type { Provider } from '../../shared/providers/types';

const CONTEXT_WARN_RATIO = 0.7;
const CONTEXT_CRITICAL_RATIO = 0.85;
const CONTEXT_KEEP_MESSAGES = 20;

const SUMMARIZATION_MODELS: Partial<Record<ProviderName, string>> = {
  anthropic: 'claude-3-5-haiku-latest',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
};

export { CONTEXT_WARN_RATIO, CONTEXT_CRITICAL_RATIO };

export async function ensureContext(
  messages: AgentMessage[],
  lastPromptTokens: number,
  contextWindow: number,
  provider: Provider | null,
  providerName: ProviderName | null,
  currentModel: string,
  currentApiKey: string
): Promise<void> {
  const threshold = Math.floor(contextWindow * CONTEXT_WARN_RATIO);
  if (lastPromptTokens < threshold) return;

  const critical = lastPromptTokens >= Math.floor(contextWindow * CONTEXT_CRITICAL_RATIO);

  const summarized =
    !critical &&
    provider !== null &&
    (await trySummarize(messages, provider, providerName, currentModel, currentApiKey));
  if (summarized) {
    return;
  }

  // Sliding window: keep last CONTEXT_KEEP_MESSAGES non-system messages
  const systemMsg = messages.find((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  if (nonSystem.length > CONTEXT_KEEP_MESSAGES) {
    const kept = nonSystem.slice(-CONTEXT_KEEP_MESSAGES);
    messages.splice(0, messages.length);
    if (systemMsg) {
      messages.push(systemMsg);
    }
    messages.push(...kept);
  }
}

async function trySummarize(
  messages: AgentMessage[],
  provider: Provider,
  providerName: ProviderName | null,
  currentModel: string,
  currentApiKey: string
): Promise<boolean> {
  const assistantIndices = messages
    .map((m, i) => (m.role === 'assistant' ? i : -1))
    .filter((i) => i !== -1);

  if (assistantIndices.length <= 3) return false;

  const summarizeUpTo = assistantIndices[assistantIndices.length - 3];
  const toSummarize = messages.slice(0, summarizeUpTo + 1);
  const cheapModel = (providerName && SUMMARIZATION_MODELS[providerName]) || currentModel;

  try {
    const summaryMessages: AgentMessage[] = [
      {
        role: 'system',
        content:
          'You compact the history of a Google Apps Script coding session so the agent can keep working without the full transcript. Preserve what is needed to resume; drop pleasantries.',
      },
      ...toSummarize,
      {
        role: 'user',
        content:
          "Summarize the conversation so far in one tight paragraph: the user's goal, decisions made, the files and functions touched, what was completed, and what remains. Keep concrete names verbatim.",
      },
    ];

    const gen = provider.stream(
      { model: cheapModel, messages: summaryMessages },
      { apiKey: currentApiKey, model: cheapModel }
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
      const hasSystem = messages[0]?.role === 'system';
      const spliceStart = hasSystem ? 1 : 0;
      const spliceCount = summarizeUpTo + 1 - spliceStart;
      if (spliceCount > 0) {
        messages.splice(spliceStart, spliceCount);
      }
      messages.splice(spliceStart, 0, {
        role: 'user',
        content: `[Conversation Summary] ${resultText}`,
      });
      return true;
    }
  } catch {
    // fall back to truncation
  }
  return false;
}
