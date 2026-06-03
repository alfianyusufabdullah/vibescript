## Context

VibeScript saat ini adalah chat interface satu-arah: user → LLM → response text. Kode AI cuma bisa nampilin code blocks yang manual di-copy atau di-klik tombol Insert/Replace.

Untuk mendukung agent loop, arsitektur perlu perubahan di 4 layer:
1. **Types** — tipe data baru untuk tool calls, tool results, agent state
2. **LLM Layer** — function calling adapter per provider (OpenAI, Anthropic, Gemini, DeepSeek)
3. **Runtime** — agent loop engine yang jalan di sidepanel, execute tool via window.postMessage ke inject.js
4. **UI** — komponen untuk visualisasi agent state, tool execution log

## Goals / Non-Goals

**Goals:**
- AI bisa baca file aktif, list semua file, ganti konten file, edit spesifik, insert/replace code
- Agent loop: LLM → tool calls → execute → hasil → LLM lagi → sampai selesai
- Cancel mechanism, max steps, timeout safety
- UI menampilkan agent status real-time dan tool execution log collapsible
- Semua provider support: OpenAI, Anthropic, Gemini, DeepSeek

**Non-Goals:**
- Multi-agent dispatch (orchestrator/sub-agents) — untuk fase berikutnya
- Streaming response — tetap pake request/response
- Running Apps Script function dari agent — untuk fase berikutnya
- File system access di luar Monaco editor (read/write file di filesystem lokal)

## Decisions

### DEC-1: Agent runtime di sidepanel, bukan background worker
- **Keputusan**: Agent loop berjalan di React app (sidepanel), LLM calls via background worker
- **Alasan**: Tool execution butuh akses window.postMessage ke inject.js (Monaco). Background worker ga punya akses ini
- **Alternatif**: Hybrid (background handle loop, sidepanel cuma execute tools) — lebih kompleks, IPC lebih berat
- **Konsekuensi**: Async/await loop ga nge-block UI karena React state updates asynchronous

### DEC-2: Provider adapter pake format converter pattern
- **Keputusan**: `formatTools()` + `parseResponse()` — fungsi converter per provider
- **Alasan**: Tiap provider punya format function calling berbeda. Pattern ini isolate perbedaan tanpa mengubah loop logic
- **Format**:
  - OpenAI & DeepSeek: `tools:[{type:"function",function:{name,description,parameters}}]` + `response.choices[0].message.tool_calls`
  - Anthropic: `tools:[{name,description,input_schema}]` + `response.content[].type==='tool_use'`
  - Gemini: `tools:{functionDeclarations:[{name,description,parameters}]}` + `response.candidates[0].content.parts[].functionCall`

### DEC-3: Tool `finish()` sebagai sentinel termination
- **Keputusan**: Loop berhenti ketika LLM panggil tool `finish(summary)` atau ketika response tanpa tool_calls
- **Alasan**: Explicit finish tool lebih reliable daripada parsing "I'm done" dari natural language
- LLM tetap bisa return text-only tanpa tool sebagai implicit termination

### DEC-4: AgentMessage format pake format OpenAI-compatible sebagai canonical
- **Keputusan**: Internal messages pakai format OpenAI (`tool_calls[]` + `tool_call_id`)
- **Alasan**: DeepSeek compatible, Anthropic dan Gemini bisa di-convert dari/ke format ini
- Mapping: Anthropic tool_use → tool_calls, Gemini functionCall → tool_calls

### DEC-5: Zustand store terpisah untuk agent state
- **Keputusan**: `agentStore.ts` baru (terpisah dari chatStore)
- **Alasan**: ChatStore handle history persistence, AgentStore handle runtime state. Separation of concerns
- Final response di-sync ke chatStore untuk persistence

## Risks / Trade-offs

- **[Risk] LLM looping infinitely** → Mitigasi: max 25 steps hard limit, cancel button
- **[Risk] Tool execution lama / hang** → Mitigasi: 10s timeout per tool, error result dikirim ke LLM
- **[Risk] Context window overflow** → Mitigasi: kalau messages kepanjangan, trim history terbaca (future enhancement)
- **[Risk] Provider response format berubah** → Mitigasi: adapter pattern — cukup update satu fungsi per provider
- **[Trade-off] Tanpa streaming** → User nunggu full response. Acceptable karena typical agent loop cuma 2-5 steps
