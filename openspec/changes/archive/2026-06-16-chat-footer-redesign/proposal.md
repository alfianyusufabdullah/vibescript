## Why

The current sidepanel chat footer has visual alignment issues where elements like the "+ New" button and the sessions count display are bunched together as "+ NEW 5 SESSIONS" without proper separation. Additionally, the chat connection status is generic ("Active Connection") rather than showing the active context (e.g. the currently active file name), and the mentions/sessions popovers do not follow standard shadcn/ui defaults, resulting in a cluttered and inconsistent design.

## What Changes

* Display the active file name (e.g. `Code.gs`) inside the connection status indicator when connected.
* Refactor the autocomplete mentions list and sessions popover styles to strictly follow default shadcn/ui styles (using CSS variables like `bg-popover`, `text-popover-foreground`, `border`, `shadow-md`, etc.) and prevent custom styles from overriding them.
* Re-architect the chat footer to have a clear, high-contrast, and modern layout that group controls logically (status and sessions on a top row, chat input and history action buttons inside the input card toolbar).

## Capabilities

### New Capabilities
- `chat-footer`: A clear, context-aware sidepanel chat footer showing active file information, standardized shadcn/ui popovers, and a balanced layout for text entry and history management.

### Modified Capabilities
<!-- None -->
-

## Impact

* `src/sidepanel/components/ChatView.tsx`: Layout structure and control bar components will be updated.
* `@radix-ui/react-popover` and shadcn components usage in `ChatView.tsx`.
* Mention component list styling inside `ChatView.tsx`.
