## 1. Types + Tool Definitions

- [x] 1.1 Add types to `src/shared/types.ts`: ToolDefinition, ToolCall, ToolResult, LLMResponse, AgentStatus, AgentStep, AgentMessage — export semua
- [x] 1.2 Create `src/shared/tools.ts` with `AVAILABLE_TOOLS: ToolDefinition[]` — 8 tools dengan JSON Schema: read_active_file, write_file, edit_file, insert_at_cursor, replace_selection, list_open_files, read_file_by_name, finish

## 2. Update LLM Layer

- [x] 2.1 Ubah signature `callLLM()` — tambah parameter `tools?: ToolDefinition[]`, ubah return type dari `Promise<string>` ke `Promise<LLMResponse>`
- [x] 2.2 Implement tool format converters: `formatToolsOpenAI()`, `formatToolsAnthropic()`, `formatToolsGemini()` — DeepSeek reuse OpenAI
- [x] 2.3 Implement response parsers: `parseOpenAIResponse()`, `parseAnthropicResponse()`, `parseGeminiResponse()` — DeepSeek reuse OpenAI
- [x] 2.4 Update `callOpenAI()` — kirim tools di body, parse tool_calls dari response, handle finish_reason='tool_calls'
- [x] 2.5 Update `callAnthropic()` — kirim tools parameter, parse content[].type='tool_use', handle stop_reason='tool_use'
- [x] 2.6 Update `callGemini()` — kirim tools.functionDeclarations, parse parts[].functionCall
- [x] 2.7 Refactor `callDeepSeek()` — jadi delegate ke callOpenAI dengan base URL `https://api.deepseek.com`, hapus duplikasi
- [x] 2.8 Update `src/background/background.ts` — pass `payload.tools` ke callLLM(), return {success, text, toolCalls, finishReason}

## 3. Editor Tools (inject.js + editorStore)

- [x] 3.1 Add `LIST_FILES` handler di inject.js — iterasi monaco.editor.getEditors(), return [{name, language, isActive}]
- [x] 3.2 Add `READ_FILE_BY_NAME` handler di inject.js — cari editor by filename, focus, return MonacoEditorContext
- [x] 3.3 Add `EDIT_FILE` handler di inject.js — model.getValue() → String.replace(search, replace) → executeEdits() — fire-and-forget
- [x] 3.4 Add `listOpenFiles()` method ke editorStore — postMessage + promise with 2s timeout
- [x] 3.5 Add `readFileByName(filename)` method ke editorStore — postMessage + promise with 2s timeout
- [x] 3.6 Add `editFile(search, replace)` method ke editorStore — postMessage fire-and-forget

## 4. Agent Runtime

- [x] 4.1 Create `AgentRuntime` class di `src/sidepanel/services/agentRuntime.ts` — cancel flag, run() method
- [x] 4.2 Implement main loop di run() — init messages, for loop max 25 iterations, call LLM → parse → check termination → execute tools
- [x] 4.3 Implement `executeTool()` dispatch — switch on toolCall.name, panggil editorStore methods, try/catch wrapper
- [x] 4.4 Implement tool timeout — Promise.race() with 10s timeout, return error result on timeout
- [x] 4.5 Implement cancellation — check flag di tiap loop iteration, throw error if cancelled

## 5. Agent Store

- [x] 5.1 Create `agentStore` (Zustand) — status, steps[], finalResponse, error, run(), cancel(), reset()
- [x] 5.2 Implement `run()` — instantiate AgentRuntime, panggil dengan callbacks (onStep, onDone, onError), update state
- [x] 5.3 Implement `cancel()` dan `reset()` — cancel panggil runtime.cancel(), reset balikin ke default
- [x] 5.4 Update `chatStore` — add `addAgentResult()` method untuk sync final response ke chat history

## 6. Agent UI Components

- [x] 6.1 Create `ToolExecutionLog.tsx` — timeline component, collapsible steps, type icons, fade-in animation
- [x] 6.2 Update `ChatView.tsx` — ubah handleSend ke agentStore.run(), tambah agent status indicator + cancel button
- [x] 6.3 Update `MessageBubble.tsx` — support rendering agent tool execution context inline
- [x] 6.4 Styling — timeline visual, color coding (thinking=blue, tool_exec=amber, done=green, error=red), konsisten dengan existing design

## 7. Integration & Testing

- [x] 7.1 Type-check — `tsc --noEmit` via build, fix semua type errors
- [ ] 7.2 Test agent loop tiap provider — OpenAI, Anthropic, Gemini, DeepSeek — pastikan tool calls diparse dengan benar
- [ ] 7.3 Test tool execution — semua 8 tools bekerja (read, write, edit, insert, replace, list, readByName, finish)
- [ ] 7.4 Test safety — cancel button, max steps, timeout, error recovery
- [ ] 7.5 Test chat history — agent conversation tersimpan di chrome.storage, reload tetap ada
