## ADDED Requirements

### Requirement: Fallback routing when editor frame is unknown

When `tabEditorFrames[tabId]` is undefined (editor frame not registered or registration lost), the background script SHALL still route DIFF_RESULT and EDIT_FILE_REVIEW messages to `frameId: 0` (main frame) instead of dropping them silently.

#### Scenario: DIFF_RESULT with unknown editor frame
- **WHEN** a DIFF_RESULT message arrives at the background script from any frame
- **AND** `tabEditorFrames[tabId]` is undefined
- **THEN** the message SHALL be forwarded to `frameId: 0`
- **THEN** a `console.warn` SHALL be logged indicating the fallback was used

### Requirement: Frame mismatch does not drop messages

When the sender frame ID does not match the registered editor frame ID, the background script SHALL attempt delivery instead of dropping.

#### Scenario: DIFF_RESULT from unregistered frame
- **WHEN** a DIFF_RESULT message arrives from a frame ID that is neither 0 nor the registered editor frame
- **THEN** the message SHALL be forwarded to `frameId: 0` as fallback
