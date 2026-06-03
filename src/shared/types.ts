export type Provider = 'gemini' | 'openai' | 'anthropic' | 'deepseek';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Settings {
  provider: Provider;
  apiKeys: Record<Provider, string>;
  models: Record<Provider, string>;
}

// Extension message passing interfaces
export type MessageAction =
  | 'GET_CODE'
  | 'CODE_RESULT'
  | 'SET_CODE'
  | 'INSERT_AT_CURSOR'
  | 'REPLACE_SELECTION'
  | 'REQUEST_COMPLETION'
  | 'COMPLETION_RESULT'
  | 'LLM_REQUEST'
  | 'LLM_RESPONSE'
  | 'PING'
  | 'PONG'
  | 'SIDE_PANEL_OPENED'
  | 'SELECTION_CHANGED'
  | 'FILE_CHANGED';

export interface ExtensionMessage {
  source: 'vibescript-sidepanel' | 'vibescript-background' | 'vibescript-content' | 'vibescript-inject';
  action: MessageAction;
  payload?: any;
}

export interface MonacoEditorContext {
  code: string;
  language: string;
  position: { line: number; col: number } | null;
  selection: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  } | null;
  selectedText: string;
}
