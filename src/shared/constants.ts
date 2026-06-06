import type { Provider } from './types';

export interface ModelInfo {
  id: string;
  name: string;
}

export interface ProviderConfig {
  name: string;
  models: ModelInfo[];
  defaultModel: string;
  contextWindow: number;
  baseUrl?: string;
}

export const PROVIDERS: Record<Provider, ProviderConfig> = {
  gemini: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fast, General)' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Advanced Coding)' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
    ],
    defaultModel: 'gemini-2.5-flash',
    contextWindow: 1_000_000
  },
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o (High Intelligence)' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Cheap)' },
      { id: 'o3-mini', name: 'o3-mini (Reasoning & Coding)' }
    ],
    defaultModel: 'gpt-4o',
    contextWindow: 128_000
  },
  anthropic: {
    name: 'Anthropic',
    models: [
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet (State of the Art Coding)' },
      { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku (Fast Coding)' }
    ],
    defaultModel: 'claude-3-5-sonnet-latest',
    contextWindow: 200_000
  },
  deepseek: {
    name: 'DeepSeek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V3' },
      { id: 'deepseek-coder', name: 'DeepSeek-Coder' },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (Reasoning)' }
    ],
    defaultModel: 'deepseek-chat',
    contextWindow: 64_000
  }
};
