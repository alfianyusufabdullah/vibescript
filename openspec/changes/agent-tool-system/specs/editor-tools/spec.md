## ADDED Requirements

### Requirement: LIST_FILES Action (inject.js)
The inject.js SHALL handle a `LIST_FILES` action that returns all open Monaco editor instances.
- Handler MUST iterate `monaco.editor.getEditors()` and return metadata per editor
- Each entry MUST include: name (from model URI path), language, isActive (has widget focus)
- MUST use request/response pattern with `requestId` for correlation

#### Scenario: List all open files
- **WHEN** sidepanel sends `{action: 'LIST_FILES', payload: {requestId}}` via postMessage
- **THEN** inject.js returns `{action: 'LIST_FILES_RESULT', payload: {requestId, files: [...]}}`
- **AND** each file entry has {name, language, isActive}

#### Scenario: No editors open
- **WHEN** `monaco.editor.getEditors()` returns empty
- **THEN** handler returns `{files: []}`

### Requirement: READ_FILE_BY_NAME Action (inject.js)
The inject.js SHALL handle a `READ_FILE_BY_NAME` action that finds and reads a specific file.
- MUST find editor by partial filename match on URI path
- MUST focus the editor after finding it
- MUST return full `MonacoEditorContext` (code, language, position, selection, selectedText)
- MUST use request/response pattern with `requestId`

#### Scenario: Read file by name
- **WHEN** sidepanel sends `{action: 'READ_FILE_BY_NAME', payload: {requestId, filename: "Code.gs"}}`
- **THEN** inject.js finds editor whose URI path includes "Code.gs"
- **AND** focuses that editor
- **AND** returns full MonacoEditorContext

#### Scenario: File not found
- **WHEN** no editor matches the given filename
- **THEN** handler returns context as null

### Requirement: EDIT_FILE Action (inject.js)
The inject.js SHALL handle an `EDIT_FILE` action that performs find-and-replace on the active editor.
- MUST use `editor.getModel().getValue()` → `String.replace()` → `editor.executeEdits()`
- MUST be fire-and-forget (no response payload needed)
- Search is single occurrence (String.replace default)

#### Scenario: Edit file content
- **WHEN** sidepanel sends `{action: 'EDIT_FILE', payload: {search: "oldFunc", replace: "newFunc"}}`
- **THEN** inject.js replaces first occurrence of "oldFunc" with "newFunc" in active editor

### Requirement: editorStore Methods
The editorStore SHALL expose three new methods: `listOpenFiles()`, `readFileByName()`, `editFile()`.
- All MUST follow existing postMessage pattern (send message → wait response with timeout)
- Timeout MUST be 2 seconds (matching existing pattern)
- `listOpenFiles()` returns `Promise<FileInfo[]>` where FileInfo = {name, language, isActive}
- `readFileByName()` returns `Promise<MonacoEditorContext | null>`
- `editFile()` returns `Promise<void>` (fire-and-forget)

#### Scenario: editorStore.listOpenFiles()
- **WHEN** calling `editorStore.listOpenFiles()`
- **THEN** it posts LIST_FILES message to inject.js
- **AND** returns parsed file list
- **AND** if timeout (2s), returns empty array

#### Scenario: editorStore.readFileByName()
- **WHEN** calling `editorStore.readFileByName("Code.gs")`
- **THEN** it posts READ_FILE_BY_NAME message with filename
- **AND** returns MonacoEditorContext or null
- **AND** if timeout (2s), returns null

#### Scenario: editorStore.editFile()
- **WHEN** calling `editorStore.editFile("foo", "bar")`
- **THEN** it posts EDIT_FILE message with search/replace
- **AND** returns immediately (fire-and-forget)
