## 1. Store and Core Runtime Updates

- [x] 1.1 Update `AgentRuntime.ts` to emit a `'text'` step for the final response text right before calling `onDone`.
- [x] 1.2 Update `agentStore.ts` to add `currentStepText` to the state interface, update it in `onStreamingText`, and reset it to empty in `onStep`, `reset`, and `run` initiation.

## 2. Component Refactoring

- [x] 2.1 Refactor `MessageBubble.tsx` to pair its `agentSteps` (or render `message.content` if empty) and render them in chronological order inline inside the bubble.
- [x] 2.2 Remove the collapsible tool execution log wrapper from the bottom of assistant `MessageBubble.tsx`.
- [x] 2.3 Refactor `ChatView.tsx` to render the running agent state as a single active message bubble using paired `agentSteps` and `currentStepText`, showing a loader inside the bubble when thinking.

## 3. Testing and Verification

- [x] 3.1 Verify that streaming text, thinking phases, and tool calls unfold chronologically in the side panel during agent execution.
- [x] 3.2 Verify that completed chat message bubbles preserve the chronological step log without duplicates and syntax highlight code blocks properly.
