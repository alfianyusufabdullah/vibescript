## Context

The diff review flow spans 4 execution contexts (sidepanel React → content script top frame → background service worker → content script editor iframe → inject.js page context) connected via `window.postMessage` and `chrome.runtime.sendMessage`. Each context boundary is a potential failure point.

The current code has 17 bugs across these layers. Most critically: messages get silently dropped at the background routing layer, promises stay pending for 300 seconds with no abort mechanism, and Monaco models leak on every overlay dismissal.

## Goals / Non-Goals

**Goals:**
- DIFF_RESULT reliably reaches editorStore regardless of frame registration timing
- Approve button always sends DIFF_RESULT even if Monaco edit operation throws
- Cancel button immediately terminates pending diff review (no 5-minute wait)
- `_diffOverlayCleanup` is always callable immediately after overlay creation starts
- Monaco models from dismissed overlays are reliably disposed
- No two concurrent diff overlays can stack
- `cleanup()` can be safely called multiple times
- AgentRuntime does not set an independent timeout for `edit_file`
- Rejection detection uses strict `=== false` not falsy check
- `chrome.runtime.sendMessage` failures for critical messages are detected
- Perpetual polling is replaced with a bounded setup

**Non-Goals:**
- No architectural changes to messaging layer (still uses postMessage + runtime.sendMessage)
- No changes to Monaco editor integration beyond the diff overlay
- No changes to the agent loop's core ReAct logic
- No new dependencies
- No breaking changes to existing message actions or types

## Decisions

### D1: Single timeout source of truth

**Problem:** Two independent 300s timeouts (agentRuntime `executeToolWithTimeout` + editorStore `editFileWithReview`) race against each other, causing non-deterministic behavior.

**Decision:** AgentRuntime removes its `DIFF_REVIEW_TIMEOUT` for `edit_file`. EditorStore is the sole timeout owner. AgentRuntime's `executeToolWithTimeout` skips the timeout race for `edit_file` — the timeout at editorStore level is sufficient.

**Rationale:** The editorStore timeout is closer to the actual blocking operation (waiting for user approval). Having a second timeout at the runtime level adds no value — it fires at approximately the same time but creates a race condition. Letting the editorStore fully own the timeout eliminates the race.

**Alternatives considered:** Make agentRuntime timeout slightly longer (310s). This doesn't solve the race — both timers are on the same clock and timing is non-deterministic due to microtask scheduling.

### D2: Synchronous `_diffOverlayCleanup` initialization

**Problem:** `_diffOverlayCleanup` is set inside `requestAnimationFrame` callback, which may never fire (background tab, throttled browser, heavy load). If `EDIT_FILE_REVIEW_CANCEL` arrives before rAF fires, the cancel is a no-op.

**Decision:** Set `_diffOverlayCleanup` synchronously BEFORE `requestAnimationFrame`. The synchronous cleanup sends `DIFF_RESULT {approved: false, output: 'Cancelled'}` and removes overlay DOM. Monaco model disposal stays inside rAF (protected by null check).

**Rationale:** The DOM overlay elements are created synchronously at lines 77-107 — they can be removed synchronously. Only the Monaco diff editor setup needs rAF. By splitting cleanup into two tiers (synchronous DOM removal + guarded Monaco dispose), cancel works instantly.

```
Before:
  rAF(() → {
    create diffEditor, models
    _diffOverlayCleanup = () → dispose + cleanup  ← init inside rAF
  })
  // cancel before rAF → _diffOverlayCleanup is null → no-op

After:
  _diffOverlayCleanup = () → {
    remove overlay DOM + send DIFF_RESULT(Cancelled)
    if (diffEditor) dispose()  ← guarded
    if (!model.isDisposed()) dispose()  ← guarded
  }
  rAF(() → {
    create diffEditor, models
    // button handlers already reference _diffOverlayCleanup
  })
  // cancel before rAF → _diffOverlayCleanup removes DOM + cancels
  // rAF later → diffEditor created but immediately disposed by cleanup
```

### D3: `cleanup()` idempotency

**Problem:** `cleanup()` is called from both `finish()` and `_diffOverlayCleanup()`. If both fire simultaneously (user approves AND cancel arrives), Monaco `dispose()` called twice can throw.

**Decision:** Add guard variables to `cleanup()`:
```javascript
let disposed = false;
const cleanup = () => {
  if (disposed) return;
  disposed = true;
  _diffOverlayCleanup = null;
  try { diffEditor?.dispose(); } catch {}
  try { if (!origModel?.isDisposed()) origModel?.dispose(); } catch {}
  try { if (!modModel?.isDisposed()) modModel?.dispose(); } catch {}
  overlay.remove();
};
```

**Rationale:** Monaco's `dispose()` can throw or have undefined behavior on already-disposed objects. The `isDisposed()` check and try-catch ensure single execution. This also prevents the `DIFF_RESULT` from being posted twice.

### D4: Background fallback routing

**Problem:** Lines 120-134 silently drop DIFF_RESULT when `tabEditorFrames[tabId]` is undefined or when sender frame ID doesn't match registered editor frame.

**Decision:** Add an explicit fallback: if `editorFrameId` is undefined, always forward DIFF_RESULT and EDIT_FILE_REVIEW messages to `frameId: 0` (main frame). Add `console.warn` logging when the fallback is triggered.

```typescript
if (tabId && (message.source === 'vibescript-content' || message.source === 'vibescript-sidepanel')) {
  const editorFrameId = tabEditorFrames[tabId];
  if (frameId !== 0 && frameId === editorFrameId) {
    // DIFF_RESULT from editor → main frame
    chrome.tabs.sendMessage(tabId, message, { frameId: 0 }).catch(() => {});
  } else if (frameId === 0 || frameId === undefined || editorFrameId === undefined) {
    // EDIT_FILE_REVIEW from main → editor frame, OR fallback for DIFF_RESULT
    const target = editorFrameId ?? 0;
    chrome.tabs.sendMessage(tabId, message, { frameId: target }).catch(() => {});
    if (editorFrameId === undefined) {
      console.warn('[VibeScript] Editor frame not registered, routing to main frame');
    }
  }
}
```

**Rationale:** DIFF_RESULT must always reach the main frame (where the React app listens). Even if the editor frame isn't registered, routing to frame 0 is the safest fallback — the message will be handled by the main frame's content script, which will forward to the React app.

### D5: `cancelDiffReview` clears timeout and removes listener

**Problem:** `cancelDiffReview()` posts `EDIT_FILE_REVIEW_CANCEL` but doesn't clear the 300s timeout or remove the message event listener. The timer runs to completion.

**Decision:** Store timeout ID and handler reference in module-level variables accessible to `cancelDiffReview`:

```typescript
let _editReviewTimeout: number | undefined;
let _editReviewHandler: ((event: MessageEvent) => void) | undefined;

// In editFileWithReview:
_editReviewTimeout = window.setTimeout(() => { ... }, 60000);
_editReviewHandler = handler;

// In cancelDiffReview:
if (_editReviewTimeout) { clearTimeout(_editReviewTimeout); _editReviewTimeout = undefined; }
if (_editReviewHandler) { window.removeEventListener('message', _editReviewHandler); _editReviewHandler = undefined; }
```

**Rationale:** This ensures cancel is instantaneous — no timer accumulation, no orphaned event listeners. Combined with D2 (synchronous `_diffOverlayCleanup`), cancel works end-to-end without waiting.

## Risks / Trade-offs

- **[R1] D2 split cleanup may leave Monaco models alive if rAF never fires and cancel is called.** Models created inside rAF won't be disposed because they were never created. This is fine — no leak, just no-op.
- **[R2] D3 try-catch on dispose hides real Monaco errors.** Mitigation: `console.warn` in catch block for debugging.
- **[R3] D4 fallback routing may cause duplicate messages if both frame 0 and editor frame receive the same message.** The content script's `fromContentScript` guard on line 155 prevents infinite loops. The React app's `source === 'vibescript-inject'` check prevents processing messages not from inject.js.
- **[R4] Reducing timeout 300s → 60s may not be enough for slow editors.** If 60s proves too short, it can be increased without code changes (configurable constant).
