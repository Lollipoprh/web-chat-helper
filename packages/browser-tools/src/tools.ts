// 浏览器工具工厂
// 只描述工具语义与参数，实际 DOM 操作通过 BrowserToolTransport 交给扩展执行
// 所有工具都基于 ref 或即时查询，不保存 DOM 节点引用

import type { AgentTool, JsonSchema, ToolResult } from 'agent-core'
import type {
  ActiveTabInfo,
  BrowserAction,
  BrowserToolResponse,
  BrowserToolTransport,
  ClickResult,
  CloseTabResult,
  FillResult,
  FindElementsResult,
  NavigateResult,
  PageSnapshot,
  ScrollResult,
  SelectResult,
  SwitchTabResult,
  TabOpenResult,
  TabsListResult,
  VerifyResult,
  WaitResult,
} from './types'

const EMPTY_PARAMS: JsonSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

export function createBrowserTools(transport: BrowserToolTransport): AgentTool[] {
  // 任务绑定的标签页由传输层维护；标签页管理工具切换绑定后，后续调用自动跟随
  const send = <T>(action: BrowserAction, args: Record<string, unknown>) =>
    transport.send<T>({ action, args })
  const bindTab = (tabId: number | undefined) => transport.setTabId?.(tabId)

  return [
    {
      name: 'get_active_tab',
      description:
        'Return the browser tab this task is bound to: tabId, title and URL. Call it when you need to confirm which page you are working on.',
      parameters: EMPTY_PARAMS,
      readOnly: true,
      async execute(): Promise<ToolResult> {
        const response = await send<ActiveTabInfo>('get_active_tab', {})
        return toResult(response, (data) => `目标标签页：${data.title || '(无标题)'}（${data.url}）`)
      },
    },
    {
      name: 'get_page_snapshot',
      description:
        'Read the current page: title, URL, visible main text (truncated) and a limited list of interactive elements. Each element has a ref that click_element and fill_input require. Call this first, and again after the page has changed.',
      parameters: EMPTY_PARAMS,
      readOnly: true,
      async execute(): Promise<ToolResult> {
        const response = await send<PageSnapshot>('get_page_snapshot', {})
        return toResult(
          response,
          (data) =>
            `页面「${data.title || '(无标题)'}」，正文 ${data.text.length} 字，可交互元素 ${data.elementCount} 个${data.elementsTruncated ? '（列表已截断）' : ''}`,
        )
      },
    },
    {
      name: 'find_elements',
      description:
        'Find elements on the current page by text, CSS selector, tag name, ARIA role or accessible label. Returns every match (bounded by limit) with a ref. When more than one element matches, inspect them and choose deliberately; never assume the first result is correct.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Case-insensitive text to look for' },
          selector: { type: 'string', description: 'CSS selector, e.g. input[type="search"]' },
          tag_name: { type: 'string', description: 'HTML tag name, e.g. button' },
          role: { type: 'string', description: 'ARIA role, e.g. button, link, searchbox' },
          label: { type: 'string', description: 'Accessible name / label text' },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
            description: 'Maximum number of matches to return (default 10)',
          },
        },
        additionalProperties: false,
      },
      readOnly: true,
      async execute(args): Promise<ToolResult> {
        const response = await send<FindElementsResult>('find_elements', args)
        return toResult(
          response,
          (data) =>
            data.total === 0
              ? '未找到匹配元素'
              : `找到 ${data.total} 个匹配元素，返回了 ${data.matches.length} 个`,
        )
      },
    },
    {
      name: 'click_element',
      description:
        'Click one element by its ref from get_page_snapshot or find_elements. The element is re-located and validated before clicking; stale refs fail instead of clicking the wrong node. Use verify_action afterwards to confirm the expected page change.',
      parameters: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'Element ref, e.g. ref-12' },
        },
        required: ['ref'],
        additionalProperties: false,
      },
      requiresConfirmation: true,
      async execute(args): Promise<ToolResult> {
        const response = await send<ClickResult>('click_element', args)
        return toResult(
          response,
          (data) => `已点击 ${data.tag}「${data.name || data.ref}」，当前地址：${data.url}`,
        )
      },
    },
    {
      name: 'fill_input',
      description:
        'Type text into an input, textarea, select or contenteditable element by ref. Input and change events are dispatched so framework-controlled fields update. Password and sensitive fields are refused. Set submit=true to submit the surrounding form, or press Enter when the element has no form.',
      parameters: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'Element ref of the field' },
          text: { type: 'string', description: 'Text to type' },
          submit: {
            type: 'boolean',
            description: 'Submit after typing (default false)',
          },
        },
        required: ['ref', 'text'],
        additionalProperties: false,
      },
      requiresConfirmation: true,
      async execute(args): Promise<ToolResult> {
        const response = await send<FillResult>('fill_input', args)
        return toResult(
          response,
          (data) =>
            `已向 ${data.tag}「${data.name || data.ref}」填写 ${data.valueLength} 个字符${data.submitted ? '并提交' : ''}`,
        )
      },
    },
    {
      name: 'scroll_page',
      description:
        'Scroll the page. direction is down/up/top/bottom; amount is an optional pixel distance (default one viewport).',
      parameters: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['down', 'up', 'top', 'bottom'] },
          amount: { type: 'integer', minimum: 50, maximum: 5000 },
        },
        required: ['direction'],
        additionalProperties: false,
      },
      readOnly: true,
      async execute(args): Promise<ToolResult> {
        const response = await send<ScrollResult>('scroll_page', args)
        return toResult(
          response,
          (data) =>
            `已滚动到 ${Math.round(data.y)}px（页面总高 ${Math.round(data.height)}px，视口 ${data.viewportHeight}px）`,
        )
      },
    },
    {
      name: 'wait_for_element',
      description:
        'Wait until an element matching text or a CSS selector appears (default 8s, max 15s). Returns the element ref. Use it after navigation or asynchronous updates instead of polling manually.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Case-insensitive text to wait for' },
          selector: { type: 'string', description: 'CSS selector to wait for' },
          timeout_ms: { type: 'integer', minimum: 500, maximum: 15000 },
        },
        additionalProperties: false,
      },
      readOnly: true,
      async execute(args): Promise<ToolResult> {
        const response = await send<WaitResult>('wait_for_element', args)
        return toResult(
          response,
          (data) => `已找到 ${data.element.tag}「${data.element.name || data.element.ref}」`,
        )
      },
    },
    {
      name: 'verify_action',
      description:
        'Wait until the page satisfies the given expectations (visible text, CSS selector and/or URL fragment), then return evidence. Use it after click/fill/submit. A failed verification returns an error instead of pretending the action succeeded.',
      parameters: {
        type: 'object',
        properties: {
          expect_text: { type: 'string', description: 'Text that should appear on the page' },
          expect_selector: { type: 'string', description: 'CSS selector that should exist' },
          expect_url_contains: { type: 'string', description: 'Fragment that the URL should contain' },
          timeout_ms: { type: 'integer', minimum: 200, maximum: 15000 },
        },
        additionalProperties: false,
      },
      readOnly: true,
      async execute(args): Promise<ToolResult> {
        const response = await send<VerifyResult>('verify_action', args)
        return toResult(
          response,
          (data) => `已验证：${data.matched.join('、')}；当前地址 ${data.url}`,
        )
      },
    },
    {
      name: 'navigate_tab',
      description:
        'Load an absolute http(s) URL in the task tab and wait until it finishes loading. Use it to open a site you cannot reach by clicking a link. The destination site needs its own host permission: if the next tool returns not_authorized, ask the user to grant the site from the side panel.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Absolute http:// or https:// URL' },
          wait_for_load: {
            type: 'boolean',
            description: 'Wait until the page finishes loading (default true)',
          },
        },
        required: ['url'],
        additionalProperties: false,
      },
      requiresConfirmation: true,
      async execute(args): Promise<ToolResult> {
        const response = await send<NavigateResult>('navigate_tab', args)
        return toResult(
          response,
          (data) => `已打开「${data.title || '(无标题)'}」（${data.url}）`,
        )
      },
    },
    {
      name: 'list_tabs',
      description:
        'List the tabs in the same window as the task tab, with tabId, title, URL and which one is active. Call it before switch_tab or close_tab so you target a real tab instead of guessing.',
      parameters: EMPTY_PARAMS,
      readOnly: true,
      async execute(): Promise<ToolResult> {
        const response = await send<TabsListResult>('list_tabs', {})
        return toResult(
          response,
          (data) =>
            `当前窗口共 ${data.total} 个标签页${data.truncated ? `（仅返回前 ${data.tabs.length} 个）` : ''}`,
        )
      },
    },
    {
      name: 'new_tab',
      description:
        'Open a new tab in the same window. Omit url to open a blank tab, or pass an absolute http(s) URL. With active=true (default) the task binding moves to the new tab, so later page tools act on it; with active=false the current binding is kept.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Absolute http:// or https:// URL (optional)' },
          active: {
            type: 'boolean',
            description: 'Activate the new tab and bind the task to it (default true)',
          },
        },
        additionalProperties: false,
      },
      requiresConfirmation: true,
      async execute(args): Promise<ToolResult> {
        const response = await send<TabOpenResult>('new_tab', args)
        if (response.ok && response.data.active) bindTab(response.data.tabId)
        return toResult(
          response,
          (data) =>
            `已新建标签页「${data.title || '(无标题)'}」（${data.url || '空白页'}）${data.active ? '，任务已切换至该页' : '，任务仍绑定原标签页'}`,
        )
      },
    },
    {
      name: 'switch_tab',
      description:
        'Switch the browser to another tab in the same window and bind the task to it, so later page tools act on that tab. Use list_tabs first to get the tabId. The target site still needs host permission; unapproved sites return not_authorized.',
      parameters: {
        type: 'object',
        properties: {
          tab_id: { type: 'integer', minimum: 0, description: 'tabId from list_tabs' },
        },
        required: ['tab_id'],
        additionalProperties: false,
      },
      requiresConfirmation: true,
      async execute(args): Promise<ToolResult> {
        const response = await send<SwitchTabResult>('switch_tab', args)
        if (response.ok) bindTab(response.data.tabId)
        return toResult(
          response,
          (data) => `已切换到标签页「${data.title || '(无标题)'}」（${data.url}），后续操作都在该页执行`,
        )
      },
    },
    {
      name: 'close_tab',
      description:
        'Close another tab in the same window by tabId from list_tabs. The task-bound tab cannot be closed because that would close the side panel and abort the task: switch_tab to another tab first, then close the old one. The last tab of a window cannot be closed either.',
      parameters: {
        type: 'object',
        properties: {
          tab_id: {
            type: 'integer',
            minimum: 0,
            description: 'tabId from list_tabs; must not be the task-bound tab',
          },
        },
        required: ['tab_id'],
        additionalProperties: false,
      },
      requiresConfirmation: true,
      async execute(args): Promise<ToolResult> {
        const response = await send<CloseTabResult>('close_tab', args)
        return toResult(response, (data) => `已关闭标签页 #${data.closedTabId}`)
      },
    },
    {
      name: 'select_option',
      description:
        'Choose an option in a native <select> element by value, visible label or zero-based index. Get the select ref from get_page_snapshot or find_elements first. For custom dropdown widgets, use click_element instead.',
      parameters: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'Element ref of the <select> element' },
          value: { type: 'string', description: 'Option value attribute to select' },
          label: { type: 'string', description: 'Visible option text to select' },
          index: {
            type: 'integer',
            minimum: 0,
            description: 'Zero-based option index to select',
          },
        },
        required: ['ref'],
        additionalProperties: false,
      },
      requiresConfirmation: true,
      async execute(args): Promise<ToolResult> {
        if (args.value === undefined && args.label === undefined && args.index === undefined) {
          return {
            ok: false,
            code: 'invalid_args',
            message: '必须提供 value、label 或 index 之一来指定选项',
          }
        }

        const response = await send<SelectResult>('select_option', args)
        return toResult(
          response,
          (data) =>
            `已在 ${data.tag}「${data.name || data.ref}」选中「${data.selectedLabel}」（value=${data.selectedValue}，共 ${data.optionCount} 项）`,
        )
      },
    },
  ]
}

function toResult<T>(
  response: BrowserToolResponse<T>,
  describe: (data: T) => string,
): ToolResult {
  if (!response.ok) {
    return { ok: false, code: response.error.code, message: response.error.message }
  }
  return { ok: true, data: response.data, message: describe(response.data) }
}
