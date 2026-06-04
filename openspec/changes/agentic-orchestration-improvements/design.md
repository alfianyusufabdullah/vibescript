## Context

VibeScript is a Chrome Extension (Manifest V3) that provides an AI coding assistant for Google Apps Script's Monaco editor. The current architecture has four layers: inject.js (Monaco bridge) → content script → background worker (LLM proxy) → React sidepanel (agent runtime + UI).

The agent system is functional but monolithic. `src/shared/llm.ts` (592 lines) handles all 4 providers via switch/case with duplicated message conversion logic. `src/sidepanel/services/agentRuntime.ts` (562 lines) mixes tool dispatch, LLM calls, retry logic, and context management in a single class. `src/shared/tools.ts` defines tools as a static array. There is no mechanism to extend or compose any of these layers without modifying core files.

The opencode project demonstrates a mature pattern: `Provider` interface with normalized streaming events, `ToolRegistry` for dynamic tool registration, `AgentV2` for role-based agents, event sourcing for state management, and session persistence. This design adapts those patterns to the Chrome Extension context (no Effect-TS, no Layer DI, browser API constraints).

## Goals / Non-Goals

**Goals:**
- Extract provider layer into pluggable classes with a common interface and normalized streaming events
- Replace hardcoded tool array with a dynamic registry where tools are self-contained modules
- Support multiple agent roles (build, explore, plan) with different capabilities
- Persist agent sessions to chrome.storage for save/load/resume
- Add typed event bus for observability
- Fix Anthropic streaming (currently fake non-streaming fallback)
- Enable any OpenAI-compatible endpoint to be used as a provider

**Non-Goals:**
- No Effect-TS or dependency injection framework (not available in browser/extension context)
- No SQLite or IndexedDB for persistence (chrome.storage.local is sufficient)
- No skill system (not relevant for browser/editor context)
- No file-system permissions or subprocess management
- No MCP (Model Context Protocol) support
- No breaking changes to inject.js Monaco bridge

## Decisions

### D1: Provider as Interface + Class (not function switch/case)

**Current:** `callLLM()` and `callLLMStream()` switch on `provider` string, calling separate functions with different signatures.

**Decision:** Define a `Provider` interface with two methods:
```typescript
interface Provider {
  readonly name: string
  generate(req: GenerateRequest): Promise<GenerateResponse>
  stream(req: StreamRequest): AsyncGenerator<ProviderEvent>
}
```
Each provider (OpenAI, Anthropic, Gemini) implements this interface. OpenAI also serves as the base for DeepSeek and any future OpenAI-compatible provider via a `baseUrl` parameter.

**Rationale:** Interface-based design allows the agent runtime to be completely provider-agnostic. Adding a new provider = implementing the interface + registering it, zero changes to agent runtime. `AsyncGenerator` is the cleanest primitive for streaming in TypeScript — it unifies SSE parsing across providers into a single iteration pattern.

**Alternatives considered:** Function-based with discriminated union types (current approach) — works but doesn't scale. Callback-based (current streaming approach) — leads to callback hell with multiple event types.

### D2: Normalized ProviderEvent Union (not separate callbacks)

**Current:** `LLMStreamCallbacks` has three separate callbacks: `onText`, `onDone`, `onError`. No way to represent tool call streams, reasoning content, or intermediate state.

**Decision:** Unified `ProviderEvent` discriminated union:
```typescript
type ProviderEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'reasoning_delta'; delta: string }
  | { type: 'tool_call_start'; index: number; id: string; name: string }
  | { type: 'tool_call_delta'; index: number; delta: string }
  | { type: 'tool_call_stop'; index: number }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'done'; finishReason: FinishReason; text: string; toolCalls: ToolCall[] }
  | { type: 'error'; error: string; retriable: boolean }
```

**Rationale:** A single event type handles all streaming scenarios uniformly. The consumer (agent runtime) can `for await` the generator and handle each event type. This matches the opencode `ProviderEvent` pattern and enables proper Anthropic streaming with `input_json_delta` for tool calls.

**Alternatives considered:** RxJS Observables — powerful but adds a dependency. Web Streams API — not yet fully standardized across browsers for this use case.

### D3: ToolRegistry as Class (not Zustand store)

**Current:** `AVAILABLE_TOOLS` is a static array. Tool dispatch is a switch/case in `agentRuntime.executeTool()`.

**Decision:** `ToolRegistry` class with methods:
```typescript
class ToolRegistry {
  register(tool: Tool): void
  unregister(name: string): void
  get(name: string): Tool | undefined
  getAll(): ToolDefinition[]
  execute(name: string, args: any, ctx: ToolContext): Promise<ToolResult>
}
```
Each tool is a module exporting a `Tool` object: `{ name, description, parameters, execute }`. Tools self-register when the registry is initialized. The agent runtime calls `registry.execute()` instead of a switch/case.

**Rationale:** Separates tool definition from agent execution. New tools can be added by creating a new module and registering it. The `ToolContext` carries editorStore references, callbacks, and other dependencies — dependency injection without a framework.

**Alternatives considered:** Zustand store for tools — overkill, tools don't need reactive state. TypeScript `Map<string, Tool>` directly — works but no centralized execute pipeline with error handling.

### D4: Agent Roles as Data (not classes)

**Current:** Single `AgentRuntime` class with hardcoded system prompt. No role differentiation.

**Decision:** Agent roles as plain data objects:
```typescript
interface AgentRole {
  id: string
  label: string
  description: string
  systemPrompt: string
  allowedTools: '*' | string[]
  color: string
}
```
Three built-in roles: `build` (full access, default), `explore` (read-only tools), `plan` (analysis only, no edit). `AgentOrchestrator` creates `AgentRuntime` instances per role.

**Rationale:** Roles as data means they can be configured or extended without modifying code. The orchestrator is lightweight — it creates runtimes, manages lifecycle, and passes results. Does not require a class hierarchy.

**Alternatives considered:** Subclass pattern (`BuildAgent extends AgentRuntime`) — more coupling, harder to configure dynamically.

### D5: Session Persistence via chrome.storage (not IndexedDB)

**Current:** Chat history persisted as `vibescript_chat_{scriptId}` key in chrome.storage.local.

**Decision:** Extend to full session objects:
```typescript
interface AgentSession {
  id: string
  scriptId: string
  label: string
  status: 'active' | 'paused' | 'completed' | 'error'
  createdAt: number
  updatedAt: number
  messages: AgentMessage[]
  steps: AgentStep[]
  agentRole: string
  tokenUsage: TokenUsage
}
```
Stored as `vibescript_session_{scriptId}_{sessionId}` with a session index `vibescript_session_index_{scriptId}` listing all session IDs for a script.

**Rationale:** chrome.storage.local is synchronous within the extension context, automatically sync'd, and already used for settings/UI state. No new permissions or dependencies needed. The 10MB quota is sufficient for session data (sessions are text-only). IndexedDB would be overkill.

**Alternatives considered:** IndexedDB — more complex API, async-only, harder to debug.

### D6: EventBus as Simple Emitter (not full pub/sub)

**Current:** No event system. Diagnostics store is manually called from various places.

**Decision:** Lightweight typed `EventBus` class:
```typescript
class EventBus<T extends Record<string, unknown[]>> {
  on<K extends keyof T>(event: K, handler: (...args: T[K]) => void): () => void
  emit<K extends keyof T>(event: K, ...args: T[K]): void
}
```

**Rationale:** A simple typed emitter is sufficient. The diagnostics store subscribes to relevant events. No need for a full pub/sub broker — the extension has a single process (service worker + one sidepanel instance).

**Alternatives considered:** Zustand middleware — couples event system to state management. Full pub/sub library — unnecessary for single-process browser extension.

## Risks / Trade-offs

- **[R1] Anthropic streaming complexity**: Proper Anthropic SSE parsing requires handling `content_block_start`, `content_block_delta`, `content_block_stop` for both text and tool_use blocks. The `input_json_delta` for tool calls is partial JSON that must be accumulated. **Mitigation:** Test against Claude 3.5 Sonnet with multi-tool-call scenarios. The opencode Go implementation handles this correctly — same protocol specification.

- **[R2] AsyncGenerator browser compatibility**: `AsyncGenerator` is ES2018. Chrome 63+ supports it, so it's fine for a Chrome Extension. **Mitigation:** No transpilation needed — TypeScript targets ES2022 in tsconfig.

- **[R3] Session storage quota**: chrome.storage.local has a 10MB quota. Each session is ~50-500KB depending on agent steps. **Mitigation:** Implement session pruning (keep last 10 sessions per script, oldest dropped). Store only essential data (trim tool outputs in completed steps).

- **[R4] Cross-cutting refactoring risk**: This touches files used by background, sidepanel, and shared layers. **Mitigation:** Implement in dependency order (providers first, then registry, then runtime, then stores, then UI). Each step should be independently testable. No changes to inject.js or the Monaco bridge.

- **[R5] Multi-agent UI complexity**: Showing which agent is active, colored indicators, sub-agent results in the same chat. **Mitigation:** Start with simple agent badge + color in the status indicator. Sub-agent results appear as a collapsible section in the parent message.

## Open Questions

- OQ1: Should the orchestrator show sub-agent steps inline in the chat, or capture only the final result? **Decision needed during implementation:** Inline is more transparent but can be noisy for long chains.
- OQ2: Should OpenAI-compatible providers (DeepSeek, OpenRouter, etc.) be separate registry entries or parameterized instances of the OpenAI provider? **Decision needed during implementation:** Parameterized (single OpenAI class with baseUrl config) — matches opencode's approach.
- OQ3: Should session resume restore the full message history including tool results, or just the last assistant response? **Decision needed during implementation:** Full history (messages + tool results) for accurate context reconstruction, but trim tool output text to avoid quota issues.
