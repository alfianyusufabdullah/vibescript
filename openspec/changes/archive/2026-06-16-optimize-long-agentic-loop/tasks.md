## 1. Context Deduplication

- [x] 1.1 In `agentRuntime.ts`, before pushing `[System Context]` message (line ~184), find and remove any existing message with `role === 'user'` and `content.startsWith('[System Context]')` from the messages array
- [x] 1.2 Fix `ensureContext` threshold guard (line ~210): change `this.totalUsage.totalTokens` to `this.lastPromptTokens`

## 2. Error Classification in Streaming Layer

- [x] 2.1 Define a `LLMCallError` type: `{ error: string; retriable: boolean }` in `agentRuntime.ts`
- [x] 2.2 Change `callLLMStreaming` return type from `Result | null` to `Result | LLMCallError`
- [x] 2.3 In `callLLMStreaming`, propagate error message from port `msg.type === 'error'` as `{ error: msg.error, retriable: true }` (default retriable)
- [x] 2.4 In `callLLMStreaming`, on port disconnect resolve as `{ error: 'Background disconnected', retriable: true }`
- [x] 2.5 In `callLLMStreaming`, on timeout resolve as `{ error: 'LLM call timed out', retriable: true }`
- [x] 2.6 In the background worker `callLLMStream` error path, include HTTP status code in the error message so the retry wrapper can classify it

## 3. Retry Wrapper

- [x] 3.1 Add `callLLMWithRetry` method to `AgentRuntime` wrapping `callLLMStreaming` with max 3 attempts and exponential backoff (1s, 2s, 4s)
- [x] 3.2 In the retry loop, check `retriable` flag — if false, return error immediately without retrying
- [x] 3.3 On each retry, emit an `onStep` callback with retry status message (e.g., "Retrying in 2s... (attempt 2/3)")
- [x] 3.4 Replace the `callLLMStreaming` call in the main loop (line ~102) with `callLLMWithRetry`
- [x] 3.5 Update the `if (!llmResponse)` error check to handle the new `LLMCallError` type and surface the specific error message

## 4. Verification

- [x] 4.1 TypeScript compiles with zero errors
- [x] 4.2 Review: after 5 sequential edits, messages array contains exactly 1 `[System Context]` message
- [x] 4.3 Review: retry logic correctly classifies 429 as retriable and 401 as permanent
