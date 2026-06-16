# llm-retry Specification

## Purpose
TBD - created by archiving change optimize-long-agentic-loop. Update Purpose after archive.
## Requirements
### Requirement: LLM calls SHALL retry on transient errors
When an LLM API call fails due to a transient error, the agent loop MUST retry up to 3 times with exponential backoff (1s, 2s, 4s) before giving up.

#### Scenario: Rate limit (429) with recovery
- **WHEN** the LLM API returns HTTP 429 on the first attempt
- **THEN** the system SHALL wait 1 second and retry
- **WHEN** the retry succeeds
- **THEN** the agent loop SHALL continue normally with the response

#### Scenario: Rate limit (429) exhausting all retries
- **WHEN** the LLM API returns HTTP 429 on all 3 retry attempts
- **THEN** the system SHALL call `callbacks.onError()` with a descriptive message including "rate limit"
- **THEN** the system SHALL NOT retry further

#### Scenario: Server error (503) with recovery
- **WHEN** the LLM API returns HTTP 503 on the first attempt
- **THEN** the system SHALL wait 1 second and retry
- **WHEN** the second attempt succeeds
- **THEN** the agent loop SHALL continue normally

### Requirement: Permanent errors SHALL NOT be retried
When an LLM API call fails due to a permanent error (authentication, bad request), the system MUST fail immediately without retrying.

#### Scenario: Invalid API key (401)
- **WHEN** the LLM API returns HTTP 401
- **THEN** the system SHALL call `callbacks.onError()` immediately
- **THEN** the system SHALL NOT retry

#### Scenario: Bad request (400)
- **WHEN** the LLM API returns HTTP 400
- **THEN** the system SHALL call `callbacks.onError()` immediately
- **THEN** the system SHALL NOT retry

### Requirement: Retry attempts SHALL be visible to user
Each retry attempt MUST emit an `onStep` callback so the user can see that the system is recovering.

#### Scenario: Retry progress indication
- **WHEN** the system retries after a transient error
- **THEN** the system SHALL emit a step with content like "LLM call failed (429). Retrying in 2s... (attempt 2/3)"

### Requirement: Streaming layer SHALL propagate error details
The `callLLMStreaming` method MUST return error information that distinguishes retriable from permanent errors, instead of returning `null` for all failures.

#### Scenario: Retriable error returned
- **WHEN** the LLM streaming call fails with HTTP 429
- **THEN** the return value SHALL include `{ error: "...", retriable: true }`

#### Scenario: Permanent error returned
- **WHEN** the LLM streaming call fails with HTTP 401
- **THEN** the return value SHALL include `{ error: "...", retriable: false }`

