# inline-agent-steps Specification

## Purpose
TBD - created by archiving change inline-agent-steps. Update Purpose after archive.
## Requirements
### Requirement: Inline Rendering of Agent Steps
The chat assistant UI MUST render agent execution steps (including thinking text blocks, tool call definitions, and tool execution results) chronologically inside the assistant's chat bubble itself.

#### Scenario: Chronological step rendering in completed messages
- **WHEN** an assistant message with agent steps is rendered in the history
- **THEN** the message bubble displays alternating text markdown components and tool execution cards in the order they occurred, and no separate collapsible log is displayed at the bottom of the bubble.

#### Scenario: Tool execution state rendering
- **WHEN** a tool is executing or has completed
- **THEN** the inline tool card displays its arguments, status (running, done, or failed), and execution output or error inside an expandable card nested within the chat bubble.

### Requirement: Real-Time Round-Level Text Streaming
The agent store and runtime MUST stream and accumulate the current round's text separately from previous steps to allow correct rendering of active streams alongside completed steps.

#### Scenario: Real-time thinking and streaming
- **WHEN** the agent is running and streaming text in the current round
- **THEN** the active chat bubble displays all completed steps first and dynamically appends the current round's streaming text with a typing cursor at the bottom.

#### Scenario: Resetting active stream on round completion
- **WHEN** a round completes and a tool call or final text step is generated
- **THEN** the active stream text is reset to empty and the text is added to the chronological steps list.

