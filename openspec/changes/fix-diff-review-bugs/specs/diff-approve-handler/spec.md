## ADDED Requirements

### Requirement: Approve handler catches Monaco errors

The approve button's `onclick` handler SHALL wrap `editor.executeEdits` in a try-catch block. If the edit operation throws, `finish()` SHALL still be called with the appropriate outcome.

#### Scenario: executeEdits succeeds
- **WHEN** the user clicks Approve
- **AND** `editor.executeEdits` completes without error
- **THEN** `finish(true)` SHALL be called
- **THEN** DIFF_RESULT SHALL be posted with `{ approved: true }`

#### Scenario: executeEdits throws
- **WHEN** the user clicks Approve
- **AND** `editor.executeEdits` throws an error
- **THEN** `finish(false)` SHALL be called
- **THEN** DIFF_RESULT SHALL be posted with `{ approved: false, output: error.message }`
