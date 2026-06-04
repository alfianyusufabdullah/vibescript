## ADDED Requirements

### Requirement: LIST_FILES returns real file names
The `LIST_FILES` handler SHALL return actual GAS file names (e.g., "Sync/IncentiveSync.gs") instead of numeric Monaco model URI paths.

#### Scenario: Listing files in a typical GAS project
- **WHEN** the agent triggers `LIST_FILES`
- **THEN** the response MUST contain file objects with `name` matching the sidebar `aria-label` values (e.g., "Sync/IncentiveSync.gs", "Helper.gs", "discussionSquadEarlyMonthReminder.html")

#### Scenario: Listing files when sidebar has folder-prefixed names
- **WHEN** GAS sidebar shows files with folder paths (e.g., "Sync/IncentiveSync.gs")
- **THEN** the `name` field MUST include the full folder-prefixed path as shown in the sidebar

### Requirement: READ_FILE_BY_NAME accepts real file names
The `READ_FILE_BY_NAME` handler SHALL accept real file names and resolve them to the correct Monaco model to return its content.

#### Scenario: Reading a file by its real name
- **WHEN** the agent calls `READ_FILE_BY_NAME` with filename "Helper.gs"
- **THEN** the system MUST return the content of the Monaco model that corresponds to "Helper.gs" in the sidebar

#### Scenario: Reading a file by numeric ID (backward compatibility)
- **WHEN** the agent calls `READ_FILE_BY_NAME` with filename "8"
- **THEN** the system MUST still return the content of the Monaco model with URI path "/8"

### Requirement: File name mapping is resolved from sidebar DOM
The system SHALL build a mapping between sidebar `data-res-id` and real file names by querying the top-frame sidebar DOM.

#### Scenario: Sidebar DOM is available
- **WHEN** `LIST_FILES` is triggered and the sidebar DOM contains `<li>` elements with `data-res-id` and `aria-label` attributes
- **THEN** the system MUST extract file names from `aria-label` and correlate them with Monaco models

#### Scenario: Sidebar DOM is unavailable or empty
- **WHEN** the sidebar DOM has no `<li>` elements (e.g., page still loading)
- **THEN** the system MUST fall back to returning numeric model URI names (current behavior)

### Requirement: Mapping handles file additions
The system SHALL reflect newly added files without requiring page reload, since the mapping is built on-demand each time `LIST_FILES` is called.

#### Scenario: User adds a new file after initial load
- **WHEN** the user creates a new file in GAS and then triggers `LIST_FILES`
- **THEN** the new file MUST appear in the result with its real name
