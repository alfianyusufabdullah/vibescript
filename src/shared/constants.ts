import type { Provider } from './types';

export const SYSTEM_PROMPT = `You are an expert Google Apps Script developer assistant.

Rules:
- Write clean, well-commented Google Apps Script code.
- Use Google Workspace Services (SpreadsheetApp, DriveApp, GmailApp, CalendarApp, DocumentApp, UrlFetchApp, CacheService, PropertiesService, ScriptApp, etc.) correctly.
- Follow Apps Script best practices (e.g. batch operations instead of loops, cache read/write optimization, clear scoping).
- When modifying code or generating code from scratch, return ONLY the code block inside a markdown code block starting with \`\`\`javascript or \`\`\`gscript.
- If asked to explain, be concise, precise, and practical.
- Use JSDoc comments for function documentation.
- Handle errors gracefully with try/catch.
- Be aware of Apps Script execution time limits (6 minutes per execution for normal accounts, 30 minutes for Workspace accounts).

When generating or modifying code:
1. Return the COMPLETE replacement code block or the modified function.
2. Put the code in a single \`\`\`javascript or \`\`\`gscript block.
3. DO NOT include any explanatory text before or after the code block, unless specifically asked. Let the code speak for itself.`;

export interface ModelInfo {
  id: string;
  name: string;
}

export interface ProviderConfig {
  name: string;
  models: ModelInfo[];
  defaultModel: string;
}

export const PROVIDERS: Record<Provider, ProviderConfig> = {
  gemini: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fast, General)' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Advanced Coding)' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
    ],
    defaultModel: 'gemini-2.5-flash'
  },
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o (High Intelligence)' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Cheap)' },
      { id: 'o3-mini', name: 'o3-mini (Reasoning & Coding)' }
    ],
    defaultModel: 'gpt-4o'
  },
  anthropic: {
    name: 'Anthropic',
    models: [
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet (State of the Art Coding)' },
      { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku (Fast Coding)' }
    ],
    defaultModel: 'claude-3-5-sonnet-latest'
  },
  deepseek: {
    name: 'DeepSeek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V3' },
      { id: 'deepseek-coder', name: 'DeepSeek-Coder' },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (Reasoning)' }
    ],
    defaultModel: 'deepseek-chat'
  }
};
