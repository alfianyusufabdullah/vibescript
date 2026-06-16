## ADDED Requirements

### Requirement: Keyboard event isolation from host page
The shadow DOM container SHALL stop propagation of all `keydown` and `keyup` events so they do not reach the GAS IDE's global keyboard shortcut handlers.

#### Scenario: Typing slash character in chat input
- **WHEN** the user types "/" in the chat textarea
- **THEN** the character is inserted into the textarea and no GAS IDE toast or shortcut is triggered

#### Scenario: Typing other special characters
- **WHEN** the user types any character (including `/`, `?`, `>`, etc.) while focused inside the VibeScript panel
- **THEN** the keypress is handled only by the VibeScript panel and does not trigger GAS IDE shortcuts

## MODIFIED Requirements

### Requirement: Standardized Mentions Autocomplete Popover
The chat textarea SHALL listen for `@` character triggers and render an autocomplete dropdown listing **only open files** in the editor. Agent role options (`@build`, `@explore`, `@plan`) SHALL NOT appear in the autocomplete.

#### Scenario: Autocomplete dropdown display
- **WHEN** the user types "@" in the chat input textarea
- **THEN** an autocomplete overlay is rendered above the textarea showing only the list of open file names (no agent role entries)

#### Scenario: Selecting autocomplete file item
- **WHEN** the user selects an autocomplete item via click or Enter keypress
- **THEN** the file is added to the draft attachments, the "@" text is replaced with `@filename`, and the autocomplete dropdown is closed
