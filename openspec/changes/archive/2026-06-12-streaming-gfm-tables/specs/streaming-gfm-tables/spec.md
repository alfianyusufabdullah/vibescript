## ADDED Requirements

### Requirement: GFM tables render in completed messages
The system SHALL parse and render GitHub Flavored Markdown tables (`| col | col |` syntax) in completed assistant messages.

#### Scenario: Table in completed message renders as HTML table
- **WHEN** an assistant message contains a complete GFM table (header row, separator row, one or more data rows)
- **THEN** the message SHALL render the table as a styled HTML table, not as raw pipe-separated text

#### Scenario: Other GFM extensions render correctly
- **WHEN** an assistant message contains strikethrough (`~~text~~`) or task list items (`- [x] item`)
- **THEN** those elements SHALL render with their intended visual formatting

### Requirement: Tables render progressively during streaming
The system SHALL begin rendering a table as a visible HTML table as soon as the header row is complete, without waiting for the full table to arrive.

#### Scenario: Table appears after header row completes
- **WHEN** a streaming response includes a complete table header row (ends with `|`) and no separator row has arrived yet
- **THEN** the system SHALL display the header row as a rendered table (with a synthetic separator injected) rather than plain text

#### Scenario: Separator row arrival does not cause layout flash
- **WHEN** the actual separator row arrives in the stream after the synthetic one was injected
- **THEN** the rendered table SHALL remain visually stable (no flash or layout change)

#### Scenario: Incomplete data row is padded
- **WHEN** a streaming response includes a partial data row (starts with `|` but does not end with `|`, or has fewer cells than the header)
- **THEN** the row SHALL be padded with empty cells to match the header column count, so the table layout remains intact

#### Scenario: Incomplete header row is not forced into table
- **WHEN** a streaming response includes a line starting with `|` that does not yet end with `|`
- **THEN** the system SHALL NOT attempt to render it as a table (column count is unknown)

### Requirement: Table column widths are stable during streaming
The system SHALL prevent table column widths from changing as cell content arrives token by token.

#### Scenario: Column widths set by header row
- **WHEN** a table header row has been rendered
- **THEN** the column widths SHALL be determined by the header row and SHALL NOT change as subsequent data rows stream in

#### Scenario: Long cell content does not overflow the chat container
- **WHEN** a table cell contains content wider than the chat panel
- **THEN** the table container SHALL provide horizontal scrolling rather than overflowing the panel
