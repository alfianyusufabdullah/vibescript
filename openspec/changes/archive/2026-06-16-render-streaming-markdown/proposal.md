## Why

The Vibescript sidepanel chat currently renders streaming text from the AI agent as plain text inside a monospace block to avoid layout glitches from incomplete Markdown syntax. This proposal aims to support real-time Markdown rendering for streaming text by pre-processing incomplete markdown tokens (like open code blocks) to ensure a high-fidelity, visually rich chat experience.

## What Changes

- Implement a preprocessor utility to dynamically sanitize and auto-close unclosed markdown blocks (specifically open code blocks) during streaming.
- Replace the plain-text monospace streaming rendering in the ChatView with ReactMarkdown using the preprocessor and existing markdown components.
- Retain the active typing cursor indicator at the end of the streaming Markdown output.

## Capabilities

### New Capabilities
- `streaming-markdown`: Safe real-time rendering of streaming markdown in the sidepanel chat assistant without layout thrashing or syntax breakage.

### Modified Capabilities
<!-- None -->

## Impact

- `src/sidepanel/components/ChatView.tsx`: Replace plain text renderer for `streamingText` with `ReactMarkdown` plus the preprocessor.
- A new markdown sanitizer utility to handle unclosed backticks and basic markdown tags in real-time.
