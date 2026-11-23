# Changelog

This file records all notable changes to Web Chat Helper.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and version numbers follow [Semantic Versioning](https://semver.org/).

本文件记录 Web Chat Helper 的所有重要变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-11-23

首个稳定版本：界面全面重建在设计令牌之上，运行过程本身成为可读、可回溯、可重试的一等公民。
First stable release: the UI is rebuilt on design tokens, and a run itself is now first-class —
readable, traceable and retryable.

From 1.0.0 on, stored data, cross-context messages and tool contracts follow the 1.x compatibility
policy in [docs/compatibility.md](docs/compatibility.md).
自 1.0.0 起，存储结构、跨上下文消息与工具契约遵循
[docs/compatibility.md](docs/compatibility.md) 中的 1.x 兼容性策略。

### Added / 新增

- **Design system and dark mode** — semantic CSS-variable tokens with `light-dark()`, a
  light / dark / follow-system preference in settings, and 22 shared primitives (Button,
  IconButton, Dialog, Tooltip, Menu, Segmented, Chip, Markdown, …).
  **设计令牌与深色模式** —— 语义化 CSS 变量 + `light-dark()`，设置页提供浅色/深色/跟随系统三选，
  并沉淀 22 个共享原语。
- **Header HUD and context strip** — brand mark, session title (capped width) with rename /
  new / delete beside it, run status pill, settings; a context strip shows the attached tab,
  bound files and a compact usage meter.
  **头部 HUD 与上下文条** —— 品牌标、定宽标题与重命名/新建/删除按钮、运行状态、设置；
  上下文条展示当前标签页、绑定文件与紧凑用量条。
- **Run blocks** — every assistant reply owns a block showing status · steps · duration, and
  expanding it reveals the step timeline, live while streaming and from the task log afterwards.
  Message actions add copy and edit-and-resend.
  **运行块** —— 每条回复一个块，折叠显示状态/步数/耗时，展开是步骤时间线（流式实时、结束后读日志）；
  消息动作支持复制与「编辑后重发」。
- **Markdown rendering** — assistant replies render headings, lists, tables, quotes and fenced
  code with per-block copy buttons; parsing is an in-repo parser, no `innerHTML`.
  **Markdown 渲染** —— 标题/列表/表格/引用/代码块，代码块可复制；解析器自研，不碰 `innerHTML`。
- **Session management** — search and per-row delete in the session menu, rename from the header.
  **会话管理** —— 菜单内搜索与逐条删除，头部重命名。
- **Page-aware empty state** — three tasks built from the current tab (translate into the UI
  language / summarise / turn into a table) that send immediately.
  **场景化空状态** —— 依据当前页面给出翻译/总结/整理表格三条建议，点击直接发送。
- **Task records with locate** — a session-scoped run index that can jump back to the run in the
  conversation and highlight it.
  **任务记录与定位** —— 会话级运行索引，可跳回对话并高亮那次运行。
- **Regenerate and resume** — the newest reply can be regenerated in place (old answer removed,
  no duplicate user message), and an interrupted run can be resumed from the checkpoint banner.
  **重新生成与续跑** —— 最新回复可原地重跑（删旧答、不重复提问），中断任务可从断点提示继续。
- **File preview** — clicking a bound file chip shows the first 200 lines / 12k characters.
  **文件预览** —— 点击绑定文件胶囊即可预览前 200 行。
- **Session artifacts** — files written by `download_file` are listed with metadata only
  (name, size, download id, time); content stays in the Downloads folder.
  **会话产物** —— `download_file` 产出的文件按元数据登记（文件名、大小、下载 id、时间），
  内容仍只存在于下载目录。
- **Command palette** — `⌘K` / `Ctrl+K` searches sessions, `/` commands, providers and panel actions.
  **命令面板** —— `⌘K` / `Ctrl+K` 搜索会话、`/` 指令、模型与面板动作。
- **Wide layout** — from 600px the task records become a permanent right column instead of a
  slide-over.
  **宽栏两列** —— 内容区 ≥600px 时任务记录固定为右列，不再滑出。

### Changed / 变更

- Hover hints all use the shared `Tooltip`; no native `title` remains on interactive elements,
  and a tooltip flips to the other side rather than covering its trigger.
  **悬浮提示统一** —— 交互元素不再使用原生 `title`；空间不足时提示换边，不遮挡触发元素。
- Rename / new / delete moved out of the session menu into the header; clearing (`/clear`) and
  the task-list entry were removed from the menu, leaving the right-edge pull tab.
  **头部动作外置** —— 重命名/新建/删除移到标题右侧；菜单移除清空（保留 `/clear`）与任务记录入口。
- The extension version is now read from `package.json` by `manifest.config.ts` instead of being
  duplicated there.
  **版本号单一来源** —— `manifest.config.ts` 直接读 `package.json`，不再两处手写。

### Fixed / 修复

- The off-screen history pane could scroll the whole chat sideways by taking focus; panes are now
  `overflow: clip` plus `inert` when hidden.
  **隐藏面板不再把对话顶歪** —— 改用 `overflow: clip` 与 `inert`。
- Dropdowns no longer close when scrolling their own list.
  **下拉菜单不再因自身滚动而关闭。**
- Dialogs no longer clip the focus ring of their first control at the top edge.
  **对话框不再裁掉首个控件的焦点环上边。**
- `download_file` reports the real byte length instead of the character count.
  **`download_file` 改报真实字节数**（原为字符数）。

## [0.1.6] - 2026-11-22

### Added / 新增

- **Automatic session memory** — every request now carries a `<session-memory>` block built from
  the previous abnormal run's ledger and the session digest, so a stopped or round-limited task
  can be continued by simply sending the next message.
  **自动会话记忆** —— 每次请求自动携带由上一段非正常结束运行账本与会话摘要组成的
  `<session-memory>` 块，中断或跑满轮次后直接发下一句即可续跑。
- **Built-in `/` commands** — `/compact`, `/memory`, `/help`, `/clear`, with an arrow-key
  completion menu in the composer. Notice cards are persisted with the session but never sent
  to the model.
  **`/` 内置指令** —— 支持 `/compact`、`/memory`、`/help`、`/clear`，输入框提供方向键补全；
  指令回执随会话持久化，但不会进入模型上下文。

### Changed / 变更

- **Context meter reflects the current context** — the progress bar now tracks the latest
  request's prompt tokens instead of cumulative session usage, and `/compact` lowers it
  immediately.
  **用量条展示当前上下文** —— 进度条改为跟随最近一次请求的 prompt tokens，
  `/compact` 后立即回落。
- **Default context window is 1M** — new providers start with a 1,000,000-token window.
  **默认上下文窗口 1M** —— 新建供应商默认使用 1,000,000 tokens。
- **`round_limit` is a distinct task status** — the loop synthesizes replies for unexecuted
  tool calls and exposes them as pending calls.
  **`round_limit` 独立状态** —— 达到轮次上限时由 loop 为未执行调用补齐应答并暴露给宿主。

## [0.1.5] - 2026-11-21

### Added / 新增

- **Session usage meter** — a compact strip below the session toolbar shows cumulative context
  usage: the track is light blue, the input segment light green, the output segment yellow, and
  the whole bar turns orange-red once the configured window is full. Token numbers come from
  OpenAI-compatible `usage` (streaming asks for `stream_options.include_usage`), accumulate in
  `SessionRecord`, and appear in a hover tooltip instead of inline text.
  **会话用量条** —— 历史会话栏下方新增紧凑用量条：轨道浅蓝、输入段浅绿、输出段黄色，
  窗口占满后整条变为橙红。用量来自 OpenAI 兼容的 `usage` 字段
  （流式请求显式索要 `stream_options.include_usage`），按会话累加持久化，
  token 数值仅在鼠标悬浮时通过通用 Tooltip 展示。
- **Reusable Tooltip component** — `apps/chrome-extension/src/ui/Tooltip.tsx` renders a glassy
  floating panel on hover/focus and is reused by the usage meter.
  **通用悬浮框组件** —— 新增 `Tooltip`，悬浮或聚焦时展示毛玻璃浮层，供用量条复用。
- **Per-session local files** — the "Add file" button now sits left of Send and opens the system
  file picker directly. Bound files are stored per session (`${sessionId}::${name}`), listed above
  the composer only when present, and file tools are limited to the current session.
  **文件按会话隔离** —— 「添加文件」按钮移到发送键左侧并直接弹出系统文件选择器；绑定文件按会话存储
  （`${sessionId}::${name}`），仅在输入框上方展示当前会话的文件，文件工具也只能读写本会话绑定的文件。
- **Drag-and-drop file binding** — dropping files onto the chat panel or composer binds them to the
  current session via `DataTransferItem.getAsFileSystemHandle()`, with a drop hint and highlight.
  **拖拽绑定文件** —— 将文件拖到会话框或输入框即可绑定到当前会话，拖拽时有高亮和提示。
- **Provider context window setting** — providers gain an editable `contextWindow` field
  (default 128000) used by the usage meter.
  **供应商上下文窗口设置** —— 供应商表单新增可编辑的 `contextWindow` 字段（默认 128000），
  供用量进度使用。

### Changed / 变更

- **Compact Side Panel header** — the provider/model subtitle is removed, the settings button is
  now a gear icon, and header padding is reduced.
  **侧边栏标题栏收紧** —— 去掉供应商/模型副标题，设置按钮改为齿轮图标，并减小标题栏高度。
- **File bindings are now per session** — the v5 IndexedDB upgrade recreates the file-handle store
  and intentionally drops legacy global bindings; stale handles now tell the user to unbind and
  re-add the file.
  **文件绑定改为按会话维护** —— IndexedDB 升级到 v5 时重建文件句柄存储，旧全局绑定不做迁移；
  句柄失效时提示用户解绑后重新添加。

## [0.1.4] - 2026-11-18

### Added / 新增

- **Context-menu page translation** — a "翻译当前页面(WebChatHelper)" right-click entry opens
  the Side Panel and immediately runs a packaged in-place translation task in a new session.
  The target language is the current browser UI language (`chrome.i18n.getUILanguage()`), and
  every run is saved to session history.
  **右键整页翻译** —— 网页右键菜单新增「翻译当前页面(WebChatHelper)」，点击后自动打开
  Side Panel 并在新会话中执行封装好的就地翻译任务；目标语言取当前浏览器界面语言
  （`chrome.i18n.getUILanguage()`），每次执行都会保存到会话记录。
- **Declarative DOM edit tools** — `set_element_text`, `set_element_attribute`,
  `set_element_style`, `remove_element` and `insert_element` in
  `packages/browser-tools/src/tools.ts`, executed by the content script. Attribute and
  style names go through strict allowlists; inserted HTML is sanitised (no scripts,
  iframes, forms, media, `on*` handlers or `javascript:` URLs) and every mutation is read
  back. No arbitrary script execution is exposed.
  **声明式 DOM 修改工具** —— `set_element_text`、`set_element_attribute`、
  `set_element_style`、`remove_element`、`insert_element`，由 content script 执行。
  属性与样式走严格白名单；插入的 HTML 会先消毒（剔除 script、iframe、表单、媒体、
  `on*` 事件与 `javascript:` URL），每次修改都回读确认；不暴露任意脚本执行能力。
- **API key encryption at rest** — provider keys are stored as
  `enc:v1:` AES-GCM ciphertext derived from a static master key plus a per-instance salt
  (`apps/chrome-extension/src/shared/encryption.ts`). Legacy plaintext keys still load and
  are encrypted on the next save. This is obfuscation against casual inspection of
  `chrome.storage.local`, not a key vault.
  **API Key 落盘加密** —— provider key 以 `enc:v1:` 前缀的 AES-GCM 密文存储，
  密钥由静态主密钥加实例级 salt 派生（`apps/chrome-extension/src/shared/encryption.ts`）。
  老的明文 key 仍可读取，并在下次保存时自动加密。该方案用于抵御对
  `chrome.storage.local` 的随手查看，并非密钥保险库。

### Changed / 变更

- **Page translation defaults to in-place editing** — the system prompt now tells the model to
  translate visible page text with `find_elements` + `set_element_text` when the user does not
  ask for a chat reply, editing only text-only leaf elements. A chat answer is used only when the
  user explicitly asks for one, or when the page is protected, unauthorized or keeps reverting
  the edits.
  **整页翻译默认就地改页面** —— 当用户没有要求"在对话框里回复"时，系统提示词让模型用
  `find_elements` + `set_element_text` 直接替换页面可见文本，且只改写纯文本叶子节点；
  仅在用户明确要求对话回复、页面受保护/未授权、或页面持续回滚修改时才改为在聊天中给出译文。

## [0.1.3] - 2026-11-10

### Added / 新增

- **Input injection module** — `apps/chrome-extension/src/content/input-injection.ts` with
  `commitText`, `planFillStrategies`, `evaluateFill`, `describeFillFailure`; pure-logic helpers
  (`normalizeForCompare`, `looseMatch`, `codePointLength`) unit-testable in node without jsdom.
  **输入注入模块** —— `apps/chrome-extension/src/content/input-injection.ts`，含 `commitText`、
  `planFillStrategies`、`evaluateFill`、`describeFillFailure`；纯逻辑函数（`normalizeForCompare`、
  `looseMatch`、`codePointLength`）可在无 jsdom 的 node 环境直接单测。
- **Fill strategy enum** — `FillStrategy` (`insert-text-command`, `native-value-setter`,
  `instance-value-setter`, `select-value`) exported from `packages/browser-tools/src/types.ts`,
  surfaced in `FillResult`.
  **写入策略枚举** —— `FillStrategy`（`insert-text-command`、`native-value-setter`、
  `instance-value-setter`、`select-value`）从 `packages/browser-tools/src/types.ts`
  导出并体现在 `FillResult` 中。
- **Manual verification fixture** — `docs/manual-tests/input-injection.html` covering
  nine scenarios: native required input, custom value accessor, `beforeinput` rejection,
  write reversion, contenteditable editor, masked input, blur-only validation,
  auto-save `change` counting, and field clearing.
  **手工验收夹具** —— `docs/manual-tests/input-injection.html` 覆盖九个场景：原生必填、
  自定义 accessor、`beforeinput` 拒绝、写入被回滚、contenteditable 编辑器、掩码输入、
  失焦校验、自动保存 `change` 计数、清空字段。

### Changed / 变更

- **`fill_input` now verifies every write** — text is committed through the browser's own
  editing command (`execCommand('insertText')`) first and falls back to value setters only when
  the page rejects or reverts it; afterwards the field is read back, HTML5 constraint validity is
  checked, and a rejected / reverted / truncated write returns `execution_failed` with an
  actionable reason instead of reporting success. `contenteditable` is no longer rebuilt with
  `textContent`, so backspace and paste keep working after injection. `valueLength` in the tool
  result is now the read-back length (code-point count), no longer the input parameter length.
  **`fill_input` 写入后回读校验** —— 优先使用浏览器原生编辑命令写入，页面拒绝或回滚时才降级到
  value setter；写入后回读字段并检查 HTML5 约束校验，被拒绝 / 回滚 / 截断时返回
  `execution_failed` 并说明原因，不再谎报成功。`contenteditable` 不再用 `textContent` 重建，
  注入后退格与粘贴保持可用；工具结果里的 `valueLength` 改为回读到的码点长度。
- **`select_option` now confirms commitment** — dispatches focus + form events, reads back the
  actual `select.value`, and sets `committed: false` when the page reverts to a different option
  (common with cascading validations). Tool result reflects the commitment status.
  **`select_option` 增加回读确认** —— 派发 focus + 表单事件后回读 `select.value`，
  页面立即改回原选项（常见于联动校验）时返回 `committed: false`，工具结果如实反映。
- **`submitForm` honours HTML5 constraints** — calls `form.checkValidity()` before
  `requestSubmit()`; when invalid, returns `submitted: false` with the first invalid field's
  `validationMessage` instead of pretending the form was submitted.
  **`submitForm` 尊重 HTML5 约束** —— `requestSubmit()` 前先 `form.checkValidity()`；
  校验不通过时返回 `submitted: false` 并带上首个无效字段的 `validationMessage`，
  不再谎报已提交。
- **Keyboard dispatch carries legacy fields** — `dispatchEnter` now also fires `keyCode: 13`
  and `which: 13`, matching older pages that still read the deprecated fields.
  **键盘事件补全废弃字段** —— `dispatchEnter` 现在同时携带 `keyCode: 13` 和 `which: 13`，
  兼容仍在读取这两个废弃字段的老页面。
- **Result semantics (breaking, scope: tool result only)** — `FillResult` adds
  `expectedLength`, `strategy`, `committed`, `validityValid`, `validationMessage`;
  `SelectResult` adds `committed`. Old code treating `valueLength` as the input length must
  read `expectedLength` instead. No manifest / permission changes.
  **结果语义调整（破坏性，仅限工具结果）** —— `FillResult` 新增 `expectedLength`、
  `strategy`、`committed`、`validityValid`、`validationMessage`；`SelectResult` 新增
  `committed`。把 `valueLength` 当作入参长度的调用方需改用 `expectedLength`。
  无 manifest / 权限变更。

### Fixed / 修复

- **Write not being recognized by framework-controlled inputs** — the prototype-value-setter
  path was correct for React's `_valueTracker`, but pages that install their own `value` accessor
  (input masks, jQuery plugins, Web Components) were never synchronised; the model saw success
  while the page model stayed empty → validation "required" fired after submit. Fallback to the
  instance setter only after observing an actual revert prevents accidentally breaking React's
  change detection.
  **受控输入不认可写入** —— 原型 setter 对 React 的 `_valueTracker` 有效，但自行安装
  `value` accessor 的页面（输入掩码、jQuery 插件、Web Component）完全不同步；模型看到
  「填写成功」而页面 model 仍为空，提交后才爆红「必填」。仅在观测到回滚后才降级到
  实例 setter，避免误伤 React 的变更检测。
- **`contenteditable` losing edit capabilities after injection** — `textContent = text`
  rebuilds the document, discarding editor model, undo stack, and selection; subsequent typing
  still works but delete / paste go through the editor's own handlers whose state no longer
  matches the DOM. `commitText` now always uses browser editing commands for contenteditable.
  **`contenteditable` 注入后退格 / 粘贴失效** —— `textContent = text` 直接重建节点，
  编辑器 model、撤销栈、选区全部丢失，后续退格 / 粘贴走编辑器自己的处理器却和 DOM
  脱节。`commitText` 对 contenteditable 统一走浏览器编辑命令。
- **`beforeinput`-based editors treating the write as a no-op** — ProseMirror / Lexical / Slate
  / Draft.js / Quill build their edit transaction on `beforeinput`, which the previous code
  never dispatched; they saw an unchanged document and returned. Trusted `insertText` commands
  give these editors the event they expect.
  **基于 `beforeinput` 的编辑器无视写入** —— ProseMirror / Lexical / Slate / Draft.js /
  Quill 等编辑器靠 `beforeinput` 构建编辑事务，旧代码从不派发，它们拿到「文档未变」
  的结论就什么也不做。可信的 `insertText` 命令能让这些编辑器走通自己的路径。

## [0.1.2] - 2026-11-09

### Added / 新增

- **Bilingual interface (EN / 中文)** — i18n translation layer (`src/shared/i18n.ts`, `useI18n()`),
  auto-detects Chrome language or manual switch in Settings → General; manifest description and
  toolbar tooltip use `__MSG_*__` placeholders; declares `default_locale: 'zh_CN'` with both
  Simplified Chinese and English message tables.
  **中英文界面国际化** —— 新增 i18n 翻译层（`src/shared/i18n.ts`、`useI18n()`），支持 Chrome
  语言自动检测与手动切换（Settings → 通用）；manifest 描述、工具栏提示改用
  `__MSG_*__` 占位符，声明 `default_locale: 'zh_CN'`，内置简体中文和英文两套消息表。
- **Local file binding and read/write** — three new tools `bind_file`, `read_file`, `write_file`
  built on File System Access API; user picks a file in the side panel and the handle is persisted
  to IndexedDB; model references by filename, plain-text only. `write_file` requires confirmation.
  **本地文件绑定与读写** —— 新增 `bind_file`、`read_file`、`write_file` 三个工具，
  基于 File System Access API，用户在侧边栏点击后选择文件，句柄以 IndexedDB 持久化；
  模型按文件名引用，仅支持纯文本格式。`write_file` 属副作用动作需用户确认。
- **`download_file` tool** — no pre-binding required; model writes generated text directly to
  the system download directory via the downloads API.
  **download_file 工具** —— 无需绑定文件，直接通过 downloads API 将模型产出的文本
  写入系统下载目录；manifest 新增 `downloads` 权限支持此能力。
- **Side panel model switcher** — new provider/model dropdown at the top of the Side Panel,
  grouped by provider; switchable mid-task, subsequent rounds use the new selection.
  **侧边栏模型切换器** —— Side Panel 顶部新增供应商/模型下拉选择，按供应商分组，
  任务进行中可随时切换，后续轮次使用新选择。
- **Slide-over task history panel** — task history moves from an embedded list to a floating
  slide-over panel, no longer covers the current output area.
  **任务历史滑出面板** —— 侧边栏任务历史改为 slide-over 浮层面板，不遮挡当前输出区。
- **Shared UI component library** — extracted Button, Input, Card, Select, Checkbox, Field,
  Alert, Badge, PageHeader primitives with design tokens (color, radius, font, spacing);
  unifies Side Panel and Options page visual language; refactored App.tsx into smaller components.
  **共享 UI 组件库** —— 抽取 Button、Input、Card、Select、Checkbox、Field、Alert、
  Badge、PageHeader 等基础组件，配套设计 tokens（颜色、圆角、字号、间距），统一
  Side Panel 和 Options 页的视觉风格；重构 App.tsx，组件拆分便于迭代。
- **AI code index** — new `docs/ai/` directory with features (feature → code mapping),
  glossary (product terminology), codemap/ (module-level symbol indexes); scripts: `pnpm map`
  to generate, `pnpm map:check` for consistency, `pnpm docs:check` to validate doc references.
  **AI 代码索引** —— 新增 `docs/ai/` 目录，含 features（功能→代码映射）、glossary
  （产品术语表）、codemap/（模块级符号索引）；提供 `pnpm map` 生成、
  `pnpm map:check` 校验、`pnpm docs:check` 检查引用有效性。

### Changed / 变更

- **Manifest: new `downloads` permission** — added to support `download_file` tool;
  declares `default_locale: 'zh_CN'`; `description` and `action.default_title` changed
  to `__MSG_*__` localization placeholders.
  **manifest 权限新增** —— 新增 `downloads` 权限以支持 `download_file` 工具；
  声明 `default_locale: 'zh_CN'`；`description` 与 `action.default_title` 改为
  `__MSG_*__` 本地化占位符。

## [0.1.1] - 2026-10-28

### Added

- **Tab management tools** — `list_tabs`, `new_tab`, `switch_tab`, `close_tab` for listing,
  creating, switching, and closing tabs in the same window during a task.
  **标签页管理工具** —— `list_tabs`、`new_tab`、`switch_tab`、`close_tab`，支持任务中列出、
  新建、切换和关闭同窗口标签页。

### Changed

- **Full-site HTTPS authorization** — manifest `host_permissions` declares `https://*/*`,
  so all HTTPS site permissions are granted on extension load instead of prompting per site
  during tasks; local HTTP addresses (`http://localhost/*`, `http://127.0.0.1/*`) remain in
  `optional_host_permissions` and are requested on user gesture.
  **全站 https 授权** —— manifest 的 `host_permissions` 声明 `https://*/*`，扩展加载即授予所有
  https 站点权限，任务中不再逐个站点弹窗；本机 http 地址（`http://localhost/*`、
  `http://127.0.0.1/*`）仍在 `optional_host_permissions` 中按需申请。
- **Round limit** — default max tool rounds increased from 10 to 50.
  **轮次上限** —— 默认最大工具轮次由 10 调整为 50。

## [0.1.0] - 2026-10-26

First public release. The core pipeline is fully functional: user describes a task → model returns
Tool Calls → extension reads and manipulates the current page → results fed back to the model →
model continues decision or gives the final answer.

首个公开版本。核心链路已完整可用：用户描述任务 → 模型返回 Tool Call → 扩展读取并操作当前页面 →
结果回传模型 → 模型继续决策或给出最终答复。

### Added

- **Side Panel chat interface** — task input, streaming output, stop button, history persistence;
  Agent Loop runs in the Side Panel (not Service Worker) to avoid MV3 idle suspension killing
  long-running tasks.
  **侧边栏聊天界面（Side Panel）** —— 任务输入、流式输出、停止按钮、历史持久化；
  Agent Loop 运行在 Side Panel 而非 Service Worker，避免 MV3 空闲挂起中断长任务。
- **Provider settings page** — add / edit / delete / switch providers (Base URL, API Key, Model,
  streaming & tool-call toggles) with connection test.
  **供应商设置页** —— 新增 / 编辑 / 删除 / 切换供应商（Base URL、API Key、Model、
  流式与 Tool Calls 开关），支持测试连接。
- **Model client (`packages/llm-client`)** — OpenAI-compatible Chat Completions: endpoint
  normalization, non-streaming and SSE streaming parsing, multi-turn context, Tool Call
  accumulation, timeout & cancellation, error classification.
  **模型客户端（`packages/llm-client`）** —— OpenAI 兼容 Chat Completions：地址规范化、
  非流式与 SSE 流式解析、多轮上下文、Tool Call 累积、超时与取消、错误分类。
- **Agent loop (`packages/agent-core`)** — Tool Call parsing, argument validation, tool
  registry, round limit (default 10), duplicate-call detection, per-call timeout, execution log.
  **Agent 循环（`packages/agent-core`）** —— Tool Call 解析、参数校验、工具注册表、
  轮次上限（默认 10 轮）、重复调用检测、单次调用超时、执行日志。
- **Browser tools (`packages/browser-tools`)** — 8 tools: `get_active_tab`, `get_page_snapshot`,
  `find_elements`, `click_element`, `fill_input`, `scroll_page`, `wait_for_element`, `verify_action`.
  **浏览器工具（`packages/browser-tools`）** —— 8 个工具：`get_active_tab`、
  `get_page_snapshot`、`find_elements`、`click_element`、`fill_input`、`scroll_page`、
  `wait_for_element`、`verify_action`。
- **Per-site authorization** — no host permissions granted at install time; user actions trigger
  per-site requests.
  **按站点授权** —— 安装时不授予任何主机权限，由用户主动操作触发按站点申请。
- **Side-effect action confirmation** — sending messages, placing orders, payments, deletions,
  etc. require explicit user confirmation in the side panel.
  **副作用动作确认** —— 发送消息、提交订单、支付、删除等动作需用户在侧边栏显式确认。
- **Checkpoints and recovery** — round-by-round persistent checkpoints; after side panel close
  or extension restart, the task does not re-run from the beginning; interrupted tasks are clearly
  marked and do not auto-replay side-effect steps.
  **检查点与恢复** —— 每轮持久化检查点，侧边栏关闭或扩展重启后不从头重跑，
  中断的任务明确标记为「已中断」，且不自动重放副作用步骤。
- **End-to-end cancellation** — cancel signal propagates to model requests, in-flight tool calls,
  and promises waiting for confirmation.
  **取消贯通** —— 取消信号同时作用于模型请求、在飞工具调用与等待确认的 Promise。

### Security / 安全

- API Key only lives in the Side Panel; Service Worker and Content Script never see it.
  API Key 只存在于 Side Panel，Service Worker 与 Content Script 均不接触。
- Host permissions use `optional_host_permissions` — requested per site after a user gesture,
  never at install time.
  主机权限使用 `optional_host_permissions`，只在用户手势后按站点申请，不在安装时获取。
- Content Script `matches` uses a placeholder domain that never matches; the manifest entry
  exists solely so the build produces an injectable file. Actual injection happens only after user
  authorizes the current site.
  Content Script 的 `matches` 使用永不匹配的占位域名，声明仅用于让构建产出注入文件；
  真正的注入发生在用户授权当前站点之后。
- Content Script exposes only the extension's own build artifacts via `web_accessible_resources`;
  no secrets or config.
  Content Script 通过 `web_accessible_resources` 暴露的仅是扩展自身构建产物，不含密钥或配置。
- DOM node references are never persisted — every action re-locates the target; stale references
  fail loudly.
  不持久化 DOM 节点引用，每次操作前重新定位目标；页面跳转或 SPA 路由变化时安全失败。
- The model has no ability to execute arbitrary JavaScript; there is no generic "run script in
  page" tool.
  模型不具备执行任意 JavaScript 的能力，不存在通用的「在页面中执行脚本」工具。
- Page content is treated as untrusted input — it cannot rewrite the user's goal or escalate tool
  permissions.
  页面内容一律视为不可信输入，不能改写用户目标或提升工具权限。

### Notes / 说明

- First release — provider config shape, cross-context message protocol, and tool arguments
  may still change. Check future release notes before upgrading.
  首个版本，供应商配置结构、跨上下文消息协议与工具参数仍可能调整，升级前请留意后续变更说明。

[Unreleased]: https://github.com/Lollipoprh/web-chat-helper/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Lollipoprh/web-chat-helper/releases/tag/v1.0.0
[0.1.6]: https://github.com/Lollipoprh/web-chat-helper/releases/tag/v0.1.6
[0.1.5]: https://github.com/Lollipoprh/web-chat-helper/releases/tag/v0.1.5
[0.1.4]: https://github.com/Lollipoprh/web-chat-helper/releases/tag/v0.1.4
[0.1.3]: https://github.com/Lollipoprh/web-chat-helper/releases/tag/v0.1.3
[0.1.2]: https://github.com/Lollipoprh/web-chat-helper/releases/tag/v0.1.2
[0.1.1]: https://github.com/Lollipoprh/web-chat-helper/releases/tag/v0.1.1
[0.1.0]: https://github.com/Lollipoprh/web-chat-helper/releases/tag/v0.1.0
