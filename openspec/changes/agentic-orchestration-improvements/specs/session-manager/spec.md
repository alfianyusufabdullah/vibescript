## ADDED Requirements

### Requirement: Session data model

The system SHALL define an `AgentSession` type with `id`, `scriptId`, `label`, `status`, `messages`, `steps`, `agentRole`, `tokenUsage`, and timestamps.

#### Scenario: Session creation
- **WHEN** a new agent run starts
- **THEN** a new session SHALL be created with status `'active'`
- **THEN** the session SHALL be persisted to chrome.storage.local

### Requirement: Session persistence

Sessions SHALL be persisted to `chrome.storage.local` using key format `vibescript_session_{scriptId}_{sessionId}`. A session index SHALL be stored at `vibescript_session_index_{scriptId}` listing all session IDs for that script.

#### Scenario: Save session
- **WHEN** the agent completes a step
- **THEN** the session data SHALL be updated in chrome.storage
- **THEN** the session index SHALL be updated if this is a new session

#### Scenario: Load session
- **WHEN** a user selects a session from the list
- **THEN** the session messages and steps SHALL be restored
- **THEN** the chat view SHALL display the restored messages

#### Scenario: Resume interrupted session
- **WHEN** a user resumes a session with status `'active'` or `'paused'`
- **THEN** the message history SHALL be restored
- **THEN** the agent SHALL continue from the last state

### Requirement: Session listing

The session manager SHALL provide a method to list all sessions for a given script ID. The UI SHALL show a session selector.

#### Scenario: List sessions
- **WHEN** `sessionManager.listSessions(scriptId)` is called
- **THEN** it SHALL return all sessions for that script, ordered by `updatedAt` descending
- **THEN** each session SHALL show its label, status, and timestamp

#### Scenario: Switch sessions
- **WHEN** a user switches to a different session
- **THEN** the current session SHALL be saved
- **THEN** the selected session SHALL be loaded
- **THEN** the chat messages SHALL reflect the loaded session

### Requirement: Session pruning

The session manager SHALL limit to 10 sessions per script. When a new session would exceed the limit, the oldest completed session SHALL be removed.

#### Scenario: Prune old sessions
- **WHEN** session count exceeds 10 for a script
- **THEN** the oldest completed session SHALL be deleted
- **THEN** `'active'` and `'paused'` sessions SHALL NOT be pruned
