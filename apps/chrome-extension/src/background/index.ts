// Service Worker（后台脚本）——Manifest V3 扩展的核心后台进程
// 职责：标签页管理、权限校验、Content Script 注入、消息路由
// 注意：Service Worker 是事件驱动的，Chrome 会在 30 秒无事件后挂起它
//       不能在此运行长循环；Agent Loop 跑在 Side Panel

import type { ToolErrorCode } from 'agent-core'
import type {
  ActiveTabInfo,
  BrowserAction,
  BrowserToolResponse,
  CloseTabResult,
  NavigateResult,
  SwitchTabResult,
  TabOpenResult,
  TabsListResult,
  TabSummary,
} from 'browser-tools'
import { BROWSER_ACTION_MESSAGE_TYPES, MESSAGE_TYPES } from '../shared/index'
import { originPatternFromUrl } from '../shared/permissions'

// 阶段 1：点击工具栏图标时，打开当前活动标签页的 Side Panel
// Side Panel 需要 Chrome 114+，且需要 sidePanel 权限
// chrome://、chrome-extension:// 等受保护页面无法注入 Content Script，
// 也无法可靠地绑定 Side Panel 到 tabId，直接跳过
chrome.action.onClicked.addListener(async (tab) => {
  try {
    const canBindTab =
      tab.id !== undefined &&
      tab.url &&
      !tab.url.startsWith('chrome://') &&
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('chrome-remote-desktop://') &&
      !tab.url.startsWith('edge://')

    if (canBindTab) {
      await chrome.sidePanel.open({ tabId: tab.id! })
    } else {
      console.warn(
        '[background] 当前页面不支持绑定 Side Panel:',
        tab.url ?? '(未知 URL)',
      )
    }
  } catch (error) {
    console.error('[background] 打开 Side Panel 失败:', error)
  }
})

// ---------------------------------------------------------------------------
// Browser Tools 消息路由
// Side Panel -> Service Worker（权限/注入/标签页）-> Content Script（DOM 操作）
// ---------------------------------------------------------------------------

const ACTION_BY_MESSAGE_TYPE: Record<string, BrowserAction> = {}
for (const [action, type] of Object.entries(BROWSER_ACTION_MESSAGE_TYPES)) {
  ACTION_BY_MESSAGE_TYPE[type] = action as BrowserAction
}

const RESTRICTED_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'chrome-search://',
  'chrome-untrusted://',
  'devtools://',
  'edge://',
  'about:',
  'view-source:',
  'file://',
]

const RESTRICTED_HOSTS = new Set(['chrome.google.com', 'chromewebstore.google.com'])

const TOOL_ERROR_CODES: readonly string[] = [
  'unknown_tool',
  'invalid_json',
  'invalid_args',
  'duplicate_call',
  'timeout',
  'cancelled',
  'not_authorized',
  'unsupported_page',
  'element_not_found',
  'stale_element',
  'execution_failed',
  'needs_confirmation',
] satisfies ToolErrorCode[]

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isPlainObject(message) || typeof message.type !== 'string') return undefined

  const action = ACTION_BY_MESSAGE_TYPE[message.type]
  if (!action) return undefined

  // 只接受扩展页面（Side Panel / 设置页）的请求：
  // 网页里的 Content Script 不能自行发起浏览器工具调用，避免网页提升权限
  if (sender.id !== chrome.runtime.id || sender.tab) return undefined

  const payload = isPlainObject(message.payload) ? message.payload : {}
  const args = isPlainObject(payload.args) ? payload.args : {}
  const tabId = typeof payload.tabId === 'number' ? payload.tabId : undefined

  void handleAction(action, args, tabId).then(sendResponse)
  return true
})

async function handleAction(
  action: BrowserAction,
  args: Record<string, unknown>,
  tabId: number | undefined,
): Promise<BrowserToolResponse<unknown>> {
  // 标签页管理动作由 Service Worker 直接执行：不读取页面内容，也不要求站点授权。
  // 放在 resolveTab 之前，保证绑定页被关闭后仍能新建/切换到可用标签页。
  if (action === 'list_tabs') return listTabs(tabId)
  if (action === 'new_tab') return createTab(tabId, args)
  if (action === 'switch_tab') return switchTab(tabId, args)
  if (action === 'close_tab') return closeTab(tabId, args)

  let tab: chrome.tabs.Tab
  try {
    tab = await resolveTab(tabId)
  } catch (error) {
    return fail('execution_failed', `无法确定目标标签页：${describeError(error)}`)
  }

  if (action === 'get_active_tab') {
    const info: ActiveTabInfo = {
      tabId: tab.id ?? -1,
      title: tab.title ?? '',
      url: tab.url ?? '',
    }
    return { ok: true, data: info }
  }

  // 导航直接由 Service Worker 执行：不读取页面内容，因此不做当前站点权限校验；
  // 目标站点仍需单独授权，后续工具会返回 not_authorized 提示用户授权
  if (action === 'navigate_tab') {
    return navigateTab(tab, args)
  }

  const targetTabId = tab.id
  if (targetTabId === undefined) return fail('execution_failed', '目标标签页不可用')

  const url = tab.url ?? ''
  if (isRestrictedUrl(url)) {
    return fail('unsupported_page', `当前页面（${url || '未知地址'}）是受保护页面，无法读取或操作`)
  }

  const originPattern = originPatternFromUrl(url)
  if (!originPattern) {
    return fail('unsupported_page', `当前页面地址不受支持：${url || '(未知)'}`)
  }

  // 站点权限必须在用户手势中申请；这里只做校验，不触发弹窗
  let granted: boolean
  try {
    granted = await chrome.permissions.contains({ origins: [originPattern] })
  } catch (error) {
    return fail('execution_failed', `权限校验失败：${describeError(error)}`)
  }
  if (!granted) {
    return fail(
      'not_authorized',
      `尚未获得 ${originPattern} 的网页访问权限。请在侧边栏点击「授权当前站点」，然后重新发送任务`,
    )
  }

  try {
    await ensureContentScript(targetTabId)
  } catch (error) {
    return fail(
      'unsupported_page',
      `无法在当前页面注入脚本：${describeError(error)}。请确认页面已加载完成后重试`,
    )
  }

  let response: unknown
  try {
    response = await chrome.tabs.sendMessage(targetTabId, {
      type: BROWSER_ACTION_MESSAGE_TYPES[action],
      payload: { args },
    })
  } catch (error) {
    return fail('execution_failed', `页面脚本没有响应：${describeError(error)}`)
  }

  return normalizeContentResponse(response)
}

const NAVIGATE_TIMEOUT_MS = 20_000
const NAVIGATE_POLL_MS = 300

/**
 * 在任务标签页里打开一个绝对 http(s) 地址。
 * 只做导航，不读取页面内容；失败与超时都必须如实返回，不能把「已发出导航」当成「页面已就绪」。
 */
async function navigateTab(
  tab: chrome.tabs.Tab,
  args: Record<string, unknown>,
): Promise<BrowserToolResponse<NavigateResult>> {
  const tabId = tab.id
  if (tabId === undefined) return fail('execution_failed', '目标标签页不可用')

  const rawUrl = args.url
  const input = typeof rawUrl === 'string' ? rawUrl.trim() : ''
  if (!input) return fail('invalid_args', '缺少参数 url')

  let target: URL
  try {
    target = new URL(input)
  } catch {
    return fail('invalid_args', `url 不是合法的绝对地址：${input}`)
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return fail('invalid_args', `只支持 http 或 https 地址，收到 ${target.protocol}`)
  }

  try {
    await chrome.tabs.update(tabId, { url: target.href })
  } catch (error) {
    return fail('execution_failed', `导航失败：${describeError(error)}`)
  }

  if (args.wait_for_load === false) {
    return { ok: true, data: { tabId, url: target.href, title: '' } }
  }

  const loaded = await waitForTabComplete(tabId, NAVIGATE_TIMEOUT_MS)
  if (!loaded) {
    return fail(
      'timeout',
      `页面在 ${Math.round(NAVIGATE_TIMEOUT_MS / 1000)} 秒内未完成加载，请用 wait_for_element 或 verify_action 确认当前状态`,
    )
  }

  try {
    const updated = await chrome.tabs.get(tabId)
    return {
      ok: true,
      data: { tabId, url: updated.url ?? target.href, title: updated.title ?? '' },
    }
  } catch (error) {
    return fail('execution_failed', `读取标签页状态失败：${describeError(error)}`)
  }
}

/** 轮询等待标签页进入 complete 状态 */
async function waitForTabComplete(tabId: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const current = await chrome.tabs.get(tabId)
      if (current.status === 'complete') return true
    } catch {
      return false
    }
    await new Promise((resolve) => setTimeout(resolve, NAVIGATE_POLL_MS))
  }
  return false
}

const MAX_LISTED_TABS = 30

/**
 * 解析任务标签页；绑定页已被关闭时回退到当前窗口的活动标签页，
 * 让模型仍能通过标签页管理工具恢复工作。
 */
async function resolveTaskTab(tabId: number | undefined): Promise<chrome.tabs.Tab | undefined> {
  if (tabId !== undefined) {
    try {
      return await chrome.tabs.get(tabId)
    } catch {
      // 绑定页已关闭，继续尝试活动标签页
    }
  }
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  return tab
}

async function listTabs(
  taskTabId: number | undefined,
): Promise<BrowserToolResponse<TabsListResult>> {
  const taskTab = await resolveTaskTab(taskTabId)
  if (!taskTab) return fail('execution_failed', '没有可用的标签页')

  try {
    const tabs = await chrome.tabs.query({ windowId: taskTab.windowId })
    const withId = tabs.filter(
      (tab): tab is chrome.tabs.Tab & { id: number } => tab.id !== undefined,
    )
    const summaries: TabSummary[] = withId.slice(0, MAX_LISTED_TABS).map((tab) => ({
      tabId: tab.id,
      title: tab.title ?? '',
      url: tab.url ?? tab.pendingUrl ?? '',
      active: tab.active === true,
    }))
    return {
      ok: true,
      data: {
        tabs: summaries,
        total: withId.length,
        truncated: withId.length > summaries.length,
      },
    }
  } catch (error) {
    return fail('execution_failed', `读取标签页列表失败：${describeError(error)}`)
  }
}

/**
 * 在任务所在窗口新建标签页。
 * active=true（默认）时新页成为绑定页；只创建不读页面，因此不需要站点授权。
 */
async function createTab(
  taskTabId: number | undefined,
  args: Record<string, unknown>,
): Promise<BrowserToolResponse<TabOpenResult>> {
  let url: string | undefined
  if (args.url !== undefined) {
    const rawUrl = typeof args.url === 'string' ? args.url.trim() : ''
    if (!rawUrl) return fail('invalid_args', 'url 必须是非空字符串，或直接省略')
    let target: URL
    try {
      target = new URL(rawUrl)
    } catch {
      return fail('invalid_args', `url 不是合法的绝对地址：${rawUrl}`)
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      return fail('invalid_args', `只支持 http 或 https 地址，收到 ${target.protocol}`)
    }
    url = target.href
  }

  if (args.active !== undefined && typeof args.active !== 'boolean') {
    return fail('invalid_args', 'active 必须是布尔值')
  }
  const active = args.active !== false

  let windowId: number | undefined
  if (taskTabId !== undefined) {
    try {
      windowId = (await chrome.tabs.get(taskTabId)).windowId
    } catch {
      // 绑定页已关闭时退回当前窗口
    }
  }

  let created: chrome.tabs.Tab
  try {
    created = await chrome.tabs.create({ windowId, url, active })
  } catch (error) {
    return fail('execution_failed', `新建标签页失败：${describeError(error)}`)
  }

  const createdId = created.id
  if (createdId === undefined) return fail('execution_failed', '新标签页没有可用的 tabId')

  if (url && args.wait_for_load !== false) {
    const loaded = await waitForTabComplete(createdId, NAVIGATE_TIMEOUT_MS)
    if (!loaded) {
      return fail(
        'timeout',
        `新标签页在 ${Math.round(NAVIGATE_TIMEOUT_MS / 1000)} 秒内未完成加载，请用 wait_for_element 确认当前状态`,
      )
    }
  }

  let current = created
  try {
    current = await chrome.tabs.get(createdId)
  } catch {
    // 保持创建时返回的快照
  }

  return {
    ok: true,
    data: {
      tabId: createdId,
      url: current.url ?? current.pendingUrl ?? url ?? '',
      title: current.title ?? '',
      active,
    },
  }
}

/** 切换到同窗口的另一个标签页，后续页面工具在调用方重新绑定后作用于该页 */
async function switchTab(
  taskTabId: number | undefined,
  args: Record<string, unknown>,
): Promise<BrowserToolResponse<SwitchTabResult>> {
  const tabId = args.tab_id
  if (typeof tabId !== 'number' || !Number.isInteger(tabId) || tabId < 0) {
    return fail('invalid_args', '缺少合法的 tab_id')
  }

  let target: chrome.tabs.Tab
  try {
    target = await chrome.tabs.get(tabId)
  } catch (error) {
    return fail('execution_failed', `标签页 #${tabId} 不存在或已关闭：${describeError(error)}`)
  }

  const taskTab = await resolveTaskTab(taskTabId)
  if (taskTab && target.windowId !== taskTab.windowId) {
    return fail('invalid_args', '只能切换到当前任务所在窗口的标签页')
  }

  try {
    await chrome.tabs.update(tabId, { active: true })
  } catch (error) {
    return fail('execution_failed', `切换标签页失败：${describeError(error)}`)
  }

  try {
    const updated = await chrome.tabs.get(tabId)
    return {
      ok: true,
      data: {
        tabId,
        url: updated.url ?? updated.pendingUrl ?? '',
        title: updated.title ?? '',
      },
    }
  } catch (error) {
    return fail('execution_failed', `读取标签页状态失败：${describeError(error)}`)
  }
}

/**
 * 关闭同窗口内的另一个标签页。
 * 任务绑定页不允许关闭——侧边栏挂在该页上，关闭会中断任务；
 * 窗口里最后一个标签页也不允许关闭，避免直接销毁用户窗口。
 */
async function closeTab(
  taskTabId: number | undefined,
  args: Record<string, unknown>,
): Promise<BrowserToolResponse<CloseTabResult>> {
  const tabId = args.tab_id
  if (typeof tabId !== 'number' || !Number.isInteger(tabId) || tabId < 0) {
    return fail('invalid_args', '缺少合法的 tab_id')
  }

  if (taskTabId !== undefined && tabId === taskTabId) {
    return fail(
      'invalid_args',
      '不能关闭任务绑定页（会关闭侧边栏并中断任务），请先用 switch_tab 绑定其他标签页',
    )
  }

  let target: chrome.tabs.Tab
  try {
    target = await chrome.tabs.get(tabId)
  } catch (error) {
    return fail('execution_failed', `标签页 #${tabId} 不存在或已关闭：${describeError(error)}`)
  }

  let taskTab: chrome.tabs.Tab | undefined
  if (taskTabId !== undefined) {
    try {
      taskTab = await chrome.tabs.get(taskTabId)
    } catch {
      // 绑定页已关闭时不再限制窗口
    }
  }
  if (taskTab && target.windowId !== taskTab.windowId) {
    return fail('invalid_args', '只能关闭当前任务所在窗口的标签页')
  }

  let tabsInWindow: chrome.tabs.Tab[]
  try {
    tabsInWindow = await chrome.tabs.query({ windowId: target.windowId })
  } catch (error) {
    return fail('execution_failed', `读取窗口标签页失败：${describeError(error)}`)
  }
  if (tabsInWindow.length <= 1) {
    return fail('invalid_args', '不能关闭窗口里的最后一个标签页')
  }

  try {
    await chrome.tabs.remove(tabId)
  } catch (error) {
    return fail('execution_failed', `关闭标签页失败：${describeError(error)}`)
  }

  return { ok: true, data: { closedTabId: tabId } }
}

async function resolveTab(tabId: number | undefined): Promise<chrome.tabs.Tab> {
  if (tabId !== undefined) return chrome.tabs.get(tabId)

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (!tab) throw new Error('没有活动的标签页')
  return tab
}

function isRestrictedUrl(url: string): boolean {
  if (!url) return true
  if (RESTRICTED_PREFIXES.some((prefix) => url.startsWith(prefix))) return true
  try {
    return RESTRICTED_HOSTS.has(new URL(url).hostname)
  } catch {
    return true
  }
}

/** 先探测已有脚本；没有则按需注入（manifest 中的 content_scripts 只用于产出构建文件） */
async function ensureContentScript(tabId: number): Promise<void> {
  if (await isContentScriptAlive(tabId)) return

  const files = chrome.runtime.getManifest().content_scripts?.[0]?.js ?? []
  if (files.length === 0) {
    throw new Error('未找到 Content Script 构建产物')
  }

  await chrome.scripting.executeScript({ target: { tabId }, files })

  // 构建产物是 loader + 动态 import 的 chunk，监听器要等模块加载完才注册
  if (!(await waitForContentScript(tabId, 1500))) {
    throw new Error('Content Script 注入后仍未响应')
  }
}

async function waitForContentScript(tabId: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isContentScriptAlive(tabId)) return true
    await new Promise<void>((resolve) => setTimeout(resolve, 50))
  }
  return false
}

async function isContentScriptAlive(tabId: number): Promise<boolean> {
  try {
    const response: unknown = await chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.PING })
    return isPlainObject(response) && response.ok === true
  } catch {
    return false
  }
}

function normalizeContentResponse(value: unknown): BrowserToolResponse<unknown> {
  if (!isPlainObject(value)) {
    return fail('execution_failed', '页面返回了无法识别的结果')
  }
  if (value.ok === true) {
    return { ok: true, data: value.data }
  }
  if (value.ok === false && isPlainObject(value.error)) {
    const code = value.error.code
    const message = value.error.message
    if (typeof code === 'string' && typeof message === 'string') {
      return {
        ok: false,
        error: {
          code: TOOL_ERROR_CODES.includes(code) ? (code as ToolErrorCode) : 'execution_failed',
          message,
        },
      }
    }
  }
  return fail('execution_failed', '页面返回了无法识别的结果')
}

function fail(code: ToolErrorCode, message: string): BrowserToolResponse<never> {
  return { ok: false, error: { code, message } }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
