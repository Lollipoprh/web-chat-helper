# 业务需求 → 代码位置

按业务词查表。只写路径与符号，不写行号；行号由 `codemap/` 自动生成。

## 模型调用 / 流式响应

- 入口：`packages/llm-client/src/chat.ts`（`streamChatCompletion`、`createChatCompletion`）
- 流解析：`packages/llm-client/src/sse.ts`（`consumeSseStream`）
- 端点归一化：`packages/llm-client/src/endpoint.ts`（`parseEndpoint`）
- 错误码映射：`packages/llm-client/src/errors.ts`（`LLMError`、`httpStatusToLLMError`）

## 连接测试（设置页“测试连接”）

- 逻辑：`packages/llm-client/src/connection-test.ts`（`testConnection`）
- UI：`apps/chrome-extension/src/options/App.tsx`、`apps/chrome-extension/src/options/ProviderForm.tsx`

## Agent 循环 / 轮次上限 / 超时

- 主循环：`packages/agent-core/src/loop.ts`（`runAgentLoop`、`DEFAULT_AGENT_LIMITS`）
- 参数校验：`packages/agent-core/src/validation.ts`（`validateToolArguments`）
- 工具注册：`packages/agent-core/src/registry.ts`（`ToolRegistry`）
- 上限读写：`apps/chrome-extension/src/shared/storage.ts`（`loadAgentLimits`、`saveAgentLimits`）

## 浏览器工具（点击/填表/滚动/快照/标签页）

- 工具定义：`packages/browser-tools/src/tools.ts`（`createBrowserTools`）
- 返回类型：`packages/browser-tools/src/types.ts`
- 页面内执行：`apps/chrome-extension/src/content/index.ts`
- 消息通道：`apps/chrome-extension/src/shared/browser-transport.ts`

## 侧边栏 UI / 聊天交互

- 主界面：`apps/chrome-extension/src/sidepanel/App.tsx`
- 任务历史：`apps/chrome-extension/src/sidepanel/TaskHistory.tsx`

## 会话与任务历史（持久化）

- 会话：`apps/chrome-extension/src/shared/session-storage.ts`（`SessionRecord`、`listSessions`）
- 步骤日志：`apps/chrome-extension/src/shared/step-log-storage.ts`（`recordStep`、`listSessionTasks`、`pruneLogs`）
- 聊天记录：`apps/chrome-extension/src/shared/chat-storage.ts`
- IndexedDB 底座：`apps/chrome-extension/src/shared/local-db.ts`

## 供应商配置（模型/Key/URL）

- 读写：`apps/chrome-extension/src/shared/storage.ts`（`ProviderConfig`、`loadProviders`、`saveProvider`）
- UI：`apps/chrome-extension/src/options/ProviderForm.tsx`、`apps/chrome-extension/src/options/App.tsx`

## 权限 / 消息路由 / 注入

- 消息类型常量：`apps/chrome-extension/src/shared/index.ts`（`MESSAGE_TYPES`、`BROWSER_ACTION_MESSAGE_TYPES`）
- Service Worker：`apps/chrome-extension/src/background/index.ts`
- 站点权限：`apps/chrome-extension/src/shared/permissions.ts`
- manifest：`apps/chrome-extension/manifest.config.ts`

## 确认 / 检查点 / 恢复

- 类型：`packages/agent-core/src/types.ts`（`ConfirmationRequest`、`AgentCheckpoint`）
- 落盘：`apps/chrome-extension/src/shared/checkpoint-storage.ts`
