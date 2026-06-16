## Context

AgentRuntime saat ini menjalankan agentic loop yang bersifat fully autonomous — tidak ada mekanisme untuk pause dan menunggu user input di tengah eksekusi. Tool `finish` sudah membuktikan pola "tool yang mengubah state runtime" via `signalStop()` di `ToolContext`. `editFileWithReview` sudah membuktikan pola "tool yang block sampai user merespons" via diff review flow. Feature ini menggabungkan kedua pola tersebut untuk `ask_user`.

## Goals / Non-Goals

**Goals:**
- Agent bisa pause loop dan menunggu jawaban user via tool call
- Agent bisa propose opsi pilihan; user bisa pilih atau input manual
- Loop tersuspend secara natural (Promise-based), tidak perlu mekanisme pause/resume eksplisit
- System prompt `build` agent diperketat untuk selalu gunakan `ask_user` saat ambiguitas
- System prompt `build` agent diberi batasan granularitas edit untuk mencegah replace block besar

**Non-Goals:**
- Multi-question dalam satu `ask_user` call (satu pertanyaan per call)
- Pertanyaan dari `explore` atau `plan` agent (hanya `build`)
- History pertanyaan yang persisted across sessions
- Timeout otomatis jika user tidak menjawab

## Decisions

### D1: Promise-based blocking, bukan interrupt/resume

`ask_user` tool `execute()` membuat sebuah `Promise` dan menyimpan `resolve` function-nya. Tool mengembalikan Promise tersebut — loop hanya `await` seperti tool biasa. Tidak perlu mekanisme pause/resume eksplisit, tidak ada state machine tambahan di runtime.

**Alternatif ditolak**: Emit event + freeze loop via flag (mirip `stopRequested`) — memerlukan polling/check di setiap iterasi loop, lebih fragile.

### D2: Resolver disimpan di AgentRuntime, dipropagasi via callback baru

`AgentRuntime` punya private field `pendingInputResolver: ((answer: string) => void) | null`. Ketika `ask_user` dipanggil, field ini di-set. Method publik `resolveUserInput(answer: string)` memanggilnya dan reset ke null.

`AgentRuntimeCallbacks` dapat callback baru `onQuestion(question: string, options?: string[])` — dipanggil saat `ask_user` dieksekusi. `agentStore` menyimpan pertanyaan ini di state dan memanggil `runtime.resolveUserInput()` saat user menjawab.

**Alternatif ditolak**: Event bus global — terlalu loose coupling, sulit track lifecycle resolver.

### D3: `ToolContext` mendapat `requestUserInput` callback

```typescript
// ToolContext tambahan:
requestUserInput: (question: string, options?: string[]) => Promise<string>
```

AgentRuntime inject implementasi yang: set `pendingInputResolver`, emit `onQuestion` callback, return Promise. Tool `ask_user` hanya perlu call `ctx.requestUserInput(question, options)`.

### D4: `AgentStatus` tambah `'waiting_for_input'`

Status ini set saat resolver dibuat, clear kembali ke `'executing_tools'` setelah resolver dipanggil. UI gunakan status ini untuk: disable chat input, show question card, hide regular "Stop" button jika diinginkan.

### D5: Cancel saat waiting membatalkan resolver

Jika `cancel()` dipanggil saat ada `pendingInputResolver`, runtime memanggil resolver dengan sentinel value `'__CANCELLED__'`. Tool detect value ini dan return `{ error: 'CANCELLED' }` — loop exit via mekanisme cancel yang sudah ada.

### D6: Edit granularity via system prompt, bukan tool-level enforcement

Batasan "max lines per replace" lebih efektif sebagai instruksi LLM daripada hard validation di tool — karena ukuran yang "terlalu besar" kontekstual. System prompt akan instruksikan: edit satu logical section per call, max ~20 baris per `replace`, jangan gunakan seluruh function body sebagai `search`.

## Risks / Trade-offs

- **LLM tidak selalu patuh `ask_user`** → Mitigasi: instruksi di system prompt harus eksplisit dan ada contoh use case konkret
- **Double resolver call** jika ada race condition → Mitigasi: `resolveUserInput()` check `pendingInputResolver !== null` sebelum call, lalu null-ify dulu sebelum invoke
- **Edit granularity sulit di-enforce via prompt saja** → Mitigasi: bisa ditambahkan soft validation di `edit_file` tool yang warn jika `replace` > 30 baris, tanpa block
