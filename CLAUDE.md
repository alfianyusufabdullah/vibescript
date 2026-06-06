# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Dev mode with Vite HMR (watch mode)
npm run build    # tsc -b && vite build → dist/
npm run lint     # ESLint
```

No test runner exists. To test: `npm run build` → Chrome Extensions → Load unpacked → `dist/`.

## Architecture

VibeScript is a Chrome Extension MV3 AI coding assistant that runs exclusively on `script.google.com`. It assists users writing Google Apps Script in the Monaco editor.

### Extension Contexts (4-layer communication)

```
Background Service Worker (src/background/)
    ↕ chrome.runtime.sendMessage
Content Script (src/content/content.tsx)   ← injects bridge, creates Shadow DOM, mounts React
    ↕ postMessage (window)
Injected Script (src/inject/)              ← runs in page context, talks to Monaco editor
    ↑
Sidepanel React App (src/sidepanel/)       ← UI inside Shadow DOM
```

Key constraint: `all_frames: true` in manifest — content script runs in every frame, which is required to reach the Monaco editor inside its iframe.

### Agent Stack (3 layers)

```
useAgentStore (src/sidepanel/stores/agentStore.ts)
    → AgentOrchestrator (src/sidepanel/services/agentOrchestrator.ts)
        → AgentRuntime (src/sidepanel/services/agentRuntime.ts)
            → Provider (src/shared/providers/)
```

- **AgentOrchestrator**: manages sub-agent lifecycle, `runSubAgentsParallel()`, session persistence, `AgentMessageBus` for cross-agent events
- **AgentRuntime**: agentic loop (up to `MAX_STEPS`), tool execution, context window truncation, retry with backoff, token usage tracking
- **Provider**: streaming via `AsyncGenerator<ProviderEvent>`, normalized to canonical OpenAI-compatible `AgentMessage[]` format

### Providers (src/shared/providers/)

Strategy pattern + registry. All providers implement `IProvider`. ProviderEvent stream types: `text_delta`, `reasoning_delta`, `tool_call_start/delta/done`, `usage`, `done`, `error`.

- `anthropic.ts` — native Anthropic SDK
- `openai.ts` — OpenAI SDK (also used by DeepSeek via `baseUrl` override)
- `gemini.ts` — Google GenAI SDK
- `registry.ts` — maps `ProviderName` → provider instance

### Tool Registry (src/shared/toolRegistry.ts)

- Result caching: 30s TTL for read-only tools (`read_active_file`, `list_open_files`, `read_file_by_name`, `batch_read_files`, `search_code`)
- Cache invalidated on successful `edit_file`
- Arg validation against JSON Schema before execution
- `MUTATING_TOOLS = Set(['edit_file'])` → executed sequentially; all others run in parallel via `Promise.allSettled`

### Agent Roles (src/shared/agents.ts)

Three roles, invoked via `@build`, `@explore`, `@plan` prefix in chat:

| Role | Tools | Purpose |
|------|-------|---------|
| `build` | `'*'` (all) | Full coding agent, edit + finish |
| `explore` | read-only subset | Investigation, structured output report |
| `plan` | read + `finish` | Produces implementation plan via `finish()` |

### State Management (src/sidepanel/stores/)

Zustand stores: `agentStore`, `chatStore`, `editorStore`, `settingsStore`, `uiStore`, `diagnosticsStore`.

`editorStore` communicates with the Monaco editor via postMessage bridge to the `vibescript-inject` context — it does not call Monaco APIs directly.

### Events (src/shared/eventBus.ts)

Typed `EventBus` with `AgentEventMap`: `tool:start`, `tool:result`, `agent:status`, `agent:error`, `session:change`. `diagnosticsStore` subscribes to these to populate the diagnostics panel.

## Key Constraints

- Background is a service worker — no DOM APIs available
- No Node.js APIs anywhere in the extension
- Only activates on `https://script.google.com/*`
- Shadow DOM isolation: sidepanel styles won't bleed into the host page and vice versa
- `@` path alias resolves to `./src` (configured in `vite.config.ts`)
