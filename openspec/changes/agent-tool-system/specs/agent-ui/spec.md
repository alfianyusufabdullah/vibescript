## ADDED Requirements

### Requirement: Agent Status Indicator
The ChatView SHALL display the current agent status when an agent is active.
- Status 'thinking' SHALL show "🧠 Agent is planning..." with subtle animation
- Status 'executing_tools' SHALL show "🔧 Executing tools..." with tool name if available
- Status 'error' SHALL show error message in red (matching existing error style)
- Cancel button SHALL be visible when status is 'thinking' or 'executing_tools'
- Send button SHALL be disabled while agent is running

#### Scenario: Thinking state display
- **WHEN** agent status is 'thinking'
- **THEN** a subtle indicator appears: "🧠 Agent is thinking..."
- **AND** cancel button is visible
- **AND** send button is disabled

#### Scenario: Executing tools state display
- **WHEN** agent status is 'executing_tools'
- **THEN** shows tool name being executed
- **AND** cancel button remains visible

#### Scenario: Error state display
- **WHEN** agent encounters an error
- **THEN** error message is displayed in red box (same style as existing error)
- **AND** cancel button disappears

### Requirement: ToolExecutionLog Component
A new `ToolExecutionLog` component SHALL render agent steps in a timeline format.
- Each step SHALL show: type icon, tool name, timestamp
- Tool call steps SHALL show: tool name, arguments (collapsible), result (collapsible), duration
- Steps SHALL be collapsible: latest step expanded by default, older steps collapsed
- New steps SHALL animate in (fade-in)
- The component SHALL accept `steps: AgentStep[]` as prop
- Empty steps array SHALL render nothing

#### Scenario: Timeline rendering
- **WHEN** rendering multiple AgentSteps
- **THEN** each step has a connecting line/timeline dot on the left
- **AND** steps appear in chronological order
- **AND** the latest step is expanded, older steps are collapsed

#### Scenario: Tool call step details
- **WHEN** a step has type 'tool_call' with toolCalls
- **THEN** shows tool name with icon
- **AND** arguments are viewable by expanding
- **AND** after tool completes, result is shown with success/failure icon

### Requirement: MessageBubble Tool Call Rendering
The MessageBubble SHALL render agent tool execution content alongside regular messages.
- Assistant messages with embedded tool execution metadata SHALL show a compact summary
- Tool execution SHALL NOT break existing user/assistant message rendering

#### Scenario: Agent message in chat
- **WHEN** agent returns final response
- **THEN** it appears as a regular assistant message in the chat
- **AND** previous tool execution steps are rendered as collapsible context above

### Requirement: ChatView Agent Integration
The ChatView SHALL delegate message sending to `agentStore.run()` instead of `chatStore.sendMessage()`.
- `handleSend` MUST call `agentStore.run()` with prompt and context
- Chat history persistence MUST still work via chatStore (agent syncs final response)
- Empty state MUST still show when no messages exist

#### Scenario: Send triggers agent
- **WHEN** user presses Enter or clicks Send
- **THEN** `agentStore.run()` is called instead of `chatStore.sendMessage()`
- **AND** agent status indicator appears
- **AND** ToolExecutionLog is rendered in message area

#### Scenario: History persistence
- **WHEN** agent completes
- **THEN** final response is synced to chatStore
- **AND** persisted to chrome.storage.local
- **AND** displayed in message list on reload
