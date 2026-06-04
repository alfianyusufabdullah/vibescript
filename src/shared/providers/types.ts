import type { AgentMessage, ToolDefinition, ProviderEvent, TokenUsage, ToolCall } from '../types';

export interface GenerateRequest {
  model: string;
  messages: AgentMessage[];
  tools?: ToolDefinition[];
}

export interface StreamRequest {
  model: string;
  messages: AgentMessage[];
  tools?: ToolDefinition[];
}

export interface GenerateResponse {
  text: string;
  toolCalls: ToolCall[];
  usage?: TokenUsage;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface Provider {
  readonly name: string;
  generate(req: GenerateRequest, config: ProviderConfig): Promise<GenerateResponse>;
  stream(req: StreamRequest, config: ProviderConfig): AsyncGenerator<ProviderEvent>;
}
