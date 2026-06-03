## Context

The agentic loop in `agentRuntime.ts` was recently patched for critical bugs (silent failures, dropped system messages, race conditions). The loop now works correctly but is not optimized for long-running sessions. In practice, refactoring tasks requiring >5 edits exhaust context windows prematurely due to duplicate file content injection, and transient API errors kill runs with no recovery.

This change focuses on three optimizations: context deduplication, retry logic, and a leftover threshold fix from the previous change.

## Goals / Non-Goals

**Goals:**
- Reduce context token usage by ~60% in multi-edit sessions via replace-instead-of-append
- Survive transient API errors (429, 503) with automatic retry up to 3 attempts
- Fix the `ensureContext` threshold guard to use `lastPromptTokens` consistently
- Distinguish retriable errors from permanent errors to avoid wasting time retrying 401s

**Non-Goals:**
- Full streaming implementation for Anthropic (stays as non-streaming fallback)
- Refactoring the `ensureContext` trimming algorithm (addressed separately)
- AbortController integration for in-flight fetch cancellation
- Unifying the dual chatStore/agentStore LLM codepaths

## Decisions

### 1. Replace-instead-of-append for file context

**Decision:** Before pushing a new `[System Context]` message, find and remove any existing message with the same `[System Context]` prefix in the messages array.

**Rationale:** Appending creates N copies of the file for N edits. Replacing keeps exactly 1 copy of the latest state. This is safe because the LLM only needs the *current* file state, not the history of intermediate states — tool results already describe what changed.

**Alternative considered:** Summarizing previous file states or using diffs. Rejected — adds complexity and the LLM already has the edit descriptions in tool results.

### 2. Retry at the agent loop level, not the LLM layer

**Decision:** Add a `callLLMWithRetry` wrapper in `agentRuntime.ts` that wraps `callLLMStreaming`. Do not modify `llm.ts` streaming logic.

**Rationale:** Retry at the loop level preserves the messages array state. The loop can log retry attempts as steps visible to the user. The `llm.ts` layer stays simple (single responsibility: talk to APIs).

**Error classification:** The streaming port returns `null` for all errors. To distinguish retriable vs permanent, the error message from `callLLMStreaming` needs to be propagated. Change the return type to include error details: `{ error: string; retriable: boolean }`.

**Alternative considered:** Retry inside `llm.ts` per-provider. Rejected — would need 4 separate retry implementations and can't emit UI steps.

### 3. Exponential backoff: 1s, 2s, 4s

**Decision:** Use `2^attempt * 1000ms` delay with max 3 retries.

**Rationale:** Aggressive enough to recover from burst rate limits (which typically clear in 1-5s) without making the user wait too long. 3 retries = max 7 seconds total wait, which is reasonable for a long-running agent.

### 4. Propagate error details from streaming layer

**Decision:** Change `callLLMStreaming` return type from `Result | null` to `Result | { error: string; retriable: boolean }`. This lets the retry wrapper decide whether to retry.

**Classification:**
- **Retriable:** 429 (rate limit), 503 (overloaded), 502 (bad gateway), network errors, port disconnect
- **Permanent:** 401 (auth), 400 (bad request), 404 (model not found)

## Risks / Trade-offs

- **[Risk] Replace-instead-of-append may remove context needed by LLM** → Mitigation: The `[System Context]` prefix ensures only our injected messages are matched, not user messages. Tool results still describe what was edited.
- **[Risk] Retry delays add latency** → Mitigation: Max 7s total. Only triggers on actual failures. User sees retry status via onStep callbacks.
- **[Risk] Error classification may miscategorize provider-specific errors** → Mitigation: Default to retriable for unknown HTTP errors. Only explicitly mark known permanent codes as non-retriable.
