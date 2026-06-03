## Why

Currently the agent applies `edit_file` changes directly to the Monaco editor in Google Apps Script with zero user oversight. Users have no chance to review what the agent is about to change before it happens. This makes the agent feel untrustworthy and risky — especially for destructive edits. Adding a review step where changes are shown as a GitHub-style diff overlay before applying gives users control and confidence.

## What Changes

- Agent pauses before applying `edit_file` and shows a side-by-side Monaco DiffEditor overlay
- Overlay appears as a modal on top of the GAS editor, showing original vs modified code
- User can Approve (apply edit) or Reject (stop agent, no edit)
- If rejected, agent stops cleanly — no error state, just a graceful stop
- Only `edit_file` is affected; `write_file` and other tools remain unchanged
- Overlay is rendered entirely in page context via `inject.js` using `window.monaco` APIs

## Capabilities

### New Capabilities

- `editor-diff-review`: Show a GitHub-style side-by-side diff in a Monaco DiffEditor overlay before applying agent edits, with Approve/Reject controls

### Modified Capabilities

- *(none)*

## Impact

- `src/shared/types.ts` — add new `MessageAction` enum values for diff review protocol
- `src/content/inject.js` — add `EDIT_FILE_REVIEW` message handler; create/destroy overlay; compute diff; apply edit on approval
- `src/sidepanel/stores/editorStore.ts` — add `editFileWithReview()` method
- `src/sidepanel/services/agentRuntime.ts` — replace `editFile` call with `editFileWithReview`; handle rejection as graceful stop
- No new npm dependencies required
