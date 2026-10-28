// 浏览器工具传输层：Side Panel 通过 chrome.runtime.sendMessage 请求 Service Worker
// 真正的权限校验、Content Script 注入与标签页解析都在 Service Worker 完成

import type {
  BrowserToolRequest,
  BrowserToolResponse,
  BrowserToolTransport,
} from 'browser-tools'
import { BROWSER_ACTION_MESSAGE_TYPES } from './index'

export function createBrowserTransport(
  initialTabId?: number,
  onTabChange?: (tabId: number | undefined) => void,
): BrowserToolTransport {
  // 任务绑定页可变：list/new/switch/close_tab 之后后续调用自动使用新绑定
  let currentTabId = initialTabId

  return {
    async send<T>(request: BrowserToolRequest): Promise<BrowserToolResponse<T>> {
      const type = BROWSER_ACTION_MESSAGE_TYPES[request.action]
      try {
        const response: unknown = await chrome.runtime.sendMessage({
          type,
          payload: {
            args: request.args,
            tabId: request.tabId ?? currentTabId,
          },
        })
        if (!isBrowserToolResponse(response)) {
          return {
            ok: false,
            error: { code: 'execution_failed', message: '后台没有返回有效的工具结果' },
          }
        }
        return response as BrowserToolResponse<T>
      } catch (error) {
        return {
          ok: false,
          error: {
            code: 'execution_failed',
            message: `与后台通信失败：${describeError(error)}`,
          },
        }
      }
    },
    setTabId(tabId: number | undefined): void {
      currentTabId = tabId
      onTabChange?.(tabId)
    },
  }
}

function isBrowserToolResponse(value: unknown): value is BrowserToolResponse<unknown> {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (record.ok === true) return 'data' in record
  if (record.ok === false) {
    const error = record.error
    return (
      Boolean(error) &&
      typeof error === 'object' &&
      typeof (error as Record<string, unknown>).code === 'string' &&
      typeof (error as Record<string, unknown>).message === 'string'
    )
  }
  return false
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
