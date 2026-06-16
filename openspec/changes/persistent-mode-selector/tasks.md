## 1. Keyboard Event Isolation

- [x] 1.1 Di `mountApp.tsx`, tambahkan `keydown` dan `keyup` event listener pada `reactContainer` yang memanggil `e.stopPropagation()`

## 2. Persistent Mode State

- [x] 2.1 Di `uiStore.ts`, tambah field `selectedRole: string` dengan default `'build'`
- [x] 2.2 Sertakan `selectedRole` dalam `SavedUiState` dan `saveUiState()` supaya persist ke `chrome.storage.local`
- [x] 2.3 Restore `selectedRole` di `loadUiState()` dari saved state

## 3. Agent Role Decoupled dari Prompt

- [x] 3.1 Di `agentStore.ts`, tambah `role?: AgentRole` ke interface `ContextInfo`
- [x] 3.2 Di `agentStore.run()`, gunakan `contextInfo.role` jika ada, fallback ke `AGENT_ROLES.build` — hapus pemanggilan `resolveAgentFromPrompt()`

## 4. Chat Input: File-only Autocomplete

- [x] 4.1 Di `useChatInput.ts`, hapus `filteredAgents` state dan logika filternya
- [x] 4.2 Di `useChatInput.ts`, hapus agents section dari autocomplete keyboard handler (`handleKeyDown`)
- [x] 4.3 Di `useChatInput.ts`, baca `selectedRole` dari `uiStore` dan kirim sebagai `role` di `contextInfo` saat `handleSend()`
- [x] 4.4 Di `ChatView.tsx`, hapus render agents section dari autocomplete dropdown

## 5. Mode Selector UI

- [x] 5.1 Gunakan shadcn `Select` (sudah tersedia) sebagai pengganti `DropdownMenu` yang tidak terinstall
- [x] 5.2 Buat komponen mode selector di `ChatView.tsx` menggunakan `Select` shadcn — tampilkan label mode aktif + chevron
- [x] 5.3 Hubungkan selector ke `uiStore.selectedRole`: read untuk label, write saat item dipilih
- [x] 5.4 Disable trigger button saat agent status `thinking` atau `executing_tools`
