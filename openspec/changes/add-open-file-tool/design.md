## Context

VibeScript agent berkomunikasi dengan Monaco editor melalui postMessage bridge (content script ↔ inject script). Semua operasi file (read, edit) bekerja pada active file Monaco. Saat ini tidak ada cara bagi agent untuk berpindah file secara programatik.

Fungsi click yang digunakan:
```js
function clickFileByIndex(i) {
  const li = document.querySelector(`li[data-index="${i}"]`);
  if (!li) return console.warn(`Index ${i} not found`);
  li.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  li.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }));
  li.dispatchEvent(new MouseEvent('click',     { bubbles: true }));
}
```

## Goals / Non-Goals

**Goals:**
- Agent dapat switch active file dengan memberikan index file di sidebar
- Tool return file context lengkap setelah switch berhasil
- Eksekusi tanpa approval user (non-mutating dari sisi konten)
- Polling memastikan Monaco sudah benar-benar switch sebelum return

**Non-Goals:**
- Bukan untuk membuat file baru
- Bukan untuk resolve nama file ke index — agent harus tahu index dari `list_open_files`
- Tidak perlu update `editorStore.currentContext` secara reactive

## Decisions

### 1. Argumen tool: `index` (number)

Agent mendapat daftar file beserta urutannya dari `list_open_files`. Index yang dimaksud adalah posisi file di sidebar (`li[data-index="${i}"]`). Agent cukup pass angka ini langsung ke tool.

### 2. Click menggunakan tiga event: `mousedown` + `mouseup` + `click`

GAS IDE mendengarkan kombinasi event ini untuk switching tab file, bukan hanya `click` biasa. Menggunakan ketiga event memastikan switch terjadi.

### 3. Polling, bukan fixed delay

Setelah click, poll `getActiveEditor().getModel()` setiap 100ms sampai model URI berubah atau timeout 3000ms. Lebih reliable dari fixed delay.

### 4. Return full file context setelah switch

Tool return `{ index, code, language }` setelah switch berhasil. Agent tidak perlu call `read_active_file` lagi — bisa langsung decide next step.

### 5. Invalidate tool cache setelah open berhasil

Sama seperti `edit_file`, setelah `open_file` berhasil cache read tools harus diinvalidasi agar `read_active_file` dan sejenisnya reflect file yang baru aktif.

### 6. Hanya tersedia untuk role `build`

`explore` dan `plan` hanya butuh membaca file — `read_file_by_name` sudah cukup. `open_file` tidak perlu ada di read-only roles.

## Risks / Trade-offs

- **[Risk] `li[data-index]` tidak ada di DOM GAS IDE versi tertentu** → click gagal, `li` null → Mitigasi: cek null sebelum dispatch, return error informatif
- **[Risk] Monaco poll timeout (3000ms)** → file lambat load → Mitigasi: return error dengan pesan jelas
- **[Risk] Index tidak sinkron dengan urutan DOM** → agent klik file yang salah → Mitigasi: `list_open_files` harus return files dalam urutan yang sama dengan DOM sidebar
