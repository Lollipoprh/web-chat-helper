# Product Terms to Code Identifiers

Use this table when a product term does not match the name used in code.

| Product term | Code identifiers | Files |
| --- | --- | --- |
| Task / task history | `TaskHistory`, `LogTaskRecord`, `listSessionTasks` | `apps/chrome-extension/src/sidepanel/TaskHistory.tsx`, `apps/chrome-extension/src/shared/step-log-storage.ts` |
| Step log | `LogStepRecord`, `recordStep` | `apps/chrome-extension/src/shared/step-log-storage.ts` |
| Session | `SessionRecord`, `listSessions`, `ACTIVE_SESSION_STORAGE_KEY` | `apps/chrome-extension/src/shared/session-storage.ts` |
| Provider / model service | `ProviderConfig`, `PROVIDERS_STORAGE_KEY` | `apps/chrome-extension/src/shared/storage.ts` |
| Connection test | `testConnection`, `ConnectionTestResult` | `packages/llm-client/src/connection-test.ts` |
| Round limit | `AgentLimits`, `DEFAULT_AGENT_LIMITS` | `packages/agent-core/src/loop.ts` |
| Skip confirmation | `UNSAFE_SKIP_CONFIRM_KEY`, `loadSkipConfirm` | `apps/chrome-extension/src/shared/storage.ts` |
| Checkpoint / interrupted task recovery | `AgentCheckpoint`, `checkpoint-storage.ts` | `apps/chrome-extension/src/shared/checkpoint-storage.ts` |
| Page snapshot | `PageSnapshot`, `snapshot` | `packages/browser-tools/src/types.ts`, `packages/browser-tools/src/tools.ts` |
| Element targeting | `ElementSummary`, `find_elements` | `packages/browser-tools/src/tools.ts` |
| Tab | `TabSummary`, `TabOpenResult` | `packages/browser-tools/src/types.ts` |
| Site permissions | `requestOriginPermissions`, `isRequestableOriginPattern` | `apps/chrome-extension/src/shared/permissions.ts` |
| Local log database | `LOCAL_DB_NAME`, `TASK_STORE` | `apps/chrome-extension/src/shared/local-db.ts` |
