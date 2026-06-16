## 1. Utility & Shared Component Setup

- [x] 1.1 Create the markdown preprocessor utility in a new file `src/sidepanel/utils/markdown.ts` that counts triple-backticks and auto-closes open code blocks.
- [x] 1.2 Create a shared React component `MarkdownRenderer` in `src/sidepanel/components/MarkdownRenderer.tsx` that encapsulates `ReactMarkdown`, the custom code block styles, and action buttons (Copy/Insert/Replace).

## 2. Component Integration

- [x] 2.1 Refactor `MessageBubble.tsx` to use the new shared `MarkdownRenderer` component for rendering completed message content.
- [x] 2.2 Update `ChatView.tsx` to pre-process the `streamingText` using the new preprocessor utility.
- [x] 2.3 Update `ChatView.tsx` to render the pre-processed `streamingText` using the new `MarkdownRenderer` component, along with a typing cursor indicator.

## 3. Testing and Verification

- [x] 3.1 Verify streaming markdown responses in the extension UI, ensuring code blocks syntax-highlight properly and do not break layout during typing.
- [x] 3.2 Verify copy, insert, and replace button actions work as expected in both streaming and completed messages.
