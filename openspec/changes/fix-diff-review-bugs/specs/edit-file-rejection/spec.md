## ADDED Requirements

### Requirement: Strict rejection check

The `edit_file` tool SHALL use strict equality (`result.approved === false`) to detect user rejection, not a falsy check (`!result.approved`).

#### Scenario: Approved is true
- **WHEN** `result.approved` is `true`
- **THEN** the tool SHALL NOT treat it as rejection
- **THEN** `error: 'USER_REJECTED'` SHALL NOT be returned

#### Scenario: Approved is false
- **WHEN** `result.approved` is `false`
- **THEN** the tool SHALL return `error: 'USER_REJECTED'`

#### Scenario: Approved is undefined or non-boolean
- **WHEN** `result.approved` is `undefined`
- **THEN** the tool SHALL return an error (not rejection)
- **THEN** the error SHALL NOT be `'USER_REJECTED'`
