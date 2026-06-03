## ADDED Requirements

### Requirement: Tool Definitions
The system SHALL define available tools as `ToolDefinition[]` with name, description, and JSON Schema parameters.
- Tool list: read_active_file, write_file, edit_file, insert_at_cursor, replace_selection, list_open_files, read_file_by_name, finish
- Tool definitions MUST be importable and reusable between LLM calls and executor dispatch
- Tool `finish` MUST have parameter `{summary: string}` as loop termination sentinel

#### Scenario: Tool definitions are complete
- **WHEN** importing `AVAILABLE_TOOLS` from `src/shared/tools.ts`
- **THEN** it MUST return an array of exactly 8 `ToolDefinition` objects
- **AND** each tool MUST have `name`, `description`, and `parameters` fields

### Requirement: Type Definitions for Tool System
The system SHALL define these TypeScript interfaces:
- `ToolDefinition`: name, description, parameters (JSON Schema)
- `ToolCall`: id, name, arguments
- `ToolResult`: toolCallId, name, success, output, error?
- `LLMResponse`: text, toolCalls[], finishReason
- `AgentMessage`: role, content, tool_calls?, tool_call_id?
- `AgentStatus`: 'idle' | 'thinking' | 'executing_tools' | 'done' | 'error' | 'cancelled'
- `AgentStep`: type, content, toolCalls?, toolResults?, timestamp

#### Scenario: Types are exported correctly
- **WHEN** importing from `src/shared/types.ts`
- **THEN** ALL tool system types MUST be exported
- **AND** TypeScript compilation MUST pass without errors

### Requirement: Provider Function Calling Adapters
The system SHALL convert `ToolDefinition[]` to each provider's tools format and parse responses back to `ToolCall[]`.
- OpenAI: `tools: [{type:"function", function:{name, description, parameters}}]`
  - Response: `choices[0].message.tool_calls[].function.{name, arguments}` (arguments is JSON string)
- DeepSeek: SAME format as OpenAI
- Anthropic: `tools: [{name, description, input_schema}]`
  - Response: `content[].{type:"tool_use", id, name, input}`
- Gemini: `tools: {functionDeclarations: [{name, description, parameters}]}`
  - Response: `candidates[0].content.parts[].{functionCall: {name, args}}`

#### Scenario: OpenAI tool format conversion
- **WHEN** converting `ToolDefinition[]` to OpenAI format
- **THEN** each tool MUST have `{type:"function", function:{name, description, parameters}}`
- **AND** the response parser MUST extract `tool_calls` from `choices[0].message.tool_calls`
- **AND** `arguments` MUST be parsed from JSON string to object

#### Scenario: Anthropic tool format conversion
- **WHEN** converting `ToolDefinition[]` to Anthropic format
- **THEN** each tool MUST have `{name, description, input_schema}`
- **AND** the response parser MUST find content blocks with `type === "tool_use"`
- **AND** MUST map `tool_use.input` to `ToolCall.arguments`

#### Scenario: Gemini tool format conversion
- **WHEN** converting `ToolDefinition[]` to Gemini format
- **THEN** tools MUST be wrapped in `{functionDeclarations: [...]}`
- **AND** the response parser MUST find parts with `functionCall` field
- **AND** MUST map `functionCall.args` to `ToolCall.arguments`

### Requirement: LLM Response Parsing
The system SHALL parse LLM responses into structured `LLMResponse` objects.
- `text`: the text content from the response (may be empty if only tool calls)
- `toolCalls[]`: extracted tool calls, empty array if none
- `finishReason`: 'stop' | 'tool_calls' | 'length' | 'error'
- Empty tool calls array MUST result in finishReason 'stop'
- Invalid JSON in arguments MUST be caught and returned as error

#### Scenario: Response with only text
- **WHEN** LLM returns response with text but no tool calls
- **THEN** `text` contains the response
- **AND** `toolCalls` is empty array
- **AND** `finishReason` is 'stop'

#### Scenario: Response with tool calls
- **WHEN** LLM returns response with tool calls
- **THEN** `text` contains any accompanying text (may be empty)
- **AND** `toolCalls` contains parsed tool calls
- **AND** `finishReason` is 'tool_calls'

#### Scenario: Invalid arguments JSON
- **WHEN** tool call arguments is invalid JSON
- **THEN** the parser MUST catch the error
- **AND** return error finishReason with error details in text
