export type Provider = 'gemini' | 'openai' | 'anthropic' | 'deepseek';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  agentSteps?: AgentStep[];
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
  | 'FILE_CHANGED'
  | 'EDIT_FILE_REVIEW'
  | 'EDIT_FILE_REVIEW_CANCEL'
  | 'DIFF_RESULT';

export interface ExtensionMessage {
  source: 'vibescript-sidepanel' | 'vibescript-background' | 'vibescript-content' | 'vibescript-inject';
  action: MessageAction;
  payload?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
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

// ─── Tool System Types ────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  success: boolean;
  output: string;
  error?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  text: string;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
  usage?: TokenUsage;
}

// ─── Agent Types ───────────────────────────────────────────────────────────

export type AgentStatus = 'idle' | 'thinking' | 'executing_tools' | 'done' | 'error' | 'cancelled';

export interface AgentStep {
  type: 'text' | 'tool_call' | 'tool_result';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: number;
}

// Canonical message format for agent loop (OpenAI-compatible)
export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}
