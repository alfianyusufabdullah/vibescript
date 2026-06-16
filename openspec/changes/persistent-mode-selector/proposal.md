## Why

Mengetik `@build`, `@explore`, atau `@plan` sebagai prefix di setiap pesan tidak ergonomis dan membingungkan karena `@` juga dipakai untuk mention file. Selain itu, karakter `/` tidak bisa diketik di chat input karena keyboard event bocor ke GAS IDE dan memicu shortcut-nya.

## What Changes

- Hapus parsing agent role dari prompt prefix (`@build`, `@explore`, `@plan` tidak lagi dibaca dari teks)
- Tambah dropdown kecil (shadcn `DropdownMenu`) di area input untuk memilih mode: Build, Explore, Plan
- Mode yang dipilih disimpan di `uiStore` dan di-persist ke `chrome.storage.local` — tidak perlu pilih ulang setiap sesi
- `@` autocomplete kini hanya menampilkan file mentions (bukan agent role)
- Stop propagation keyboard events dari dalam shadow DOM supaya karakter seperti `/` tidak memicu shortcut GAS IDE

## Capabilities

### New Capabilities

- `agent-mode-selector`: UI dropdown untuk memilih agent mode (Build/Explore/Plan) yang state-nya persists antar sesi

### Modified Capabilities

- `chat-footer`: Input area mendapat mode selector dropdown; `@` autocomplete hanya menampilkan files; keyboard events di-stop propagation
- `code-context-attachment`: `@` mention kini eksklusif untuk file (tidak ada ambiguitas dengan agent role prefix)

## Impact

- `src/content/mountApp.tsx` — tambah keyboard event stop propagation di shadow container
- `src/sidepanel/stores/uiStore.ts` — tambah `selectedRole` state + persist
- `src/sidepanel/stores/agentStore.ts` — `run()` terima role dari luar, bukan parse dari prompt
- `src/sidepanel/hooks/useChatInput.ts` — hapus agents dari autocomplete, baca `selectedRole` dari uiStore saat send
- `src/sidepanel/components/ChatView.tsx` — render mode selector dropdown di input area
- `src/shared/agents.ts` — `resolveAgentFromPrompt()` tidak lagi dipakai dari UI path
