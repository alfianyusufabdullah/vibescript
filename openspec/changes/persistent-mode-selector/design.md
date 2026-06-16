## Context

VibeScript saat ini menggunakan prefix `@build`, `@explore`, `@plan` di awal prompt untuk memilih agent role. Ini diparse oleh `resolveAgentFromPrompt()` di `agents.ts` dan dipanggil di `agentStore.run()` setiap kali pesan dikirim. State role tidak persists — user harus mengetiknya ulang di setiap pesan.

Selain itu, keyboard event dari textarea di dalam Shadow DOM bocor ke host page (GAS IDE), sehingga karakter seperti `/` memicu shortcut GAS IDE dan tidak bisa diketik di chat.

## Goals / Non-Goals

**Goals:**
- Mode selector dropdown persists di `uiStore` (survive reload via `chrome.storage.local`)
- `@` autocomplete hanya menampilkan files
- `/` dan karakter lain bisa diketik bebas di chat input
- Gunakan shadcn `DropdownMenu` untuk konsistensi komponen

**Non-Goals:**
- Mengubah behavior agent runtime / tool access per role
- Menambah role baru
- Backward compatibility untuk user yang masih mengetik `@build` di prompt (cukup diabaikan)

## Decisions

### 1. State persistence: `uiStore` bukan `settingsStore`

`selectedRole` disimpan di `uiStore` karena ini adalah UI state (bukan konfigurasi provider/model). `uiStore` sudah punya `saveUiState()` yang persist ke `chrome.storage.local` dan `loadUiState()` untuk restore. Tidak perlu mekanisme baru.

**Alternatif ditolak**: `settingsStore` — terlalu coupling dengan provider settings; `agentStore` — state-nya ephemeral per-run.

### 2. Role dikirim ke `agentStore.run()` dari luar, bukan diparse dari prompt

`agentStore.run()` menerima `role` sebagai parameter eksplisit di `ContextInfo`. `resolveAgentFromPrompt()` di `agents.ts` tetap ada tapi tidak lagi dipanggil dari UI path. Ini memisahkan concern: UI yang tentukan role, bukan teks prompt.

**Alternatif ditolak**: Tetap parse dari prompt — mempertahankan ambiguitas `@` antara role dan file mention.

### 3. Keyboard event stop propagation di shadow container level

Stop propagation dilakukan di `mountApp.tsx` dengan menambahkan `keydown` dan `keyup` event listener pada `reactContainer` (div di dalam shadow DOM) yang memanggil `e.stopPropagation()`. Ini mencegah semua keyboard event dari dalam shadow DOM bocor ke GAS IDE.

**Alternatif ditolak**: Stop di textarea level saja — tidak cukup karena event bisa datang dari komponen lain (input settings, dsb); Stop key tertentu saja — fragile, harus tahu semua shortcut GAS IDE yang bermasalah.

### 4. UI: shadcn `DropdownMenu` kecil di kiri input area

Dropdown ditempatkan di sebelah kiri textarea, menampilkan label mode aktif dan chevron kecil. Menggunakan `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` dari shadcn/ui untuk konsistensi. Lebar dropdown cukup untuk label "Build / Explore / Plan".

## Risks / Trade-offs

- **User yang terbiasa mengetik `@build`** → prompt mereka akan dikirim as-is tanpa parsing role. Mitigasi: `@build` di teks prompt hanya jadi teks biasa, tidak ada error.
- **Stop propagation semua keyboard** → shortcut GAS IDE yang mungkin diinginkan user (misal Ctrl+S untuk save) tidak bisa dipanggil saat fokus di chat. Trade-off yang acceptable: user bisa klik di luar chat lalu gunakan shortcut GAS.
