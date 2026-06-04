## ADDED Requirements

### Requirement: Error callback on critical sendMessage calls

The content script SHALL attach error callbacks to `chrome.runtime.sendMessage` calls for DIFF_RESULT and EDIT_FILE_REVIEW messages. Failures SHALL be logged.

#### Scenario: DIFF_RESULT send fails
- **WHEN** the editor iframe content script sends DIFF_RESULT via `chrome.runtime.sendMessage`
- **AND** the send fails (extension context invalid, background unavailable)
- **THEN** the error SHALL be logged via `console.error`

#### Scenario: EDIT_FILE_REVIEW send fails
- **WHEN** the main frame content script sends EDIT_FILE_REVIEW via `chrome.runtime.sendMessage`
- **AND** the send fails
- **THEN** the error SHALL be logged via `console.error`
