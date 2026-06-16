## MODIFIED Requirements

### Requirement: Autocomplete file mentions in chat input
The chat textarea SHALL listen for `@` character triggers and render an autocomplete dropdown listing open files in the editor. The `@` trigger is exclusively for file mentions; agent role selection is handled by the mode selector dropdown, not by `@` prefix.

#### Scenario: Autocomplete dropdown display
- **WHEN** the user types "@" in the chat input textarea
- **THEN** an autocomplete overlay is rendered above the textarea showing only open file names (no agent role entries)

#### Scenario: Selecting autocomplete file item
- **WHEN** the user selects an autocomplete item via click or Enter keypress
- **THEN** the file is added to the draft attachments, the `@` trigger is replaced with `@filename`, and the autocomplete dropdown is closed
