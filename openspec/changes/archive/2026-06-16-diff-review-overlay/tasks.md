## 1. Message Protocol

- [x] 1.1 Add `EDIT_FILE_REVIEW` and `DIFF_RESULT` to `MessageAction` type in `shared/types.ts`

## 2. Diff Overlay in inject.js

- [x] 2.1 Add `EDIT_FILE_REVIEW` message handler in `inject.js` — read current code, compute modified code in memory, verify unique match
- [x] 2.2 Build overlay DOM structure (backdrop, panel, header with filename + stats, diff container, footer with Approve/Reject buttons)
- [x] 2.3 Instantiate Monaco DiffEditor in the overlay container with `renderSideBySide: true`, read-only models
- [x] 2.4 Implement Approve handler — `executeEdits` on real editor, dispose models + overlay, post `DIFF_RESULT{approved: true}`
- [x] 2.5 Implement Reject handler — no edit, dispose models + overlay, post `DIFF_RESULT{approved: false}`
- [x] 2.6 Style overlay to match GitHub diff aesthetic (file header bar, change stats badges, green/red buttons, backdrop)

## 3. editorStore Method

- [x] 3.1 Add `EditFileReviewResult` interface with `approved` and `output` fields in `editorStore.ts`
- [x] 3.2 Add `editFileWithReview(search, replace)` method — posts `EDIT_FILE_REVIEW`, returns promise resolved by `DIFF_RESULT` message, 5-minute timeout returns rejected

## 4. Agent Runtime Wiring

- [x] 4.1 In `agentRuntime.ts` — replace `editorStore.editFile()` with `editorStore.editFileWithReview()` in the `edit_file` case
- [x] 4.2 Handle rejection — if `result.approved === false`, set tool result error to `USER_REJECTED`, check after tool execution in the main loop and call `callbacks.onDone()` to stop gracefully
- [x] 4.3 Handle agent cancel during overlay — add `cancelDiffReview()` to editorStore, call it from `agentRuntime.cancel()`, handle `EDIT_FILE_REVIEW_CANCEL` in inject.js
