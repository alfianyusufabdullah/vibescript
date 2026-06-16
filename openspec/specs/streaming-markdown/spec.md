# streaming-markdown Specification

## Purpose
TBD - created by archiving change render-streaming-markdown. Update Purpose after archive.
## Requirements
### Requirement: Preprocess Streaming Markdown
The system SHALL parse and preprocess the streaming markdown text to detect and automatically close any unclosed code blocks (delineated by triple backticks) before it is passed to the Markdown renderer.

#### Scenario: Auto-closing unclosed code blocks during streaming
- **WHEN** the agent streams text containing an unclosed triple backtick markdown block (e.g. "Some explanation\n```javascript\nconst x = 1;")
- **THEN** the preprocessor SHALL append the closing "\n```" block to the text so that it renders as a valid syntax-highlighted code block instead of swallowing subsequent text.

### Requirement: Render Streaming Text as Markdown
The system SHALL render the preprocessed streaming text in the sidepanel chat interface using ReactMarkdown with matching styles and custom component styling as the completed message bubble.

#### Scenario: High fidelity rendering during streaming
- **WHEN** streamingText is active and containing markdown formatting like bold text, lists, or headers
- **THEN** the UI SHALL render the formatted markdown elements in real-time.

### Requirement: Retain Typing Cursor during Streaming
The system SHALL append an active cursor indicator to the end of the streaming Markdown content block.

#### Scenario: Typing cursor visible
- **WHEN** the agent is actively streaming response text
- **THEN** a blinking typing cursor indicator SHALL be rendered at the end of the text.

