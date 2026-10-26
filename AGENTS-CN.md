# AGENTS-CN.md

[English](AGENTS.md)

本文件面向在本仓库中工作的 AI 编码助手。

## 项目是什么

一个纯 Manifest V3 的 Chrome 扩展，充当浏览器 AI 助手。用户在 Side Panel 输入任务 → OpenAI 兼容模型返回 Tool Calls → 扩展读写当前页面 → 工具结果回传模型 → 模型输出最终答复。

没有后端、没有本地服务、不使用 Playwright/CDP、不接 MCP。只依赖 Chrome API 和用户自己配置的模型接口。

## 常用命令

```bash
pnpm install     # 安装 workspace 依赖（需要 pnpm 12；esbuild 必须保留在 allowBuilds 中）
pnpm typecheck   # 对所有 workspace 包执行 tsc --noEmit —— 完成工作前必须通过
pnpm build       # 生产构建，产物位于 apps/chrome-extension/dist
pnpm dev         # Vite + CRXJS 热更新，用于手动调试
```

`packages/*` 的 `main` / `types` 直接指向 `src/index.ts`，Vite 与 `tsc` 都直接消费 TypeScript 源码 —— 没有单独的包构建步骤，也不会出现陈旧的包内 `dist/`。

## 目录说明

- `apps/chrome-extension/` —— 扩展本体。四个入口：`src/sidepanel`、`src/options`、`src/background`、`src/content`。`manifest.config.ts` 使用 `defineManifest()`，入口路径相对 `apps/chrome-extension/` 解析。
- `packages/llm-client/` —— OpenAI 兼容客户端：地址规范化、SSE 解析、Tool Call 累积、取消。
- `packages/agent-core/` —— Agent 循环、工具注册表、参数校验、限额、日志。
- `packages/browser-tools/` —— 浏览器工具实现。
- `apps/chrome-extension/src/shared/` —— 跨上下文类型与消息常量。

应用通过 `workspace:*` 协议依赖这三个包。

## 架构红线（不得违反）

1. **Agent Loop 运行在 Side Panel 中。** 不要把它搬进 Service Worker —— MV3 Worker 空闲即被挂起，长循环会直接死掉。Worker 只负责标签页、权限、注入和消息路由。
2. **Content Script 永远不接触 API Key。** 只有 Side Panel 侧代码发起模型请求。
3. **不持久化 DOM 节点引用。** 每次操作前重新定位元素；失效引用必须明确报错，不能悄悄操作错的节点。
4. **不让模型执行任意 JavaScript。** 不提供「在页面里跑脚本」这类通用工具。
5. **网页内容一律视为不可信输入。** 页面上的文字不能改变用户目标，也不能提升工具权限。
6. **副作用动作必须经用户明确确认** —— 发送消息、提交订单、付款、删除数据。
7. **成功以证据为准，而不是状态码。** 点击没有报错不代表任务推进了，之后要读取 DOM 或状态确认。
8. **工具参数执行前必须校验**，并有硬性轮次上限（默认 10 轮）、重复调用检测和单次调用超时。

## 编码约定

- 全局 TypeScript strict。新代码不使用 `any`；优先使用 `src/shared` 与各 workspace 包中的显式类型。
- 所有面向用户的 UI 文案使用中文；代码、注释、标识符和提交信息使用英文。新增文案要与现有风格一致。
- 业务逻辑中不得硬编码任何供应商地址、模型名或密钥。供应商信息是 `chrome.storage.local` 中的用户数据。
- 供应商配置存储在 `chrome.storage.local`；日志中绝不输出密钥，参数需脱敏。
- 跨上下文通信统一走 `chrome.runtime` 消息，并使用 `src/shared/index.ts` 中的常量。新增消息类型要加在那里，不要临时拼字符串。
- `manifest.config.ts` 权限保持最小化。新增站点访问走 `optional_host_permissions`，在用户手势中申请，而不是安装时申请。
- Windows 下的 PowerShell：创建目录用 `New-Item -ItemType Directory -Force`，避免 `mkdir -p`、花括号展开和 `&&` 串联。

## 完成前的验证要求

在宣称任务完成之前：

```bash
pnpm typecheck
pnpm build
```

然后确认 `apps/chrome-extension/dist/manifest.json` 中的权限与入口仍符合预期。自动化浏览器工具无法打开 `chrome://extensions`，加载未打包扩展属于手动步骤 —— 要如实说明这一点，不要声称已经验证过。
