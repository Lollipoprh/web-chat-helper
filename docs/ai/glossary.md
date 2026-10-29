# 术语对照：中文业务词 ↔ 代码

AI 收到的需求是中文，代码是英文；这张表负责翻译。

| 中文（UI/需求用词） | 代码标识符 | 位置 |
| --- | --- | --- |
| 任务 / 任务历史 | `TaskHistory`、`LogTaskRecord`、`listSessionTasks` | `apps/chrome-extension/src/sidepanel/TaskHistory.tsx`、`apps/chrome-extension/src/shared/step-log-storage.ts` |
| 步骤日志 | `LogStepRecord`、`recordStep` | `apps/chrome-extension/src/shared/step-log-storage.ts` |
| 会话 | `SessionRecord`、`listSessions`、`ACTIVE_SESSION_STORAGE_KEY` | `apps/chrome-extension/src/shared/session-storage.ts` |
| 供应商 / 模型服务 | `ProviderConfig`、`PROVIDERS_STORAGE_KEY` | `apps/chrome-extension/src/shared/storage.ts` |
| 连接测试 | `testConnection`、`ConnectionTestResult` | `packages/llm-client/src/connection-test.ts` |
| 轮次上限 | `AgentLimits`、`DEFAULT_AGENT_LIMITS` | `packages/agent-core/src/loop.ts` |
| 跳过确认 | `UNSAFE_SKIP_CONFIRM_KEY`、`loadSkipConfirm` | `apps/chrome-extension/src/shared/storage.ts` |
| 检查点 / 中断恢复 | `AgentCheckpoint`、`checkpoint-storage.ts` | `apps/chrome-extension/src/shared/checkpoint-storage.ts` |
| 页面快照 | `PageSnapshot`、`snapshot` | `packages/browser-tools/src/types.ts`、`packages/browser-tools/src/tools.ts` |
| 元素定位 | `ElementSummary`、`find_elements` | `packages/browser-tools/src/tools.ts` |
| 标签页 | `TabSummary`、`TabOpenResult` | `packages/browser-tools/src/types.ts` |
| 站点权限 | `requestOriginPermissions`、`isRequestableOriginPattern` | `apps/chrome-extension/src/shared/permissions.ts` |
| 本地日志库 | `LOCAL_DB_NAME`、`TASK_STORE` | `apps/chrome-extension/src/shared/local-db.ts` |
