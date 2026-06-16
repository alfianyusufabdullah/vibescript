## 1. Monaco Integration & Communication Bridge

- [x] 1.1 In `src/content/inject.js`, add selection change (`onDidChangeCursorSelection`) and scroll change (`onDidScrollChange`) event listeners to register a floating action pill.
- [x] 1.2 Implement DOM insertion, styling, absolute positioning, and removal logic for the `#vibescript-selection-pill` inside `inject.js`.
- [x] 1.3 Implement the `ATTACH_SELECTION` message posting inside the floating pill's click handler.
- [x] 1.4 Update the `window.addEventListener('message')` listener inside `src/content/content.tsx` to handle `ATTACH_SELECTION` and dispatch it to `editorStore`.

## 2. Store Updates

- [x] 2.1 Update `src/shared/types.ts` to add the `CodeAttachment` interface and add `attachments` to `ChatMessage`.
- [x] 2.2 In `src/sidepanel/stores/editorStore.ts`, add `draftAttachments` state, and implement `addAttachment`, `removeAttachment`, and `clearAttachments` actions.

## 3. Sidepanel UI: Mentions & Autocomplete

- [x] 3.1 Implement an autocomplete dropdown menu styled for files in `src/sidepanel/components/ChatView.tsx` triggering on the `@` character in the textarea.
- [x] 3.2 Add keyboard event handling (ArrowUp, ArrowDown, Enter, Escape) to navigate the autocomplete dropdown overlay.
- [x] 3.3 Add attachment pill components above the textarea in `ChatView.tsx` to show currently attached draft code snippets with delete buttons.
- [x] 3.4 In `ChatView.tsx` text submission handler, parse any inline `@filename:line-range` pattern using a regex and fetch the corresponding file range content before clearing draft input.

## 4. Agent Integration & Chat History rendering

- [x] 4.1 Update `src/sidepanel/services/agentRuntime.ts` to format and inject `draftAttachments` as system context prefix right before compiling prompt messages.
- [x] 4.2 Update `src/sidepanel/stores/chatStore.ts` to store `attachments` in user `ChatMessage` instances and persist them to Chrome storage.
- [x] 4.3 Update `src/sidepanel/components/MessageBubble.tsx` to render attached code chips inside the user's message bubble with a collapsible/expandable code viewer.
