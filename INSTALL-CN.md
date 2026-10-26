# Web Chat Helper —— 安装与验证指南

## 一、前置条件

| 条件 | 说明 |
|---|---|
| Chrome 116+ | 依赖 Side Panel API（Chrome 114 引入，116 起稳定） |
| pnpm 12 | 构建工具，首次使用需 `npm install -g pnpm@12` |
| 模型供应商 | 支持任何 OpenAI Chat Completions 兼容服务：官方、DeepSeek、豆包、Moonshot、本地 Ollama 等 |
| 供应商 API Key | 在供应商控制台申请；扩展**只在侧边栏**发送请求，不经过 Service Worker 或 Content Script |

> 本扩展**不依赖** Node.js 运行时、CDP、Playwright、MCP 或任何本地服务。打包后直接加载即可使用。

## 二、从源码安装（load-unpacked）

```bash
# 1. 克隆仓库
git clone <repo-url> web-chat-helper
cd web-chat-helper

# 2. 安装依赖（首次）
pnpm install

# 3. 生产构建
pnpm build
# 输出：apps/chrome-extension/dist/
```

然后在 Chrome 中：

1. 打开 `chrome://extensions`
2. 右上角打开「开发者模式」
3. 点击「加载已解压的扩展程序」，选择 `apps/chrome-extension/dist/` 目录
4. 工具栏出现 🛠 图标；右键图标→「选项」或直接打开侧边栏进行配置

> **注意**：不要用「打包扩展程序」生成 `.crx`——该扩展使用 Service Worker 模块模式 + CRXJS 动态 chunk，load-unpacked 是最稳定的方式。

## 三、配置供应商

1. 打开侧边栏（点击工具栏图标）
2. 点击右上角「设置」按钮
3. 填写三项：
   - **供应商名称**：任意，用于展示
   - **Base URL**：兼容 OpenAI Chat Completions 的地址，例如
     - 官方：`https://api.openai.com/v1`
     - DeepSeek：`https://api.deepseek.com/v1`
     - 豆包（火山）：`https://ark.cn-beijing.volces.com/api/v3`
     - 本地 Ollama：`http://localhost:11434/v1`
   - **API Key**：供应商提供的密钥
   - **模型名称**：如 `gpt-4o-mini`、`deepseek-chat`、`doubao-pro-32k` 等
4. 点击「测试连接」——成功会显示绿色提示；失败会带错误原因（网络错误 / 401 无效 Key / 402 额度不足等）

**连接测试返回 402 的含义**：供应商账户额度已耗尽，需充值或更换 Key。错误提示会直接在页面上用中文说明。

## 四、测试矩阵

逐项执行，通过打 ✅，失败写简短备注。**先在普通 HTTPS 网页上跑**（如新闻网站、产品介绍页），避开需要登录的页面。

### 核心场景

| # | 场景 | 操作步骤 | 通过标准 | 结果 | 备注 |
|---|---|---|---|---|---|
| 1 | 安装与设置 | load-unpacked → 设置供应商 → 测试连接 | 扩展可加载；配置保存/编辑/切换正常；连接测试有明确反馈 | ☐ 通过 ☐ 失败 | |
| 2 | 普通聊天（非浏览器工具） | 发送纯文本问题，如"你好，你能做什么？" | 模型正常回复，流式输出有打字效果；取消按钮及时生效 | ☐ 通过 ☐ 失败 | |
| 3 | 页面读取 | 打开任意 HTTPS 网页→发送"总结当前页面" | 模型正确调用 `get_page_snapshot`；结果包含标题、URL、可见文本（不含密码/敏感字段） | ☐ 通过 ☐ 失败 | |
| 4 | 页面操作（只读） | 打开带搜索框的页面→发送"搜索某个关键词" | 模型调用 `find_elements` / `click_element`（搜索框）→ 确认弹窗出现 | ☐ 通过 ☐ 失败 | |
| 5 | 操作确认机制 | 让模型执行 `click_element` 或 `fill_input` | 侧边栏出现橙色「等待确认」弹窗，显示脱敏参数；点「拒绝」后模型收到 needs_confirmation 并调整策略；点「确认」后动作执行 | ☐ 通过 ☐ 失败 | |
| 6 | 页面验证 | 点击搜索按钮→模型必须用 `verify_action` 检查结果 | verify 返回成功或明确的失败信息；模型不会假定动作成功 | ☐ 通过 ☐ 失败 | |
| 7 | 页面跳转 / 旧引用失效 | 在上一页点链接→到新页面→观察 | 旧 ref 在 Content Script 里返回 `stale_element`，不会误操作新页面元素 | ☐ 通过 ☐ 失败 | |
| 8 | 限制页面拦截 | 在 `chrome://`、`chrome-extension://`、`edge://` 页面发送任务 | 工具调用返回 `unsupported_page`，不注入 Content Script | ☐ 通过 ☐ 失败 | |
| 9 | 取消 / 停止 | 任务运行中点「停止」 | 模型请求被 abort；在飞工具被取消；等待中的确认弹窗立即关闭；最终状态显示「已取消」 | ☐ 通过 ☐ 失败 | |
| 10 | 生命周期（中断恢复） | 让任务跑起来→关闭 Side Panel→重新打开 | 顶部显示橙色提示「上次任务已中断（第 N 轮）」；**不自动重放**副作用步骤；点「清除」后提示消失 | ☐ 通过 ☐ 失败 | |

### 失败路径专项

| # | 场景 | 操作 | 期望 | 结果 |
|---|---|---|---|---|
| F1 | 无效 API Key | 故意填错 Key → 测试连接 | 401 → 明确错误提示 | ☐ |
| F2 | 错误 Base URL | 填 `https://example.com` | 连接测试失败，提示 URL 不兼容 | ☐ |
| F3 | 超时 | 关掉网络 → 发送任务 | 请求超时后返回 timeout 错误 | ☐ |
| F4 | 权限拒绝 | 弹出站点授权窗口时点「拒绝」 | 工具返回 not_authorized；侧边栏红色 banner + 一键授权按钮 | ☐ |
| F5 | 元素缺失 | 让模型查找一个不存在的元素 | element_not_found → 模型收到后应换策略 | ☐ |
| F6 | 重复调用拦截 | 让模型对同一元素点两次相同的 click_element | 第二次 duplicate_call 被跳过 | ☐ |
| F7 | 402 额度不足 | 在账户耗尽的 Key 上测试 | 中文提示「账户额度不足，请检查供应商账户余额或配额，或更换 API Key」 | ☐ |

## 五、第一轮人工测试任务（推荐顺序）

按这个顺序跑一遍就能覆盖大部分路径：

1. ☐ 设置供应商并进行普通文本对话
2. ☐ 测试流式输出，中途停止一次
3. ☐ 让 AI 总结当前网页（页面读取）
4. ☐ 让 AI 找到搜索框 → 填入关键词 → **点击提交按钮**（应弹确认框）→ 确认执行 → 读取结果
5. ☐ 让 AI 搜索另一个关键词 → **拒绝确认** → 观察模型是否能调整策略
6. ☐ 测试错误 Key → 看是否有清晰提示

## 六、诊断与日志

### 日志位置
侧边栏运行 Agent Loop 时，工具调用的结构化日志会通过 `console.debug` 输出到 **侧边栏 DevTools Console**。打开方式：在扩展工具栏图标上右键 → 「检查视图」→「侧边栏」。

### 日志脱敏策略
日志中的工具参数经过以下处理：
- **敏感字段替换**：包含 `api_key`、`token`、`secret`、`password`、`authorization` 等关键词的键，值会被替换为 `***`
- **长文本截断**：单个字符串超过 120 字符截断，数组超过 20 项截断，对象超过 4 层嵌套截断
- **整体预览**：最终预览字符串超过 300 字符再整体截断

示例输出：
```
[agent] { taskId: 'xxx', round: 1, toolName: 'find_elements', argsRedacted: '{"query":"submit"}', ok: true, durationMs: 85 }
```

### 失败排查 Checklist
遇到 P0 问题时，按以下顺序收集证据：

1. 侧边栏 Console 里复制完整的 `[agent]` 日志（含 error）
2. 侧边栏 Network 面板 → 找到发往模型供应商的那条 `chat/completions` 请求 → 记录状态码和 Response body 前 500 字符（**不要**贴出完整 API Key，它在 Request Headers 里）
3. 记录当时的工具名、错误码（`not_authorized` / `element_not_found` / `stale_element` / `unsupported_page` / `needs_confirmation` 等）和页面 URL

## 七、常见问题

### Q：为什么发送任务时 Chrome 弹出权限窗口？
扩展使用**按需授权**模式：安装时不申请任何站点权限，第一次对某站点执行任务时，同时申请模型供应商 URL + 当前页面 URL 的 `host_permissions`。授权后才会向该页面注入 Content Script。

### Q：为什么某个页面不能操作？
三种原因：
1. **受保护页面**：`chrome://`、`chrome-extension://`、`edge://`、`view-source:` 这些协议不允许扩展注入脚本，会返回 `unsupported_page`
2. **未授权**：红色 banner 提示"当前页面尚未授权"→ 点「授权当前站点」或重新发送（会触发弹窗）
3. **站点拒绝**：极少数网站（如 Google 搜索、Google Docs）的 CSP 或 Content Security Policy 阻断了扩展脚本，需换普通网页测试

### Q：Content Script 为什么不自动注入？
manifest 里用了 `web-chat-helper.invalid/*` 这个**永不匹配**的占位域名。Service Worker 会在用户授权站点后，通过 `chrome.scripting.executeScript` 手动注入。这样安装时不会自动向任何站点暴露脚本。

### Q：API Key 安全吗？
- **只在侧边栏发送**：Content Script 和 Service Worker 都不持有 Key
- **不硬编码**：Key 存在 `chrome.storage.local`，随扩展卸载自动清除
- **日志脱敏**：所有工具参数和请求头都会被脱敏后再写入 Console

### Q：V1 范围？
V1 冻结在 8 个浏览器工具 + Agent Loop + 确认 + 取消 + 检查点。后续版本（V2+）考虑：跨站长任务、视觉理解、更多副作用动作、多标签页联动、本地 Ollama 流式工具等。
