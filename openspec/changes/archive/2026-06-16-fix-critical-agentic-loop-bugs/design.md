## Context

VibeScript is a Chrome extension (Manifest V3) that provides an AI coding assistant for Google Apps Script. The core agentic loop in `agentRuntime.ts` drives a cycle of LLM calls → tool execution → result feedback, communicating with the background service worker via `chrome.runtime.connect` (streaming port) and `chrome.runtime.sendMessage` (fallback).

The loop currently has 5 confirmed bugs across error handling, cross-provider compatibility, concurrency, and context management. All are in `agentRuntime.ts` and `agentStore.ts` — no UI or API surface changes needed.

## Goals / Non-Goals

**Goals:**
- Every LLM call failure SHALL surface a user-visible error message (no silent `return`)
- Mid-loop context injection SHALL work identically across all 4 providers (OpenAI, Anthropic, Gemini, DeepSeek)
- Only one `AgentRuntime` SHALL execute at any time; concurrent calls SHALL cancel the previous
- Port disconnection (MV3 service worker killed) SHALL be detected immediately, not after 60s timeout
- Context window ratio SHALL reflect actual context size, not cumulative token sums

**Non-Goals:**
- Retry/backoff logic for transient API failures (separate change)
- Refactoring the dual codepath (chatStore.sendMessage vs agentStore.run)
- Streaming support for Anthropic (currently falls back to non-streaming — keep as-is)
- Changing the `ensureContext` trimming algorithm beyond fixing the token metric

## Decisions

### 1. Use `role: 'user'` for mid-loop context injection

**Decision:** Change `role: 'system'` → `role: 'user'` for the "Updated file content" message injected after edits.

**Rationale:** Anthropic's `toAnthropicMessages()` and Gemini's `toGeminiContents()` both `continue` on `role === 'system'` — these messages are silently dropped. Using `role: 'user'` is universally supported by all providers. The content is clearly labeled (`"Updated file content after modification:"`) so the LLM won't confuse it with a human message.

**Alternative considered:** Merging system content into the next assistant prompt or using provider-specific injection. Rejected — adds complexity for no benefit.

### 2. Guard concurrent runs at `agentStore.run()` level

**Decision:** Cancel any existing `currentRuntime` before creating a new one in `agentStore.run()`.

**Rationale:** The guard belongs in the store (not in the runtime) because `currentRuntime` is a module-level variable managed by the store. Canceling at the store level ensures the old runtime's `cancelled` flag is set before any new work begins.

**Alternative considered:** Debouncing at the UI level. Rejected — doesn't protect against programmatic calls.

### 3. Track `lastPromptTokens` instead of cumulative `totalTokens`

**Decision:** Replace cumulative `totalUsage.totalTokens` with the most recent call's `promptTokens` for context ratio calculation.

**Rationale:** Each LLM call re-tokenizes the full message array. The `promptTokens` from the latest call reflects the actual current context size. Cumulative sums overcount by 3-10x after a few iterations, causing premature trimming.

### 4. Add `port.onDisconnect` in `callLLMStreaming`

**Decision:** Register a `port.onDisconnect` listener that immediately resolves the promise as `null` (triggering the error path).

**Rationale:** Chrome MV3 aggressively kills background service workers. Without this, the promise hangs for 60 seconds (the existing timeout). With the listener, the failure is detected in <100ms.

## Risks / Trade-offs

- **[Risk] `role: 'user'` context messages may confuse some models** → Mitigation: Prefix with clear `[System Context]` label. Test across all 4 providers.
- **[Risk] Canceling previous runtime may orphan pending diff reviews** → Mitigation: `cancel()` already calls `useEditorStore.getState().cancelDiffReview()`, which cleans up the overlay.
- **[Risk] `port.onDisconnect` fires before `onMessage('done')`** → Mitigation: The `settled` flag already prevents double-resolve; the disconnect handler checks `if (!settled)` before resolving.
