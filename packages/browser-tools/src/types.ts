// 页面动作协议：Side Panel 与 Service Worker / Content Script 之间的唯一约定
// 该包不直接调用 chrome API，传输层由宿主（Chrome 扩展）注入，便于测试与复用

import type { ToolErrorCode } from 'agent-core'

export type BrowserAction =
  | 'get_active_tab'
  | 'get_page_snapshot'
  | 'find_elements'
  | 'click_element'
  | 'fill_input'
  | 'scroll_page'
  | 'wait_for_element'
  | 'verify_action'
  | 'navigate_tab'
  | 'select_option'

export interface BrowserToolRequest {
  action: BrowserAction
  args: Record<string, unknown>
  /** 任务绑定的标签页；缺省时由 Service Worker 解析当前活动标签页 */
  tabId?: number
}

export type BrowserToolResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ToolErrorCode; message: string } }

export interface BrowserToolTransport {
  send<T = unknown>(request: BrowserToolRequest): Promise<BrowserToolResponse<T>>
}

export interface ActiveTabInfo {
  tabId: number
  title: string
  url: string
}

/** 页面元素的稳定引用：仅本次页面快照内有效，页面导航后必然失效 */
export interface ElementSummary {
  ref: string
  tag: string
  role: string
  name: string
  text?: string
  type?: string
  href?: string
  disabled?: boolean
}

export interface PageSnapshot {
  url: string
  title: string
  text: string
  textTruncated: boolean
  elements: ElementSummary[]
  elementCount: number
  elementsTruncated: boolean
  scroll: {
    y: number
    height: number
    viewportHeight: number
  }
}

export interface FindElementsResult {
  matches: ElementSummary[]
  total: number
}

export interface ClickResult {
  ref: string
  tag: string
  name: string
  url: string
  title: string
}

export interface FillResult {
  ref: string
  tag: string
  name: string
  valueLength: number
  submitted: boolean
}

export interface ScrollResult {
  y: number
  height: number
  viewportHeight: number
}

export interface WaitResult {
  element: ElementSummary
}

export interface VerifyResult {
  url: string
  title: string
  matched: string[]
}

export interface NavigateResult {
  tabId: number
  url: string
  title: string
}

export interface SelectResult {
  ref: string
  tag: string
  name: string
  selectedValue: string
  selectedLabel: string
  optionCount: number
  url: string
}
