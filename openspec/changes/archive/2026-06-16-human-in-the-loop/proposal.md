## Why

Agent saat ini beroperasi autonomously — kalau ada ambiguitas ia membuat asumsi sendiri dan lanjut, dan kalau mau edit kode ia bisa replace block besar sekaligus. Dua hal ini menyebabkan agent sering melakukan sesuatu yang tidak sesuai ekspektasi user tanpa ada kesempatan untuk intervensi.

## What Changes

- **New**: Tool `ask_user` yang memungkinkan agent pause dan menunggu jawaban user sebelum melanjutkan
- **New**: Tool `ask_user` mendukung `options[]` — agent bisa propose pilihan, user bisa pilih atau input manual
- **New**: UI "question card" yang render pertanyaan agent dengan opsi sebagai clickable chip + free-text fallback
- **New**: `AgentStatus` baru: `'waiting_for_input'` — loop tersuspend sampai user menjawab
- **Modified**: System prompt `build` agent diperketat: wajib gunakan `ask_user` saat ada ambiguitas, bukan asumsi diam-diam
- **Modified**: System prompt `build` agent diberi batasan granularitas edit: tidak boleh replace block besar sekaligus, harus dipecah per section

## Capabilities

### New Capabilities

- `ask-user-tool`: Tool `ask_user` dengan schema `{ question, options? }`, runtime wiring (Promise-based blocking), dan `AgentStatus` baru `waiting_for_input`
- `question-card-ui`: UI component untuk merender pertanyaan agent — opsi sebagai clickable chip, free-text input sebagai fallback, behavior submit on chip click

### Modified Capabilities

<!-- none -->

## Impact

- `src/shared/types.ts` — extend `AgentStatus`, extend `ToolContext` dengan `requestUserInput`
- `src/shared/tools/` — file baru `ask-user.ts`
- `src/shared/tools/index.ts` — register tool baru
- `src/shared/agents.ts` — update system prompt `build` role (ask_user instruction + edit granularity rules)
- `src/sidepanel/services/agentRuntime.ts` — wiring resolver, method `resolveUserInput()`
- `src/sidepanel/stores/agentStore.ts` — state `pendingQuestion`, action `resolveQuestion()`
- `src/sidepanel/components/ChatView.tsx` atau komponen baru — render question card
