## ADDED Requirements

### Requirement: Agent Runtime Loop
The system SHALL implement an agent loop that orchestrates: call LLM → parse → execute tools → repeat.
- Loop MUST handle 3 exit conditions: no tool_calls in response, tool `finish()` called, max 25 steps reached
- Each iteration MUST push assistant message (with tool_calls) and subsequent tool results to messages array
- The loop MUST support cancellation via a boolean flag checked at the start of each iteration

#### Scenario: Normal agent flow (read → edit → finish)
- **WHEN** user asks "fix the bug in myFunction"
- **THEN** agent calls LLM with tools
- **AND** LLM returns tool_call: `read_active_file`
- **AND** agent executes and sends result back
- **AND** LLM returns tool_call: `edit_file` with search/replace
- **AND** agent executes edit
- **AND** LLM returns tool_call: `finish({summary: "Fixed bug..."})`
- **AND** agent returns the summary as final response

#### Scenario: Text-only response terminates loop
- **WHEN** LLM returns response with text but no tool_calls
- **THEN** agent treats this as final answer
- **AND** returns the text as final response
- **AND** stops the loop

#### Scenario: Max steps reached
- **WHEN** agent loop reaches 25 iterations without termination
- **THEN** agent throws "Max steps reached" error
- **AND** UI shows error state

#### Scenario: Cancellation
- **WHEN** user clicks cancel button
- **THEN** agent loop stops at next iteration check
- **AND** status is set to 'cancelled'
- **AND** no further LLM calls are made

### Requirement: Tool Executor Dispatch
The system SHALL dispatch tool calls to the correct executor function based on `toolCall.name`.
- Each executor MUST return `ToolResult` with success/failure and output
- Unknown tool names MUST return error result, not throw
- Each tool execution MUST be wrapped in try/catch

#### Scenario: Unknown tool
- **WHEN** LLM calls an undefined tool name
- **THEN** executor returns `{success: false, output: "Unknown tool: <name>"}`
- **AND** the error result is sent back to LLM
- **AND** the loop continues

#### Scenario: Tool execution throws
- **WHEN** `editorStore.editFile()` throws an error
- **THEN** executor catches the error
- **AND** returns `{success: false, output: error.message}`

### Requirement: Tool Timeout
Each tool execution SHALL have a 10-second timeout.
- Use `Promise.race([executeTool, timeoutPromise])`
- On timeout, return error result (not throw)

#### Scenario: Tool timeout
- **WHEN** a tool execution takes longer than 10 seconds
- **THEN** executor returns `{success: false, output: "Tool execution timed out"}`
- **AND** the loop continues with the error result

### Requirement: Agent State Management
The system SHALL maintain reactive agent state via Zustand store (`agentStore`).
- Store MUST expose: status, steps[], finalResponse, error
- Store MUST have methods: run(), cancel(), reset()
- Store MUST update in real-time as agent progresses
- Final response MUST be synced to chatStore for persistence

#### Scenario: Agent state transitions
- **WHEN** `agentStore.run()` is called
- **THEN** status becomes 'thinking'
- **AND** when tools are executing, status becomes 'executing_tools'
- **AND** when finished, status becomes 'done' with finalResponse set
- **AND** when error, status becomes 'error' with error message
- **AND** when cancelled, status becomes 'cancelled'

#### Scenario: Agent state resets
- **WHEN** `agentStore.reset()` is called
- **THEN** status becomes 'idle'
- **AND** steps is empty array
- **AND** finalResponse and error are null

### Requirement: Message Pipeline Format
The agent SHALL format messages correctly for each provider's function calling API.
- Assistant messages with tool_calls MUST include the `tool_calls` field in provider format
- Tool result messages MUST include `tool_call_id` matching the original call
- Messages array MUST alternate: assistant (with tool_calls) → tool results → assistant → ...

#### Scenario: Tool call message format
- **WHEN** LLM returns tool calls
- **THEN** assistant message pushed to messages MUST include `tool_calls` array
- **AND** each tool_call MUST have: id, type: "function", function: {name, arguments: JSON string}
- **AND** subsequent tool role messages MUST reference the correct tool_call_id
