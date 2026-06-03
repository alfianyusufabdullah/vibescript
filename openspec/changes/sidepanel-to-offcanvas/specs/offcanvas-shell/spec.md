## ADDED Requirements

### Requirement: Offcanvas panel renders as a right-side drawer
The system SHALL render the VibeScript UI as a fixed-position drawer anchored to the right edge of the viewport, overlaying the Apps Script editor content.

#### Scenario: Panel opens with slide-in animation
- **WHEN** user triggers the panel open action (via FAB click or extension icon)
- **THEN** the offcanvas panel SHALL slide in from the right edge with a CSS transition (transform translateX), reaching its full width of 380px within 200-300ms using an ease-out curve

#### Scenario: Panel closes with slide-out animation
- **WHEN** user triggers the panel close action (via FAB click, extension icon, or close button)
- **THEN** the offcanvas panel SHALL slide out to the right edge, fully hidden off-screen, with a matching reverse transition

#### Scenario: Panel does not cause layout reflow
- **WHEN** the panel opens or closes
- **THEN** the Apps Script editor layout SHALL NOT shift or reflow — the panel MUST use `position: fixed` with a z-index above the editor UI

### Requirement: Floating Action Button (FAB) toggle
The system SHALL render a circular floating action button in the bottom-right corner of the viewport to toggle the offcanvas panel.

#### Scenario: FAB visible on Apps Script pages
- **WHEN** the user navigates to any `script.google.com` page
- **THEN** a circular FAB (40-48px diameter) SHALL appear in the bottom-right corner with the VibeScript icon, with sufficient margin from the viewport edge (16-24px)

#### Scenario: FAB toggles panel state
- **WHEN** user clicks the FAB while the panel is closed
- **THEN** the panel SHALL open
- **WHEN** user clicks the FAB while the panel is open
- **THEN** the panel SHALL close

#### Scenario: FAB visual state reflects panel state
- **WHEN** the panel is open
- **THEN** the FAB icon SHALL change to a close/X icon to indicate dismissal action
- **WHEN** the panel is closed
- **THEN** the FAB icon SHALL show the VibeScript sparkle icon

### Requirement: Extension icon toggles panel
The system SHALL allow toggling the offcanvas panel via the Chrome extension toolbar icon.

#### Scenario: Extension icon click toggles panel
- **WHEN** user clicks the VibeScript extension icon in the Chrome toolbar while on a `script.google.com` page
- **THEN** the background script SHALL send a toggle message to the active tab's content script, which SHALL toggle the panel open/closed state

#### Scenario: Extension icon click on non-Apps-Script page
- **WHEN** user clicks the extension icon on a page that is NOT `script.google.com`
- **THEN** no action SHALL be taken (content script is not injected on non-matching pages)

### Requirement: Panel state persistence
The system SHALL persist the panel's open/closed state and active view tab across page reloads.

#### Scenario: Panel reopens after page reload
- **WHEN** user has the panel open and reloads the Apps Script editor page
- **THEN** the panel SHALL automatically reopen to the same state (open, same active tab) after the page finishes loading

#### Scenario: Panel stays closed after page reload
- **WHEN** user has the panel closed and reloads the page
- **THEN** the panel SHALL remain closed, showing only the FAB

#### Scenario: Active view tab persists
- **WHEN** user is on the Settings tab, navigates away, and returns
- **THEN** the Settings tab SHALL be the active view when the panel reopens

### Requirement: Draft input persistence
The system SHALL persist the chat input draft text across page reloads.

#### Scenario: Draft survives reload
- **WHEN** user has typed text in the chat input without sending, and the page reloads
- **THEN** the draft text SHALL be restored in the chat input textarea after reload

### Requirement: Offcanvas contains existing UI views
The offcanvas panel SHALL render the same UI components as the current side panel: header with tab selector, ChatView, SettingsView, and ActionBar.

#### Scenario: All views accessible
- **WHEN** the offcanvas panel is open
- **THEN** the user SHALL be able to switch between Chat and Settings tabs, use quick actions from the ActionBar, and interact with the chat input — identical to the current side panel behavior
