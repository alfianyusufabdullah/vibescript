## ADDED Requirements

### Requirement: Persistent agent mode selector
The system SHALL provide a dropdown (shadcn `DropdownMenu`) in the chat input area that lets the user select the active agent mode (Build, Explore, Plan), and the selection SHALL persist across sessions via `chrome.storage.local`.

#### Scenario: Default mode on first load
- **WHEN** the extension is loaded for the first time with no saved state
- **THEN** the mode selector displays "Build" as the active mode

#### Scenario: Persisted mode restored after reload
- **WHEN** the user previously selected "Explore" and reloads the page
- **THEN** the mode selector restores to "Explore" without requiring re-selection

#### Scenario: Mode selection changes active role
- **WHEN** the user opens the dropdown and clicks "Plan"
- **THEN** the dropdown closes, the label updates to "Plan", and the next message sent uses the Plan agent role

#### Scenario: Mode selector disabled while agent is running
- **WHEN** the agent status is `thinking` or `executing_tools`
- **THEN** the mode selector trigger button is disabled and non-interactive

### Requirement: Agent role sourced from selector, not prompt text
The system SHALL determine the agent role from the persisted `selectedRole` UI state, not by parsing `@build`, `@explore`, or `@plan` prefixes from the prompt text.

#### Scenario: Prompt sent without role prefix
- **WHEN** the user types "fix the loop logic" and clicks send with mode set to "Explore"
- **THEN** the agent runs with the Explore role and "fix the loop logic" as the full prompt

#### Scenario: Legacy role prefix in prompt is ignored
- **WHEN** the user types "@build refactor this" with mode set to "Plan"
- **THEN** the agent runs with the Plan role; "@build refactor this" is treated as plain prompt text
