# context-deduplication Specification

## Purpose
TBD - created by archiving change optimize-long-agentic-loop. Update Purpose after archive.
## Requirements
### Requirement: File context injection SHALL replace previous injection
After a successful `edit_file` tool execution, the re-injected file content MUST replace any previously injected file context message in the messages array, rather than appending a new one.

#### Scenario: Single edit in session
- **WHEN** the agent performs one `edit_file` operation
- **THEN** the messages array SHALL contain exactly one `[System Context]` message with the current file content

#### Scenario: Multiple edits in session
- **WHEN** the agent performs 5 sequential `edit_file` operations
- **THEN** the messages array SHALL contain exactly one `[System Context]` message (not 5)
- **THEN** that message SHALL reflect the file state after the 5th edit

#### Scenario: Identification of replaceable messages
- **WHEN** scanning for a previous context injection to replace
- **THEN** the system SHALL identify messages by checking `role === 'user'` AND `content.startsWith('[System Context]')`
- **THEN** non-context user messages SHALL NOT be affected

### Requirement: ensureContext threshold SHALL use lastPromptTokens
The `ensureContext` guard condition MUST use `this.lastPromptTokens` instead of `this.totalUsage.totalTokens` to determine whether trimming is needed.

#### Scenario: Accurate threshold check
- **WHEN** `lastPromptTokens` is 15,000 and `contextWindow` is 128,000 (ratio 0.12)
- **THEN** `ensureContext` SHALL skip trimming (below CONTEXT_WARN_RATIO of 0.7)
- **THEN** the decision SHALL NOT be based on cumulative `totalUsage.totalTokens`

