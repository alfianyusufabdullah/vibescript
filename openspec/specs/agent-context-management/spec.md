# agent-context-management Specification

## Purpose
TBD - created by archiving change fix-critical-agentic-loop-bugs. Update Purpose after archive.
## Requirements
### Requirement: Mid-loop context injection SHALL use user role
After file modifications, fresh code context injected into the message array MUST use `role: 'user'` (not `role: 'system'`) to ensure compatibility with all LLM providers.

#### Scenario: Anthropic provider receives updated context
- **WHEN** the agent edits a file using the `edit_file` tool with the Anthropic provider
- **THEN** the re-read file content SHALL be added as a `role: 'user'` message
- **THEN** `toAnthropicMessages()` SHALL include this message in the converted output (not skip it)

#### Scenario: Gemini provider receives updated context
- **WHEN** the agent edits a file using the `edit_file` tool with the Gemini provider
- **THEN** the re-read file content SHALL be added as a `role: 'user'` message
- **THEN** `toGeminiContents()` SHALL include this message in the converted output (not skip it)

#### Scenario: OpenAI/DeepSeek provider backwards compatibility
- **WHEN** the agent edits a file using the `edit_file` tool with OpenAI or DeepSeek
- **THEN** the `role: 'user'` message SHALL be processed identically to the previous `role: 'system'` behavior

### Requirement: Context window ratio SHALL reflect actual context size
The context ratio calculation MUST use the most recent LLM call's `promptTokens` as the numerator — not the cumulative sum of all calls' `totalTokens`.

#### Scenario: After 5 tool iterations
- **WHEN** the agent has completed 5 LLM call iterations with ~20K prompt tokens each
- **THEN** the context ratio SHALL be calculated as `lastPromptTokens / contextWindow` (e.g., `20000 / 128000 ≈ 0.16`)
- **THEN** the context ratio SHALL NOT be calculated as cumulative `totalTokens / contextWindow` (e.g., `100000 / 128000 ≈ 0.78`)

#### Scenario: Context warning threshold
- **WHEN** the actual prompt token count exceeds 70% of the context window
- **THEN** the `ensureContext` trimming function SHALL activate
- **THEN** a warning step SHALL be emitted to the UI

