// 界面语言的解析与文案表。
//
// 两层语言来源，互相独立：
// 1. manifest 层（扩展名称、应用商店描述、工具栏提示）：由 Chrome 在加载扩展时
//    按浏览器 UI 语言从 public/_locales 解析 __MSG_*__，本文件管不到；
// 2. 界面层（侧边栏与设置页自己渲染的文案）：走本文件，优先级为
//    「用户在设置页显式选择 > 浏览器 UI 语言（chrome.i18n.getUILanguage()）」。
//
// 只支持 zh / en 两种。新增语言时：补一份 messages.json，
// 再给 MESSAGES 加一张表，并扩展 Lang 联合类型。

export type Lang = 'zh' | 'en'

/** auto 表示跟随 Chrome 的界面语言 */
export type LangPref = 'auto' | Lang

/** 用户显式选择的语言保存在这里；未设置或值非法时按 auto 处理 */
export const UI_LANGUAGE_KEY = 'uiLanguage'

const zh = {
  'common.save': '保存',
  'common.cancel': '取消',
  'common.delete': '删除',
  'common.edit': '编辑',
  'common.loading': '加载中…',
  'common.settings': '设置',
  'common.confirm': '确定',
  'common.close': '关闭',

  'sidepanel.noProvider': '未配置供应商',
  'sidepanel.translateNeedsToolCalls':
    '当前供应商未启用 Tool Calls，无法直接修改页面；请在设置中启用后再试',
  'sidepanel.translateStartFailed': '无法自动启动整页翻译，请在侧边栏中重试',
  'sidepanel.switchSession': '切换会话',
  'sidepanel.newSession': '新建',
  'sidepanel.deleteSession': '删除',
  'sidepanel.clearChat': '清空',
  'sidepanel.addFile': '添加文件',
  'sidepanel.dropToBind': '拖拽到此处绑定文件',
  'sidepanel.dropFileUnsupported': '无法读取拖入的文件，请使用「添加文件」',
  'sidepanel.dropFileFailed': '文件绑定失败，请重试或使用「添加文件」',
  'sidepanel.unbind': '解绑',

  'palette.title': '命令面板',
  'palette.placeholder': '搜索会话、命令或模型',
  'palette.sessions': '会话',
  'palette.commands': '命令',
  'palette.models': '模型',
  'palette.other': '其他',
  'palette.empty': '没有匹配项',
  'palette.messageCount': '{count} 条',
  'palette.footerHint': '↑↓ 选择 · Enter 执行 · Esc 关闭',
  'palette.openSettings': '打开设置',
  'palette.openTasks': '任务记录',
  'palette.newSession': '新建会话',
  'palette.rename': '重命名当前会话',
  'palette.hint': '{shortcut} 打开命令面板',

  'file.previewTitle': '文件预览：{name}',
  'file.previewBinary': '该文件不是纯文本，暂不支持预览。',
  'file.previewFailed': '读取失败，可能是文件访问权限已失效，请重新绑定。',
  'file.previewTruncated': '内容较长，仅显示前 {lines} 行（共 {total} 行）。',
  'file.modified': '修改于 {time}',
  'sidepanel.usageInput': '输入',
  'sidepanel.usageContext': '当前上下文',
  'sidepanel.usageOutput': '输出',
  'sidepanel.usageWindow': '窗口',
  'sidepanel.grantSite': '授权当前站点',
  'sidepanel.notAuthorized': '当前页面尚未授权，无法操作',
  'sidepanel.checkpointNotice':
    '上次任务已中断（第 {rounds} 轮）。可以继续完成它，或清除这条提示。',
  'sidepanel.resume': '继续',
  'sidepanel.resumeTask':
    '继续完成刚才被中断的任务。先确认已经完成的部分，再从断点继续，不要重复已完成的步骤。',
  'sidepanel.dismiss': '清除',
  'sidepanel.awaitingConfirmation': '等待确认：',
  'sidepanel.run': '确认执行',
  'sidepanel.deny': '拒绝',
  'sidepanel.noProviderTitle': '尚未配置模型供应商',
  'sidepanel.openSettings': '前往设置',
  'sidepanel.emptyChatTitle': '开始一个新任务',
  'sidepanel.emptyChatHint':
    '可以让我读取当前页面、填写表单、整理资料或翻译整页内容。',
  'sidepanel.suggestTranslate': '把当前页面翻译成{language}',
  'sidepanel.suggestTranslateTask':
    '把当前页面翻译成{language}，只改页面，不要在对话里贴译文。',
  'sidepanel.suggestSummarize': '总结这个页面的要点',
  'sidepanel.suggestSummarizeTask': '总结这个页面的要点，用简短的分点回答，不要修改页面。',
  'sidepanel.suggestTable': '把页面主要内容整理成表格',
  'sidepanel.suggestTableTask': '把页面里的主要内容整理成表格，不要修改页面。',
  'sidepanel.tasks': '任务记录',
  'sidepanel.backToChat': '返回对话',
  'sidepanel.noSession': '尚未选择会话',
  'sidepanel.statusRunning': '运行中',
  'sidepanel.statusAwaiting': '待确认',
  'sidepanel.deleteSessionAction': '删除当前会话',
  'sidepanel.renameSession': '重命名',
  'sidepanel.renameTitle': '重命名会话',
  'sidepanel.renamePlaceholder': '会话名称',
  'sidepanel.renameFailed': '重命名失败，请重试',
  'sidepanel.sessionSearch': '搜索会话',
  'sidepanel.sessionNoMatch': '没有匹配的会话',
  'sidepanel.inputPlaceholder': '输入问题，Enter 发送，Shift+Enter 换行',
  'sidepanel.inputPlaceholderNoProvider': '请先配置供应商',
  'sidepanel.confirmMode': '需确认',
  'sidepanel.autoMode': '自动执行',
  'sidepanel.autoModeOnTitle': '已开启：全局自动执行风险操作（不再弹窗确认）',
  'sidepanel.autoModeOffTitle': '允许全局自动执行风险操作（默认关闭）',
  'sidepanel.streaming': '流式输出',
  'sidepanel.nonStreaming': '非流式输出',
  'sidepanel.stop': '停止',
  'sidepanel.send': '发送',

  'options.navProviders': '供应商',
  'options.navProvidersDesc': '模型接口与密钥',
  'options.navLimits': '工具限额',
  'options.navLimitsDesc': '轮次、超时等上限',
  'options.navLogs': '运行日志',
  'options.navLogsDesc': '本地任务记录',
  'options.navGeneral': '通用',
  'options.navGeneralDesc': '界面语言',
  'options.providersTitle': '供应商',
  'options.providersDesc':
    '配置 OpenAI 兼容的模型供应商。所有配置只保存在本机浏览器中，不会上传。',
  'options.providerListTitle': '供应商列表',
  'options.addProvider': '新增供应商',
  'options.providersEmpty':
    '尚未配置任何供应商。至少添加一个并设为默认，侧边栏才能发起对话。',
  'options.defaultBadge': '默认',
  'options.providerMeta': '模型 {model} · 密钥 {key}',
  'options.setDefault': '设为默认',
  'options.streaming': '流式',
  'options.nonStreaming': '非流式',
  'options.toolCallsSupported': '支持 Tool Calls',
  'options.toolCallsUnsupported': '不支持 Tool Calls',
  'options.limitsTitle': '工具限额',
  'options.limitsDesc':
    '应用级默认值。设置后，所有新发起的 Side Panel 对话都会使用这里的限额。',
  'options.maxRoundsLabel': '最大工具调用轮次（maxRounds）',
  'options.maxRoundsHint':
    '模型最多执行 N 轮「模型返回 → 工具调用」。超出即停止，避免死循环。默认 {default}。',
  'options.toolTimeoutLabel': '单工具执行超时（toolTimeoutMs，毫秒）',
  'options.toolTimeoutHint':
    '单次工具调用（点击、输入等）最长等待时间。超时视为该步失败。默认 {default} ms。',
  'options.requestTimeoutLabel': '模型请求超时（requestTimeoutMs，毫秒）',
  'options.requestTimeoutHint':
    '单次 Chat Completions 请求的最长等待时间（流式与非流式通用）。默认 {default} ms。',
  'options.reset': '恢复默认',
  'options.savedAt': '已保存于 {time}',
  'options.logsTitle': '运行日志',
  'options.logsDesc':
    '任务日志保存在本机 IndexedDB，Side Panel 的「任务记录」视图可以按会话检索。',
  'options.logStatsTitle': '本地日志统计',
  'options.clearLogs': '清空日志',
  'options.logsBody':
    '最多保留 {days} 天或 {tasks} 个任务（先到者为准），到期自动清理。日志只记录脱敏后的工具参数与结果摘要，不含页面正文、表单值、Cookie 与 API Key。',
  'options.logStats': '当前有 {tasks} 个任务、{steps} 条步骤记录。',
  'options.footerNote':
    '说明：API Key 保存在 chrome.storage.local，并非操作系统级密钥保险库，仅供个人本机使用。运行日志与会话消息存放在 IndexedDB，与配置存储相互隔离。',
  'options.generalTitle': '通用设置',
  'options.appearanceTitle': '外观',
  'options.appearanceDesc': '默认跟随系统；也可以固定为浅色或深色，修改后立即生效。',
  'options.themeLabel': '主题',
  'options.themeAuto': '跟随系统（{theme}）',
  'options.themeLight': '浅色',
  'options.themeDark': '深色',
  'options.appearanceScopeNote':
    '主题偏好保存在本机浏览器存储中，侧边栏与设置页共用同一份设置。',
  'options.languageTitle': '界面语言',
  'options.languageDesc':
    '默认跟随 Chrome 的界面语言，也可以固定为某一种。修改后侧边栏与设置页立即生效。',
  'options.languageLabel': '语言',
  'options.langAuto': '跟随 Chrome（{language}）',
  'options.langZh': '简体中文',
  'options.langEn': 'English',
  'options.languageScopeNote':
    '扩展名称、应用商店描述与工具栏提示由 Chrome 在加载扩展时按浏览器语言解析，修改语言偏好后可能需要重启浏览器或重新加载扩展。',

  'providerForm.editTitle': '编辑供应商',
  'providerForm.newTitle': '新增供应商',
  'providerForm.nameLabel': '名称',
  'providerForm.namePlaceholder': '例如：公司网关 / 本地模型',
  'providerForm.baseUrlHint':
    '支持根地址、带版本号地址，或完整的 /chat/completions 地址；仅支持 HTTPS，本机地址可用 HTTP。',
  'providerForm.resolvedUrl': '实际请求：{url}',
  'providerForm.apiKeyHint': '当前填入：{masked}',
  'providerForm.apiKeyPlaceholder': '仅保存在本机浏览器存储中',
  'providerForm.showKey': '显示',
  'providerForm.hideKey': '隐藏',
  'providerForm.modelPlaceholder': '填写该服务商提供的模型名',
  'providerForm.contextWindowLabel': '上下文窗口（tokens）',
  'providerForm.contextWindowHint': '该模型的上下文窗口上限，用于侧边栏用量进度显示',
  'providerForm.supportsStreaming': '支持流式输出',
  'providerForm.supportsToolCalls': '支持 Tool Calls',
  'providerForm.saving': '保存中…',
  'providerForm.test': '测试连接',
  'providerForm.testing': '测试中…',
  'providerForm.errName': '请填写供应商名称',
  'providerForm.errBaseUrl': '请填写 Base URL',
  'providerForm.errApiKey': '请填写 API Key',
  'providerForm.errModel': '请填写 Model',
  'providerForm.errContextWindow': '请填写有效的上下文窗口（正整数）',
  'providerForm.errPermission': '未获得 {origin} 的访问权限，无法测试连接',
  'providerForm.testResult': '{message} · 用时 {ms}ms',

  'task.statusRunning': '运行中',
  'task.statusCompleted': '已完成',
  'task.statusFailed': '失败',
  'task.statusCancelled': '已取消',
  'task.statusInterrupted': '已中断',
  'task.statusRoundLimit': '达到轮次上限',

  'history.summary': '共 {count} 个任务，点击查看工具调用明细',
  'history.sessionLabel': '会话：{title}',
  'history.refresh': '刷新',
  'history.locate': '定位',
  'history.empty': '当前会话还没有任务记录。发送任务后，工具调用步骤会显示在这里。',
  'history.readingSteps': '读取步骤…',
  'history.noSteps': '该任务没有落盘的步骤。',
  'history.roundsSteps': '{rounds} 轮 · {steps} 步',
  'history.dropped': ' · 丢弃 {count}',
  'history.stopReason': '停止原因：{reason}',
  'history.stepSuccess': '成功',
  'history.stepFailed': '失败',
  'history.truncated': '内容已截断',

  'tool.running': '执行中',
  'tool.awaitingConfirmation': '等待确认',
  'tool.success': '成功',
  'tool.error': '失败',
  'tool.errorCode': '错误码：{code}',

  'message.generating': '正在生成…',
  'message.cancelled': '（已取消）',
  'message.failed': '生成失败',
  'message.copy': '复制',
  'message.copied': '已复制',
  'message.edit': '编辑并重发',

  'run.title': '执行记录',
  'run.retry': '重新生成这条回答',
  'run.stepCount': '{count} 步',
  'run.loading': '读取步骤…',
  'run.empty': '这一轮没有记录到工具调用',
  'run.toggle': '展开或收起执行记录',

  'picker.switchModel': '切换供应商模型',
  'picker.selectModel': '选择模型',
  'picker.unnamed': '未命名供应商',

  'sidepanel.localDataFailed': '本地会话数据读取失败，可尝试重新打开侧边栏。',
  'sidepanel.granted': '已授权当前站点，请重新发送任务。',
  'sidepanel.grantDenied': '授权被拒绝，无法读取或操作当前页面。',
  'sidepanel.confirmClear': '确定清空当前对话吗？',
  'sidepanel.clearDialogTitle': '清空对话',
  'sidepanel.confirmDeleteSession': '删除当前会话及其任务记录？',
  'sidepanel.confirmDeleteSessionNamed': '删除会话「{title}」？该会话的消息与任务记录会一并删除。',
  'sidepanel.deleteSessionRow': '删除会话',
  'sidepanel.deleteDialogTitle': '删除会话',
  'sidepanel.autoModeDialogTitle': '开启自动执行',
  'sidepanel.sessionLoadFailed': '会话加载失败，请重试。',
  'sidepanel.newSessionFailed': '新建会话失败，请重试。',
  'sidepanel.deleteSessionFailed': '删除会话失败，请重试。',
  'sidepanel.skipConfirmWarning':
    '⚠️ 风险提示\n\n开启后，模型执行 click / fill / submit 等副作用动作时将不再弹窗确认，页面上的任何操作都会自动执行。\n\n请确认当前网站可信、模型指令可控。继续？',
  'sidepanel.fileBound': '已绑定文件「{name}」',
  'sidepanel.bindFileFailed': '绑定文件失败',
  'sidepanel.unbindFileFailed': '解绑文件失败，请重试',
  'sidepanel.modelPermissionDenied': '未获得模型服务的访问权限，无法执行任务',
  'sidepanel.pagePermissionDenied': '未获得当前网页的访问权限，本次任务无法读取或操作页面',
  'sidepanel.agentFailed': '工具调用流程失败',
  'sidepanel.roundLimit':
    '已达到 {rounds} 轮工具调用上限，任务已停止。已完成 {calls} 次工具调用。',
  'sidepanel.cancelled': '已取消',
  'sidepanel.slash.helpTitle': '可用指令',
  'sidepanel.slash.unknown': '未识别的指令 {name}，输入 /help 查看可用指令',
  'sidepanel.slash.busy': '任务进行中，请结束后再执行指令',
  'sidepanel.slash.compactDone':
    '已压缩：{before} 条消息 → 摘要约 {tokens} tokens',
  'sidepanel.slash.compactEmpty': '当前没有可压缩的任务记录',
  'sidepanel.slash.compactDesc': '把会话历史压缩为摘要',
  'sidepanel.slash.memoryDesc': '查看下次请求将注入的记忆',
  'sidepanel.slash.helpDesc': '列出可用指令',
  'sidepanel.slash.clearDesc': '清空当前会话',
  'sidepanel.memory.title': '下次请求将注入的记忆块',
  'sidepanel.memory.empty': '当前没有可注入的记忆。',

  'options.loadProvidersFailed': '读取配置失败：{message}',
  'options.loadLimitsFailed': '读取限额失败：{message}',
  'options.saveFailed': '保存失败：{message}',
  'options.deleteFailed': '删除失败：{message}',
  'options.setDefaultFailed': '设置默认供应商失败：{message}',
  'options.clearLogsFailed': '清空日志失败：{message}',
  'options.saveLimitsFailed': '保存限额失败：{message}',
  'options.confirmDeleteProvider': '确定删除「{name}」吗？该操作不可撤销。',
  'options.confirmClearLogs': '确定清空全部本地运行日志吗？该操作不可撤销。',
  'options.confirmResetLimits':
    '确定恢复到默认值？\n\nmaxRounds: {rounds} 轮\ntoolTimeoutMs: {toolTimeout} ms\nrequestTimeoutMs: {requestTimeout} ms',
  'options.errMaxRounds': '最大工具调用轮次必须是正整数',
  'options.errToolTimeout': '单工具执行超时必须是不小于 1000 的整数（毫秒）',
  'options.errRequestTimeout': '模型请求超时必须是不小于 5000 的整数（毫秒）',
  'options.joinErrors': '；',
} as const

export type MessageKey = keyof typeof zh

const en: Record<MessageKey, string> = {
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.loading': 'Loading…',
  'common.settings': 'Settings',
  'common.confirm': 'Confirm',
  'common.close': 'Close',

  'sidepanel.noProvider': 'No provider configured',
  'sidepanel.translateNeedsToolCalls':
    'The current provider does not support tool calls, so the page cannot be edited in place. Enable tool calls in settings and try again.',
  'sidepanel.translateStartFailed': 'Could not start the page translation. Please retry from the side panel.',
  'sidepanel.switchSession': 'Switch session',
  'sidepanel.newSession': 'New',
  'sidepanel.deleteSession': 'Delete',
  'sidepanel.clearChat': 'Clear',
  'sidepanel.addFile': 'Add file',
  'sidepanel.dropToBind': 'Drag files here to bind',
  'sidepanel.dropFileUnsupported': 'Cannot read the dropped file; use "Add file" instead',
  'sidepanel.dropFileFailed': 'Failed to bind the file; try again or use "Add file"',
  'sidepanel.unbind': 'Unbind',

  'palette.title': 'Command palette',
  'palette.placeholder': 'Search sessions, commands or models',
  'palette.sessions': 'Sessions',
  'palette.commands': 'Commands',
  'palette.models': 'Models',
  'palette.other': 'Other',
  'palette.empty': 'No matches',
  'palette.messageCount': '{count} msgs',
  'palette.footerHint': '↑↓ to select · Enter to run · Esc to close',
  'palette.openSettings': 'Open settings',
  'palette.openTasks': 'Task records',
  'palette.newSession': 'New session',
  'palette.rename': 'Rename this session',
  'palette.hint': '{shortcut} for the command palette',

  'file.previewTitle': 'Preview: {name}',
  'file.previewBinary': 'This file is not plain text, so it cannot be previewed.',
  'file.previewFailed': 'Could not read the file; access may have expired, so bind it again.',
  'file.previewTruncated': 'Showing the first {lines} of {total} lines.',
  'file.modified': 'modified {time}',
  'sidepanel.usageInput': 'Input',
  'sidepanel.usageContext': 'Current context',
  'sidepanel.usageOutput': 'Output',
  'sidepanel.usageWindow': 'Window',
  'sidepanel.grantSite': 'Grant access to this site',
  'sidepanel.notAuthorized': 'This page is not authorized yet; cannot operate on it',
  'sidepanel.checkpointNotice':
    'The previous task was interrupted (round {rounds}). You can resume it, or dismiss this notice.',
  'sidepanel.resume': 'Resume',
  'sidepanel.resumeTask':
    'Continue the task that was interrupted. Check what is already done, then resume from there without repeating finished steps.',
  'sidepanel.dismiss': 'Dismiss',
  'sidepanel.awaitingConfirmation': 'Awaiting confirmation: ',
  'sidepanel.run': 'Run',
  'sidepanel.deny': 'Deny',
  'sidepanel.noProviderTitle': 'No model provider configured',
  'sidepanel.openSettings': 'Open settings',
  'sidepanel.emptyChatTitle': 'Start a new task',
  'sidepanel.emptyChatHint':
    'Ask me to read this page, fill in a form, summarise material, or translate the whole page.',
  'sidepanel.suggestTranslate': 'Translate this page into {language}',
  'sidepanel.suggestTranslateTask':
    'Translate this page into {language}. Edit the page in place and do not paste the translation into the chat.',
  'sidepanel.suggestSummarize': 'Summarise the key points of this page',
  'sidepanel.suggestSummarizeTask':
    'Summarise the key points of this page as a short bullet list. Do not modify the page.',
  'sidepanel.suggestTable': 'Turn the main content into a table',
  'sidepanel.suggestTableTask':
    'Turn the main content of this page into a table. Do not modify the page.',
  'sidepanel.tasks': 'Tasks',
  'sidepanel.backToChat': 'Back to chat',
  'sidepanel.noSession': 'No session selected',
  'sidepanel.statusRunning': 'Running',
  'sidepanel.statusAwaiting': 'Needs approval',
  'sidepanel.deleteSessionAction': 'Delete session',
  'sidepanel.renameSession': 'Rename',
  'sidepanel.renameTitle': 'Rename session',
  'sidepanel.renamePlaceholder': 'Session name',
  'sidepanel.renameFailed': 'Rename failed, please try again',
  'sidepanel.sessionSearch': 'Search sessions',
  'sidepanel.sessionNoMatch': 'No matching sessions',
  'sidepanel.inputPlaceholder': 'Ask a question — Enter to send, Shift+Enter for a new line',
  'sidepanel.inputPlaceholderNoProvider': 'Configure a provider first',
  'sidepanel.confirmMode': 'Ask first',
  'sidepanel.autoMode': 'Auto-run',
  'sidepanel.autoModeOnTitle': 'Enabled: risky actions run automatically (no confirmation)',
  'sidepanel.autoModeOffTitle': 'Allow risky actions to run automatically (off by default)',
  'sidepanel.streaming': 'Streaming',
  'sidepanel.nonStreaming': 'Non-streaming',
  'sidepanel.stop': 'Stop',
  'sidepanel.send': 'Send',

  'options.navProviders': 'Providers',
  'options.navProvidersDesc': 'Model endpoints and keys',
  'options.navLimits': 'Limits',
  'options.navLimitsDesc': 'Rounds and timeouts',
  'options.navLogs': 'Logs',
  'options.navLogsDesc': 'Local task records',
  'options.navGeneral': 'General',
  'options.navGeneralDesc': 'Interface language',
  'options.providersTitle': 'Providers',
  'options.providersDesc':
    'Configure OpenAI-compatible model providers. Everything stays in this browser and is never uploaded.',
  'options.providerListTitle': 'Provider list',
  'options.addProvider': 'Add provider',
  'options.providersEmpty':
    'No provider configured yet. Add at least one and set it as default before chatting in the side panel.',
  'options.defaultBadge': 'Default',
  'options.providerMeta': 'Model {model} · Key {key}',
  'options.setDefault': 'Set default',
  'options.streaming': 'Streaming',
  'options.nonStreaming': 'Non-streaming',
  'options.toolCallsSupported': 'Tool calls supported',
  'options.toolCallsUnsupported': 'Tool calls not supported',
  'options.limitsTitle': 'Limits',
  'options.limitsDesc':
    'Application-wide defaults. New Side Panel conversations use these limits.',
  'options.maxRoundsLabel': 'Max tool-call rounds (maxRounds)',
  'options.maxRoundsHint':
    'How many "model reply → tool call" rounds the model may run. It stops when exceeded, avoiding infinite loops. Default {default}.',
  'options.toolTimeoutLabel': 'Tool timeout (toolTimeoutMs, ms)',
  'options.toolTimeoutHint':
    'Maximum wait for a single tool call (click, type, …). A timeout counts as a failed step. Default {default} ms.',
  'options.requestTimeoutLabel': 'Request timeout (requestTimeoutMs, ms)',
  'options.requestTimeoutHint':
    'Maximum wait for one Chat Completions request (streaming and non-streaming alike). Default {default} ms.',
  'options.reset': 'Reset to defaults',
  'options.savedAt': 'Saved at {time}',
  'options.logsTitle': 'Logs',
  'options.logsDesc':
    'Task logs are stored in the local IndexedDB and can be browsed per session from the side panel “Tasks” view.',
  'options.logStatsTitle': 'Local log statistics',
  'options.clearLogs': 'Clear logs',
  'options.logsBody':
    'Keeps at most {days} days or {tasks} tasks (whichever comes first) and prunes the rest automatically. Logs only contain redacted tool arguments and result summaries — never page text, form values, cookies or API keys.',
  'options.logStats': '{tasks} tasks and {steps} step records are stored right now.',
  'options.footerNote':
    'Note: API keys live in chrome.storage.local, which is not an OS-level secret vault, so use this on a personal machine only. Run logs and session messages live in IndexedDB, isolated from the config store.',
  'options.generalTitle': 'General',
  'options.appearanceTitle': 'Appearance',
  'options.appearanceDesc':
    'Follow the system by default, or pin light/dark. Changes apply immediately.',
  'options.themeLabel': 'Theme',
  'options.themeAuto': 'Follow system ({theme})',
  'options.themeLight': 'Light',
  'options.themeDark': 'Dark',
  'options.appearanceScopeNote':
    'The theme preference is stored in local browser storage and shared by the side panel and this page.',
  'options.languageTitle': 'Interface language',
  'options.languageDesc':
    'Follow Chrome by default, or pin one language. Changes apply to the side panel and this page immediately.',
  'options.languageLabel': 'Language',
  'options.langAuto': 'Follow Chrome ({language})',
  'options.langZh': '简体中文',
  'options.langEn': 'English',
  'options.languageScopeNote':
    'The extension name, store description and toolbar tooltip are resolved by Chrome from the browser language when the extension loads, so changing the language preference may require restarting the browser or reloading the extension.',

  'providerForm.editTitle': 'Edit provider',
  'providerForm.newTitle': 'Add provider',
  'providerForm.nameLabel': 'Name',
  'providerForm.namePlaceholder': 'e.g. company gateway / local model',
  'providerForm.baseUrlHint':
    'Accepts a root URL, a versioned URL, or a full /chat/completions URL. HTTPS only; local addresses may use HTTP.',
  'providerForm.resolvedUrl': 'Effective request: {url}',
  'providerForm.apiKeyHint': 'Currently set: {masked}',
  'providerForm.apiKeyPlaceholder': 'Stored only in this browser',
  'providerForm.showKey': 'Show',
  'providerForm.hideKey': 'Hide',
  'providerForm.modelPlaceholder': 'The model name this provider offers',
  'providerForm.contextWindowLabel': 'Context window (tokens)',
  'providerForm.contextWindowHint':
    'The model context window limit, used by the side panel usage meter',
  'providerForm.supportsStreaming': 'Supports streaming',
  'providerForm.supportsToolCalls': 'Supports tool calls',
  'providerForm.saving': 'Saving…',
  'providerForm.test': 'Test connection',
  'providerForm.testing': 'Testing…',
  'providerForm.errName': 'Enter a provider name',
  'providerForm.errBaseUrl': 'Enter a Base URL',
  'providerForm.errApiKey': 'Enter an API Key',
  'providerForm.errModel': 'Enter a Model',
  'providerForm.errContextWindow': 'Enter a valid context window (positive integer)',
  'providerForm.errPermission': 'No permission for {origin}; cannot test the connection',
  'providerForm.testResult': '{message} · took {ms}ms',

  'task.statusRunning': 'Running',
  'task.statusCompleted': 'Completed',
  'task.statusFailed': 'Failed',
  'task.statusCancelled': 'Cancelled',
  'task.statusInterrupted': 'Interrupted',
  'task.statusRoundLimit': 'Round limit reached',

  'history.summary': '{count} tasks — click one to see its tool calls',
  'history.sessionLabel': 'Session: {title}',
  'history.refresh': 'Refresh',
  'history.locate': 'Locate',
  'history.empty':
    'No task records in this session yet. Tool-call steps appear here after you send a task.',
  'history.readingSteps': 'Loading steps…',
  'history.noSteps': 'This task has no persisted steps.',
  'history.roundsSteps': '{rounds} rounds · {steps} steps',
  'history.dropped': ' · {count} dropped',
  'history.stopReason': 'Stop reason: {reason}',
  'history.stepSuccess': 'OK',
  'history.stepFailed': 'Failed',
  'history.truncated': 'Content truncated',

  'tool.running': 'Running',
  'tool.awaitingConfirmation': 'Awaiting approval',
  'tool.success': 'Done',
  'tool.error': 'Failed',
  'tool.errorCode': 'Error code: {code}',

  'message.generating': 'Generating…',
  'message.cancelled': ' (cancelled)',
  'message.failed': 'Generation failed',
  'message.copy': 'Copy',
  'message.copied': 'Copied',
  'message.edit': 'Edit and resend',

  'run.title': 'Run',
  'run.retry': 'Regenerate this answer',
  'run.stepCount': '{count} steps',
  'run.loading': 'Loading steps…',
  'run.empty': 'No tool calls were recorded in this run',
  'run.toggle': 'Expand or collapse the run log',

  'picker.switchModel': 'Switch provider model',
  'picker.selectModel': 'Select model',
  'picker.unnamed': 'Unnamed provider',

  'sidepanel.localDataFailed':
    'Failed to read local session data. Try reopening the side panel.',
  'sidepanel.granted': 'Site access granted — please resend the task.',
  'sidepanel.grantDenied': 'Permission denied; the page cannot be read or operated on.',
  'sidepanel.confirmClear': 'Clear the current conversation?',
  'sidepanel.clearDialogTitle': 'Clear conversation',
  'sidepanel.confirmDeleteSession': 'Delete this session and its task records?',
  'sidepanel.confirmDeleteSessionNamed':
    'Delete “{title}”? Its messages and task records will be removed too.',
  'sidepanel.deleteSessionRow': 'Delete session',
  'sidepanel.deleteDialogTitle': 'Delete session',
  'sidepanel.autoModeDialogTitle': 'Enable auto-run',
  'sidepanel.sessionLoadFailed': 'Failed to load the session. Please try again.',
  'sidepanel.newSessionFailed': 'Failed to create a session. Please try again.',
  'sidepanel.deleteSessionFailed': 'Failed to delete the session. Please try again.',
  'sidepanel.skipConfirmWarning':
    '⚠️ Risk notice\n\nOnce enabled, side-effecting actions such as click / fill / submit run without a confirmation dialog — anything on the page executes automatically.\n\nMake sure you trust this site and control the model instructions. Continue?',
  'sidepanel.fileBound': 'Bound file “{name}”',
  'sidepanel.bindFileFailed': 'Failed to bind the file',
  'sidepanel.unbindFileFailed': 'Failed to unbind the file. Please try again',
  'sidepanel.modelPermissionDenied':
    'No permission for the model service; the task cannot run',
  'sidepanel.pagePermissionDenied':
    'No permission for the current page; this task cannot read or operate it',
  'sidepanel.agentFailed': 'The tool-calling flow failed',
  'sidepanel.roundLimit':
    'Reached the {rounds}-round tool-call limit, so the task stopped. {calls} tool calls completed.',
  'sidepanel.cancelled': 'Cancelled',
  'sidepanel.slash.helpTitle': 'Available commands',
  'sidepanel.slash.unknown': 'Unknown command {name}. Type /help to list available commands',
  'sidepanel.slash.busy': 'A task is running; run commands after it finishes',
  'sidepanel.slash.compactDone':
    'Compacted: {before} messages → summary of about {tokens} tokens',
  'sidepanel.slash.compactEmpty': 'No task records to compact',
  'sidepanel.slash.compactDesc': 'Compact the conversation history into a summary',
  'sidepanel.slash.memoryDesc': 'Preview the memory injected into the next request',
  'sidepanel.slash.helpDesc': 'List available commands',
  'sidepanel.slash.clearDesc': 'Clear the current session',
  'sidepanel.memory.title': 'Memory injected into the next request',
  'sidepanel.memory.empty': 'No memory to inject right now.',

  'options.loadProvidersFailed': 'Failed to read configuration: {message}',
  'options.loadLimitsFailed': 'Failed to read limits: {message}',
  'options.saveFailed': 'Failed to save: {message}',
  'options.deleteFailed': 'Failed to delete: {message}',
  'options.setDefaultFailed': 'Failed to set the default provider: {message}',
  'options.clearLogsFailed': 'Failed to clear logs: {message}',
  'options.saveLimitsFailed': 'Failed to save limits: {message}',
  'options.confirmDeleteProvider': 'Delete “{name}”? This cannot be undone.',
  'options.confirmClearLogs': 'Clear all local run logs? This cannot be undone.',
  'options.confirmResetLimits':
    'Reset to defaults?\n\nmaxRounds: {rounds}\ntoolTimeoutMs: {toolTimeout} ms\nrequestTimeoutMs: {requestTimeout} ms',
  'options.errMaxRounds': 'Max tool-call rounds must be a positive integer',
  'options.errToolTimeout': 'Tool timeout must be an integer of at least 1000 ms',
  'options.errRequestTimeout': 'Request timeout must be an integer of at least 5000 ms',
  'options.joinErrors': '; ',
}

const MESSAGES: Record<Lang, Record<MessageKey, string>> = { zh, en }

export function isLangPref(value: unknown): value is LangPref {
  return value === 'auto' || value === 'zh' || value === 'en'
}

/** 浏览器界面语言 → 本扩展支持的两种语言；非中文一律回落到英文 */
export function detectLang(): Lang {
  const raw =
    typeof chrome !== 'undefined' && chrome.i18n
      ? chrome.i18n.getUILanguage()
      : typeof navigator !== 'undefined'
        ? navigator.language
        : 'en'
  return raw.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function resolveLang(pref: LangPref): Lang {
  return pref === 'auto' ? detectLang() : pref
}

/** 读取用户语言偏好；读不到时按 auto 处理，不让 i18n 阻断页面渲染 */
export async function loadLangPref(): Promise<LangPref> {
  try {
    const stored = await chrome.storage.local.get(UI_LANGUAGE_KEY)
    const value = stored[UI_LANGUAGE_KEY]
    return isLangPref(value) ? value : 'auto'
  } catch {
    return 'auto'
  }
}

export async function saveLangPref(pref: LangPref): Promise<void> {
  await chrome.storage.local.set({ [UI_LANGUAGE_KEY]: pref })
}

/**
 * 取一条文案。key 在目标语言缺失时回落到中文，再缺失则原样返回 key，
 * 便于在界面上直接看出漏翻的条目。
 * 占位符写法为 {name}，未提供的占位符保持原样。
 */
export function translate(
  lang: Lang,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const template = MESSAGES[lang][key] ?? zh[key] ?? key
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

/** 语言下拉框的选项顺序；label 由调用方用 translate 生成 */
export const LANG_PREF_VALUES: readonly LangPref[] = ['auto', 'zh', 'en']
