## 1. Enable GFM Parser

- [x] 1.1 Import `remarkGfm` from `remark-gfm` in `MarkdownRenderer.tsx`
- [x] 1.2 Pass `remarkPlugins={[remarkGfm]}` to the `<ReactMarkdown>` component

## 2. Table Styling Components

- [x] 2.1 Add `table` override in `markdownComponents`: wrap in `overflow-x-auto` container, apply `table-layout: fixed`, `border-collapse`, full width
- [x] 2.2 Add `thead` override: bottom border, light background
- [x] 2.3 Add `tbody` override: pass-through wrapper
- [x] 2.4 Add `tr` override: bottom border on each row except last
- [x] 2.5 Add `th` override: left-aligned, semibold, `px-3 py-1.5`, zinc-700 text
- [x] 2.6 Add `td` override: `px-3 py-1.5`, zinc-700 text, `align-top`

## 3. Streaming Table Preprocessor

- [x] 3.1 Add `fixIncompleteTable(text: string): string` helper inside `markdown.ts` that detects the trailing table block (last contiguous block of `|`-prefixed lines)
- [x] 3.2 Implement column count detection from header row (split by `|`, count non-empty cells)
- [x] 3.3 Implement State 1: if header row does not end with `|`, return text unchanged
- [x] 3.4 Implement State 2: if header is complete but no separator row exists, inject synthetic `| --- | ... |` separator
- [x] 3.5 Implement State 3: if separator row exists but is incomplete (fewer cells than header), complete it
- [x] 3.6 Implement State 4 & 5: if last data row is missing trailing `|` or has fewer cells than header, pad with empty cells
- [x] 3.7 Call `fixIncompleteTable()` from `preprocessStreamingMarkdown()` after the existing code block fix

## 4. Verification

- [x] 4.1 Build extension (`npm run build`) and load in Chrome to verify tables render in completed messages
- [ ] 4.2 Test streaming: trigger an AI response that includes a table and confirm the table appears progressively without layout jumps
- [ ] 4.3 Verify `table-layout: fixed` stability: column widths do not shift as cell content streams in
- [ ] 4.4 Verify horizontal scroll works for wide tables instead of overflow
- [ ] 4.5 Verify code blocks, lists, and other existing formatting remain unaffected
