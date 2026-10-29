<!-- 由 pnpm map 生成，请勿手工编辑；一致性由 pnpm map:check 保证 -->

# apps/chrome-extension（9 文件 / 约 1233 行）

## src/shared/browser-transport.ts (73 行)
- :11 — `createBrowserTransport`
imports: `apps/chrome-extension/src/shared/index.ts`, `browser-tools`
used by: `apps/chrome-extension/src/sidepanel/App.tsx`

## src/shared/chat-storage.ts (43 行)
- :4 — `StoredChatRole`
- :6 — `StoredChatMessage`
- :13 — `CHAT_MESSAGES_STORAGE_KEY`
- :18 — `loadChatMessages`
- :29 — `clearChatMessages`
imports: -
used by: `apps/chrome-extension/src/shared/session-storage.ts`

## src/shared/checkpoint-storage.ts (71 行)
- :7 — `AgentCheckpointRecord`
- :17 — `loadAgentCheckpoint`
- :33 — `saveAgentCheckpoint`
- :42 — `clearAgentCheckpoint`
- :47 — `addCheckpointListener`
imports: `llm-client`
used by: `apps/chrome-extension/src/sidepanel/App.tsx`

## src/shared/index.ts (67 行)
- :7 — `TaskStatus`
- :17 — `ExtensionMessage`
- :23 — `MESSAGE_TYPES`
- :51 — `BROWSER_ACTION_MESSAGE_TYPES`
imports: `browser-tools`
used by: `apps/chrome-extension/src/background/index.ts`, `apps/chrome-extension/src/content/index.ts`, `apps/chrome-extension/src/shared/browser-transport.ts`

## src/shared/local-db.ts (100 行)
- :5 — `LOCAL_DB_NAME`
- :6 — `LOCAL_DB_VERSION`
- :8 — `TASK_STORE`
- :9 — `STEP_STORE`
- :10 — `SESSION_STORE`
- :11 — `MESSAGE_STORE`
- :13 — `TASK_CREATED_INDEX`
- :14 — `TASK_SESSION_INDEX`
- :15 — `STEP_TASK_INDEX`
- :16 — `SESSION_UPDATED_INDEX`
- :17 — `MESSAGE_SESSION_INDEX`
- :21 — `openLocalDb`
- :62 — `requestResult`
- :69 — `txDone`
- :81 — `deleteByIndex`
imports: -
used by: `apps/chrome-extension/src/shared/session-storage.ts`, `apps/chrome-extension/src/shared/step-log-storage.ts`

## src/shared/permissions.ts (65 行)
- :9 — `isHttpsOriginPattern`
- :18 — `originPatternFromUrl`
- :33 — `isRequestableOriginPattern`
- :45 — `requestOriginPermissions`
- :62 — `requestOriginPermission`
imports: -
used by: `apps/chrome-extension/src/background/index.ts`, `apps/chrome-extension/src/options/ProviderForm.tsx`, `apps/chrome-extension/src/sidepanel/App.tsx`

## src/shared/session-storage.ts (227 行)
- :17 — `ACTIVE_SESSION_STORAGE_KEY`
- :18 — `DEFAULT_SESSION_TITLE`
- :22 — `SessionRole`
- :23 — `SessionMessageStatus`
- :25 — `SessionRecord`
- :33 — `SessionMessageRecord`
- :44 — `createSession`
- :61 — `listSessions`
- :71 — `loadSessionMessages`
- :86 — `appendSessionMessage`
- :121 — `clearSessionMessages`
- :143 — `deleteSession`
- :151 — `getActiveSessionId`
- :157 — `setActiveSessionId`
- :165 — `ensureSessions`
imports: `apps/chrome-extension/src/shared/chat-storage.ts`, `apps/chrome-extension/src/shared/local-db.ts`
used by: `apps/chrome-extension/src/sidepanel/App.tsx`

## src/shared/step-log-storage.ts (435 行)
- :22 — `LOG_RETENTION_DAYS`
- :24 — `LOG_MAX_TASKS`
- :26 — `LOG_MAX_STEPS_PER_TASK`
- :28 — `LOG_MAX_FIELD_CHARS`
- :32 — `LogTaskStatus`
- :39 — `LogTaskRecord`
- :59 — `LogStepRecord`
- :74 — `LogStats`
- :86 — `recordTaskStart`
- :122 — `recordStep`
- :220 — `finishTask`
- :245 — `markInterruptedTasks`
- :275 — `pruneLogs`
- :357 — `getLogStats`
- :372 — `clearAllLogs`
- :381 — `listSessionTasks`
- :396 — `listTaskSteps`
- :408 — `deleteTasksForSession`
imports: `agent-core`, `apps/chrome-extension/src/shared/local-db.ts`
used by: `apps/chrome-extension/src/options/App.tsx`, `apps/chrome-extension/src/sidepanel/App.tsx`, `apps/chrome-extension/src/sidepanel/TaskHistory.tsx`

## src/shared/storage.ts (152 行)
- :8 — `PROVIDERS_STORAGE_KEY`
- :9 — `DEFAULT_PROVIDER_STORAGE_KEY`
- :15 — `UNSAFE_SKIP_CONFIRM_KEY`
- :16 — `AGENT_LIMITS_KEY`
- :18 — `loadProviders`
- :30 — `saveProvider`
- :45 — `deleteProvider`
- :62 — `setDefaultProvider`
- :66 — `loadDefaultProviderId`
- :76 — `loadDefaultProvider`
- :112 — `loadSkipConfirm`
- :118 — `saveSkipConfirm`
- :126 — `loadAgentLimits`
- :140 — `saveAgentLimits`
- :145 — `resetAgentLimits`
imports: `agent-core`, `llm-client`
used by: `apps/chrome-extension/src/options/App.tsx`, `apps/chrome-extension/src/sidepanel/App.tsx`
