## Context

The current vibescript extension sidepanel uses React, Tailwind CSS v4, and Lucide React icons. The footer area of `ChatView.tsx` contains connection status, session switcher, new session buttons, history clear/copy tools, and the chat text input. However, the current layout lacks visual spacing, displays "Active Connection" generically, and relies on custom styling for popovers which overrides shadcn's standard aesthetic.

## Goals / Non-Goals

**Goals:**
* Redesign the chat footer layout to make it clean, structured, and easy to use.
* Connect active editor filename context (`currentContext?.filename`) to the connection status badge.
* Move history copy/clear buttons to a dedicated toolbar inside the textarea card.
* Ensure both the mentions autocomplete dropdown and the sessions list popover use default shadcn styles (`bg-popover`, `text-popover-foreground`, `border`, `shadow-md`).
* Align items correctly vertically and horizontally.

**Non-Goals:**
* Redesigning the extension header or settings panel.
* Changing monaco editor integration or message streaming/parsing.

## Decisions

### 1. Unified Textarea & History Action Bar Layout
We will wrap the textarea (`MentionInput`) and its secondary actions (Copy, Reset History) inside a single visually cohesive card container.
* *Rationale*: Putting copy/reset inside the input card aligns with modern AI chat designs (e.g., ChatGPT) and prevents layout shifting on the top bar when the chat history is cleared or populated.
* *Alternatives Considered*: Keeping copy/reset on the top row, which looked cluttered and left-heavy when they disappeared.

### 2. Sessional & Status Header Bar
We will separate the status badge and session controls into two distinct sides of a top row above the input card:
* *Left Side*: Status badge reading `Connected: [Filename]` or `Disconnected` with a colored status dot.
* *Right Side*: Sessional tools (`+ New` button and the standard `Sessions` popover).
* *Rationale*: Clearly separates system-level connection status from user-level session grouping, avoiding visual collision.

### 3. Strict Shadcn/UI Style Enforcement
We will use tailwind utility classes corresponding to default shadcn variables for all popover content.
* *Mentions*: Style the autocomplete mentions list with:
  `absolute bottom-[calc(100%+8px)] left-0 w-72 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md z-50`
* *Sessions*: Use standard `<PopoverContent className="w-64 p-1">` styled with standard shadcn variables.
* *Rationale*: Keeps the look consistent with the rest of the application without hardcoding colors or custom border values (like `border-zinc-250`).

## Risks / Trade-offs

* **Risk**: Long filenames might overflow the connection status badge and push session controls off-screen.
  * *Mitigation*: We will implement text truncation (e.g., `max-w-[120px] truncate`) on the filename display in the connection badge.
