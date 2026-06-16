## ADDED Requirements

### Requirement: Active File Indicator
The system SHALL display the name of the currently active file from the Google Apps Script editor in the connection status indicator when the extension is active.

#### Scenario: Active connection with focused file
- **WHEN** the Apps Script editor has an active tab and `Code.gs` is focused
- **THEN** the status indicator displays `🟢 Connected: Code.gs`

#### Scenario: Active connection with no focused file
- **WHEN** the Apps Script editor is active but no file context is resolved yet
- **THEN** the status indicator displays `🟢 Connected: No active file`

#### Scenario: Disconnected editor
- **WHEN** the editor tab is not active or focus is lost
- **THEN** the status indicator displays `⚪ Disconnected`

### Requirement: Standardized Session Popover
The system SHALL display the session selector using default shadcn/ui popover styling tokens.

#### Scenario: Click sessions trigger
- **WHEN** user clicks on the sessions trigger button
- **THEN** the system displays a popover with the class `bg-popover text-popover-foreground border border-border shadow-md rounded-md` containing the list of sessions

### Requirement: Standardized Mentions Autocomplete Popover
The system SHALL style the `@mention` autocomplete popover using default shadcn/ui popover styling tokens.

#### Scenario: User types @ character
- **WHEN** user types `@` in the prompt input field
- **THEN** the autocomplete mentions dropdown appears styled with default shadcn popover classes (`bg-popover`, `text-popover-foreground`, `border`, `shadow-md`, `rounded-md`)

### Requirement: Structured Footer Layout
The system SHALL structure the chat footer into a top status/session row and a bottom chat input/action box.

#### Scenario: Messages list is empty
- **WHEN** a new session is started and history is empty
- **THEN** the copy history and reset history buttons are hidden, and the input card footer only displays the send button

#### Scenario: Messages list has items
- **WHEN** the chat history contains at least one message
- **THEN** the copy history and reset history buttons are visible in the left corner of the input card's inner toolbar
