## 1. Active File Context Integration

- [x] 1.1 Read current active filename (`currentContext?.filename`) in `ChatView.tsx`
- [x] 1.2 Update the connection badge layout to render `Connected: [filename]` when connected, truncating name if needed, or `Disconnected` when offline.

## 2. Standardize Popover Styles

- [x] 2.1 Refactor session switcher popover structure in `ChatView.tsx` to strictly use shadcn popover classes (`bg-popover text-popover-foreground border border-border shadow-md rounded-md p-1`).
- [x] 2.2 Refactor mention autocomplete dropdown container styling in `ChatView.tsx` to use standard shadcn popover classes (`bg-popover text-popover-foreground border border-border shadow-md rounded-md p-1`).
- [x] 2.3 Style list items inside mentions autocomplete to match shadcn select/item styles.

## 3. Rearrange Chat Footer Layout

- [x] 3.1 Separate status bar and sessional controls into a top row above the input card in `ChatView.tsx`.
- [x] 3.2 Place the `MentionInput` and send button inside a single visually cohesive card container.
- [x] 3.3 Move history action buttons (Copy / Reset History) to the bottom-left corner inside the card container toolbar (aligned next to the send button on the right).
- [x] 3.4 Adjust layout margins, spacing, and icons alignment to ensure a high-contrast, clean, and clear look.
