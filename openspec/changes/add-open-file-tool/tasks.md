## 1. Inject Handler

- [x] 1.1 Di `inject-message-handler.js`, tambah fungsi `clickFileByIndex(i)` yang querySelector `li[data-index="${i}"]` dan dispatch `mousedown`, `mouseup`, `click` events dengan `bubbles: true`
- [x] 1.2 Tambah handler `OPEN_FILE`: ambil `index` dari payload, cek null `li`, panggil `clickFileByIndex(index)`, lalu poll `getActiveEditor().getModel()` setiap 100ms hingga model berubah atau timeout 3000ms
- [x] 1.3 Setelah poll berhasil, kirim `OPEN_FILE_RESULT` dengan `{ requestId, success: true, context: { code, language } }`
- [x] 1.4 Jika `li` null atau timeout, kirim `OPEN_FILE_RESULT` dengan `{ requestId, success: false, error }`

## 2. EditorStore

- [x] 2.1 Di `editorStore.ts`, tambah method `openFile(index: number)` yang kirim postMessage `OPEN_FILE` dan tunggu `OPEN_FILE_RESULT` via `waitForInjectedMessage`
- [x] 2.2 Tambah constant `OPEN_FILE_TIMEOUT_MS = 5000`

## 3. Tool

- [x] 3.1 Buat `src/shared/tools/open-file.ts` — tool `open_file` dengan parameter `index: number` (description: "One-based index of the file in the sidebar, first file = 1")
- [x] 3.2 Tool call `ctx.editorStore.openFile(index)`, jika sukses invalidate tool cache, return `{ success, index, code, language }`
- [x] 3.3 Daftarkan tool di `src/shared/tools/index.ts`

## 4. Agent Roles

- [x] 4.1 Di `src/shared/agents.ts`, tambah `'open_file'` ke `allowedTools` role `build` saja (tidak ke `explore` dan `plan`)
