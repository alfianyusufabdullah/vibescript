## Context

VibeScript is a Chrome extension that provides an AI coding assistant for Google Apps Script. Currently, the UI is rendered in Chrome's Side Panel — a browser-managed panel that opens beside the page. The extension uses a multi-layer message passing architecture: `inject.js` (page context) ↔ `content.ts` (content script) ↔ Side Panel (separate HTML page) ↔ `background.ts` (service worker).

The side panel creates a disconnected experience — it's visually separate from the editor and controlled by Chrome's layout engine. The user perceives it as "switching tabs" rather than using an integrated tool.

The target architecture injects the full React UI directly into the Apps Script editor page as an offcanvas drawer, using Shadow DOM for style isolation and a floating action button for toggle control.

**Tech stack:** React 19, Zustand, Tailwind v4, Vite 8, CRXJS, TypeScript, Lucide icons, Outfit font.

## Goals / Non-Goals

**Goals:**
- Seamless, editor-integrated UX — the assistant panel feels native to the Apps Script IDE
- Full state persistence across page reloads (panel state, draft input, active view)
- Simplified message architecture by eliminating one hop in the communication chain
- Style isolation via Shadow DOM — zero CSS interference with host page
- Floating action button with clear visual affordance for toggling the panel

**Non-Goals:**
- Resizable panel (future enhancement — fixed width for now)
- Drag-to-reposition the FAB
- Keyboard shortcut for toggle (future enhancement)
- Multiple concurrent panels across tabs (each tab gets its own instance)
- Backward compatibility with the side panel approach — this is a full replacement

## Decisions

### Decision 1: Shadow DOM for style isolation

**Choice:** Render the offcanvas inside an `open` Shadow DOM attached to a host `<div>` injected into `document.body`.

**Alternatives considered:**
- **CSS namespacing** (prefix all classes with `.vs-*`): Fragile — Google could add conflicting styles. Tailwind's reset would also leak into the host page.
- **iframe**: Full isolation but creates a new browsing context — messaging becomes complex again (same problem as side panel). Also has CORS/CSP issues.

**Rationale:** Shadow DOM provides true style boundary. The `open` mode allows debugging via DevTools. Content scripts run in an isolated world so CSP doesn't block our JavaScript — only the DOM styles need isolation.

### Decision 2: CSS injection via `<style>` tag in Shadow DOM

**Choice:** Bundle Tailwind output as a CSS string, inject it as a `<style>` element inside the Shadow Root.

**Alternatives considered:**
- **`adoptedStyleSheets`**: Cleaner API but requires constructing `CSSStyleSheet` from string. Tailwind v4's `@import` directives may not work in constructed stylesheets. Also, browser support in the extension's target Chromium version needs verification.
- **`<link>` to external CSS**: Requires the CSS file to be in `web_accessible_resources`, exposing it to any page script. Also causes FOUC (Flash of Unstyled Content).

**Rationale:** Inline `<style>` is the most reliable cross-version approach. CRXJS can inline the CSS at build time. The Tailwind bundle for this small app is ~15-20KB gzipped — acceptable for inline injection.

### Decision 3: Google Fonts loading strategy

**Choice:** Inject `<link>` for Google Fonts (Outfit) into the **main document** `<head>`, then reference `font-family: 'Outfit'` from within the Shadow DOM.

**Rationale:** `@font-face` declarations only work at the document level — Shadow DOM cannot load fonts independently. The font link is lightweight and non-intrusive to the host page. Outfit font is unlikely to conflict with anything Google uses.

### Decision 4: Content script as React host

**Choice:** The content script (`content.ts`) creates a Shadow DOM host element, mounts the React app into it, and also serves as the message bridge to `inject.js`.

**Alternatives considered:**
- **Separate content script for UI vs bridge**: More files to manage, and they'd share the same execution context anyway.

**Rationale:** Single content script keeps the architecture simple. The React mount is a one-time operation at script load. The message bridge handlers coexist cleanly.

### Decision 5: Direct postMessage for editor communication

**Choice:** The React app (now in content script context) communicates with `inject.js` via `window.postMessage` directly, eliminating the `chrome.tabs.sendMessage` hop.

**Current flow:** React → `chrome.tabs.sendMessage` → content.ts → `window.postMessage` → inject.js
**New flow:** React → `window.postMessage` → inject.js

**Rationale:** Since React now lives in the content script's isolated world (same execution context as the current `content.ts`), it can call `window.postMessage` directly. This removes an entire async messaging layer and its error handling.

### Decision 6: State persistence via chrome.storage.local

**Choice:** Extend Zustand stores with `chrome.storage.local` persistence for:
- Panel open/closed state
- Active tab (chat vs settings)
- Draft input text
- Panel width (for future resizability)

**Rationale:** `chrome.storage.local` is already used by `chatStore` and `settingsStore`. Adding more keys is trivial. The storage is per-extension, shared across all tabs — which means panel preferences persist globally.

### Decision 7: Vite build restructuring

**Choice:** Remove `sidepanel.html` as a build entry. Make the content script the primary entry that imports React components. Use CRXJS's content script CSS handling.

**Rationale:** CRXJS already supports content scripts with CSS imports. The plugin will bundle the React app and its styles into the content script output.

## Risks / Trade-offs

**[Shadow DOM + Tailwind v4 compatibility]** → Tailwind v4 uses `@theme` directives and CSS layers. These must work inside a `<style>` tag in Shadow DOM. **Mitigation:** Build a minimal POC first. If `@theme` doesn't resolve in shadow context, extract Tailwind's computed CSS output (post-build) as a raw string.

**[HMR loss in development]** → Content scripts don't support Vite HMR. Development requires manual extension reload after each change. **Mitigation:** CRXJS v2 has experimental content script HMR support. Test if it works for our setup. Worst case, use `chrome.runtime.reload()` triggered by a file watcher.

**[Memory per tab]** → Each Apps Script tab gets its own React instance. Currently, side panel is a single shared instance. **Mitigation:** The React app is small (~50KB JS). Multiple instances are acceptable for a developer tool. Lazy-mount React only when FAB is clicked for the first time to reduce idle overhead.

**[Page layout shift]** → Injecting a panel that overlays the editor could cause visual disruption. **Mitigation:** Use `position: fixed` overlay with `z-index` high enough to sit above Apps Script UI but below Chrome's own UI. No layout reflow — the panel floats over content.

**[inject.js unchanged]** → The page-context script (`inject.js`) stays untouched. It already listens for `vibescript-content` source messages, which is the same source the content script uses. **Mitigation:** No change needed — the message protocol is compatible.

**[Extension icon behavior]** → Removing side panel means clicking the extension icon does nothing by default. **Mitigation:** Use `chrome.action.onClicked` to send a message to the active tab's content script, toggling the offcanvas. This provides two toggle methods: FAB + extension icon.
