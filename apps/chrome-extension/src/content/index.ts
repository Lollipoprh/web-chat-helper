// Content Script：注入到网页中的脚本
// 职责：读取页面摘要、定位元素、执行点击/输入/滚动等 DOM 操作
// 运行在 Chrome isolated world，与网页 JS 隔离，无 API Key 访问权限
//
// 关键约束：
//   - 不持久化 DOM 节点引用：ref 只在当前文档内有效，页面导航或节点移除后必须显式报错
//   - 不执行任意 JavaScript：只接受这里显式实现的动作
//   - 页面文本视为不可信数据，只用于描述元素，不影响任何工具权限

import type { ToolErrorCode } from 'agent-core'
import type {
  ClickResult,
  ElementSummary,
  FillResult,
  FindElementsResult,
  PageSnapshot,
  ScrollResult,
  SelectResult,
  VerifyResult,
  WaitResult,
} from 'browser-tools'
import { MESSAGE_TYPES } from '../shared/index'

const MAX_TEXT_CHARS = 8000
const MAX_ELEMENTS = 80
const MAX_REFS = 500
const MAX_MATCHES = 100

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="searchbox"]',
  '[role="textbox"]',
  '[role="combobox"]',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(',')

const SKIPPED_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'meta',
  'link',
  'head',
  'title',
  'html',
  'body',
])

class PageToolError extends Error {
  constructor(
    readonly code: ToolErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'PageToolError'
  }
}

// ---------------------------------------------------------------------------
// 元素引用：只保存弱引用语义的映射，节点失效后立即报错
// ---------------------------------------------------------------------------

let refSequence = 0
let refsByElement = new WeakMap<Element, string>()
const elementsByRef = new Map<string, Element>()

function resetRefs(): void {
  refsByElement = new WeakMap()
  elementsByRef.clear()
}

function getRef(element: Element): string {
  const existing = refsByElement.get(element)
  if (existing && elementsByRef.get(existing) === element) return existing

  if (elementsByRef.size >= MAX_REFS) resetRefs()

  refSequence += 1
  const ref = `ref-${refSequence}`
  elementsByRef.set(ref, element)
  refsByElement.set(element, ref)
  return ref
}

function resolveElement(ref: string): Element {
  const element = elementsByRef.get(ref)
  if (!element) {
    throw new PageToolError('stale_element', `元素引用 ${ref} 已失效，请重新获取页面快照或重新查找`)
  }
  if (!element.isConnected) {
    elementsByRef.delete(ref)
    throw new PageToolError('stale_element', `元素引用 ${ref} 对应的节点已从页面移除，请重新获取页面快照`)
  }
  return element
}

// ---------------------------------------------------------------------------
// 元素描述
// ---------------------------------------------------------------------------

function isVisible(element: Element): boolean {
  if (!element.isConnected) return false
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
}

function isSensitiveField(element: Element): boolean {
  if (!(element instanceof HTMLInputElement)) return false
  if (element.type === 'password' || element.type === 'hidden') return true

  const autocomplete = (element.getAttribute('autocomplete') ?? '').toLowerCase()
  if (
    autocomplete.startsWith('cc-') ||
    autocomplete === 'one-time-code' ||
    autocomplete.includes('password')
  ) {
    return true
  }

  const identity = `${element.name} ${element.id} ${element.getAttribute('placeholder') ?? ''}`
  return /password|passwd|passcode|one-time-code|\botp\b|验证码|密码/i.test(identity)
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function elementName(element: Element): string {
  const ariaLabel = element.getAttribute('aria-label')?.trim()
  if (ariaLabel) return ariaLabel

  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.innerText ?? '')
      .join(' ')
    if (text.trim()) return collapse(text)
  }

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    const label = element.labels?.[0]
    if (label?.innerText.trim()) return collapse(label.innerText)

    const placeholder = element.getAttribute('placeholder')
    if (placeholder?.trim()) return placeholder.trim()

    const title = element.getAttribute('title')
    if (title?.trim()) return title.trim()

    if (element instanceof HTMLInputElement) {
      if (element.type === 'submit') return element.value || '提交'
      if (element.type === 'button' || element.type === 'reset') return element.value || element.type
      return ''
    }
    return ''
  }

  const innerText = (element as HTMLElement).innerText ?? ''
  if (innerText.trim()) return collapse(innerText).slice(0, 120)

  const title = element.getAttribute('title')
  if (title?.trim()) return title.trim()

  const imageAlt = element.querySelector('img[alt]')?.getAttribute('alt')
  return imageAlt?.trim() ?? ''
}

function elementRole(element: Element): string {
  const explicit = element.getAttribute('role')
  if (explicit) return explicit

  const tag = element.tagName.toLowerCase()
  if (tag === 'a') return element instanceof HTMLAnchorElement && element.href ? 'link' : ''
  if (tag === 'button' || tag === 'summary') return 'button'
  if (tag === 'select') return 'combobox'
  if (tag === 'textarea') return 'textbox'
  if (tag === 'input' && element instanceof HTMLInputElement) {
    if (element.type === 'checkbox') return 'checkbox'
    if (element.type === 'radio') return 'radio'
    if (element.type === 'search') return 'searchbox'
    if (['button', 'submit', 'reset'].includes(element.type)) return 'button'
    if (element.type === 'hidden') return ''
    return 'textbox'
  }
  return ''
}

function describeElement(element: Element): ElementSummary {
  const tag = element.tagName.toLowerCase()
  const name = elementName(element)
  const summary: ElementSummary = {
    ref: getRef(element),
    tag,
    role: elementRole(element),
    name,
  }

  const innerText = collapse((element as HTMLElement).innerText ?? '').slice(0, 120)
  if (innerText && innerText !== name) summary.text = innerText

  if (element instanceof HTMLInputElement) summary.type = element.type
  if (element instanceof HTMLAnchorElement && element.href) {
    summary.href = element.href.slice(0, 200)
  }

  const disabled =
    ('disabled' in element && Boolean((element as HTMLButtonElement).disabled)) ||
    element.getAttribute('aria-disabled') === 'true'
  if (disabled) summary.disabled = true

  return summary
}

function isDisabled(element: Element): boolean {
  return (
    ('disabled' in element && Boolean((element as HTMLButtonElement).disabled)) ||
    element.getAttribute('aria-disabled') === 'true'
  )
}

// ---------------------------------------------------------------------------
// 页面读取
// ---------------------------------------------------------------------------

function readPageSnapshot(): PageSnapshot {
  const rawText = document.body?.innerText ?? ''
  const text = collapse(rawText)

  let elementCount = 0
  const elements: ElementSummary[] = []
  for (const element of document.querySelectorAll(INTERACTIVE_SELECTOR)) {
    if (isSensitiveField(element) || !isVisible(element)) continue
    elementCount += 1
    if (elements.length < MAX_ELEMENTS) elements.push(describeElement(element))
  }

  return {
    url: location.href,
    title: document.title,
    text: text.slice(0, MAX_TEXT_CHARS),
    textTruncated: text.length > MAX_TEXT_CHARS,
    elements,
    elementCount,
    elementsTruncated: elementCount > elements.length,
    scroll: {
      y: Math.round(window.scrollY),
      height: Math.round(document.documentElement.scrollHeight),
      viewportHeight: window.innerHeight,
    },
  }
}

interface SearchArgs {
  query?: string
  selector?: string
  tagName?: string
  role?: string
  label?: string
}

function searchElements(args: SearchArgs, maxMatches = MAX_MATCHES): Element[] {
  const { query, selector, tagName, role, label } = args
  if (!query && !selector && !tagName && !role && !label) {
    throw new PageToolError(
      'invalid_args',
      '至少提供 query、selector、tag_name、role、label 中的一个查找条件',
    )
  }

  let candidates: Element[]
  if (selector) {
    try {
      candidates = Array.from(document.querySelectorAll(selector))
    } catch {
      throw new PageToolError('invalid_args', `无效的 CSS 选择器：${selector}`)
    }
  } else if (tagName) {
    candidates = Array.from(document.getElementsByTagName(tagName))
  } else {
    candidates = Array.from(document.body?.querySelectorAll('*') ?? [])
  }

  const queryLower = query?.toLowerCase()
  const roleLower = role?.toLowerCase()
  const labelLower = label?.toLowerCase()
  const tagLower = tagName?.toLowerCase()

  const matches: Element[] = []
  for (const candidate of candidates) {
    if (SKIPPED_TAGS.has(candidate.tagName.toLowerCase())) continue
    if (tagLower && candidate.tagName.toLowerCase() !== tagLower) continue
    if (roleLower && elementRole(candidate).toLowerCase() !== roleLower) continue
    if (labelLower && !elementName(candidate).toLowerCase().includes(labelLower)) continue
    if (queryLower) {
      const name = elementName(candidate).toLowerCase()
      const text = (candidate.textContent ?? '').toLowerCase()
      if (!name.includes(queryLower) && !text.includes(queryLower)) continue
    }
    if (!isVisible(candidate)) continue
    if (isSensitiveField(candidate)) continue

    matches.push(candidate)
    if (matches.length >= maxMatches) break
  }

  // 文本查找常同时命中祖先与后代：只保留最内层，避免把整个容器当成目标
  return matches.filter(
    (element) => !matches.some((other) => other !== element && element.contains(other)),
  )
}

function findElements(args: Record<string, unknown>): FindElementsResult {
  const limit = readNumber(args, 'limit', 10, 1, 20)
  const matches = searchElements(
    {
      query: readString(args, 'query'),
      selector: readString(args, 'selector'),
      tagName: readString(args, 'tag_name'),
      role: readString(args, 'role'),
      label: readString(args, 'label'),
    },
    MAX_MATCHES,
  )

  return {
    matches: matches.slice(0, limit).map(describeElement),
    total: matches.length,
  }
}

// ---------------------------------------------------------------------------
// 页面操作
// ---------------------------------------------------------------------------

function scrollIntoView(element: Element): void {
  element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' })
}

function dispatchClick(element: Element): void {
  const base = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    button: 0,
  }
  const pointerInit = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true }

  element.dispatchEvent(new PointerEvent('pointerdown', pointerInit))
  element.dispatchEvent(new MouseEvent('mousedown', base))
  element.dispatchEvent(new PointerEvent('pointerup', pointerInit))
  element.dispatchEvent(new MouseEvent('mouseup', base))

  if (element instanceof HTMLElement) element.click()
  else element.dispatchEvent(new MouseEvent('click', base))
}

function clickElement(args: Record<string, unknown>): ClickResult {
  const ref = readString(args, 'ref')
  if (!ref) throw new PageToolError('invalid_args', '缺少参数 ref')

  const element = resolveElement(ref)
  if (!isVisible(element)) {
    throw new PageToolError('execution_failed', `元素 ${ref} 当前不可见，可能已折叠或移除`)
  }
  if (isDisabled(element)) {
    throw new PageToolError('invalid_args', `元素 ${ref} 处于禁用状态，无法点击`)
  }

  scrollIntoView(element)
  if ('focus' in element && typeof element.focus === 'function') element.focus()
  dispatchClick(element)

  return {
    ref,
    tag: element.tagName.toLowerCase(),
    name: elementName(element),
    url: location.href,
    title: document.title,
  }
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype =
    element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  if (setter) setter.call(element, value)
  else element.value = value
}

function dispatchInputEvents(element: Element, value: string): void {
  element.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      composed: true,
      inputType: 'insertText',
      data: value,
    }),
  )
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function dispatchEnter(element: Element): void {
  const base = { bubbles: true, cancelable: true, composed: true, key: 'Enter', code: 'Enter' }
  element.dispatchEvent(new KeyboardEvent('keydown', base))
  element.dispatchEvent(new KeyboardEvent('keypress', base))
  element.dispatchEvent(new KeyboardEvent('keyup', base))
}

function fillInput(args: Record<string, unknown>): FillResult {
  const ref = readString(args, 'ref')
  if (!ref) throw new PageToolError('invalid_args', '缺少参数 ref')
  const text = readRawString(args, 'text')
  if (text === undefined) throw new PageToolError('invalid_args', '缺少参数 text')
  const submit = readBoolean(args, 'submit') === true

  const element = resolveElement(ref)
  if (!isVisible(element)) {
    throw new PageToolError('execution_failed', `元素 ${ref} 当前不可见，可能已折叠或移除`)
  }
  if (isSensitiveField(element)) {
    throw new PageToolError('invalid_args', '禁止填写密码或敏感输入框')
  }
  if (isDisabled(element)) {
    throw new PageToolError('invalid_args', `元素 ${ref} 处于禁用状态，无法填写`)
  }

  let submitted = false
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.readOnly) {
      throw new PageToolError('invalid_args', `元素 ${ref} 为只读，无法填写`)
    }
    if (
      element instanceof HTMLInputElement &&
      ['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'hidden', 'password'].includes(
        element.type,
      )
    ) {
      throw new PageToolError('invalid_args', `输入框类型 ${element.type} 不支持文本填写`)
    }

    element.focus()
    setNativeValue(element, text)
    dispatchInputEvents(element, text)

    if (submit) {
      const form = element.form
      if (form) {
        form.requestSubmit()
        submitted = true
      } else {
        dispatchEnter(element)
        submitted = true
      }
    }
  } else if (element instanceof HTMLSelectElement) {
    const option = Array.from(element.options).find(
      (item) => item.value === text || item.label === text || item.text.trim() === text.trim(),
    )
    if (!option) {
      throw new PageToolError('invalid_args', `下拉框中不存在选项「${text}」`)
    }
    element.focus()
    element.value = option.value
    dispatchInputEvents(element, element.value)
    if (submit) {
      const form = element.form
      if (form) {
        form.requestSubmit()
        submitted = true
      }
    }
  } else if (element instanceof HTMLElement && element.isContentEditable) {
    element.focus()
    element.textContent = text
    dispatchInputEvents(element, text)
    if (submit) {
      dispatchEnter(element)
      submitted = true
    }
  } else {
    throw new PageToolError('invalid_args', '目标元素不是可填写的输入框')
  }

  return {
    ref,
    tag: element.tagName.toLowerCase(),
    name: elementName(element),
    valueLength: text.length,
    submitted,
  }
}

function describeOptionChoices(options: HTMLOptionElement[]): string {
  const labels = options.slice(0, 10).map((option) => collapse(option.label) || '(空)')
  const suffix = options.length > labels.length ? ` 等 ${options.length} 项` : ''
  return labels.join('、') + suffix
}

function selectOption(args: Record<string, unknown>): SelectResult {
  const ref = readString(args, 'ref')
  if (!ref) throw new PageToolError('invalid_args', '缺少参数 ref')

  const element = resolveElement(ref)
  if (!(element instanceof HTMLSelectElement)) {
    throw new PageToolError(
      'invalid_args',
      `元素 ${ref} 不是原生下拉框（实际为 ${element.tagName.toLowerCase()}），自定义下拉组件请使用 click_element`,
    )
  }
  if (!isVisible(element)) {
    throw new PageToolError('execution_failed', `元素 ${ref} 当前不可见，可能已折叠或移除`)
  }
  if (isDisabled(element)) {
    throw new PageToolError('invalid_args', `元素 ${ref} 处于禁用状态，无法选择`)
  }

  const options = Array.from(element.options)
  if (options.length === 0) {
    throw new PageToolError('element_not_found', `元素 ${ref} 没有任何选项`)
  }

  const choices = describeOptionChoices(options)
  const value = readRawString(args, 'value')
  const label = readString(args, 'label')
  const rawIndex = args.index

  let target: HTMLOptionElement | undefined
  if (value !== undefined) {
    target = options.find((option) => option.value === value)
    if (!target) {
      throw new PageToolError('invalid_args', `下拉框中不存在 value 为「${value}」的选项；可选：${choices}`)
    }
  } else if (label !== undefined) {
    const wanted = collapse(label)
    target =
      options.find((option) => collapse(option.label) === wanted) ??
      options.find((option) => collapse(option.label).toLowerCase() === wanted.toLowerCase())
    if (!target) {
      throw new PageToolError('invalid_args', `下拉框中不存在文本为「${label}」的选项；可选：${choices}`)
    }
  } else if (typeof rawIndex === 'number' && Number.isFinite(rawIndex)) {
    const index = Math.trunc(rawIndex)
    if (index < 0 || index >= options.length) {
      throw new PageToolError('invalid_args', `index 超出范围，应在 0 到 ${options.length - 1} 之间`)
    }
    target = options[index]
  } else {
    throw new PageToolError('invalid_args', '必须提供 value、label 或 index 之一来指定选项')
  }

  // 单选下拉框要显式清空其余选项；多选下拉框保留已有选择
  if (!element.multiple) {
    for (const option of options) option.selected = option === target
  }
  target.selected = true
  element.focus()
  dispatchInputEvents(element, element.value)

  return {
    ref,
    tag: element.tagName.toLowerCase(),
    name: elementName(element),
    selectedValue: element.value,
    selectedLabel: collapse(target.label),
    optionCount: options.length,
    url: location.href,
  }
}

function scrollPage(args: Record<string, unknown>): ScrollResult {
  const direction = readString(args, 'direction') ?? 'down'
  const amount = readNumber(
    args,
    'amount',
    Math.max(100, Math.round(window.innerHeight * 0.8)),
    50,
    5000,
  )

  switch (direction) {
    case 'up':
      window.scrollBy({ top: -amount, behavior: 'auto' })
      break
    case 'top':
      window.scrollTo({ top: 0, behavior: 'auto' })
      break
    case 'bottom':
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'auto' })
      break
    case 'down':
    default:
      window.scrollBy({ top: amount, behavior: 'auto' })
      break
  }

  return {
    y: Math.round(window.scrollY),
    height: Math.round(document.documentElement.scrollHeight),
    viewportHeight: window.innerHeight,
  }
}

// ---------------------------------------------------------------------------
// 等待与验证
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function waitForElement(args: Record<string, unknown>): Promise<WaitResult> {
  const query = readString(args, 'query')
  const selector = readString(args, 'selector')
  if (!query && !selector) {
    throw new PageToolError('invalid_args', '至少提供 query 或 selector')
  }
  const timeout = readNumber(args, 'timeout_ms', 8000, 500, 15000)
  const deadline = Date.now() + timeout
  const target = query ? `文本「${query}」` : `选择器 ${selector}`

  while (true) {
    const [found] = searchElements({ query, selector }, 1)
    if (found) return { element: describeElement(found) }
    if (Date.now() >= deadline) {
      throw new PageToolError('element_not_found', `等待超时（${timeout}ms）：未找到${target}`)
    }
    await sleep(200)
  }
}

async function verifyAction(args: Record<string, unknown>): Promise<VerifyResult> {
  const expectText = readString(args, 'expect_text')
  const expectSelector = readString(args, 'expect_selector')
  const expectUrlContains = readString(args, 'expect_url_contains')
  if (!expectText && !expectSelector && !expectUrlContains) {
    throw new PageToolError(
      'invalid_args',
      '至少提供 expect_text、expect_selector、expect_url_contains 中的一个验证条件',
    )
  }

  const timeout = readNumber(args, 'timeout_ms', 3000, 200, 15000)
  const deadline = Date.now() + timeout

  while (true) {
    const matched: string[] = []
    const missing: string[] = []

    if (expectText) {
      if ((document.body?.innerText ?? '').includes(expectText)) matched.push(`文本「${expectText}」`)
      else missing.push(`文本「${expectText}」`)
    }

    if (expectSelector) {
      let exists = false
      try {
        exists = document.querySelector(expectSelector) !== null
      } catch {
        throw new PageToolError('invalid_args', `无效的 CSS 选择器：${expectSelector}`)
      }
      if (exists) matched.push(`选择器 ${expectSelector}`)
      else missing.push(`选择器 ${expectSelector}`)
    }

    if (expectUrlContains) {
      if (location.href.includes(expectUrlContains)) matched.push(`URL 包含 ${expectUrlContains}`)
      else missing.push(`URL 包含 ${expectUrlContains}`)
    }

    if (missing.length === 0) {
      return { url: location.href, title: document.title, matched }
    }
    if (Date.now() >= deadline) {
      throw new PageToolError(
        'execution_failed',
        `验证超时（${timeout}ms）：未满足 ${missing.join('、')}；当前地址 ${location.href}`,
      )
    }
    await sleep(250)
  }
}

// ---------------------------------------------------------------------------
// 参数读取
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readRawString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key]
  return typeof value === 'string' ? value : undefined
}

function readBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key]
  return typeof value === 'boolean' ? value : undefined
}

function readNumber(
  args: Record<string, unknown>,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = args[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

// ---------------------------------------------------------------------------
// 消息处理
// ---------------------------------------------------------------------------

type ActionHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>

const handlers: Record<string, ActionHandler> = {
  [MESSAGE_TYPES.GET_PAGE_SNAPSHOT]: () => readPageSnapshot(),
  [MESSAGE_TYPES.FIND_ELEMENTS]: (args) => findElements(args),
  [MESSAGE_TYPES.CLICK_ELEMENT]: (args) => clickElement(args),
  [MESSAGE_TYPES.FILL_INPUT]: (args) => fillInput(args),
  [MESSAGE_TYPES.SELECT_OPTION]: (args) => selectOption(args),
  [MESSAGE_TYPES.SCROLL_PAGE]: (args) => scrollPage(args),
  [MESSAGE_TYPES.WAIT_FOR_ELEMENT]: (args) => waitForElement(args),
  [MESSAGE_TYPES.VERIFY_ACTION]: (args) => verifyAction(args),
}

type GlobalWithInstallFlag = typeof globalThis & {
  __webChatHelperContentInstalled?: boolean
}

const globalScope = globalThis as GlobalWithInstallFlag

// 同一文档内可能因重试被重复注入，只安装一次监听器
if (!globalScope.__webChatHelperContentInstalled) {
  globalScope.__webChatHelperContentInstalled = true

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isPlainObject(message)) return undefined
    const type = message.type
    if (typeof type !== 'string') return undefined

    if (type === MESSAGE_TYPES.PING) {
      sendResponse({ ok: true, data: { pong: true } })
      return undefined
    }

    const handler = handlers[type]
    if (!handler) return undefined

    const payload = message.payload
    const rawArgs = isPlainObject(payload) ? payload.args : undefined
    const args = isPlainObject(rawArgs) ? rawArgs : {}

    void Promise.resolve(handler(args)).then(
      (data) => sendResponse({ ok: true, data }),
      (error: unknown) =>
        sendResponse({
          ok: false,
          error: {
            code: error instanceof PageToolError ? error.code : 'execution_failed',
            message: error instanceof Error ? error.message : String(error),
          },
        }),
    )

    // 异步响应
    return true
  })
}
