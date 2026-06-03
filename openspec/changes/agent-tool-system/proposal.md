## Why

VibeScript saat ini hanyalah chat interface sederhana — user kirim prompt, AI balas text, selesai. Tidak ada tool execution, tidak ada agent loop, tidak ada multi-step reasoning. Untuk menjadi AI coding assistant yang powerful (seperti Claude Code, OpenCode, Gemini CLI), VibeScript harus punya agent system: AI bisa baca file, edit code, execute tools, dan looping sampai task selesai.

## What Changes

- **Tool System**: Define 8 tools (read_active_file, write_file, edit_file, insert_at_cursor, replace_selection, list_open_files, read_file_by_name, finish) dengan JSON Schema untuk function calling
- **Provider Function Calling**: Implementasi function calling format untuk semua provider (OpenAI, Anthropic, Gemini, DeepSeek) — masing-masing punya format request/response berbeda
- **Agent Loop Engine**: Runtime yang menjalankan loop: call LLM → parse tool calls → execute tools → send results back → repeat sampai finish() dipanggil
- **Monaco Editor Tools**: 3 aksi baru di inject.js (LIST_FILES, READ_FILE_BY_NAME, EDIT_FILE) + executor di sidepanel
- **Agent UI**: Status indicator, tool execution log timeline, cancel button, expandable tool call/result visualization

## Capabilities

### New Capabilities
- `tool-system`: Definisi tool schemas, tipe data untuk tool calls/results, dan adapter per-provider untuk function calling
- `agent-loop`: Core agent runtime — state machine, loop engine, tool executor, safety constraints
- `editor-tools`: Monaco editor integration — baca semua file, edit spesifik, find/replace, select-by-name
- `agent-ui`: React components untuk menampilkan agent status, tool execution timeline, expandable logs

### Modified Capabilities
- *(none — no existing specs are being modified)*

## Impact

- **New files**: `src/shared/tools.ts`, `src/sidepanel/services/agentRuntime.ts`, `src/sidepanel/stores/agentStore.ts`, `src/sidepanel/components/ToolExecutionLog.tsx`
- **Modified files**: `src/shared/types.ts` (new types), `src/shared/llm.ts` (tools param, LLMResponse return), `src/background/background.ts` (pass tools payload), `src/content/inject.js` (3 new actions), `src/sidepanel/stores/editorStore.ts` (3 new methods), `src/sidepanel/stores/chatStore.ts` (delegate to agent), `src/sidepanel/components/ChatView.tsx` (agent integration), `src/sidepanel/components/MessageBubble.tsx` (tool call rendering)
- **Provider compatibility**: Semua provider support function calling. DeepSeek pakai format OpenAI-compatible
