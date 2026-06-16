## Context

VibeScript currently lacks a native way to attach code snippets or specify line ranges within chat threads. The user has to manually copy and paste code, leading to friction. This design enables a direct integration with the Monaco editor for click-to-attach selection popups, and introduces inline file/line mentions (`@filename:line-range`) inside the chat view.

## Goals / Non-Goals

**Goals:**
- Implement a floating action button in the Monaco editor context that allows one-click attachment of selections to the VibeScript chat draft.
- Implement an autocomplete dropdown menu in the sidepanel textarea when typing `@` to easily mention open files.
- Resolve file names and line ranges from the active Monaco editor state on the main window.
- Enrich the LLM agent prompt with the attached snippets.

**Non-Goals:**
- A fully styled WYSIWYG text editor inside the textarea. Mentions will be parsed either as tags in state or plain text strings.
- Multiline highlight overlays or diffs in the editor for select-to-edit. This feature only handles code attachment.

## Decisions

### 1. Monaco Event Registration & Float Position
We will register `onDidChangeCursorSelection` and `onDidScrollChange` on the active editor inside `inject.js`.
- *Rationale*: We need coordinates relative to the viewport to render the button. By using `editor.getScrolledVisiblePosition()`, we can absolute-position the button in the document body.
- *Alternative*: Inject a Monaco content widget. This was rejected because content widgets are bounded by the editor pane overflow rules, which might clip or hide the pill if the selection is near the edges. Placing it in the document body guarantees visibility.

### 2. Message Bridge Strategy
- *Rationale*: Communication between page context (Monaco), content script, and sidepanel React app will use standard `window.postMessage` bridged via the Chrome extensions port or message handlers.
- *Alternative*: Directly updating shared state is impossible due to execution context isolation in Chrome Extensions (page context vs extension context).

### 3. Attachment representation in Zustands State
We will extend `editorStore` (or `uiStore`) to manage `draftAttachments`.
- *Rationale*: It keeps all Monaco-related files and selections under `editorStore.ts` where fetch context functions already live.

## Risks / Trade-offs

- **Risk**: Floating pill positioning drift during scrolling.
  - *Mitigation*: Register `onDidScrollChange` and hide the button immediately when the user scrolls the editor, forcing them to re-select or click a stable selection.
- **Risk**: Style contamination in host page (Google Apps Script).
  - *Mitigation*: Prefix all custom styles and classes with `vibescript-` to avoid conflicts.
