## Why

The agentic loop in `agentRuntime.ts` has three critical bugs that cause silent failures, provider-specific data loss, and race conditions. These make the agent unreliable for Anthropic/Gemini users, leave the UI stuck on errors, and can corrupt state on concurrent runs. These must be fixed before any feature work.

## What Changes

- **Fix silent LLM failure**: When `callLLMStreaming` returns `null` (API error, timeout, network), the loop silently returns without calling `onError()`, leaving the UI permanently stuck in "thinking" state. Add proper error propagation.
- **Fix mid-loop system messages dropped for Anthropic/Gemini**: After file edits, fresh code context is injected as `role: 'system'`. Both `toAnthropicMessages()` and `toGeminiContents()` skip system messages — the agent becomes blind to its own edits. Change to `role: 'user'` with a clear label.
- **Fix concurrent agent run race condition**: Double-clicking or rapid submissions can spawn parallel `AgentRuntime` instances. Only the last is tracked by `currentRuntime`, so `cancel()` only stops the newest. The orphaned runtime runs unchecked, causing duplicate edits and token waste. Add a guard to cancel existing runs before starting new ones.
- **Add port.onDisconnect handler**: The streaming port has no disconnect handler. When Chrome kills the background service worker (common in MV3), the promise hangs for 60 seconds before timeout. Add immediate detection.
- **Fix inaccurate context window tracking**: Token usage is accumulated across all iterations (prompt+completion summed), but prompt tokens are re-counted each call. This causes premature or late context trimming. Track the last call's prompt tokens as current context size instead.

## Capabilities

### New Capabilities
- `agent-error-handling`: Proper error propagation, port disconnect handling, and concurrent run protection in the agentic loop
- `agent-context-management`: Accurate context window tracking and cross-provider compatible mid-loop context injection

### Modified Capabilities
_(none — no existing specs)_

## Impact

- **Files modified**: `src/sidepanel/services/agentRuntime.ts`, `src/sidepanel/stores/agentStore.ts`
- **Providers affected**: All providers benefit from error handling fixes; Anthropic and Gemini specifically fixed for mid-loop context
- **No API changes**: Internal fixes only, no UI or tool definition changes
- **No dependencies added**: Pure logic fixes
