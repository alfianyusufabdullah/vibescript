## 1. Fix Silent LLM Failure

- [x] 1.1 In `agentRuntime.ts`, replace `if (!llmResponse) return;` (line ~102) with `if (!llmResponse) { callbacks.onError('LLM call failed. Check your API key and network connection.'); return; }`
- [x] 1.2 In `callLLMStreaming`, add `port.onDisconnect` handler that checks `if (!settled)` and resolves the promise as `null` with a logged warning

## 2. Fix Mid-Loop Context for Anthropic/Gemini

- [x] 2.1 In `agentRuntime.ts`, change the "Updated file content" message from `role: 'system'` to `role: 'user'` (line ~180) and prefix content with `[System Context]` label

## 3. Fix Concurrent Run Race Condition

- [x] 3.1 In `agentStore.ts`, add guard at the start of `run()`: if `currentRuntime` exists, call `currentRuntime.cancel()` and set it to `null` before proceeding

## 4. Fix Context Window Tracking

- [x] 4.1 In `agentRuntime.ts`, add a `lastPromptTokens` field to `AgentRuntime` (initialized to `0`)
- [x] 4.2 After each LLM call, set `this.lastPromptTokens = usage.promptTokens` (from the latest call only)
- [x] 4.3 Change the context ratio calculation from `this.totalUsage.totalTokens / this.contextWindow` to `this.lastPromptTokens / this.contextWindow`

## 5. Verification

- [x] 5.1 Verify agent loop surfaces error in UI when API key is invalid (should show error, not hang)
- [x] 5.2 Verify Anthropic/Gemini users see updated code context after multi-step edits
- [x] 5.3 Verify double-clicking send cancels the first run cleanly
