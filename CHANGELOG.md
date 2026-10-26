# Changelog

本文件记录 Web Chat Helper 的所有重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.1.0] - 2026-10-26

首个公开版本。核心链路已完整可用：用户描述任务 → 模型返回 Tool Call → 扩展读取并操作当前页面 →
结果回传模型 → 模型继续决策或给出最终答复。

### Added

- **侧边栏聊天界面（Side Panel）** —— 任务输入、流式输出、停止按钮、历史持久化；
  Agent Loop 运行在 Side Panel 而非 Service Worker，避免 MV3 空闲挂起中断长任务。
- **供应商设置页** —— 新增 / 编辑 / 删除 / 切换供应商（Base URL、API Key、Model、
  流式与 Tool Calls 开关），支持测试连接。
- **模型客户端（`packages/llm-client`）** —— OpenAI 兼容 Chat Completions：地址规范化、
  非流式与 SSE 流式解析、多轮上下文、Tool Call 累积、超时与取消、错误分类。
- **Agent 循环（`packages/agent-core`）** —— Tool Call 解析、参数校验、工具注册表、
  轮次上限（默认 10 轮）、重复调用检测、单次调用超时、执行日志。
- **浏览器工具（`packages/browser-tools`）** —— 8 个工具：`get_active_tab`、
  `get_page_snapshot`、`find_elements`、`click_element`、`fill_input`、`scroll_page`、
  `wait_for_element`、`verify_action`。
- **按站点授权** —— 安装时不授予任何主机权限，由用户主动操作触发按站点申请。
- **副作用动作确认** —— 发送消息、提交订单、支付、删除等动作需用户在侧边栏显式确认。
- **检查点与恢复** —— 每轮持久化检查点，侧边栏关闭或扩展重启后不从头重跑，
  中断的任务明确标记为「已中断」，且不自动重放副作用步骤。
- **取消贯通** —— 取消信号同时作用于模型请求、在飞工具调用与等待确认的 Promise。

### Security

- API Key 只存在于 Side Panel，Service Worker 与 Content Script 均不接触。
- 主机权限使用 `optional_host_permissions`，只在用户手势后按站点申请，不在安装时获取。
- Content Script 的 `matches` 使用永不匹配的占位域名，声明仅用于让构建产出注入文件；
  真正的注入发生在用户授权当前站点之后。
- Content Script 通过 `web_accessible_resources` 暴露的仅是扩展自身构建产物，不含密钥或配置。
- 不持久化 DOM 节点引用，每次操作前重新定位目标；页面跳转或 SPA 路由变化时安全失败。
- 模型不具备执行任意 JavaScript 的能力，不存在通用的「在页面中执行脚本」工具。
- 页面内容一律视为不可信输入，不能改写用户目标或提升工具权限。

### 说明

- 首个版本，供应商配置结构、跨上下文消息协议与工具参数仍可能调整，升级前请留意后续变更说明。

[Unreleased]: https://github.com/Lollipoprh/web-chat-helper/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Lollipoprh/web-chat-helper/releases/tag/v0.1.0
