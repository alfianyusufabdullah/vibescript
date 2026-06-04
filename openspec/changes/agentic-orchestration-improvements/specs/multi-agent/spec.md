## ADDED Requirements

### Requirement: Agent role definitions

The system SHALL define agent roles as data objects with `id`, `label`, `description`, `systemPrompt`, `allowedTools`, and `color`. Three built-in roles SHALL be defined: `build`, `explore`, and `plan`.

#### Scenario: Build agent role
- **WHEN** the `build` agent is active
- **THEN** it SHALL have access to ALL tools (`'*'`)
- **THEN** it SHALL use the existing `AGENT_SYSTEM_PROMPT`
- **THEN** it SHALL be the default role when no agent is specified

#### Scenario: Explore agent role
- **WHEN** the `explore` agent is active
- **THEN** it SHALL only have access to read-only tools: `read_active_file`, `list_open_files`, `read_file_by_name`
- **THEN** it SHALL NOT have access to `edit_file` or `finish`
- **THEN** its system prompt SHALL instruct it to investigate code structure

#### Scenario: Plan agent role
- **WHEN** the `plan` agent is active
- **THEN** it SHALL have access to read-only tools plus `finish`
- **THEN** it SHALL NOT have access to `edit_file`
- **THEN** its system prompt SHALL instruct it to analyze and create plans without modifying code

### Requirement: Agent role filtering in ToolRegistry

The `ToolRegistry.getAll()` method SHALL accept an optional list of allowed tool names. When provided, it SHALL filter the returned tool definitions to only include allowed tools.

#### Scenario: Filter tools by allowed list
- **WHEN** `registry.getAll(['read_active_file', 'list_open_files'])` is called
- **THEN** only `read_active_file` and `list_open_files` SHALL be returned
- **THEN** `edit_file` and other tools SHALL be excluded

### Requirement: Agent orchestrator

The system SHALL provide an `AgentOrchestrator` that manages agent role lifecycle. The orchestrator SHALL create `AgentRuntime` instances per role, run tasks, and return results.

#### Scenario: Run agent with specific role
- **WHEN** `orchestrator.runAgent('explore', prompt, context)` is called
- **THEN** an `AgentRuntime` SHALL be created with the `explore` role's system prompt and filtered tools
- **THEN** the runtime SHALL execute with those constraints
- **THEN** the result SHALL be returned to the caller

#### Scenario: Sub-agent invocation
- **WHEN** the user types `@explore find the data fetching functions`
- **THEN** the `build` agent SHALL NOT process the prompt
- **THEN** the `explore` agent SHALL run with the task
- **THEN** the result SHALL be shown in the chat with explore agent's color indicator

### Requirement: Agent UI indicator

The chat view SHALL show which agent role is currently active. The status indicator SHALL display the agent's label and color. Sub-agent results SHALL be visually differentiated.

#### Scenario: Agent indicator display
- **WHEN** the `build` agent is running
- **THEN** the status indicator SHALL show "AI Assistant (build)"
- **WHEN** the `explore` agent is running
- **THEN** the status indicator SHALL show "Explore Agent"
- **THEN** the indicator SHALL use the agent's assigned color

#### Scenario: Sub-agent result in chat
- **WHEN** a sub-agent completes a task
- **THEN** its output SHALL be displayed in a collapsible section
- **THEN** the section SHALL be labeled with the agent's name and color
