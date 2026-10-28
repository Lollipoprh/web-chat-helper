<!-- 由 pnpm map 生成，请勿手工编辑；一致性由 pnpm map:check 保证 -->

# packages/llm-client（7 文件 / 约 820 行）

## src/chat.ts (395 行)
- :8 — `ChatRole`
- :10 — `ToolCall`
- :20 — `ToolDefinition`
- :30 — `ChatMessage`
- :40 — `ChatRequest`
- :56 — `ChatResult`
- :66 — `createChatCompletion`
- :120 — `streamChatCompletion`
imports: `packages/llm-client/src/errors.ts`, `packages/llm-client/src/sse.ts`
used by: `packages/llm-client/src/index.ts`

## src/connection-test.ts (148 行)
- :7 — `ConnectionTestCode`
- :20 — `ConnectionTestResult`
- :30 — `ConnectionTestInput`
- :43 — `testConnection`
imports: `packages/llm-client/src/errors.ts`
used by: `packages/llm-client/src/index.ts`

## src/endpoint.ts (71 行)
- :11 — `EndpointInfo`
- :22 — `EndpointParseResult`
- :26 — `parseEndpoint`
imports: -
used by: `packages/llm-client/src/index.ts`

## src/errors.ts (90 行)
- :4 — `LLMErrorCode`
- :16 — `LLMError`
- :30 — `httpStatusToLLMError`
- :66 — `extractServerMessage`
- :86 — `truncate`
imports: -
used by: `packages/llm-client/src/chat.ts`, `packages/llm-client/src/connection-test.ts`, `packages/llm-client/src/index.ts`

## src/index.ts (12 行)
reexports: `./chat`, `./connection-test`, `./endpoint`, `./errors`, `./sse`, `./types`
imports: `packages/llm-client/src/chat.ts`, `packages/llm-client/src/connection-test.ts`, `packages/llm-client/src/endpoint.ts`, `packages/llm-client/src/errors.ts`, `packages/llm-client/src/sse.ts`, `packages/llm-client/src/types.ts`
used by: -

## src/sse.ts (68 行)
- :5 — `consumeSseStream`
imports: -
used by: `packages/llm-client/src/chat.ts`, `packages/llm-client/src/index.ts`

## src/types.ts (36 行)
- :4 — `ProviderConfig`
- :24 — `ProviderDraft`
- :26 — `createProviderId`
- :31 — `maskApiKey`
imports: -
used by: `packages/llm-client/src/index.ts`
