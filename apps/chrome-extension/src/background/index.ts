// Service Worker（后台脚本）——Manifest V3 扩展的核心后台进程
// 职责：标签页管理、权限校验、Content Script 注入、消息路由
// 注意：Service Worker 是事件驱动的，Chrome 会在 30 秒无事件后挂起它
//       不能在此运行长循环；Agent Loop 跑在 Side Panel

import type { ToolErrorCode } from 'agent-core'
import type { ActiveTabInfo, BrowserAction, BrowserToolResponse } from 'browser-tools'
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
