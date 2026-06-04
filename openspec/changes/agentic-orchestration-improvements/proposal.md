## Why

The current agent system in VibeScript uses a monolithic architecture where LLM provider calls, tool definitions, agent execution logic, and state management are tightly coupled in single files (`llm.ts` at 592 lines, `agentRuntime.ts` at 562 lines). This makes it difficult to add new providers, extend tools dynamically, introduce multi-agent workflows, or persist agent sessions. The provider layer has only partial streaming support (Anthropic streaming is a fake non-streaming fallback), error handling is inconsistent, and there is no mechanism for plugins or extensions to contribute capabilities at runtime. Adapting architectural patterns from the opencode project will solve these problems, making the system modular, extensible, and observable.

## What Changes

- **Provider Abstraction Layer**: Extract monolithic `llm.ts` into provider-specific classes behind a common `Provider` interface with normalized streaming events. Fix Anthropic streaming (proper SSE parsing). Enable dynamic provider registration (e.g., any OpenAI-compatible endpoint).
- **Tool Registry**: Replace the hardcoded `AVAILABLE_TOOLS` array with a dynamic `ToolRegistry` that allows tools to be registered, unregistered, and executed via a central dispatcher. Extract each tool into its own module.
- **Multi-Agent Orchestrator**: Introduce multiple agent roles (`build`, `explore`, `plan`) with different tool permissions and system prompts. Primary agent can delegate tasks to sub-agents. Users invoke via `@agentname` mention.
- **Session Manager**: Persist agent sessions to `chrome.storage.local` with save/load/resume capabilities. Multiple sessions per script.
- **Event System**: Simple typed event bus for observability (tool calls, agent status, errors). Integrate with existing diagnostics store.
- **Agent Runtime Enhancement**: Improve context window management (summarization instead of drop), reasoning content support, and modular extraction.

## Capabilities

### New Capabilities

- `provider-abstraction`: Define a common `Provider` interface (`generate`, `stream`) with normalized `ProviderEvent` types. Implement OpenAI, Anthropic (with real streaming), and Gemini providers. Factory-based registration enabling any OpenAI-compatible endpoint as a provider.
- `tool-registry`: Dynamic `ToolRegistry` class with `register`, `unregister`, `getAll`, `execute` methods. Each tool is a self-contained module. Tool execution goes through a common decode-authorize-execute pipeline.
- `multi-agent`: Define agent roles (`build`, `explore`, `plan`) with role-specific system prompts, tool allowlists, and display properties. `AgentOrchestrator` manages sub-agent lifecycle and result passing.
- `session-manager`: Persist agent sessions (messages, steps, context) to `chrome.storage`. Support save, load, resume operations. Multiple sessions per script.
- `event-system`: Typed event bus with `subscribe`/`publish`. Events for tool lifecycle, agent status, session changes. Diagnostics store consumes events.
- `context-window-management`: Replace simple truncation with LLM-based summarization for context compaction. Track token usage per turn with more accuracy. Support reasoning/thinking content.

### Modified Capabilities

- `agent-runtime`: Refactor from monolithic class to modular architecture. Extract tool dispatch to `ToolRegistry`. Extract provider calls to `Provider` interface. Improve error classification and retry strategy.

## Impact

- **`src/shared/llm.ts`**: Replaced entirely by `src/shared/providers/` directory (types.ts, registry.ts, openai.ts, anthropic.ts, gemini.ts). All 592 lines refactored into ~200-250 lines per provider file.
- **`src/shared/tools.ts`**: Replaced by `src/shared/toolRegistry.ts` + `src/shared/tools/*.ts` (5 tool files).
- **`src/sidepanel/services/agentRuntime.ts`**: Significant refactoring — extract tool dispatch (to registry), extract provider calls (to providers), add orchestrator integration, improve context management.
- **`src/background/background.ts`**: Updated to use `ProviderRegistry` and normalized events for streaming.
- **`src/shared/types.ts`**: Add `ProviderEvent`, `AgentRole`, `Session` types. Minor additions to existing types.
- **`src/shared/constants.ts`**: Add agent role definitions, update provider config shape.
- **New files**: ~12-15 new files across `shared/providers/`, `shared/tools/`, `sidepanel/services/`.
- **Dependencies**: No new external dependencies. Uses existing Zustand, chrome.storage APIs.
