<!-- 由 pnpm map 生成，请勿手工编辑；一致性由 pnpm map:check 保证 -->

# 模块总览

| 单元 | 文件数 | 行数 | 依赖（workspace 内） |
| --- | ---: | ---: | --- |
| apps/chrome-extension | 20 | 5343 | `agent-core`, `browser-tools`, `llm-client` |
| packages/agent-core | 6 | 796 | `llm-client` |
| packages/browser-tools | 3 | 546 | `agent-core` |
| packages/llm-client | 7 | 820 | - |

## 依赖方向（由 import 推导）
- apps/chrome-extension → agent-core, browser-tools, llm-client
- packages/agent-core → llm-client
- packages/browser-tools → agent-core

## 热文件（行数降序 Top 10）

| 路径 | 行数 |
| --- | ---: |
| apps/chrome-extension/src/sidepanel/App.tsx | 1285 |
| apps/chrome-extension/src/content/index.ts | 800 |
| apps/chrome-extension/src/options/App.tsx | 722 |
| apps/chrome-extension/src/background/index.ts | 574 |
| packages/agent-core/src/loop.ts | 458 |
| apps/chrome-extension/src/shared/step-log-storage.ts | 435 |
| packages/llm-client/src/chat.ts | 395 |
| packages/browser-tools/src/tools.ts | 373 |
| apps/chrome-extension/src/options/ProviderForm.tsx | 281 |
| apps/chrome-extension/src/sidepanel/TaskHistory.tsx | 233 |
