## ADDED Requirements

### Requirement: Single timeout owned by editorStore

The agent runtime SHALL NOT set an independent timeout for `edit_file` tool execution. The editorStore's internal timeout SHALL be the single source of truth for diff review timeout.

#### Scenario: AgentRuntime skips edit_file timeout
- **WHEN** `executeToolWithTimeout` is called for `edit_file`
- **THEN** the agentRuntime SHALL NOT create a timeout promise for this tool
- **THEN** the editorStore's internal timeout SHALL be the only timeout active

### Requirement: Reduced timeout duration

The diff review timeout SHALL be 60 seconds (reduced from 300 seconds).

#### Scenario: Timeout after 60 seconds
- **WHEN** an `edit_file` diff review is shown
- **AND** 60 seconds pass without user action or cancel
- **THEN** the promise SHALL resolve with `{ approved: false, output: 'Timeout' }`

### Requirement: Cancel clears timeout

The `cancelDiffReview` method SHALL clear the pending timeout and remove the message event listener, not just post a cancel message.

#### Scenario: Cancel terminates instantly
- **WHEN** `cancelDiffReview()` is called
- **THEN** the 60-second timeout SHALL be cleared
- **THEN** the message event listener SHALL be removed
- **THEN** the pending promise SHALL NOT resolve (the agent loop handles cancel separately)
