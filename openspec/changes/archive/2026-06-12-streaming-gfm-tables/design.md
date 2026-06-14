## Context

`MarkdownRenderer` uses `react-markdown` with no plugins — only CommonMark is parsed. `remark-gfm` is already in `package.json` but never imported. As a result, GFM-specific syntax (tables, strikethrough, task lists) is never recognized and renders as raw text.

For tables specifically, streaming adds a second problem: the parser needs at minimum a header row + separator row before it can recognize a table block. Content arrives token-by-token, so for several frames the table syntax is either invisible (still plain text) or partially structured.

Current `preprocessStreamingMarkdown()` only handles unclosed code blocks (odd backtick count). It has no awareness of tables.

## Goals / Non-Goals

**Goals:**
- Tables (and other GFM extensions) render correctly in both streaming and completed messages.
- Tables appear progressively — the table structure is visible as soon as the header row is complete, not after the entire table arrives.
- Column widths are stable during streaming — no horizontal layout jumps as cell content grows.

**Non-Goals:**
- Streaming-specific handling for other GFM inline elements (strikethrough, autolinks, task lists) — these are single-line and have no streaming render problem.
- Syntax highlighting inside table cells.
- Handling tables inside blockquotes or nested structures.

## Decisions

### 1. Enable remark-gfm in MarkdownRenderer

Pass `remarkPlugins={[remarkGfm]}` to `<ReactMarkdown>`. This is the minimal fix for all GFM parsing; everything else builds on it.

No alternatives considered — the plugin is already installed and purpose-built for this.

### 2. Eager separator injection (Option A)

When `preprocessStreamingMarkdown()` detects a table header row that is complete (ends with `|`) but has no following separator row, inject a synthetic separator immediately.

```
Input:  "| Name | Age |"
Output: "| Name | Age |\n| --- | --- |"
```

**Alternative considered — conservative (wait for actual separator)**: Table would remain plain text until separator arrives (~1–3 tokens later). Rejected because it causes a visible flash from plain text to table layout.

**Why eager is safe**: A line of the form `| word | word |` followed by nothing is nearly always a table header in AI output. The cost of a false positive (an accidental table appearance) is very low compared to the benefit of immediate progressive rendering.

### 3. Five-state preprocessing algorithm

The preprocessor handles these states in order:

| State | Condition | Action |
|-------|-----------|--------|
| 1 | Header incomplete (no trailing `\|`) | No-op — column count unknown |
| 2 | Header complete, no separator | Inject synthetic `\| --- \| ... \|` |
| 3 | Separator incomplete | Complete separator to match header column count |
| 4 | Data row missing trailing `\|` | Pad with empty cells to header column count |
| 5 | Data row has fewer cells than header | Pad missing cells |

Column count is always derived from the header row (first line of the detected table block).

### 4. Table block detection scoped to the trailing block

Only the last contiguous block of `|`-prefixed lines is processed. Earlier completed tables in the same response are left untouched.

### 5. CSS stability via `table-layout: fixed`

Add `table-layout: fixed` to the `table` component override. This causes the browser to determine column widths from the first row (header) and hold them fixed — subsequent rows fill in without causing reflow.

Without this, each new token that widens a cell causes a full column resize, creating visible horizontal jumps.

### 6. Cursor character `▋` is safe

The `▋` cursor is appended before preprocessing. Because it is not a `|` character, splitting on `|` to count columns treats it as ordinary cell content. No special handling needed.

## Risks / Trade-offs

- **[Risk] Pipe characters inside cell content** → Mitigation: `remark-gfm` handles escaped pipes (`\|`) natively. The preprocessor operates on a structural level (line-by-line pipe counting) and is not impacted by escaped content in completed cells; the risk only applies to the last incomplete cell, where content is still arriving.
- **[Risk] Synthetic separator causes false table** → Mitigation: A false positive requires a line that looks exactly like `| word | word |` but is not a table. In practice, AI models consistently follow header rows with separator rows, and the visual cost of a brief false table is negligible.
- **[Risk] `table-layout: fixed` with very long cell content** → Mitigation: Wrap the `<table>` in an `overflow-x: auto` container so content doesn't clip.
