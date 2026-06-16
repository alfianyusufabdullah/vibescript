## ADDED Requirements

### Requirement: Question card tampil ketika agent menunggu input
UI SHALL menampilkan question card di chat timeline ketika `AgentStatus === 'waiting_for_input'`.

#### Scenario: Card muncul saat ask_user dipanggil
- **WHEN** agent memanggil `ask_user` dan status berubah ke `waiting_for_input`
- **THEN** question card muncul di bawah pesan agent yang sedang berjalan
- **AND** regular chat input area disabled

#### Scenario: Card hilang setelah user menjawab
- **WHEN** user submit jawaban
- **THEN** question card tidak lagi interaktif (menjadi read-only atau hilang)
- **AND** regular chat input area kembali disabled sampai agent selesai

---

### Requirement: Question card menampilkan opsi sebagai clickable chip
Jika `ask_user` menyertakan `options[]`, UI SHALL merender setiap opsi sebagai chip yang bisa diklik.

#### Scenario: Render opsi sebagai chip
- **WHEN** question card ditampilkan dengan `options: ["A", "B", "C"]`
- **THEN** tiga chip button tampil di bawah teks pertanyaan

#### Scenario: Klik chip auto-submit
- **WHEN** user klik salah satu chip
- **THEN** teks chip menjadi jawaban dan langsung di-submit tanpa perlu tekan tombol kirim

#### Scenario: Klik chip mengisi input (opsional edit sebelum submit)
- **WHEN** user klik chip
- **THEN** teks chip mengisi text input — user bisa edit sebelum submit jika mau

---

### Requirement: Question card memiliki free-text input sebagai fallback
Question card SHALL selalu menampilkan text input dan tombol kirim, baik dengan atau tanpa opsi.

#### Scenario: Input manual tanpa opsi
- **WHEN** question card ditampilkan tanpa `options`
- **THEN** hanya text input dan tombol kirim yang tampil

#### Scenario: Input manual selain opsi yang tersedia
- **WHEN** question card ditampilkan dengan opsi
- **THEN** text input dan tombol kirim tetap tersedia di bawah chip-chip opsi
- **AND** user bisa ketik jawaban custom lalu submit

#### Scenario: Submit dengan input kosong tidak diizinkan
- **WHEN** user menekan tombol kirim dengan input kosong dan tidak ada chip yang dipilih
- **THEN** submit tidak terjadi (tombol disabled atau ada visual feedback)

---

### Requirement: Question card tidak mengganggu regular chat input
Selama `waiting_for_input`, regular chat input area (tempat user biasa mengirim pesan baru) SHALL disabled.

#### Scenario: Chat input disabled saat waiting
- **WHEN** `AgentStatus === 'waiting_for_input'`
- **THEN** regular chat textarea dan send button tidak bisa diinteraksi

#### Scenario: Chat input kembali normal setelah agent selesai
- **WHEN** `AgentStatus` kembali ke `'idle'` atau `'done'`
- **THEN** regular chat input kembali aktif
