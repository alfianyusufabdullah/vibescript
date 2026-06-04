## ADDED Requirements

### Requirement: Token-accurate context tracking

The agent runtime SHALL track token usage per LLM call using the usage data returned by each provider. The context window ratio SHALL be calculated based on actual token counts, not estimated.

#### Scenario: Token usage accumulation
- **WHEN** each LLM call completes
- **THEN** the `usage` event's tokens SHALL be accumulated into total counts
- **THEN** the context window ratio SHALL be calculated as `lastPromptTokens / contextWindow`

### Requirement: Summarization-based context compaction

When the context window reaches 70% utilization, the agent runtime SHALL use an LLM call to summarize older conversation turns instead of dropping them entirely.

#### Scenario: Summarize old messages at 70% threshold
- **WHEN** context window exceeds 70% utilization
- **THEN** the runtime SHALL select messages before the last 2 assistant rounds
- **THEN** it SHALL send them to the LLM with a summarization prompt
- **THEN** the original messages SHALL be replaced with a single summary message

#### Scenario: Fallback truncation at 85% threshold
- **WHEN** context window exceeds 85% utilization
- **THEN** if summarization has already been applied or fails, SHALL drop messages keeping the last 2 assistant rounds and the current user prompt
- **THEN** a warning SHALL be shown to the user

### Requirement: Reasoning content support

The agent runtime SHALL handle `reasoning_delta` events from providers that support extended thinking (e.g., OpenAI o-series, Anthropic extended thinking). Reasoning content SHALL be captured but SHALL NOT be sent as visible text to the user by default.

#### Scenario: Capture reasoning content
- **WHEN** a `reasoning_delta` event is received
- **THEN** the reasoning text SHALL be accumulated separately from visible text
- **THEN** the total tokens SHALL include reasoning tokens in the usage count

#### Scenario: Display reasoning in UI
- **WHEN** the agent response contains reasoning content
- **THEN** a collapsible "thinking" section SHALL be shown in the UI
- **THEN** expanding it SHALL show the reasoning content
