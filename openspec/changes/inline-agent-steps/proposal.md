## Why

Currently, when the AI agent executes, its thinking process (reasoning content) and tool execution logs are separated from the text stream and presented as a collapsible log at the bottom of the completed message bubble. This layout separates the text explanation from the action context, making it hard for the user to follow the chronological sequence of thoughts, tools used, outputs received, and final code corrections. Integrating them chronologically into the chat bubble provides a unified and premium user experience similar to modern AI coding assistants.

## What Changes

- Update `AgentRuntime` to emit a `'text'` step for the final text response so that every part of the agent's output is recorded in `steps`.
- Update `agentStore` to store the active step's streaming text separately from the accumulated `streamingText`, ensuring real-time rendering without duplicates.
- Refactor the UI (`MessageBubble.tsx` and `ChatView.tsx`) to render agent steps and tool execution cards in chronological order inline inside the chat bubble itself.
- Remove the collapsible execution log footer from completed assistant message bubbles, as tool executions will now be integrated directly within the bubble text stream.

## Capabilities

### New Capabilities
- `inline-agent-steps`: Chronological rendering of streaming text, reasoning contents, and tool executions inside a unified assistant chat bubble.

### Modified Capabilities
<!-- None -->

## Impact

- **`src/sidepanel/services/agentRuntime.ts`**: Modifies the callbacks to emit a step for final text blocks.
- **`src/sidepanel/stores/agentStore.ts`**: Adds state tracking for the active step's streaming text and resets it on new steps.
- **`src/sidepanel/components/MessageBubble.tsx`**: Updates the rendering logic to iterate over paired steps and display text and tool execution cards sequentially.
- **`src/sidepanel/components/ChatView.tsx`**: Refactors the streaming indicator container to show the active, unfolding message bubble with inline steps and current stream.
