## 1. Background Routing (`background.ts`)

- [x] 1.1 Add fallback routing for DIFF_RESULT when `tabEditorFrames[tabId]` is undefined — route to `frameId: 0`
- [x] 1.2 Add console.warn logging when fallback routing is triggered
- [x] 1.3 Remove the silent-drop `else` branch — handle all frame scenarios

## 2. Diff Overlay Lifecycle (`inject.js`)

- [x] 2.1 Move `_diffOverlayCleanup` initialization outside `requestAnimationFrame` — set synchronously before rAF
- [x] 2.2 Add guard to call previous `_diffOverlayCleanup` before overwriting it (dispose old models on new overlay)
- [x] 2.3 Add duplicate overlay check — remove existing `#vibescript-diff-overlay` before creating new one
- [x] 2.4 Make `cleanup()` idempotent with disposed flag — guard `isDisposed()` on Monaco models, try-catch dispose calls
- [x] 2.5 Ensure `_diffOverlayCleanup = null` after first invocation to prevent double execution

## 3. Diff Approve Handler (`inject.js`)

- [x] 3.1 Wrap `editor.executeEdits` in try-catch inside the approve onclick handler
- [x] 3.2 On success: call `finish(true)` — post DIFF_RESULT with `{ approved: true }`
- [x] 3.3 On error: call `finish(false)` — post DIFF_RESULT with `{ approved: false, output: error.message }`

## 4. Timeout & Cancel (`editorStore.ts`, `agentRuntime.ts`)

- [x] 4.1 Remove `DIFF_REVIEW_TIMEOUT` constant from `agentRuntime.ts`
- [x] 4.2 In `executeToolWithTimeout`, skip timeout race for `edit_file` (let editorStore own the timeout)
- [x] 4.3 Reduce editorStore timeout from `300_000` to `60_000`
- [x] 4.4 Store timeout ID in editorStore module-level variable (`_editReviewTimeout`)
- [x] 4.5 Store message event handler reference in editorStore module-level variable (`_editReviewHandler`)
- [x] 4.6 Update `cancelDiffReview()` to clearTimeout and removeEventListener
- [x] 4.7 Ensure `cancelDiffReview` also posts `EDIT_FILE_REVIEW_CANCEL` (existing behavior preserved)

## 5. Rejection Check (`edit-file.ts`)

- [x] 5.1 Change `if (!result.approved)` to `if (result.approved === false)` for user rejection detection
- [x] 5.2 Add explicit handling for `undefined`/non-boolean `approved`: return error (not USER_REJECTED)

## 6. Content Script Reliability (`content.tsx`)

- [x] 6.1 Add error callback to DIFF_RESULT `chrome.runtime.sendMessage` (editor frame → background)
- [x] 6.2 Add error callback to EDIT_FILE_REVIEW `chrome.runtime.sendMessage` (main frame → background)

## 7. Polling Cleanup (`inject.js`)

- [x] 7.1 Replace the perpetual `setInterval` for editor hooking with a one-shot poll (max N attempts or stop on success)
- [x] 7.2 Clear the polling interval/timer once editors are successfully hooked
- [x] 7.3 Log a warning if max attempts are reached without finding editors

## 8. Additional Issues

- [x] 8.1 Fix Monaco polling: add max attempt limit (60 attempts @ 1s)
- [x] 8.2 Fix onApprove failure paths: call `finish(false)` instead of `cleanup()` to post DIFF_RESULT
- [x] 8.3 Wrap executeEdits in 5 other handlers: SET_CODE, INSERT_AT_CURSOR, REPLACE_SELECTION, EDIT_FILE(fallback), EDIT_FILE(single)
- [x] 8.4 Build: run `npm run build` and verify no errors

## 9. Session Error Resilience

- [x] 9.1 Wrap session operations in `agentStore.run()` with try-catch — session errors don't prevent agent execution
- [x] 9.2 Wrap session save in `onDone` callback with try-catch — unhandled rejections don't break UI
- [x] 9.3 Wrap session operations in `handleNewSession` with try-catch — "New session" works even if save fails
- [x] 9.4 Wrap session operations in `handleSwitchSession` with try-catch — session switch works even if save/load fails
- [ ] 8.2 Test: user clicks Approve → DIFF_RESULT reached editorStore → tool returns success
- [ ] 8.3 Test: user clicks Reject → tool returns USER_REJECTED → agent stops with appropriate message
- [ ] 8.4 Test: user clicks Cancel agent → cancel terminates within 1s (no 5-minute wait)
- [ ] 8.5 Test: rapid edit_file calls → no overlay stacking, no model leak
- [ ] 8.6 Test: background tab diff review → cancel still works (no rAF dependency)
