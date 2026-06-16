## ADDED Requirements

### Requirement: ask_user tool tersedia untuk build agent
Build agent (`@build`) SHALL memiliki akses ke tool `ask_user` yang dapat dipanggil untuk meminta input dari user selama agentic loop berjalan.

#### Scenario: Tool terdaftar di build role
- **WHEN** `build` agent role dikonfigurasi
- **THEN** `ask_user` termasuk dalam `allowedTools: '*'`

#### Scenario: Tool tidak tersedia di explore dan plan agent
- **WHEN** `explore` atau `plan` agent mencoba memanggil `ask_user`
- **THEN** tool call gagal karena tool tidak ada di `allowedTools` mereka

---

### Requirement: ask_user menerima question dan opsi opsional
Tool `ask_user` SHALL menerima `question` (string, required) dan `options` (array of string, optional).

#### Scenario: Panggil dengan opsi
- **WHEN** agent memanggil `ask_user({ question: "Pilih pendekatan?", options: ["A", "B", "C"] })`
- **THEN** tool mengirimkan pertanyaan dan opsi ke UI, lalu menunggu jawaban

#### Scenario: Panggil tanpa opsi
- **WHEN** agent memanggil `ask_user({ question: "Nama function apa?" })`
- **THEN** tool mengirimkan pertanyaan tanpa opsi ke UI, lalu menunggu jawaban

#### Scenario: Validasi: question wajib ada
- **WHEN** agent memanggil `ask_user({})` tanpa `question`
- **THEN** tool return error dan loop melanjutkan dengan error result

---

### Requirement: Loop tersuspend sampai user menjawab
Agentic loop SHALL berhenti melakukan LLM call atau tool execution selain menunggu jawaban user selama `ask_user` dalam status pending.

#### Scenario: Loop suspended
- **WHEN** `ask_user` dipanggil
- **THEN** `AgentStatus` berubah ke `'waiting_for_input'`
- **AND** tidak ada LLM call atau tool lain yang berjalan sampai user menjawab

#### Scenario: Loop resume setelah jawaban
- **WHEN** user memberikan jawaban
- **THEN** tool return `{ output: <jawaban user> }` ke LLM
- **AND** `AgentStatus` kembali ke `'executing_tools'`
- **AND** loop melanjutkan iterasi berikutnya

---

### Requirement: Cancel saat waiting_for_input membatalkan loop
Jika user menekan cancel/stop saat agent sedang menunggu jawaban `ask_user`, loop SHALL berhenti.

#### Scenario: Cancel saat pending question
- **WHEN** `cancel()` dipanggil dan ada pending `ask_user`
- **THEN** pending resolver dipanggil dengan sentinel `'__CANCELLED__'`
- **AND** tool return error result
- **AND** loop exit via cancel flow yang sudah ada

---

### Requirement: System prompt menginstruksikan kapan gunakan ask_user
System prompt `build` agent SHALL secara eksplisit menginstruksikan agent untuk menggunakan `ask_user` daripada membuat asumsi diam-diam.

#### Scenario: Instruksi untuk ambiguitas
- **WHEN** prompt build agent di-load
- **THEN** system prompt berisi instruksi: gunakan `ask_user` saat intent ambigu, ada banyak pendekatan valid, atau keputusan bisa berdampak besar

#### Scenario: Instruksi untuk granularitas edit
- **WHEN** prompt build agent di-load
- **THEN** system prompt berisi batasan: max ~20 baris per `replace` argument, pecah perubahan besar menjadi edit berurutan
