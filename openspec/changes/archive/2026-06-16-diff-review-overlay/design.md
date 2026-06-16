## Context

VibeScript's agent currently applies `edit_file` changes directly to the Google Apps Script Monaco editor with no user review. The agent runtime in `agentRuntime.ts` calls `editorStore.editFile()` which sends a `postMessage` to `inject.js`, which executes the edit on the Monaco editor model. There is no mechanism to pause, preview, or approve edits.

The Google Apps Script page exposes `window.monaco` in the page context (confirmed via runtime probe). Key APIs available:
- `monaco.editor.createDiffEditor()` — function (confirmed)
- `monaco.editor.createDiffNavigator()` — function (confirmed)
- `monaco.editor.createModel()` — function (confirmed)
- `monaco.editor.getEditors()` — function (confirmed)
- `monaco.Range` — available

This means we can use Monaco's built-in DiffEditor to render a side-by-side diff entirely in page context, without any extra dependencies.

## Goals / Non-Goals

**Goals:**
- Show a side-by-side Monaco DiffEditor overlay when `edit_file` is called, before the edit is applied
- Overlay appears as a modal centered on top of the GAS editor
- Overlay shows original code (left) vs modified code (right) with line-level diff highlighting
- User can Approve (apply edit, continue agent) or Reject (stop agent, no edit)
- If rejected, agent stops gracefully with `onDone` (no error state)
- All overlay rendering happens in page context via `inject.js`

**Non-Goals:**
- Not changing `write_file` or other tools
- Not adding sidepanel-based diff views
- Not supporting multi-hunk approval (approve/reject is all-or-nothing per edit_file call)
- Not supporting user editing the diff before applying
- Not adding keyboard shortcuts for approve/reject

## Decisions

**Decision 1: Full-page modal overlay, not inline decorations**
Overlay approach (fixed positioning, centered panel) rather than Monaco decorations in the existing editor. This gives the most GitHub-realistic experience with side-by-side diff, and avoids mutating the editor state before the user approves.

**Decision 2: Side-by-side (renderSideBySide: true)**
Monaco DiffEditor in side-by-side mode. Left pane shows original code with red deletion markers, right pane shows modified code with green addition markers. This matches GitHub's "split" diff view.

**Decision 3: inject.js is the sole renderer**
All overlay creation, DiffEditor instantiation, and interaction logic lives in `inject.js` (page context). The sidepanel/background only relays messages. This avoids needing Monaco in the shadow DOM and keeps the diff rendering close to the editor.

**Decision 4: New `editFileWithReview()` method in editorStore**
Rather than modifying the existing `editFile()` method (which would break other potential callers), a new method is added. The existing method remains unchanged.

**Decision 5: Rejection = graceful stop via onDone, not onError**
When the user rejects, the agent runtime calls `callbacks.onDone('Changes rejected. Agent stopped.')` instead of `callbacks.onError()`. This avoids showing error UI while still halting execution.

**Decision 6: No new npm dependencies**
Monaco's built-in `createDiffEditor` handles diff computation, model management, and rendering. No diff library needed.

## Risks / Trade-offs

- **Overlay positioning on window resize** — The GAS editor layout can shift. Mitigation: use `position: fixed` with viewport units instead of positioning relative to the editor container. The overlay covers the full screen as a modal.
- **User switches file while overlay is open** — The diff becomes stale. Mitigation: the edit targets a specific range computed before the overlay opens; when approved, `executeEdits` applies to the current model. If the user switched files, the edit may silently fail on a different file or produce unexpected results. Future improvement: detect file/tab changes and dismiss overlay.
- **Performance on large files** — createDiffEditor handles large diffs natively, but creating two models for every review adds memory pressure. Mitigation: dispose models and diff editor on every cleanup path (approve, reject, cancel, error).
- **Multiple tool calls in one agent step** — The agent may call multiple tools (e.g., edit_file + read_file). Only edit_file triggers the overlay. Other tools execute normally. The overlay blocks the agent loop until resolved.
- **Agent cancel during overlay** — If the user clicks Cancel in the sidepanel while the overlay is open, the overlay must be dismissed. Mitigation: listen for cancel signal and call the same cleanup path as Reject.
