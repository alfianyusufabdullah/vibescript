## ADDED Requirements

### Requirement: Typed EventBus

The system SHALL provide a typed `EventBus` class with `on()` and `emit()` methods. Event names and payload types SHALL be defined as a type map.

#### Scenario: Subscribe to events
- **WHEN** `eventBus.on('tool:start', handler)` is called
- **THEN** the handler SHALL be called whenever a `tool:start` event is emitted
- **THEN** the `on()` method SHALL return an unsubscribe function

#### Scenario: Emit events
- **WHEN** `eventBus.emit('tool:start', { name, args })` is called
- **THEN** all subscribed handlers SHALL be called with the event data
- **THEN** errors in handlers SHALL NOT affect other handlers

### Requirement: Event types

The system SHALL define the following event types at minimum:
- `tool:start` — when a tool execution begins
- `tool:result` — when a tool execution completes
- `agent:status` — when agent status changes
- `agent:error` — when an agent error occurs
- `session:change` — when session data changes

#### Scenario: Tool lifecycle events
- **WHEN** a tool call is dispatched
- **THEN** `tool:start` SHALL be emitted with `{ name, args }`
- **THEN** `tool:result` SHALL be emitted with `{ name, success, output, error?, duration }`

#### Scenario: Agent status events
- **WHEN** agent status changes (`thinking`, `executing_tools`, `done`, `error`)
- **THEN** `agent:status` SHALL be emitted with `{ status, role? }`

### Requirement: Diagnostics integration

The diagnostics store SHALL subscribe to the event bus and log all events as structured entries.

#### Scenario: Diagnostics log from events
- **WHEN** any event is emitted
- **THEN** the diagnostics store SHALL add a log entry with timestamp, event type, and payload summary
- **THEN** the diagnostics view SHALL display these entries in real-time
