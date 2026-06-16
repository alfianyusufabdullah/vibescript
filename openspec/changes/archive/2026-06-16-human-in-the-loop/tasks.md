## 1. Types & Contracts

- [x] 1.1 Tambah `'waiting_for_input'` ke `AgentStatus` union di `src/shared/types.ts`
- [x] 1.2 Tambah `requestUserInput: (question: string, options?: string[]) => Promise<string>` ke interface `ToolContext` di `src/shared/types.ts`

## 2. ask_user Tool

- [x] 2.1 Buat `src/shared/tools/ask-user.ts` — tool schema `{ question: string, options?: string[] }`, implementasi call `ctx.requestUserInput(question, options)`
- [x] 2.2 Register `askUserTool` di `src/shared/tools/index.ts`

## 3. AgentRuntime Wiring

- [x] 3.1 Tambah private field `pendingInputResolver: ((answer: string) => void) | null = null` di `AgentRuntime`
- [x] 3.2 Tambah method publik `resolveUserInput(answer: string)` yang invoke resolver (dengan null guard) lalu reset ke null
- [x] 3.3 Tambah callback `onQuestion?: (question: string, options?: string[]) => void` ke interface `AgentRuntimeCallbacks`
- [x] 3.4 Inject `requestUserInput` ke `ToolContext` saat runtime mengeksekusi tools — implementasi: set resolver, emit `onQuestion` callback, emit `agent:status` `waiting_for_input`, return Promise
- [x] 3.5 Update `cancel()` di `AgentRuntime`: jika `pendingInputResolver !== null`, panggil dengan `'__CANCELLED__'` sebelum set `cancelled = true`

## 4. AgentStore State

- [x] 4.1 Tambah `pendingQuestion: { text: string; options?: string[] } | null` ke `AgentState` di `src/sidepanel/stores/agentStore.ts`
- [x] 4.2 Tambah action `resolveQuestion(answer: string)` yang call `agentRuntime.resolveUserInput(answer)` dan clear `pendingQuestion`
- [x] 4.3 Wire `onQuestion` callback di `agentStore.run()` untuk set `pendingQuestion` state

## 5. Question Card UI

- [x] 5.1 Buat component `QuestionCard` (di `src/sidepanel/components/`) — render teks pertanyaan, chip buttons (jika ada opsi), text input, tombol kirim
- [x] 5.2 Implementasi chip click behavior: isi text input dengan teks chip, lalu auto-submit
- [x] 5.3 Disable tombol kirim jika input kosong
- [x] 5.4 Integrasikan `QuestionCard` ke `ChatView` — tampilkan ketika `agentStore.pendingQuestion !== null`
- [x] 5.5 Pastikan regular chat input disabled ketika `status === 'waiting_for_input'` (sudah sebagian handled — cek kondisi yang ada)

## 6. System Prompt Updates

- [x] 6.1 Update system prompt `build` role di `src/shared/agents.ts`: ganti instruksi "make reasonable interpretation" menjadi "gunakan `ask_user` saat ambigu"
- [x] 6.2 Tambah section `ask_user` ke tabel tools build agent (kapan digunakan, contoh use case)
- [x] 6.3 Tambah aturan granularitas edit ke `## edit_file rules`: max ~20 baris per `replace`, pecah perubahan besar menjadi multiple edit_file calls berurutan
