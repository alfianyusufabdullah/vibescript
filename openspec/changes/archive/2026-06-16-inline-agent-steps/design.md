## Context

Currently, `ChatView.tsx` and `MessageBubble.tsx` render the completed messages and the running agent state separately:
- The text content (accumulated across all LLM rounds) is rendered as a single markdown bubble.
- The execution steps (tool calls/results) are appended below the bubble in a collapsible log.

When running reasoning models or multi-step tool agents, this separation causes cognitive load, as it separates code inspection/modifications from the text explanations/rationale.

## Goals / Non-Goals

**Goals:**
- Render text segments and tool execution logs chronologically in a single, unified stream inside the assistant message bubble.
- Enable smooth, real-time streaming of text per round inside the active bubble container.
- Cleanly pair `tool_call` and `tool_result` steps into unified expandable cards inside the bubble.

**Non-Goals:**
- Storing reasoning text separate from final content in the database (we will keep the standard schema but structure the runtime steps chronologically).

## Decisions

### 1. Final Text Step Emission in `AgentRuntime.ts`
To ensure the final response text (which has no tool calls) is captured in the chronological step log:
- **Decision**: Emit a step of type `'text'` right before the agent completes in `callbacks.onDone`.
- **Alternatives Considered**: Substring subtraction in the UI. (Rejected due to complexity and potential bugs with whitespaces).

### 2. Active Round-Level Streaming Text in `agentStore.ts`
To prevent the streaming text from repeating content already committed to previous steps:
- **Decision**: Maintain a `currentStepText` in `agentStore`. This accumulates streaming text in the current round and is reset to `""` whenever `onStep` is fired.
- **Alternatives Considered**: Modifying the stream parser to return raw chunks (we already do this, but storing them in a dedicated variable keeps UI logic clean).

### 3. Chronological Step Rendering in `MessageBubble.tsx` and `ChatView.tsx`
- **Decision**: Reuse the `pairSteps` utility to transform the flat `AgentStep` array into paired text and tool blocks. Map these blocks sequentially to markdown renderers and accordion tool cards.
- **Alternatives Considered**: Writing custom JSX renderers in both files. We will keep components simple and modular.

## Risks / Trade-offs

- **[Risk] Layout shifting during tool execution** → **Mitigation**: Tool cards are rendered with fixed heights/compact headers and clean collapsible contents.
- **[Risk] Broken styling on empty state** → **Mitigation**: Render a clean "Thinking..." card inside the bubble if there are no steps or current streaming text yet.
