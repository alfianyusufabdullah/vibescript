## Why

The diff review approval flow has 17 confirmed bugs causing three critical issues: (1) agent stops as if rejected after the user approves an edit, (2) tool execution status stuck on "running" for up to 5 minutes with no recovery, and (3) page becomes progressively heavier with each edit due to accumulated memory leaks (Monaco models never disposed) and unstoppable timers.

## What Changes

- **Background routing**: Fix DIFF_RESULT silently dropped when `tabEditorFrames` frame ID mismatches or is missing. Always route DIFF_RESULT to main frame regardless.
- **Inject.js approve handler**: Wrap `editor.executeEdits` in try-catch so `finish(true)` is always called. Set `_diffOverlayCleanup` synchronously before async overlay creation so cancel works immediately.
- **Inject.js overlay disposal**: Dispose previous diff editor models before `_diffOverlayCleanup` is overwritten. Make `cleanup()` idempotent. Add guard against duplicate overlays.
- **EditorStore timeout**: Single timeout source of truth (60s). Store timeout ID and clear it in `cancelDiffReview()`. AgentRuntime no longer sets its own timeout for `edit_file`.
- **Edit-file tool**: Change `!result.approved` to `result.approved === false` to prevent timeout/malformed responses from being treated as user rejection.
- **Content script**: Add error callbacks to `chrome.runtime.sendMessage` for DIFF_RESULT and EDIT_FILE_REVIEW messages.
- **Inject.js polling**: Replace perpetual `setInterval` hooking editors with one-shot poll that stops after completion.

## Capabilities

### New Capabilities
- `background-routing`: Reliable cross-frame message routing with fallback when editor frame ID is unknown.
- `diff-overlay-lifecycle`: Proper Monaco model lifecycle — synchronously init cleanup before async overlay, dispose old models before overwrite, idempotent dispose, guard duplicate overlays.
- `diff-approve-handler`: `executeEdits` wrapped in try-catch. `finish()` always called regardless of edit success.
- `edit-file-timeout`: Single 60s timeout managed by editorStore. AgentRuntime delegates entirely. `cancelDiffReview` clears timeout.
- `edit-file-rejection`: Strict `=== false` check for `result.approved`. Non-boolean values treated as error, not user rejection.
- `content-message-reliability`: Error callbacks on `chrome.runtime.sendMessage`. Failures logged.
- `editor-polling-cleanup`: One-shot poll that stops after editors are hooked.

### Modified Capabilities
- (none)

## Impact

- `src/background/background.ts` lines 120-134: fallback routing
- `src/content/inject.js` lines 67-207, 432-435, 794-799: approve handler, cleanup lifecycle, cancel, polling
- `src/content/content.tsx` lines 188-214: sendMessage error callbacks
- `src/sidepanel/stores/editorStore.ts` lines 264-299: timeout management, cancel
- `src/sidepanel/services/agentRuntime.ts` lines 473-479: remove edit_file timeout
- `src/shared/tools/edit-file.ts` line 31: strict rejection check
