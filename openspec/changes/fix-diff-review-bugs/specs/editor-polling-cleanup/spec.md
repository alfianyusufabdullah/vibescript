## ADDED Requirements

### Requirement: Bounded editor hooking

The editor hooking logic SHALL stop polling once editors are successfully hooked. The persistent `setInterval` SHALL be replaced with a one-shot approach that terminates on completion or after a maximum number of attempts.

#### Scenario: Editors hooked successfully
- **WHEN** editors are found and hooked
- **THEN** no further polling SHALL occur
- **THEN** no perpetual `setInterval` SHALL remain active

#### Scenario: Maximum attempts reached
- **WHEN** editors cannot be hooked after N attempts (N=30, ~60 seconds)
- **THEN** polling SHALL stop
- **THEN** a warning SHALL be logged
