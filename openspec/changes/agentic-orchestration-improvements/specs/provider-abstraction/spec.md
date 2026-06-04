## ADDED Requirements

### Requirement: Provider interface

The system SHALL define a common `Provider` interface with `generate()` and `stream()` methods. The `stream()` method SHALL return an `AsyncGenerator<ProviderEvent>`. Every provider implementation MUST conform to this interface.

#### Scenario: Provider interface is implemented
- **WHEN** a new provider is added
- **THEN** it MUST implement `generate()` and `stream()` methods
- **THEN** the agent runtime SHALL use the same code path regardless of which provider is active

#### Scenario: Streaming returns normalized events
- **WHEN** `stream()` is called
- **THEN** it SHALL yield `ProviderEvent` objects with types: `text_delta`, `reasoning_delta`, `tool_call_start`, `tool_call_delta`, `tool_call_stop`, `usage`, `done`, `error`
- **THEN** the consumer SHALL iterate using `for await...of`

### Requirement: OpenAI provider

The OpenAI provider SHALL call `https://api.openai.com/v1/chat/completions` (configurable base URL). It SHALL support streaming SSE with `stream_options: { include_usage: true }`. Tool calls in streaming mode SHALL be accumulated via the `tool_call_start`/`tool_call_delta`/`tool_call_stop` event sequence.

#### Scenario: OpenAI streaming with tool calls
- **WHEN** the LLM responds with tool calls
- **THEN** partial `tool_call_delta` events SHALL be emitted for each chunk of arguments JSON
- **THEN** `tool_call_stop` SHALL be emitted when all deltas for a tool call index are received
- **THEN** accumulated arguments JSON SHALL be valid and parseable

#### Scenario: OpenAI usage tracking
- **WHEN** streaming completes
- **THEN** a `usage` event SHALL be emitted with `promptTokens`, `completionTokens`, `totalTokens`
- **THEN** the usage values MUST match the final SSE chunk's `usage` field

### Requirement: Anthropic provider with real streaming

The Anthropic provider SHALL call `https://api.anthropic.com/v1/messages` with proper streaming via SSE. It SHALL parse `content_block_start`, `content_block_delta` (text and input_json variants), and `content_block_stop` events. The current fake streaming fallback SHALL be replaced.

#### Scenario: Anthropic streaming text
- **WHEN** streaming text responses
- **THEN** `text_delta` events SHALL be emitted for each `content_block_delta` with `type: "text_delta"`
- **THEN** text SHALL accumulate across multiple content blocks

#### Scenario: Anthropic streaming tool calls
- **WHEN** the LLM responds with tool use
- **THEN** `tool_call_start` SHALL be emitted on `content_block_start` with `type: "tool_use"`
- **THEN** `tool_call_delta` SHALL be emitted for each `input_json_delta`
- **THEN** `tool_call_stop` SHALL be emitted on `content_block_stop`
- **THEN** accumulated input JSON SHALL be a valid object

#### Scenario: Anthropic usage tracking
- **WHEN** streaming completes
- **THEN** a `usage` event SHALL be emitted with `input_tokens` and `output_tokens`

### Requirement: Gemini provider

The Gemini provider SHALL call `https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent`. It SHALL support SSE streaming and parse function calls from response parts.

#### Scenario: Gemini streaming with function calls
- **WHEN** the LLM responds with function calls
- **THEN** `tool_call_start` events SHALL be emitted for each functionCall part
- **THEN** tool call IDs SHALL be auto-generated as `fc_0`, `fc_1`, etc.

### Requirement: Provider registry

The system SHALL provide a `ProviderRegistry` class that maps provider names to factory functions. Providers MUST be registered before use. The registry SHALL support creating provider instances with configuration (API key, model, base URL).

#### Scenario: Register and create provider
- **WHEN** a provider is registered via `registry.register(name, factory)`
- **THEN** `registry.get(name)` SHALL return the provider instance
- **THEN** attempting to get an unregistered provider SHALL throw an error

#### Scenario: OpenAI-compatible endpoints
- **WHEN** registering an OpenAI-compatible provider (e.g., DeepSeek)
- **THEN** the OpenAI provider class SHALL accept a `baseUrl` parameter
- **THEN** all API calls SHALL use the configured base URL instead of the default

### Requirement: Provider config structure

The provider configuration in settings SHALL support per-provider base URL override. The `ProviderConfig` type in constants SHALL include an optional `baseUrl` field for OpenAI-compatible providers.

#### Scenario: Provider baseUrl configuration
- **WHEN** a provider has a custom `baseUrl` in settings
- **THEN** the provider SHALL use that URL instead of the default
- **THEN** the settings UI SHALL show a base URL input for applicable providers
