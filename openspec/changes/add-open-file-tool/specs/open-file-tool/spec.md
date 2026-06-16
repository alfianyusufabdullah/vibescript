## ADDED Requirements

### Requirement: Agent dapat switch active file by index
The system SHALL provide an `open_file` tool that accepts a zero-based `index` parameter, dispatches `mousedown`, `mouseup`, and `click` events on `li[data-index="${index}"]` in the GAS IDE sidebar, polls until Monaco confirms the switch, and returns the full file context.

#### Scenario: Successful file switch
- **WHEN** agent calls `open_file` with a valid index (e.g. `1`)
- **THEN** the inject script dispatches mousedown, mouseup, and click on `li[data-index="1"]`, polls until `getActiveEditor().getModel()` reflects the new file, and the tool returns `{ success: true, index, code, language }`

#### Scenario: Element not found for given index
- **WHEN** agent calls `open_file` with an index for which no `li[data-index]` exists in the DOM
- **THEN** the tool returns `{ success: false, error: "File at index N not found" }`

#### Scenario: Monaco switch times out
- **WHEN** the click events are dispatched but Monaco does not switch within 3000ms
- **THEN** the tool returns `{ success: false, error: "Timed out waiting for Monaco to switch" }`

### Requirement: open_file does not require user approval
The `open_file` tool SHALL execute immediately without triggering a diff review or user confirmation step.

#### Scenario: Tool executes without approval prompt
- **WHEN** the build agent calls `open_file`
- **THEN** the tool executes and returns without any approval dialog or user intervention

### Requirement: open_file invalidates the tool result cache
After a successful file switch, the tool result cache SHALL be invalidated so subsequent read tool calls reflect the new active file's content.

#### Scenario: Cache cleared after open
- **WHEN** agent calls `open_file` successfully and then calls `read_active_file`
- **THEN** `read_active_file` returns the content of the newly opened file, not a cached result

### Requirement: open_file is available only to the build role
The `open_file` tool SHALL be included in the `allowedTools` of the `build` role only.

#### Scenario: Build agent can call open_file
- **WHEN** the build agent includes `open_file` in a tool call
- **THEN** the tool is executed

#### Scenario: Explore agent cannot call open_file
- **WHEN** the explore agent attempts to call `open_file`
- **THEN** the tool is not in its allowed tool set and is not executed
