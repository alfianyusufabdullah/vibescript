export type Provider = 'gemini' | 'openai' | 'anthropic' | 'deepseek';

export type FinishReason = 'stop' | 'tool_calls' | 'length' | 'error';

export type ProviderEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'reasoning_delta'; delta: string }
  | { type: 'tool_call_start'; index: number; id: string; name: string }
  | { type: 'tool_call_delta'; index: number; delta: string }
  | { type: 'tool_call_stop'; index: number }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'done'; finishReason: FinishReason; text: string; toolCalls: ToolCall[]; usage?: TokenUsage; reasoningText?: string }
  | { type: 'error'; error: string; retriable: boolean };

export interface CodeAttachment {
  filename: string;
  lineStart?: number;
  lineEnd?: number;
  content: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  agentSteps?: AgentStep[];
  attachments?: CodeAttachment[];
  reasoningText?: string;
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
  | 'DIFF_RESULT'
  | 'ATTACH_SELECTION'
  | 'LIST_FILES'
  | 'LIST_FILES_RESULT'
  | 'MONACO_READY'
  | 'INJECT_BRIDGE'
  | 'EDIT_FILE'
  | 'EDIT_FILE_RESULT'
  | 'READ_FILE_BY_NAME';

export interface ExtensionMessage {
  source: 'vibescript-sidepanel' | 'vibescript-background' | 'vibescript-content' | 'vibescript-inject';
  action: MessageAction;
  payload?: Record<string, unknown>;
}

export interface MonacoEditorContext {
  code: string;
  filename?: string;
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

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export interface ToolContext {
  editorStore: {
    fetchContext: () => Promise<MonacoEditorContext | null>;
    editFile: (search: string, replace: string) => Promise<{ success: boolean; matchCount: number; error?: string }>;
    editFileWithReview: (search: string, replace: string) => Promise<{ approved: boolean; output: string }>;
    listOpenFiles: () => Promise<Array<{ name: string; language: string; isActive: boolean }>>;
    readFileByName: (filename: string) => Promise<MonacoEditorContext | null>;
    cancelDiffReview: () => void;
  };
  cancelDiffReview: () => void;
  signalStop: () => void;
  requestUserInput: (question: string, options?: string[]) => Promise<string>;
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
  finishReason: FinishReason;
  usage?: TokenUsage;
}

export interface AgentRole {
  id: string;
  label: string;
  description: string;
  systemPrompt: string;
  allowedTools: '*' | string[];
  color: string;
  maxSteps?: number;
}

export type AgentStatus = 'idle' | 'thinking' | 'executing_tools' | 'waiting_for_input' | 'done' | 'error' | 'cancelled';

export interface AgentSession {
  id: string;
  scriptId: string;
  label: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  agentRole: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  steps: AgentStep[];
  tokenUsage: TokenUsage;
}

export interface AgentStep {
  type: 'text' | 'tool_call' | 'tool_result';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  reasoningText?: string;
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
  reasoning_content?: string;
}
