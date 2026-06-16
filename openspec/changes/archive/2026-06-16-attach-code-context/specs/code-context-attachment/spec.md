## ADDED Requirements

### Requirement: Floating selection popup in Monaco editor
The Monaco integration SHALL listen to text selection events and display a floating action pill near the selection to let the user attach the code snippet to the chat.

#### Scenario: Floating pill display on text selection
- **WHEN** the user selects a non-empty text range in the Monaco editor
- **THEN** a floating pill styled "Attach to VibeScript" is displayed above the cursor/selection coordinates.

#### Scenario: Floating pill action triggers attachment
- **WHEN** the user clicks the floating pill
- **THEN** the selection details (filename, selected code content, and line numbers) are sent to the side panel, the side panel is opened (if closed), and the floating pill is hidden.

#### Scenario: Floating pill auto-hides on editor events
- **WHEN** the user scrolls the editor or collapses the selection to empty
- **THEN** the floating pill is removed from the DOM immediately.

### Requirement: Autocomplete file mentions in chat input
The chat textarea SHALL listen for `@` character triggers and render an autocomplete dropdown listing open files in the editor.

#### Scenario: Autocomplete dropdown display
- **WHEN** the user types "@" in the chat input textarea
- **THEN** an autocomplete overlay is rendered above the textarea showing the list of open file names.

#### Scenario: Selecting autocomplete file item
- **WHEN** the user selects an autocomplete item via click or Enter keypress
- **THEN** the file is added to the draft attachments, the "@" text is removed from the textarea, and the autocomplete dropdown is closed.

### Requirement: Regex mention parsing and prompt enrichment
The chat system SHALL support inline text file mentions (e.g., `@Code.gs:10-20`) in the user prompt, parse them, fetch the code segments, and enrich the agent prompt context.

#### Scenario: Sending message with inline mentions
- **WHEN** the user sends a message containing file mentions like `@filename:start-end`
- **THEN** the chat client extracts all matching mentions, fetches the code contents, slices the requested line range, appends them to the agent system prompt context, and renders corresponding visual chips in the user message bubble.
