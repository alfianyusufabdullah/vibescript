## ADDED Requirements

### Requirement: Shadow DOM host element creation
The content script SHALL create a host `<div>` element appended to `document.body` and attach an open Shadow Root to it for rendering the React application.

#### Scenario: Shadow root created on page load
- **WHEN** the content script executes on a `script.google.com` page
- **THEN** a `<div id="vibescript-root">` SHALL be appended to `document.body` with an open Shadow Root attached

#### Scenario: Duplicate prevention
- **WHEN** the content script executes and a `#vibescript-root` element already exists
- **THEN** the script SHALL NOT create a duplicate — it SHALL reuse the existing host element

### Requirement: React app mounts into Shadow DOM
The content script SHALL mount the React application tree into the Shadow Root, ensuring all React rendering occurs inside the shadow boundary.

#### Scenario: React mount on script load
- **WHEN** the Shadow Root is created
- **THEN** the content script SHALL call `createRoot` on a container `<div>` inside the Shadow Root and render the `<App />` component

#### Scenario: React unmount on extension unload
- **WHEN** the extension is disabled or the content script context is invalidated
- **THEN** the React root SHALL be unmounted cleanly to prevent memory leaks

### Requirement: CSS isolation via inline styles in Shadow DOM
The content script SHALL inject all application CSS (Tailwind output, custom styles, animations) as a `<style>` element inside the Shadow Root.

#### Scenario: Tailwind styles available in shadow
- **WHEN** the React app renders inside the Shadow Root
- **THEN** all Tailwind utility classes used by components SHALL resolve correctly, including theme variables, color utilities, and responsive breakpoints

#### Scenario: No style leakage to host page
- **WHEN** the application CSS is injected into the Shadow Root
- **THEN** no CSS rules (including resets, base styles, and utility classes) SHALL affect elements outside the Shadow Root

#### Scenario: No host page style leakage into shadow
- **WHEN** the Apps Script editor page has its own stylesheets
- **THEN** those styles SHALL NOT affect elements inside the Shadow Root (Shadow DOM provides this by default)

### Requirement: Google Fonts loading
The content script SHALL ensure the Outfit font family is available for use within the Shadow DOM.

#### Scenario: Font loaded via main document
- **WHEN** the content script initializes
- **THEN** it SHALL inject a `<link>` element for Google Fonts (Outfit) into the main document's `<head>` if not already present
- **AND** the font SHALL be referenceable via `font-family: 'Outfit'` from within the Shadow DOM

### Requirement: Direct message bridge to inject.js
The React application running in the content script context SHALL communicate with `inject.js` (page context) via `window.postMessage` directly, without routing through `chrome.tabs.sendMessage`.

#### Scenario: Editor context retrieval
- **WHEN** the React app needs to read the Monaco editor state (code, selection, cursor position)
- **THEN** it SHALL post a message with `source: 'vibescript-content'` and `action: 'GET_CODE'` via `window.postMessage`
- **AND** receive the response via a `window` message event listener with `source: 'vibescript-inject'`

#### Scenario: Code write operations
- **WHEN** the React app needs to set code, insert at cursor, or replace selection
- **THEN** it SHALL post the appropriate message (`SET_CODE`, `INSERT_AT_CURSOR`, `REPLACE_SELECTION`) with `source: 'vibescript-content'` via `window.postMessage`

#### Scenario: LLM requests still route through background
- **WHEN** the React app needs to call an LLM API
- **THEN** it SHALL use `chrome.runtime.sendMessage` to send the request to the background service worker, NOT `window.postMessage` (content scripts are CORS-restricted)

### Requirement: Vite build produces content script bundle
The Vite/CRXJS build pipeline SHALL produce a content script bundle that includes the React application, its dependencies, and CSS output.

#### Scenario: Single JS entry for content script
- **WHEN** the project is built via `vite build`
- **THEN** the output SHALL include a content script JS file containing React, Zustand, Lucide icons, and all application components

#### Scenario: CSS extracted separately
- **WHEN** the project is built
- **THEN** Tailwind CSS output SHALL be available as a string or file that the content script can inject into the Shadow Root

#### Scenario: sidepanel.html removed from build
- **WHEN** the project is built
- **THEN** there SHALL be no `sidepanel.html` output — it is fully replaced by the content script approach
