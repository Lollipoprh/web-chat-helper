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

  'sidepanel.noProvider': '未配置供应商',
  'sidepanel.switchSession': '切换会话',
  'sidepanel.newSession': '新建',
  'sidepanel.deleteSession': '删除',
  'sidepanel.clearChat': '清空',
  'sidepanel.files': '文件管理',
  'sidepanel.filesHide': '收起文件',
  'sidepanel.fileManagerTitle': '本地文件管理（供模型读写）',
  'sidepanel.bindFile': '绑定文件',
  'sidepanel.noFiles': '尚未绑定文件。绑定后模型可通过文件名读取和写入该文件。',
  'sidepanel.unbind': '解绑',
  'sidepanel.grantSite': '授权当前站点',
  'sidepanel.notAuthorized': '当前页面尚未授权，无法操作',
  'sidepanel.checkpointNotice':
    '上次任务已中断（第 {rounds} 轮）。为避免重放副作用步骤，恢复前请重新发送，不自动执行旧动作。',
  'sidepanel.dismiss': '清除',
  'sidepanel.awaitingConfirmation': '等待确认：',
  'sidepanel.run': '确认执行',
  'sidepanel.deny': '拒绝',
  'sidepanel.noProviderTitle': '尚未配置模型供应商',
  'sidepanel.openSettings': '前往设置',
  'sidepanel.emptyChat': '输入问题开始对话。',
  'sidepanel.tasks': '任务记录',
  'sidepanel.backToChat': '返回对话',
  'sidepanel.noSession': '尚未选择会话',
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
  'providerForm.supportsStreaming': '支持流式输出',
  'providerForm.supportsToolCalls': '支持 Tool Calls',
  'providerForm.saving': '保存中…',
  'providerForm.test': '测试连接',
  'providerForm.testing': '测试中…',
  'providerForm.errName': '请填写供应商名称',
  'providerForm.errBaseUrl': '请填写 Base URL',
  'providerForm.errApiKey': '请填写 API Key',
  'providerForm.errModel': '请填写 Model',
  'providerForm.errPermission': '未获得 {origin} 的访问权限，无法测试连接',
  'providerForm.testResult': '{message} · 用时 {ms}ms',

  'task.statusRunning': '运行中',
  'task.statusCompleted': '已完成',
  'task.statusFailed': '失败',
  'task.statusCancelled': '已取消',
  'task.statusInterrupted': '已中断',

  'history.summary': '共 {count} 个任务，点击查看工具调用明细',
  'history.refresh': '刷新',
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

  'picker.switchModel': '切换供应商模型',
  'picker.selectModel': '选择模型',
  'picker.unnamed': '未命名供应商',

  'sidepanel.localDataFailed': '本地会话数据读取失败，可尝试重新打开侧边栏。',
  'sidepanel.granted': '已授权当前站点，请重新发送任务。',
  'sidepanel.grantDenied': '授权被拒绝，无法读取或操作当前页面。',
  'sidepanel.confirmClear': '确定清空当前对话吗？',
  'sidepanel.confirmDeleteSession': '删除当前会话及其任务记录？',
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

  'sidepanel.noProvider': 'No provider configured',
  'sidepanel.switchSession': 'Switch session',
  'sidepanel.newSession': 'New',
  'sidepanel.deleteSession': 'Delete',
  'sidepanel.clearChat': 'Clear',
  'sidepanel.files': 'Files',
  'sidepanel.filesHide': 'Hide files',
  'sidepanel.fileManagerTitle': 'Local files (readable and writable by the model)',
  'sidepanel.bindFile': 'Bind file',
  'sidepanel.noFiles':
    'No file bound yet. Once bound, the model can read and write it by file name.',
  'sidepanel.unbind': 'Unbind',
  'sidepanel.grantSite': 'Grant access to this site',
  'sidepanel.notAuthorized': 'This page is not authorized yet; cannot operate on it',
  'sidepanel.checkpointNotice':
    'The previous task was interrupted (round {rounds}). To avoid replaying side-effecting steps, please resend instead of resuming; old actions are not re-executed automatically.',
  'sidepanel.dismiss': 'Dismiss',
  'sidepanel.awaitingConfirmation': 'Awaiting confirmation: ',
  'sidepanel.run': 'Run',
  'sidepanel.deny': 'Deny',
  'sidepanel.noProviderTitle': 'No model provider configured',
  'sidepanel.openSettings': 'Open settings',
  'sidepanel.emptyChat': 'Type a question to start the conversation.',
  'sidepanel.tasks': 'Tasks',
  'sidepanel.backToChat': 'Back to chat',
  'sidepanel.noSession': 'No session selected',
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
  'providerForm.supportsStreaming': 'Supports streaming',
  'providerForm.supportsToolCalls': 'Supports tool calls',
  'providerForm.saving': 'Saving…',
  'providerForm.test': 'Test connection',
  'providerForm.testing': 'Testing…',
  'providerForm.errName': 'Enter a provider name',
  'providerForm.errBaseUrl': 'Enter a Base URL',
  'providerForm.errApiKey': 'Enter an API Key',
  'providerForm.errModel': 'Enter a Model',
  'providerForm.errPermission': 'No permission for {origin}; cannot test the connection',
  'providerForm.testResult': '{message} · took {ms}ms',

  'task.statusRunning': 'Running',
  'task.statusCompleted': 'Completed',
  'task.statusFailed': 'Failed',
  'task.statusCancelled': 'Cancelled',
  'task.statusInterrupted': 'Interrupted',

  'history.summary': '{count} tasks — click one to see its tool calls',
  'history.refresh': 'Refresh',
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

  'picker.switchModel': 'Switch provider model',
  'picker.selectModel': 'Select model',
  'picker.unnamed': 'Unnamed provider',

  'sidepanel.localDataFailed':
    'Failed to read local session data. Try reopening the side panel.',
  'sidepanel.granted': 'Site access granted — please resend the task.',
  'sidepanel.grantDenied': 'Permission denied; the page cannot be read or operated on.',
  'sidepanel.confirmClear': 'Clear the current conversation?',
  'sidepanel.confirmDeleteSession': 'Delete this session and its task records?',
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
