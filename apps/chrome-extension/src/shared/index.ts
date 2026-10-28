// 扩展内部共享类型和常量
// 跨模块引用：Side Panel / Background / Content Script 都可以从这里导入

import type { BrowserAction } from 'browser-tools'

// Agent 任务状态枚举（阶段 6 完善生命周期管理）
export type TaskStatus =
  | 'idle'
  | 'running'
  | 'waiting_for_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted'

// 扩展内部消息类型（Service Worker 消息路由协议）
export interface ExtensionMessage {
  type: string
  payload?: unknown
}

// 消息类型常量
export const MESSAGE_TYPES = {
  // Browser Tools 消息（Side Panel -> Service Worker -> Content Script）
  GET_ACTIVE_TAB: 'browser-tools:get_active_tab',
  GET_PAGE_SNAPSHOT: 'browser-tools:get_page_snapshot',
  FIND_ELEMENTS: 'browser-tools:find_elements',
  CLICK_ELEMENT: 'browser-tools:click_element',
  FILL_INPUT: 'browser-tools:fill_input',
  SCROLL_PAGE: 'browser-tools:scroll_page',
  WAIT_FOR_ELEMENT: 'browser-tools:wait_for_element',
  VERIFY_ACTION: 'browser-tools:verify_action',
  NAVIGATE_TAB: 'browser-tools:navigate_tab',
  SELECT_OPTION: 'browser-tools:select_option',
  LIST_TABS: 'browser-tools:list_tabs',
  NEW_TAB: 'browser-tools:new_tab',
  SWITCH_TAB: 'browser-tools:switch_tab',
  CLOSE_TAB: 'browser-tools:close_tab',
  /** Service Worker 探测标签页里是否已有可用的 Content Script */
  PING: 'browser-tools:ping',

  // 权限消息
  REQUEST_HOST_PERMISSION: 'permissions:request_host',

  // 配置消息
  GET_PROVIDER_CONFIG: 'config:get_provider',
  SAVE_PROVIDER_CONFIG: 'config:save_provider',
} as const

/** 工具动作 -> 消息类型，避免在两处硬编码字符串 */
export const BROWSER_ACTION_MESSAGE_TYPES: Record<BrowserAction, string> = {
  get_active_tab: MESSAGE_TYPES.GET_ACTIVE_TAB,
  get_page_snapshot: MESSAGE_TYPES.GET_PAGE_SNAPSHOT,
  find_elements: MESSAGE_TYPES.FIND_ELEMENTS,
  click_element: MESSAGE_TYPES.CLICK_ELEMENT,
  fill_input: MESSAGE_TYPES.FILL_INPUT,
  scroll_page: MESSAGE_TYPES.SCROLL_PAGE,
  wait_for_element: MESSAGE_TYPES.WAIT_FOR_ELEMENT,
  verify_action: MESSAGE_TYPES.VERIFY_ACTION,
  navigate_tab: MESSAGE_TYPES.NAVIGATE_TAB,
  select_option: MESSAGE_TYPES.SELECT_OPTION,
  list_tabs: MESSAGE_TYPES.LIST_TABS,
  new_tab: MESSAGE_TYPES.NEW_TAB,
  switch_tab: MESSAGE_TYPES.SWITCH_TAB,
  close_tab: MESSAGE_TYPES.CLOSE_TAB,
}
