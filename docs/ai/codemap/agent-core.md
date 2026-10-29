<!-- 由 pnpm map 生成，请勿手工编辑；一致性由 pnpm map:check 保证 -->

# packages/agent-core（6 文件 / 约 796 行）

## src/diagnostic-tools.ts (33 行)
- :6 — `createEchoTool`
imports: `packages/agent-core/src/types.ts`
used by: `packages/agent-core/src/index.ts`

## src/index.ts (15 行)
reexports: `./diagnostic-tools`, `./loop`, `./registry`, `./types`, `./validation`
imports: `packages/agent-core/src/diagnostic-tools.ts`, `packages/agent-core/src/loop.ts`, `packages/agent-core/src/registry.ts`, `packages/agent-core/src/types.ts`, `packages/agent-core/src/validation.ts`
used by: -

## src/loop.ts (458 行)
- :28 — `AgentChatConfig`
- :36 — `AgentLimits`
- :45 — `DEFAULT_AGENT_LIMITS`
- :51 — `AgentRunOptions`
- :72 — `runAgentLoop`
- :405 — `previewArgs`
imports: `llm-client`, `packages/agent-core/src/registry.ts`, `packages/agent-core/src/types.ts`, `packages/agent-core/src/validation.ts`
used by: `packages/agent-core/src/index.ts`

## src/registry.ts (41 行)
- :6 — `ToolRegistry`
imports: `llm-client`, `packages/agent-core/src/types.ts`
used by: `packages/agent-core/src/index.ts`, `packages/agent-core/src/loop.ts`

## src/types.ts (111 行)
- :6 — `ToolErrorCode`
- :21 — `ToolResult`
- :30 — `AgentToolContext`
- :39 — `AgentTool`
- :50 — `StopReason`
- :53 — `AgentToolEvent`
- :67 — `ConfirmationRequest`
- :77 — `AgentCheckpoint`
- :88 — `AgentToolLog`
- :101 — `AgentRunResult`
imports: `llm-client`, `packages/agent-core/src/validation.ts`
used by: `packages/agent-core/src/diagnostic-tools.ts`, `packages/agent-core/src/index.ts`, `packages/agent-core/src/loop.ts`, `packages/agent-core/src/registry.ts`

## src/validation.ts (138 行)
- :5 — `JsonSchema`
- :20 — `ValidationResult`
- :25 — `validateToolArguments`
imports: -
used by: `packages/agent-core/src/index.ts`, `packages/agent-core/src/loop.ts`, `packages/agent-core/src/types.ts`
