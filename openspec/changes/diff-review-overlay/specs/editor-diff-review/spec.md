## ADDED Requirements

### Requirement: Agent pauses edit_file for user review
When the agent calls `edit_file`, the system SHALL pause execution and display a side-by-side diff overlay instead of applying the edit directly.

#### Scenario: Edit_file triggers diff overlay
- **WHEN** the agent executes `edit_file`
- **THEN** the system reads the current code from the active Monaco editor
- **THEN** the system computes the modified code by applying the search/replace in memory
- **THEN** the system displays a modal overlay containing a Monaco DiffEditor showing original (left) vs modified (right)
- **THEN** the agent pauses execution until the user makes a decision

### Requirement: Diff overlay shows GitHub-style side-by-side diff
The overlay SHALL render a Monaco DiffEditor configured with `renderSideBySide: true` showing the original and modified code.

#### Scenario: Overlay layout
- **WHEN** the diff overlay appears
- **THEN** it SHALL contain a file header bar showing the filename and change stats (+N -M)
- **THEN** it SHALL contain a side-by-side Monaco DiffEditor with read-only original/modified models
- **THEN** it SHALL contain Approve and Reject action buttons
- **THEN** the overlay SHALL be centered on screen with a semi-transparent backdrop
- **THEN** the Monaco DiffEditor SHALL NOT be user-editable (readOnly: true)

### Requirement: User can approve changes
When the user clicks Approve, the system SHALL apply the edit to the active Monaco editor model and signal the agent to continue.

#### Scenario: Approve applies edit
- **WHEN** the user clicks "Approve"
- **THEN** the system applies the edit to the active Monaco editor via `executeEdits`
- **THEN** the system disposes the diff models and overlay
- **THEN** the system signals `DIFF_RESULT{approved: true}` to the agent
- **THEN** the agent continues its execution loop

### Requirement: User can reject changes
When the user clicks Reject, the system SHALL NOT apply the edit, SHALL dispose the overlay, and SHALL stop the agent gracefully.

#### Scenario: Reject stops agent cleanly
- **WHEN** the user clicks "Reject"
- **THEN** the system SHALL NOT apply any edit to the Monaco editor
- **THEN** the system disposes the diff models and overlay
- **THEN** the system signals `DIFF_RESULT{approved: false}` to the agent
- **THEN** the agent stops immediately via `onDone` (not onError)

### Requirement: Rejection does not show error state
The system SHALL treat user rejection as a graceful stop, not an error. The agent runtime SHALL call `onDone` with a summary message like "Changes rejected. Agent stopped."

#### Scenario: No error UI on rejection
- **WHEN** the agent stops due to user rejection
- **THEN** the agent status SHALL be "done" (not "error")
- **THEN** the final response SHALL contain a message indicating the user rejected the changes
- **THEN** no error icon or error styling SHALL be displayed

### Requirement: Agent cancel cleans up overlay
If the user cancels the agent (via Cancel button in sidepanel) while the overlay is open, the system SHALL dismiss the overlay without applying the edit.

#### Scenario: Cancel during overlay dismissed overlay
- **WHEN** the user cancels the agent while the overlay is displayed
- **THEN** the system disposes the diff models and overlay
- **THEN** no edit is applied to the Monaco editor
