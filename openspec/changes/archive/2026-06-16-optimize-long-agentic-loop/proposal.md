## Why

Long agentic sessions (>5 tool iterations) suffer from rapid context window exhaustion and fragile error handling. Each `edit_file` appends a full copy of the file to the messages array, wasting ~60% of context on duplicate content. A single transient API error (429/503) kills the entire run with no recovery. And the `ensureContext` trimming guard still uses cumulative token counts from a previous fix, causing incorrect trimming behavior.

## What Changes

- **Deduplicate context re-injection**: After file edits, replace the previous file context message instead of appending a new one. Reduces context usage by ~60% in multi-edit sessions.
- **Add retry with exponential backoff**: Wrap LLM calls with up to 3 retries (1s, 2s, 4s delays) for transient errors (429, 503, network timeout). Permanent errors (401, 400) fail immediately.
- **Fix `ensureContext` threshold guard**: Change the remaining `this.totalUsage.totalTokens` reference in `ensureContext()` to `this.lastPromptTokens` to match the ratio fix applied in the previous change.

## Capabilities

### New Capabilities
- `context-deduplication`: Replace-instead-of-append strategy for mid-loop file context injection
- `llm-retry`: Exponential backoff retry logic for transient LLM API failures with retriable vs permanent error distinction

### Modified Capabilities
_(none — no existing specs)_

## Impact

- **Files modified**: `src/sidepanel/services/agentRuntime.ts` (primary), `src/shared/llm.ts` (error classification)
- **Performance**: ~60% reduction in context token usage for multi-edit sessions
- **Reliability**: 3x more resilient to transient API failures
- **No API/UI changes**: Internal optimization only
- **No dependencies added**
