## Why

The sidepanel chat renders AI responses using `react-markdown`, but the `remark-gfm` plugin (already installed) is never imported — so GitHub Flavored Markdown elements like tables are never parsed and render as raw pipe-separated text. Even after enabling the plugin, streaming table syntax arrives incrementally (header → separator → rows) in a way that needs preprocessing to render progressively without layout jumps.

## What Changes

- Import and enable `remark-gfm` in `MarkdownRenderer` so tables (and other GFM elements: strikethrough, task lists, autolinks) actually parse and render.
- Extend `preprocessStreamingMarkdown()` to detect incomplete table blocks during streaming and auto-complete them so the parser can render progressively from the moment the header row is complete.
- Add styled component overrides for `table`, `thead`, `tbody`, `tr`, `th`, `td` in `MarkdownRenderer` with `table-layout: fixed` to prevent column-width layout jumps as content streams in.

## Capabilities

### New Capabilities
- `streaming-gfm-tables`: Progressive real-time rendering of GFM tables during streaming, with stable column layout and auto-completion of partial table syntax.

### Modified Capabilities
<!-- None -->

## Impact

- `src/sidepanel/components/MarkdownRenderer.tsx`: Add `remarkGfm` plugin, add table component overrides.
- `src/sidepanel/utils/markdown.ts`: Extend `preprocessStreamingMarkdown()` with table completion logic.
- No new dependencies required (`remark-gfm` already in `package.json`).
