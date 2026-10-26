# Web Chat Helper

一个可以读取并操作当前网页的 Chrome 扩展 AI 助手。它对接任意 **OpenAI 兼容** 的 Chat Completions API —— 供应商、模型和密钥都由你自己配置。

纯 Manifest V3 Chrome 扩展：没有后端、没有本地服务、不依赖 Playwright 或 CDP。

## 第一版交付范围

- **Side Panel 聊天界面** —— 任务输入、流式输出、停止按钮、历史持久化。
- **供应商设置页** —— 新增 / 编辑 / 删除 / 选择供应商（Base URL、API Key、Model、流式与 Tool Calls 开关），并支持测试连接。
- **模型客户端** —— OpenAI 兼容 Chat Completions，支持非流式与 SSE 流式、多轮上下文、超时与取消。
- **Agent Loop** —— Tool Call 解析、参数校验、轮次上限（默认 10 轮）、重复调用检测、执行日志。
- **浏览器工具** —— 读取当前标签页、页面快照、元素查找、点击、输入、滚动、等待与验证。
- **安全机制** —— 按站点授权、副作用动作需用户确认、取消贯穿全程、未完成任务标记为「已中断」。

第一版不包含：Playwright/CDP 自动化、独立后端、MCP、多 Agent 编排、长期记忆与完整视觉自动化。

## 环境要求

- Node.js >= 18（开发使用 v24）
- pnpm 12
- Chrome 114+（Side Panel API）

## 安装

```bash
pnpm install
```

如果 `pnpm install` 报 `ERR_PNPM_IGNORED_BUILDS`，请确认 `pnpm-workspace.yaml` 中的 `allowBuilds` 仍然允许 `esbuild` —— 构建链需要它的平台二进制。

## 开发

```bash
pnpm dev        # Vite 开发服务，CRXJS 热更新
pnpm typecheck  # 对所有 workspace 包执行 tsc --noEmit
pnpm build      # 生产构建，产物在 apps/chrome-extension/dist
```

加载扩展到浏览器：

1. 打开 `chrome://extensions`
2. 开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**，选择 `apps/chrome-extension/dist`

点击工具栏图标会在当前标签页打开 Side Panel；打开扩展的设置页即可配置供应商。

## 目录结构

```
web-chat-helper/
├── apps/chrome-extension/        # Manifest V3 扩展（Vite + React + CRXJS）
│   ├── manifest.config.ts        # defineManifest() —— 权限、入口、Side Panel
│   ├── vite.config.ts
│   └── src/
│       ├── sidepanel/            # 侧边栏 UI —— Agent Loop 运行在这里
│       ├── options/              # 供应商设置页
│       ├── background/           # Service Worker —— 标签页、权限、消息路由
│       ├── content/              # Content Script —— DOM 读取与操作
│       └── shared/               # 跨上下文类型与消息常量
└── packages/
    ├── llm-client/               # OpenAI 兼容客户端（流式、Tool Calls）
    ├── agent-core/               # Agent 循环、工具注册表、限额、日志
    └── browser-tools/            # 浏览器自动化工具
```

目前 `packages/*` 以 TypeScript 源码作为入口，Vite 直接打包。`llm-client` 已实现供应商类型、地址规范化与连接测试，其余两个仍是带类型定义的模块空壳。

## 运行时架构

```
用户 → Side Panel（Agent Loop）
          ├── llm-client   → 用户配置的 OpenAI 兼容接口
          ├── agent-core   → 校验、限额、日志、取消
          └── browser-tools → Service Worker → Content Script → DOM
```

三条规则约束整个设计：

1. **Agent Loop 跑在 Side Panel，而不是 Service Worker** —— MV3 的 Service Worker 空闲时会被挂起，长循环无法存活。
2. **Content Script 永远看不到 API Key** —— 只有 Side Panel 与模型通信。
3. **不持久化 DOM 节点引用** —— 每次操作前重新定位目标，页面跳转或 SPA 路由变化时安全失败，而不是操作失效节点。

## 文档

- [第一版实现流程.md](第一版实现流程.md) —— V1 实施阶段与验收标准
- [完整方案.md](完整方案.md) —— 完整架构与后续路线

## 当前状态

阶段 1–6 已实现。阶段 6 新增：(1) 副作用工具（`click_element`、`fill_input`）执行前的确认弹窗，工具卡片显示「等待确认」状态；(2) 「停止」按钮的取消信号贯通到等待确认的 Promise、模型请求和在飞的工具；(3) 每轮结束后持久化检查点到独立的 `agentCheckpoint` 存储键（含完整 `messages[]`，包括 tool 角色消息）；(4) Side Panel 下次打开时若读到未完成检查点则显示橙色提示，**绝不自动重放**副作用步骤。阶段 7（生产打包与真实 Chrome 测试矩阵）尚未开始；阶段 2–6 的手动加载验证仍待进行。

## 许可证

Apache License 2.0 —— 见 [LICENSE.txt](LICENSE.txt)。
