## Why

Agent saat ini hanya bisa membaca dan mengedit file yang sedang aktif di Monaco editor. Ketika agent perlu memodifikasi file lain (misalnya refactor lintas file), agent tidak bisa — karena `edit_file` hanya bekerja pada active file dan tidak ada mekanisme untuk berpindah file secara programatik.

## What Changes

- Tambah tool baru `open_file` yang memungkinkan agent berpindah active file di Monaco editor GAS IDE
- Agent memberikan argumen `index` (nomor urut file di sidebar), inject script mengklik `li[data-index="${i}"]` dengan dispatching `mousedown` + `mouseup` + `click` events
- Tool poll hingga Monaco confirm switch, lalu return file context yang sudah aktif
- Tool tidak memerlukan approval user — dieksekusi langsung seperti tool read-only
- Tool **tidak** dimasukkan ke `MUTATING_TOOLS` (tidak trigger sequential lock) karena tidak mengubah konten file
- Setelah berhasil, tool return file context lengkap (code, language) sehingga agent langsung bisa decide next step tanpa read ulang

## Capabilities

### New Capabilities

- `open-file-tool`: Tool `open_file` untuk agent — switch active file di Monaco editor by index, dengan polling konfirmasi dan return context

### Modified Capabilities

*(tidak ada)*

## Impact

- `src/shared/tools/open-file.ts` — file tool baru
- `src/shared/tools/index.ts` — register tool baru
- `src/sidepanel/stores/editorStore.ts` — tambah method `openFile(index: number)`
- `src/content/inject-message-handler.js` — tambah handler `OPEN_FILE` / `OPEN_FILE_RESULT` menggunakan `clickFileByIndex`
- `src/shared/agents.ts` — tambah `open_file` ke `allowedTools` role `build`
