## 1. Build System & Manifest

- [x] 1.1 Update `manifest.json`: remove `sidePanel` permission, remove `side_panel` config block, add CSS file to `content_scripts` declaration
- [ ] 1.2 Update `vite.config.ts`: restructure entry points — remove `sidepanel.html` entry, configure content script as React bundle entry with CSS extraction
- [ ] 1.3 Create CSS build pipeline: configure Tailwind v4 output to produce a CSS string/file injectable into Shadow DOM (test `@theme` directive compatibility)
- [ ] 1.4 Delete `sidepanel.html` — no longer needed as an entry point

## 2. Content Script — Shadow DOM & React Host

- [ ] 2.1 Rewrite `content.ts`: create `<div id="vibescript-root">` host element on `document.body` with duplicate prevention check
- [ ] 2.2 Attach open Shadow Root to host element and create inner container `<div>` for React mount
- [ ] 2.3 Inject bundled Tailwind CSS as `<style>` element inside Shadow Root
- [ ] 2.4 Inject Google Fonts `<link>` (Outfit) into main document `<head>` with duplicate prevention
- [ ] 2.5 Mount React app (`createRoot` + `<App />`) into the Shadow Root container
- [ ] 2.6 Preserve existing `inject.js` bridge script injection (unchanged)
- [ ] 2.7 Preserve existing `window.postMessage` listener for `inject.js` communication (CODE_RESULT, REQUEST_COMPLETION handlers)

## 3. Offcanvas Shell Component

- [x] 3.1 Create `OffcanvasShell.tsx`: fixed-position drawer container, right-aligned, 380px width, full viewport height
- [x] 3.2 Implement slide-in/out CSS transition (`transform: translateX`, 200-300ms ease-out)
- [x] 3.3 Implement open/closed state with Zustand, persisted to `chrome.storage.local`
- [x] 3.4 Set appropriate `z-index` to overlay above Apps Script editor UI
- [x] 3.5 Wire the existing `App.tsx` content (header, ChatView, SettingsView) inside the offcanvas shell

## 4. Floating Action Button (FAB)

- [x] 4.1 Create `FloatingButton.tsx`: circular button (40-48px), bottom-right corner, fixed position, 16-24px margin from viewport edge
- [x] 4.2 Implement icon toggle: Sparkles icon when panel closed, X icon when panel open
- [x] 4.3 Wire click handler to toggle offcanvas open/closed state
- [x] 4.4 Style FAB with dark theme matching the app (zinc-900 bg, subtle shadow, hover state)

## 5. State Persistence

- [x] 5.1 Add panel UI state to Zustand store: `isPanelOpen`, `activeTab` (chat/settings), `draftInput`
- [x] 5.2 Implement `chrome.storage.local` sync for panel UI state (read on mount, write on change)
- [x] 5.3 Restore panel state on content script re-initialization (page reload): auto-open if previously open, restore active tab
- [x] 5.4 Persist draft input text from chat textarea to `chrome.storage.local` on change, restore on mount

## 6. Editor Store Simplification

- [x] 6.1 Refactor `editorStore.ts`: replace `chrome.tabs.sendMessage` with direct `window.postMessage` for `GET_CODE`, `SET_CODE`, `INSERT_AT_CURSOR`, `REPLACE_SELECTION`
- [x] 6.2 Update `fetchContext` to use `window.postMessage` + `window.addEventListener` pattern with request ID tracking (move pending callbacks logic from content.ts into the store)
- [x] 6.3 Keep `chrome.runtime.sendMessage` path for LLM requests (background script handles CORS)

## 7. Background Script Update

- [x] 7.1 Remove `chrome.sidePanel.setPanelBehavior` from `onInstalled` listener
- [x] 7.2 Add `chrome.action.onClicked` listener: send toggle message to active tab's content script via `chrome.tabs.sendMessage`
- [x] 7.3 Keep existing LLM request handler (`chrome.runtime.onMessage` for `LLM_REQUEST`) unchanged

## 8. Integration & Cleanup

- [x] 8.1 Update `App.tsx`: wrap with `OffcanvasShell`, integrate panel state from Zustand
- [x] 8.2 Update `ChatView.tsx`: wire draft input persistence (sync textarea value to store on change)
- [x] 8.3 Remove side panel-specific code paths and dead imports across all files
- [x] 8.4 Verify full message flow: React (shadow DOM) → postMessage → inject.js → Monaco editor (and reverse)
- [x] 8.5 Build and test extension: `npm run build`, load unpacked in Chrome, verify on `script.google.com`
