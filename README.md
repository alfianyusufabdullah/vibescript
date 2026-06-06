# VibeScript

A Chrome Extension (MV3) AI coding assistant for Google Apps Script. It integrates directly into the Monaco editor on `script.google.com`, giving you an AI agent that can read, understand, and edit your Apps Script code.

## Features

- **Multi-provider AI**: Anthropic, OpenAI, Gemini, and DeepSeek — configurable model per session
- **Agentic loop**: The agent reads files, applies edits, and iterates until the task is complete
- **Three agent roles**: `@build` (full access), `@explore` (read-only analysis), `@plan` (implementation planning)
- **Smart tool execution**: Read-only tools run in parallel; mutating tools run sequentially
- **Result caching**: 30s TTL cache on read tools to avoid redundant API calls
- **Reasoning support**: Displays model thinking in collapsible blocks (Anthropic extended thinking, Gemini, DeepSeek R1)
- **Session persistence**: Chat history saved per Google Apps Script project ID

## Getting Started

### Prerequisites

- Node.js 18+
- A supported API key (Anthropic, OpenAI, Google Gemini, or DeepSeek)

### Development

```bash
npm install
npm run dev      # Vite watch mode with HMR
```

### Build & Load in Chrome

```bash
npm run build    # Outputs to dist/
```

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder
4. Navigate to [script.google.com](https://script.google.com) — the VibeScript panel appears

### Other Commands

```bash
npm run lint     # ESLint
```

No automated test suite. Test by loading the built extension and exercising it on a real Apps Script project.

## Architecture

```
Background Service Worker
    ↕ chrome.runtime.sendMessage
Content Script                  ← injects bridge, creates Shadow DOM, mounts React
    ↕ postMessage
Injected Script                 ← runs in page context, interfaces with Monaco editor
    ↑
Sidepanel (React + Tailwind)    ← rendered inside Shadow DOM
```

The agent stack is three layers deep:

```
useAgentStore → AgentOrchestrator → AgentRuntime → Provider
```

Providers stream `ProviderEvent` objects (`text_delta`, `reasoning_delta`, `tool_call_*`, `usage`, `done`, `error`) normalized to a canonical OpenAI-compatible message format.

## Usage

Open a script at `script.google.com`, then use the VibeScript panel:

- Type a request to ask the `@build` agent (default)
- Prefix with `@explore` to investigate code without making changes
- Prefix with `@plan` to get a detailed implementation plan before editing
- Attach code snippets or reference specific files in your message

## Configuration

Add your API key in the Settings panel. Supports:

| Provider | Models |
|----------|--------|
| Anthropic | Claude 3.5 Sonnet, Claude 3.5 Haiku |
| OpenAI | GPT-4o, GPT-4o Mini, o3-mini |
| Google Gemini | Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 2.0 Flash |
| DeepSeek | DeepSeek-V3, DeepSeek-Coder, DeepSeek-R1 |
