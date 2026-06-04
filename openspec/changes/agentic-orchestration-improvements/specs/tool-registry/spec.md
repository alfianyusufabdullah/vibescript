## ADDED Requirements

### Requirement: Tool interface

The system SHALL define a `Tool` interface with `name`, `description`, `parameters` (JSON Schema), and `execute` method. Each tool SHALL be a self-contained module in `src/shared/tools/<name>.ts`.

#### Scenario: Tool definition
- **WHEN** a tool is defined
- **THEN** it MUST export an object matching the `Tool` interface
- **THEN** its `execute` method SHALL receive `(args: Record<string, unknown>, ctx: ToolContext)`
- **THEN** it SHALL return a `ToolResult` with `toolCallId`, `name`, `success`, `output`, and optional `error`

### Requirement: ToolRegistry class

The system SHALL provide a `ToolRegistry` class with `register()`, `unregister()`, `get()`, `getAll()`, and `execute()` methods. The registry SHALL be the single source of truth for available tools.

#### Scenario: Register a tool
- **WHEN** `registry.register(tool)` is called
- **THEN** the tool SHALL be available via `registry.get(name)`
- **THEN** `registry.getAll()` SHALL include the registered tool

#### Scenario: Unregister a tool
- **WHEN** `registry.unregister(name)` is called
- **THEN** the tool SHALL no longer appear in `getAll()`
- **THEN** `execute(name)` SHALL return an error result

#### Scenario: Execute a tool
- **WHEN** `registry.execute(name, args, ctx)` is called
- **THEN** the matching tool's `execute()` SHALL be invoked with args and ctx
- **THEN** the result SHALL be returned as a `ToolResult`
- **THEN** if the tool name is not found, an error `ToolResult` SHALL be returned

### Requirement: Built-in tools

The system SHALL register 5 built-in tools: `read_active_file`, `edit_file`, `list_open_files`, `read_file_by_name`, `finish`. Each SHALL be in its own file under `src/shared/tools/`.

#### Scenario: read_active_file tool
- **WHEN** executed
- **THEN** it SHALL call `editorStore.fetchContext()`
- **THEN** it SHALL return the editor context as JSON string

#### Scenario: edit_file tool
- **WHEN** executed with `search` and `replace`
- **THEN** it SHALL call `editorStore.editFileWithReview(search, replace)`
- **THEN** if rejected, it SHALL return `error: 'USER_REJECTED'`
- **THEN** if approved, it SHALL return success with applied edit message

#### Scenario: list_open_files tool
- **WHEN** executed
- **THEN** it SHALL call `editorStore.listOpenFiles()`
- **THEN** it SHALL return the files list as JSON string

#### Scenario: read_file_by_name tool
- **WHEN** executed with `filename`
- **THEN** it SHALL call `editorStore.readFileByName(filename)`
- **THEN** if found, it SHALL return the file context as JSON string
- **THEN** if not found, it SHALL return error with filename

#### Scenario: finish tool
- **WHEN** executed with `summary`
- **THEN** it SHALL signal the agent loop to stop
- **THEN** the summary SHALL be used as the final response
