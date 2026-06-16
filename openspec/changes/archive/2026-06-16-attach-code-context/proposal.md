## Why

Currently, when users want to refer to a specific piece of code or file range in their chat with the VibeScript agent, they have to manually copy and paste the code snippet, or explain which file they are talking about. This leads to friction, visual clutter in the chat window, and less precise context injection for the LLM. Providing a seamless way to mention files/ranges and click-to-attach selections directly from the editor streamlines the debugging and code-generation workflows.

## What Changes

- Add a floating code-selection pill ("Attach to VibeScript") directly above selection highlights in the Monaco editor.
- Add an autocomplete/file mention listener (`@filename:line-range`) in the sidepanel chat textarea.
- Parse mentions in the draft input before sending, and resolve file content and specific line ranges from the active Monaco models.
- Support displaying attachments as rich chips in the sidepanel UI and user message bubble.
- Enrich the LLM agent prompt with these code context attachments.

## Capabilities

### New Capabilities
- `code-context-attachment`: Ability to select code in the active editor and attach it to the chat via a floating pill, as well as mentioning open files and line ranges in the chatbox.

### Modified Capabilities
<!-- None -->

## Impact

- **Monaco Bridge (`inject.js`)**: Listen to selection change and scroll events, rendering a floating HTML button in the page DOM above selection coordinates.
- **Content Script (`content.tsx`)**: Bridge `ATTACH_SELECTION` messages between page context and sidepanel.
- **Zustand Stores (`editorStore.ts`, `uiStore.ts`)**: Add draft attachments state, handling action routing, and opening sidepanel on attachment.
- **React Components (`ChatView.tsx`, `MessageBubble.tsx`)**: Textarea autocomplete for `@` files, draft attachment chips rendering, user message attachment styling.
- **Agent System (`agentRuntime.ts`)**: Prompt prefix compilation with resolved attachment context.
