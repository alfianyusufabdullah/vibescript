## 1. Shared Types & Foundation

- [x] 1.1 Add `ProviderEvent` discriminated union type to `src/shared/types.ts`
- [x] 1.2 Add `AgentRole` interface to `src/shared/types.ts`
- [x] 1.3 Add `AgentSession` interface to `src/shared/types.ts`
- [x] 1.4 Add `Tool` interface (with `execute`) to `src/shared/types.ts`
- [x] 1.5 Add `ToolContext` interface to `src/shared/types.ts`
- [x] 1.6 Add `FinishReason` type and `TokenUsage` update if needed
- [x] 1.7 Update `AgentStatus` to include role information

## 2. Event System

- [x] 2.1 Create `src/shared/eventBus.ts` with typed `EventBus` class (on/emit/unsubscribe)
- [x] 2.2 Define event map type with all event signatures (`tool:start`, `tool:result`, `agent:status`, `agent:error`, `session:change`)
- [x] 2.3 Create singleton event bus instance for the extension
- [x] 2.4 Integrate `useDiagnosticsStore` to subscribe to event bus and log events

## 3. Provider Abstraction Layer

- [x] 3.1 Create `src/shared/providers/types.ts` with `Provider` interface, `GenerateRequest`, `StreamRequest`, `GenerateResponse`, `ProviderConfig`
- [x] 3.2 Create `src/shared/providers/registry.ts` with `ProviderRegistry` class (register, get, factory pattern)
- [x] 3.3 Create `src/shared/providers/openai.ts` with `OpenAIProvider` class implementing `Provider`, supporting configurable `baseUrl` for DeepSeek/OpenRouter compatibility
- [x] 3.4 Create `src/shared/providers/anthropic.ts` with `AnthropicProvider` class implementing `Provider` with proper SSE streaming (content_block_start/delta/stop, input_json_delta for tool calls)
- [x] 3.5 Create `src/shared/providers/gemini.ts` with `GeminiProvider` class implementing `Provider` with SSE streaming via streamGenerateContent
- [x] 3.6 Create `src/shared/providers/index.ts` that exports all providers and registers built-in providers in the registry
- [x] 3.7 Update `src/shared/constants.ts` `ProviderConfig` to include optional `baseUrl` field
- [x] 3.8 Update `src/shared/types.ts` `Provider` union type if needed and add provider registration config
- [x] 3.9 Remove/archive `src/shared/tools.ts` — replaced by ToolRegistry + individual tool modules

## 4. Tool Registry

- [x] 4.1 Create `src/shared/toolRegistry.ts` with `ToolRegistry` class (register, unregister, get, getAll, execute)
- [x] 4.2 Create `src/shared/tools/read-active-file.ts` — extract from `agentRuntime.ts` executeTool switch case
- [x] 4.3 Create `src/shared/tools/edit-file.ts` — extract edit_file with review approval logic
- [x] 4.4 Create `src/shared/tools/list-open-files.ts` — extract list_open_files
- [x] 4.5 Create `src/shared/tools/read-file-by-name.ts` — extract read_file_by_name
- [x] 4.6 Create `src/shared/tools/finish.ts` — extract finish tool
- [x] 4.7 Create `src/shared/tools/index.ts` — register all built-in tools into ToolRegistry
- [x] 4.8 Remove `src/shared/tools.ts` — replaced by ToolRegistry + individual tool modules

## 5. Agent Runtime Enhancement

- [x] 5.1 Refactor `AgentRuntime.executeTool()` to delegate to `ToolRegistry.execute()` instead of switch/case
- [x] 5.2 Refactor `AgentRuntime.callLLMStreaming()` to use `Provider.stream()` AsyncGenerator instead of Chrome port message passing
- [x] 5.3 Process `ProviderEvent` types in agent loop: text_delta, reasoning_delta, tool_call_start/delta/stop, usage, done, error
- [x] 5.4 Update background.ts to use new provider classes instead of callLLM/callLLMStream
- [x] 5.5 Add `reasoning_delta` handling: accumulate separately from visible text
- [x] 5.6 Implement summarization-based context compaction (LLM call to summarize old messages)
- [x] 5.7 Update `ensureContext()` to call summarization at 70% threshold, fallback truncation at 85%
- [x] 5.8 Enhance error classification with provider-specific status code handling
- [x] 5.9 Add `AgentRole` parameter to `AgentRuntime` constructor, filter tools by allowed list

## 6. Multi-Agent Orchestrator

- [x] 6.1 Create `src/shared/agents.ts` with three built-in agent role definitions: `build`, `explore`, `plan`
- [x] 6.2 Define role-specific system prompts (explore: investigate code, plan: analyze without editing)
- [x] 6.3 Create `src/sidepanel/services/agentOrchestrator.ts` with `AgentOrchestrator` class
- [x] 6.4 Implement sub-agent lifecycle: create runtime → run → capture result → return
- [x] 6.5 Implement `@agentname` mention parsing in chat input (similar to existing `@filename` pattern)
- [x] 6.6 Pass sub-agent results back as structured context for the primary agent

## 7. Session Manager

- [x] 7.1 Create `src/sidepanel/services/sessionManager.ts` with `SessionManager` class
- [x] 7.2 Implement session CRUD: create, save, load, delete with chrome.storage.local persistence
- [x] 7.3 Implement session index management (list all sessions for a script ID)
- [x] 7.4 Implement session pruning (max 10 per script)
- [x] 7.5 Integrate session save on agent step completion (via event bus subscription)
- [x] 7.6 Add session list UI component (dropdown or sidebar in chat view)
- [x] 7.7 Implement session switch: save current → load selected → restore chat messages

## 8. UI Updates

- [x] 8.1 Update agent status indicator to show agent role label and color
- [x] 8.2 Add collapsible "thinking" section for reasoning content display
- [x] 8.3 Add session selector dropdown to chat header
- [x] 8.4 Update `ToolExecutionLog.tsx` to show agent role badge in tool items
  (role shown via status indicator in ChatView; ToolExecutionLog shows per-tool status via CombinedToolItem)
- [x] 8.5 Update `ChatView.tsx` to handle `@agentname` mentions
- [x] 8.6 Update `agentStore.ts` to pass role information and handle orchestrator integration

## 9. Cleanup & Verification

- [x] 9.1 Verify all imports updated across the codebase
- [x] 9.2 Remove unused code paths (old switch/case, old llm.ts exports)
- [x] 9.4 Run `npm run build` (tsc -b && vite build) and verify no errors
- [x] 9.3 Run `npm run lint` — 1 remaining error (no-explicit-any in openai.ts for JSON response parsing, necessary pattern)
- [x] 9.5 Fix CRITICAL bug: apiKey hardcoded to '' in callLLMStreaming and trySummarize
  (threaded apiKey from run() → callLLMWithRetry → callLLMStreaming, stored as this.currentApiKey for trySummarize)
- [x] 9.5 Fix CRITICAL bug: OpenAI provider silently drops system messages
  (toOpenAIMessage returned null for system role; fixed by renaming to toMessagePayload and removing the system filter)
- [x] 9.5 Fix CRITICAL bug: OpenAI and Anthropic generate() silent failures on API errors
  (added response.ok checks that throw descriptive errors instead of returning empty success)
- [x] 9.6 Fix system prompt: agent refused to call tools for read/list operations
  (removed "respond directly without tools" rule; added explicit "ALWAYS use tools" + per-operation triggers)
- [ ] 9.7 Test multi-agent invocation (`@explore`, `@plan`)
  (requires manual testing - type `@explore` in chat to verify)
- [x] 9.8 Fix session creation: every message created a new session (onDone marked 'completed', run() couldn't find 'active')
  (changed to reuse latest session; onDone keeps status 'active'; session only created on first message)
  (requires manual testing - run agent, refresh, verify session persists)
