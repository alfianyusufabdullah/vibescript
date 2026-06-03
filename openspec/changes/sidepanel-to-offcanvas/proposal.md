## Why

The current VibeScript extension uses Chrome's Side Panel API to render the AI assistant UI. This creates a disconnected UX — when the user interacts with the side panel, they're effectively context-switching between the Apps Script editor tab and a separate Chrome-managed panel. The panel's size and position are controlled by Chrome, not by us, and it visually separates from the editing experience.

By migrating to an offcanvas sidebar injected directly into the Apps Script editor page, the assistant becomes a seamless part of the coding environment — similar to how VS Code's Copilot Chat lives inside the editor itself.

## What Changes

- **BREAKING**: Remove Chrome Side Panel API integration entirely (`side_panel` permission, `sidepanel.html` entry point, `setPanelBehavior` in background script)
- **New**: Inject a React-based offcanvas drawer into the Apps Script editor page via content script, rendered inside a Shadow DOM for style isolation
- **New**: Floating Action Button (FAB) anchored to bottom-right corner to toggle the offcanvas open/close
- **Modify**: Simplify editor communication — React app now lives in content script context, can use direct `window.postMessage` to `inject.js` instead of routing through `chrome.tabs.sendMessage`
- **Modify**: LLM calls still route through `chrome.runtime.sendMessage` → `background.ts` (content scripts are CORS-restricted)
- **New**: Enhanced state persistence via `chrome.storage` for panel state (open/closed, width, active tab, draft input) to survive page reloads
- **Modify**: Vite build configuration — content script becomes the main React entry point instead of `sidepanel.html`
- **Modify**: CSS bundling strategy — Tailwind styles must be adopted into Shadow DOM via `adoptedStyleSheets` or inline injection

## Capabilities

### New Capabilities
- `offcanvas-shell`: The offcanvas drawer container with slide-in/out animation, Shadow DOM isolation, and FAB toggle. Handles mounting React into the page, CSS adoption, and panel state persistence.
- `content-script-react-host`: Content script infrastructure for creating Shadow DOM root, bundling and injecting React + Tailwind CSS, mounting/unmounting the app lifecycle, and Google Fonts loading workaround.

### Modified Capabilities
_(No existing specs to modify — this is a greenfield extension)_

## Impact

- **Manifest**: Remove `sidePanel` permission and `side_panel` config block. Add CSS to `content_scripts` declaration.
- **Build system**: Vite config needs new entry point strategy. CRXJS must bundle React + Tailwind into content script output. `sidepanel.html` entry removed.
- **Content script** (`content.ts`): Major rewrite — becomes the host for React app, Shadow DOM creation, and message bridging.
- **Background script** (`background.ts`): Minor — remove `setPanelBehavior`, keep LLM request handler.
- **Editor store** (`editorStore.ts`): Simplify — replace `chrome.tabs.sendMessage` with direct `window.postMessage` since React now lives in content script context.
- **All UI components**: Functionally unchanged (ChatView, SettingsView, ActionBar, MessageBubble) — they move into the offcanvas but their internal logic stays the same.
- **State stores**: Add persistence for UI state (panel open/closed, active tab, draft input) to `chrome.storage`.
- **Dependencies**: May need `construct-style-sheets-polyfill` for Shadow DOM CSS adoption in older Chromium versions. Evaluate if Tailwind v4 output is compatible with `adoptedStyleSheets`.
- **Dev experience**: HMR behavior changes — content scripts require extension reload instead of hot module replacement. Consider dev-mode workarounds.
