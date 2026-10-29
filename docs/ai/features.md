# Features to Code

Use these product terms to find files and symbols. Line numbers belong in the generated `codemap/` files.

## Model requests and streaming responses

- Request entry points: `packages/llm-client/src/chat.ts` (`streamChatCompletion`, `createChatCompletion`)
- Stream parsing: `packages/llm-client/src/sse.ts` (`consumeSseStream`)
- Endpoint normalization: `packages/llm-client/src/endpoint.ts` (`parseEndpoint`)
- Error mapping: `packages/llm-client/src/errors.ts` (`LLMError`, `httpStatusToLLMError`)

## Connection test in settings

- Logic: `packages/llm-client/src/connection-test.ts` (`testConnection`)
- UI: `apps/chrome-extension/src/options/App.tsx`, `apps/chrome-extension/src/options/ProviderForm.tsx`

## Agent loop, round limit, and timeout

- Main loop: `packages/agent-core/src/loop.ts` (`runAgentLoop`, `DEFAULT_AGENT_LIMITS`)
- Argument validation: `packages/agent-core/src/validation.ts` (`validateToolArguments`)
- Tool registry: `packages/agent-core/src/registry.ts` (`ToolRegistry`)
- Limit storage: `apps/chrome-extension/src/shared/storage.ts` (`loadAgentLimits`, `saveAgentLimits`)

## Browser tools: clicks, forms, scrolling, snapshots, and tabs

- Tool definitions: `packages/browser-tools/src/tools.ts` (`createBrowserTools`)
- Result types: `packages/browser-tools/src/types.ts`
- In-page execution: `apps/chrome-extension/src/content/index.ts`
- Message transport: `apps/chrome-extension/src/shared/browser-transport.ts`

## Side panel UI and chat interaction

- Main UI: `apps/chrome-extension/src/sidepanel/App.tsx`
- Task history: `apps/chrome-extension/src/sidepanel/TaskHistory.tsx`

## Sessions and task history storage

- Sessions: `apps/chrome-extension/src/shared/session-storage.ts` (`SessionRecord`, `listSessions`)
- Step logs: `apps/chrome-extension/src/shared/step-log-storage.ts` (`recordStep`, `listSessionTasks`, `pruneLogs`)
- Chat records: `apps/chrome-extension/src/shared/chat-storage.ts`
- IndexedDB setup: `apps/chrome-extension/src/shared/local-db.ts`

## Provider configuration: model, key, and URL

- Storage: `apps/chrome-extension/src/shared/storage.ts` (`ProviderConfig`, `loadProviders`, `saveProvider`)
- UI: `apps/chrome-extension/src/options/ProviderForm.tsx`, `apps/chrome-extension/src/options/App.tsx`

## Permissions, message routing, and injection

- Message constants: `apps/chrome-extension/src/shared/index.ts` (`MESSAGE_TYPES`, `BROWSER_ACTION_MESSAGE_TYPES`)
- Service Worker: `apps/chrome-extension/src/background/index.ts`
- Site permissions: `apps/chrome-extension/src/shared/permissions.ts`
- Manifest: `apps/chrome-extension/manifest.config.ts`

## Confirmation, checkpoints, and recovery

- Types: `packages/agent-core/src/types.ts` (`ConfirmationRequest`, `AgentCheckpoint`)
- Storage: `apps/chrome-extension/src/shared/checkpoint-storage.ts`
