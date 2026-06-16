# agent-error-handling Specification

## Purpose
TBD - created by archiving change fix-critical-agentic-loop-bugs. Update Purpose after archive.
## Requirements
### Requirement: LLM failure SHALL propagate error to UI
When `callLLMStreaming` returns `null` (due to API error, network failure, timeout, or missing chrome runtime), the agent loop MUST call `callbacks.onError()` with a descriptive message before returning.

#### Scenario: API returns error
- **WHEN** the LLM API responds with a non-2xx status code
- **THEN** the agent loop SHALL call `callbacks.onError()` with a message containing the error details
- **THEN** the UI SHALL transition from "thinking" to "error" state

#### Scenario: Network timeout on streaming port
- **WHEN** the streaming port timeout (60s) fires without receiving a `done` message
- **THEN** the agent loop SHALL call `callbacks.onError()` with a timeout message

#### Scenario: Chrome runtime unavailable
- **WHEN** `chrome.runtime` is undefined (e.g., extension context invalidated)
- **THEN** the agent loop SHALL call `callbacks.onError()` with an environment error message

### Requirement: Port disconnect SHALL be detected immediately
The streaming LLM call MUST register a `port.onDisconnect` handler that resolves the promise immediately when the background service worker disconnects.

#### Scenario: Background service worker killed by Chrome
- **WHEN** Chrome terminates the MV3 background service worker during a streaming LLM call
- **THEN** the `onDisconnect` handler SHALL fire and resolve the promise within 1 second
- **THEN** the error SHALL propagate to `callbacks.onError()`

#### Scenario: Normal completion before disconnect
- **WHEN** the LLM call completes normally via `onMessage('done')`
- **THEN** a subsequent disconnect event SHALL NOT trigger a duplicate resolution (guarded by `settled` flag)

### Requirement: Only one AgentRuntime SHALL execute at a time
The `agentStore.run()` function MUST cancel any existing `currentRuntime` before creating and starting a new one.

#### Scenario: Rapid double submission
- **WHEN** the user triggers `run()` while a previous run is still executing
- **THEN** the previous runtime's `cancel()` method SHALL be called before the new runtime starts
- **THEN** only the new runtime SHALL be tracked as `currentRuntime`

#### Scenario: No previous runtime
- **WHEN** the user triggers `run()` with no existing runtime
- **THEN** the new runtime SHALL start normally without any cancel operation

