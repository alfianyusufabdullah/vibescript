# VibeScript

> An AI coding assistant embedded directly into the Google Apps Script editor.

VibeScript is a Chrome Extension (MV3) that integrates an agentic AI assistant into the Monaco editor on `script.google.com`. It reads, understands, and edits your Apps Script code — all without leaving the browser.

---

## Features

| Feature | Description |
|---------|-------------|
| **Multi-provider AI** | Anthropic, OpenAI, Gemini, and DeepSeek — configurable per session |
| **Agentic loop** | Agent reads files, applies edits, and iterates until the task is complete |
| **Agent roles** | `@build` (full access), `@explore` (read-only), `@plan` (implementation planning) |
| **Parallel tool execution** | Read-only tools run concurrently; mutating tools run sequentially |
| **Result caching** | 30-second TTL cache on read tools to eliminate redundant API calls |
| **Reasoning support** | Collapsible thinking blocks for Anthropic, Gemini, and DeepSeek R1 |
| **Session persistence** | Chat history saved per Google Apps Script project |

---

## Getting Started

### Prerequisites

- Node.js 18+
- An API key from at least one supported provider (Anthropic, OpenAI, Google Gemini, or DeepSeek)

### Install & Run (Development)

```bash
npm install
npm run dev      # Vite watch mode with HMR
```

### Build & Load in Chrome

```bash
npm run build    # Compiles TypeScript and outputs to dist/
```

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `dist/` folder
4. Go to [script.google.com](https://script.google.com) — the VibeScript panel appears automatically

### Other Commands

```bash
npm run lint     # Run ESLint
```

> **Testing:** No automated test suite. Load the built extension and exercise it on a real Apps Script project.

---

## Usage

Open any script on `script.google.com` and use the VibeScript side panel:

| Prefix | Agent | Behavior |
|--------|-------|----------|
| *(none)* | `@build` | Default — full edit access, executes tasks end-to-end |
| `@explore` | Explore | Read-only analysis; investigates code without making changes |
| `@plan` | Plan | Produces a detailed implementation plan before any edits |

You can also attach code snippets or reference specific files directly in your message.

---

## Configuration

Add your API key via the **Settings** panel inside the extension.

| Provider | Supported Models |
|----------|-----------------|
| Anthropic | Claude 3.5 Sonnet, Claude 3.5 Haiku |
| OpenAI | GPT-4o, GPT-4o Mini, o3-mini |
| Google Gemini | Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 2.0 Flash |
| DeepSeek | DeepSeek-V3, DeepSeek-Coder, DeepSeek-R1 |

---

## Architecture

VibeScript operates across four isolated browser contexts:

```
Background Service Worker
    ↕  chrome.runtime.sendMessage
Content Script                  ← injects bridge, creates Shadow DOM, mounts React
    ↕  postMessage
Injected Script                 ← runs in page context, interfaces with Monaco editor
    ↑
Sidepanel (React + Tailwind)    ← rendered inside Shadow DOM
```

### Agent Stack

```
useAgentStore → AgentOrchestrator → AgentRuntime → Provider
```

- **AgentOrchestrator** — manages sub-agent lifecycle and session persistence
- **AgentRuntime** — drives the agentic loop (tool execution, retries, context truncation)
- **Provider** — streams `ProviderEvent` objects normalized to a canonical OpenAI-compatible format

**Event types:** `text_delta`, `reasoning_delta`, `tool_call_start/delta/done`, `usage`, `done`, `error`
