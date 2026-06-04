## ADDED Requirements

### Requirement: Modular agent runtime

The `AgentRuntime` class SHALL be refactored to delegate tool execution to `ToolRegistry` and LLM calls to the `Provider` interface. The runtime SHALL focus on the agent loop logic: building messages, calling LLM, processing events, and managing continuation.

#### Scenario: Tool dispatch via registry
- **WHEN** a tool call is received from the LLM
- **THEN** the runtime SHALL call `toolRegistry.execute(name, args, ctx)` instead of a switch/case
- **THEN** unknown tool names SHALL return an error result without crashing

#### Scenario: LLM calls via provider
- **WHEN** the runtime needs to call the LLM
- **THEN** it SHALL use `provider.stream()` with the normalized event generator
- **THEN** it SHALL iterate through `ProviderEvent` types to build the response
- **THEN** it SHALL use the same code path for all providers

### Requirement: Error classification

The retry logic SHALL be enhanced to classify HTTP errors by status code with provider-specific rules. Permanent errors (401, 400, 403, 404) SHALL fail immediately. Transient errors (429, 500, 502, 503) SHALL be retried with exponential backoff.

#### Scenario: Permanent error handling
- **WHEN** an LLM call returns a 401 or 400 error
- **THEN** the runtime SHALL NOT retry
- **THEN** it SHALL report the error to the user with the status code

#### Scenario: Transient error retry
- **WHEN** an LLM call returns a 429 or 503 error
- **THEN** the runtime SHALL retry with exponential backoff (2^attempt * 1000ms)
- **THEN** it SHALL retry up to 3 times
- **THEN** if all retries fail, it SHALL report the error to the user

### Requirement: Agent runtime per-role

The `AgentRuntime` constructor SHALL accept an `AgentRole` parameter. When provided, it SHALL use the role's system prompt and tool allowlist.

#### Scenario: Runtime with role
- **WHEN** `new AgentRuntime('explore')` is created
- **THEN** the system prompt SHALL be the `explore` role's prompt
- **THEN** tools SHALL be filtered to the `explore` allowed tools
- **THEN** the runtime SHALL refuse to execute disallowed tools
