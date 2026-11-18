// Content Script：注入到网页中的脚本
// 职责：读取页面摘要、定位元素、执行点击/输入/滚动，以及声明式的 DOM 修改
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
  InsertElementResult,
  InsertPosition,
  PageSnapshot,
  RemoveElementResult,
  ScrollResult,
  SelectResult,
  SetAttributeResult,
  SetStyleResult,
  SetTextResult,
  VerifyResult,
  WaitResult,
} from 'browser-tools'
import { MESSAGE_TYPES } from '../shared/index'
import {
  classifyEditable,
  codePointLength,
  commitText,
  describeFillFailure,
  dispatchFormEvents,
  focusDeep,
  readValidity,
} from './input-injection'
import type { EditableElement } from './input-injection'

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

function dispatchEnter(element: Element): void {
  const base = {
    bubbles: true,
    cancelable: true,
    composed: true,
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
  }
  element.dispatchEvent(new KeyboardEvent('keydown', base))
  element.dispatchEvent(new KeyboardEvent('keypress', base))
  element.dispatchEvent(new KeyboardEvent('keyup', base))
}

const UNSUPPORTED_INPUT_TYPES = [
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'file',
  'hidden',
  'password',
]

interface SubmitOutcome {
  submitted: boolean
  validationMessage?: string
}

/** 提交前先做约束校验：校验不通过时如实报告，不谎报已提交 */
function submitForm(element: Element): SubmitOutcome {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    const form = element.form
    if (form) {
      if (!form.checkValidity()) {
        const invalid = form.querySelector<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >('input:invalid, textarea:invalid, select:invalid')
        return {
          submitted: false,
          validationMessage: invalid?.validationMessage || '表单校验未通过',
        }
      }
      form.requestSubmit()
      return { submitted: true }
    }
  }
  // 没有表单时只能按 Enter：合成按键同样不可信，只能视为「已尝试」
  dispatchEnter(element)
  return { submitted: true }
}

function findSelectOption(
  element: HTMLSelectElement,
  text: string,
): HTMLOptionElement | undefined {
  return Array.from(element.options).find(
    (item) => item.value === text || item.label === text || item.text.trim() === text.trim(),
  )
}

function describeSelected(element: HTMLSelectElement): string {
  const labels = Array.from(element.selectedOptions)
    .map((option) => collapse(option.label))
    .filter(Boolean)
  return labels.join('、') || '空'
}

async function fillInput(args: Record<string, unknown>): Promise<FillResult> {
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

  const kind = classifyEditable(element)
  if (kind === 'select') {
    return fillSelect(ref, element as HTMLSelectElement, text, submit)
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.readOnly) {
      throw new PageToolError('invalid_args', `元素 ${ref} 为只读，无法填写`)
    }
    if (element instanceof HTMLInputElement && UNSUPPORTED_INPUT_TYPES.includes(element.type)) {
      throw new PageToolError('invalid_args', `输入框类型 ${element.type} 不支持文本填写`)
    }
  } else if (kind !== 'contenteditable') {
    throw new PageToolError('invalid_args', '目标元素不是可填写的输入框')
  }

  scrollIntoView(element)
  const editable = element as EditableElement
  focusDeep(editable)

  const outcome = await commitText(editable, text)
  const strategy = outcome.strategy
  if (!outcome.committed || !strategy) {
    throw new PageToolError(
      'execution_failed',
      describeFillFailure(outcome, text, `「${elementName(element) || ref}」`),
    )
  }

  const submission = submit ? submitForm(element) : { submitted: false }
  return {
    ref,
    tag: element.tagName.toLowerCase(),
    name: elementName(element),
    valueLength: codePointLength(outcome.actual),
    expectedLength: codePointLength(text),
    strategy,
    committed: true,
    validityValid: outcome.validity?.valid ?? true,
    validationMessage: outcome.validity?.message ?? submission.validationMessage,
    submitted: submission.submitted,
  }
}

function fillSelect(
  ref: string,
  element: HTMLSelectElement,
  text: string,
  submit: boolean,
): FillResult {
  const option = findSelectOption(element, text)
  if (!option) {
    throw new PageToolError('invalid_args', `下拉框中不存在选项「${text}」`)
  }

  scrollIntoView(element)
  focusDeep(element)
  // 单选下拉框要显式清空其余选项；多选下拉框保留已有选择
  if (!element.multiple) {
    for (const item of Array.from(element.options)) item.selected = item === option
  }
  option.selected = true
  element.value = option.value
  dispatchFormEvents(element, element.value)

  if (element.multiple ? !option.selected : element.value !== option.value) {
    throw new PageToolError(
      'execution_failed',
      `已选择「${collapse(option.label)}」，但页面立即改回「${describeSelected(element)}」，可能有联动校验。`,
    )
  }

  const submission = submit ? submitForm(element) : { submitted: false }
  const validity = readValidity(element)
  return {
    ref,
    tag: element.tagName.toLowerCase(),
    name: elementName(element),
    valueLength: codePointLength(element.value),
    expectedLength: codePointLength(option.value),
    strategy: 'select-value',
    committed: true,
    validityValid: validity?.valid ?? true,
    validationMessage: validity?.message ?? submission.validationMessage,
    submitted: submission.submitted,
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
  focusDeep(element)
  dispatchFormEvents(element, element.value)

  // 回读确认：页面若在 change 监听里改回原值，不能当作成功
  const committed = element.multiple ? target.selected : element.value === target.value

  return {
    ref,
    tag: element.tagName.toLowerCase(),
    name: elementName(element),
    selectedValue: element.value,
    selectedLabel: collapse(target.label),
    optionCount: options.length,
    committed,
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
// DOM 修改：文本 / 属性 / 样式 / 删除 / 插入
// 只提供声明式、参数白名单的修改能力：不接受脚本、任意选择器或任意 HTML 属性
// 所有修改都是临时的本地 DOM 变化，页面 re-render 后可能被覆盖，因此都要回读
// ---------------------------------------------------------------------------

const MAX_MUTATION_TEXT_CHARS = 4000
const MAX_ATTRIBUTE_VALUE_CHARS = 500
const MAX_STYLE_ENTRIES = 20
const MAX_STYLE_VALUE_CHARS = 200
const MAX_INSERT_HTML_CHARS = 20_000
const MAX_INSERTED_ELEMENTS = 200
const MUTATION_PREVIEW_CHARS = 200

/** 不允许被整体改写、隐藏或移除的节点 */
const PROTECTED_MUTATION_TAGS = new Set([
  'html',
  'head',
  'body',
  'script',
  'style',
  'title',
  'meta',
  'link',
  'base',
  'noscript',
  'template',
  'iframe',
  'object',
  'embed',
])

/** 插入操作的锚点也不能是这些节点 */
const PROTECTED_INSERT_ANCHORS = new Set([
  'html',
  'head',
  'script',
  'style',
  'title',
  'meta',
  'link',
  'base',
  'noscript',
  'template',
])

/** 允许模型修改的属性：只影响展示与无障碍描述，不改导航或行为 */
const MUTABLE_ATTRIBUTE_NAMES = new Set([
  'title',
  'placeholder',
  'aria-label',
  'aria-description',
  'aria-describedby',
  'aria-hidden',
  'aria-expanded',
  'aria-pressed',
  'aria-checked',
  'aria-selected',
  'aria-disabled',
  'aria-required',
  'aria-invalid',
  'tabindex',
])

/** 允许模型覆盖的内联样式：纯视觉属性，不含 background-image 之类的加载能力 */
const MUTABLE_STYLE_PROPERTIES = new Set([
  'display',
  'visibility',
  'opacity',
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'font-style',
  'font-family',
  'text-decoration',
  'text-align',
  'text-transform',
  'line-height',
  'letter-spacing',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border',
  'border-color',
  'border-width',
  'border-style',
  'border-radius',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'overflow',
  'transform',
  'box-shadow',
  'cursor',
])

/** 插入内容允许使用的标签：纯展示与排版，不含表单、媒体与可执行容器 */
const ALLOWED_INSERT_TAGS = new Set([
  'div',
  'span',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'small',
  'sub',
  'sup',
  'mark',
  'br',
  'hr',
  'a',
  'img',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'blockquote',
  'pre',
  'code',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'caption',
  'section',
  'article',
  'header',
  'footer',
  'nav',
  'aside',
  'figure',
  'figcaption',
  'time',
])

/** 插入内容中直接连子树一起丢弃的标签 */
const DANGEROUS_INSERT_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'link',
  'meta',
  'base',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'option',
  'video',
  'audio',
  'source',
  'track',
  'canvas',
  'svg',
  'math',
  'template',
  'dialog',
])

const ALLOWED_INSERT_ATTRIBUTES = new Set([
  'class',
  'style',
  'title',
  'alt',
  'width',
  'height',
  'colspan',
  'rowspan',
  'href',
  'src',
  'target',
  'rel',
  'role',
  'dir',
  'lang',
  'datetime',
  'cite',
  'start',
])

function resolveMutationTarget(ref: string): Element {
  const element = resolveElement(ref)
  const tag = element.tagName.toLowerCase()
  if (PROTECTED_MUTATION_TAGS.has(tag)) {
    throw new PageToolError('invalid_args', `不允许修改或移除 <${tag}> 元素`)
  }
  return element
}

function mutationPreview(text: string): string {
  return collapse(text).slice(0, MUTATION_PREVIEW_CHARS)
}

function isFormTextField(element: Element): boolean {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    return true
  }
  const editable = element.getAttribute('contenteditable')
  return editable !== null && editable !== 'false'
}

function isMutableAttributeName(name: string): boolean {
  return MUTABLE_ATTRIBUTE_NAMES.has(name) || /^data-[a-z0-9._-]+$/.test(name)
}

function toKebabCase(name: string): string {
  return name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

/** 拒绝可加载外部资源或执行表达式的 CSS 值 */
function isUnsafeCssValue(value: string): boolean {
  return /url\s*\(|expression\s*\(|@import|javascript:/i.test(value)
}

/** 只放行 http(s)、mailto、tel、相对路径与内联图片 data URI */
function isUnsafeUrlValue(name: string, value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)?.[1]?.toLowerCase()
  if (!scheme) return false
  if (scheme === 'http' || scheme === 'https' || scheme === 'mailto' || scheme === 'tel') return false
  if (name === 'src' && /^data:image\/(png|jpe?g|gif|webp|avif);/i.test(trimmed)) return false
  return true
}

function setElementText(args: Record<string, unknown>): SetTextResult {
  const ref = readString(args, 'ref')
  if (!ref) throw new PageToolError('invalid_args', '缺少参数 ref')
  const text = readRawString(args, 'text')
  if (text === undefined) throw new PageToolError('invalid_args', '缺少参数 text')
  if (text.length > MAX_MUTATION_TEXT_CHARS) {
    throw new PageToolError('invalid_args', `text 不能超过 ${MAX_MUTATION_TEXT_CHARS} 字符`)
  }

  const element = resolveMutationTarget(ref)
  if (isFormTextField(element)) {
    throw new PageToolError(
      'invalid_args',
      `元素 ${ref} 是表单文本控件，请使用 fill_input 修改其值`,
    )
  }

  const previousText = mutationPreview(element.textContent ?? '')
  element.textContent = text
  const actualText = mutationPreview(element.textContent ?? '')

  return {
    ref,
    tag: element.tagName.toLowerCase(),
    name: elementName(element),
    url: location.href,
    previousText,
    text: actualText,
    changed: previousText !== actualText,
  }
}

function setElementAttribute(args: Record<string, unknown>): SetAttributeResult {
  const ref = readString(args, 'ref')
  if (!ref) throw new PageToolError('invalid_args', '缺少参数 ref')
  const rawName = readString(args, 'name')
  if (!rawName) throw new PageToolError('invalid_args', '缺少参数 name')
  const attribute = rawName.toLowerCase()
  if (!isMutableAttributeName(attribute)) {
    throw new PageToolError(
      'invalid_args',
      `不允许修改属性 ${rawName}；仅支持 title、placeholder、aria-*、tabindex 和 data-*`,
    )
  }
  const value = readRawString(args, 'value')
  if (value === undefined) throw new PageToolError('invalid_args', '缺少参数 value')
  if (value.length > MAX_ATTRIBUTE_VALUE_CHARS) {
    throw new PageToolError('invalid_args', `value 不能超过 ${MAX_ATTRIBUTE_VALUE_CHARS} 字符`)
  }

  const element = resolveMutationTarget(ref)
  const previousValue = element.getAttribute(attribute)
  if (value === '') element.removeAttribute(attribute)
  else element.setAttribute(attribute, value)

  return {
    ref,
    tag: element.tagName.toLowerCase(),
    name: elementName(element),
    url: location.href,
    attribute,
    previousValue,
    value: element.getAttribute(attribute),
  }
}

function setElementStyle(args: Record<string, unknown>): SetStyleResult {
  const ref = readString(args, 'ref')
  if (!ref) throw new PageToolError('invalid_args', '缺少参数 ref')
  const rawStyles = args.styles
  if (!isPlainObject(rawStyles)) {
    throw new PageToolError('invalid_args', '参数 styles 必须是对象')
  }
  const entries = Object.entries(rawStyles)
  if (entries.length === 0) throw new PageToolError('invalid_args', 'styles 至少需要一个样式声明')
  if (entries.length > MAX_STYLE_ENTRIES) {
    throw new PageToolError('invalid_args', `styles 最多 ${MAX_STYLE_ENTRIES} 项`)
  }

  const element = resolveMutationTarget(ref)
  if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
    throw new PageToolError('invalid_args', `元素 ${ref} 不支持内联样式`)
  }

  const applied: Record<string, string> = {}
  for (const [rawProp, rawValue] of entries) {
    const prop = toKebabCase(rawProp)
    if (!MUTABLE_STYLE_PROPERTIES.has(prop)) {
      throw new PageToolError('invalid_args', `不允许修改样式 ${rawProp}`)
    }
    const value = typeof rawValue === 'number' ? String(rawValue) : rawValue
    if (typeof value !== 'string') {
      throw new PageToolError('invalid_args', `样式 ${rawProp} 的值必须是字符串或数字`)
    }
    const trimmed = value.trim()
    if (!trimmed) throw new PageToolError('invalid_args', `样式 ${rawProp} 的值不能为空`)
    if (trimmed.length > MAX_STYLE_VALUE_CHARS) {
      throw new PageToolError('invalid_args', `样式 ${rawProp} 的值不能超过 ${MAX_STYLE_VALUE_CHARS} 字符`)
    }
    if (isUnsafeCssValue(trimmed)) {
      throw new PageToolError('invalid_args', `样式 ${rawProp} 的值包含不允许的写法`)
    }
    element.style.setProperty(prop, trimmed)
    applied[prop] = trimmed
  }

  const computedStyle = window.getComputedStyle(element)
  const computed: Record<string, string> = {}
  for (const prop of Object.keys(applied)) {
    computed[prop] = computedStyle.getPropertyValue(prop).trim()
  }

  return {
    ref,
    tag: element.tagName.toLowerCase(),
    name: elementName(element),
    url: location.href,
    applied,
    computed,
  }
}

function removeElement(args: Record<string, unknown>): RemoveElementResult {
  const ref = readString(args, 'ref')
  if (!ref) throw new PageToolError('invalid_args', '缺少参数 ref')
  const rawMode = readString(args, 'mode') ?? 'remove'
  if (rawMode !== 'remove' && rawMode !== 'hide') {
    throw new PageToolError('invalid_args', 'mode 只能是 remove 或 hide')
  }

  const element = resolveMutationTarget(ref)
  const tag = element.tagName.toLowerCase()
  const name = elementName(element)

  if (rawMode === 'hide') {
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
      throw new PageToolError('invalid_args', `元素 ${ref} 不支持隐藏`)
    }
    element.style.setProperty('display', 'none', 'important')
    return {
      ref,
      tag,
      name,
      url: location.href,
      mode: 'hide',
      removed: false,
      stillVisible: isVisible(element),
    }
  }

  element.remove()
  return {
    ref,
    tag,
    name,
    url: location.href,
    mode: 'remove',
    removed: !element.isConnected,
    stillVisible: false,
  }
}

/**
 * 消毒插入片段：
 *   - 危险标签连同子树一起丢弃
 *   - 非白名单标签保留子节点、去掉自身
 *   - 属性只保留白名单 / aria-* / data-*，并剔除事件、脚本 URL 与危险 CSS
 */
function sanitizeInsertedFragment(html: string): DocumentFragment {
  const template = document.createElement('template')
  template.innerHTML = html
  const root = template.content

  for (const element of Array.from(root.querySelectorAll('*'))) {
    // 父节点已被丢弃时，子树一并跳过
    if (element.getRootNode() !== root) continue
    const tag = element.tagName.toLowerCase()

    if (DANGEROUS_INSERT_TAGS.has(tag)) {
      element.remove()
      continue
    }
    if (!ALLOWED_INSERT_TAGS.has(tag)) {
      const parent = element.parentNode
      if (!parent) continue
      let child = element.firstChild
      while (child) {
        parent.insertBefore(child, element)
        child = element.firstChild
      }
      parent.removeChild(element)
      continue
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const allowed =
        ALLOWED_INSERT_ATTRIBUTES.has(name) ||
        name.startsWith('aria-') ||
        name.startsWith('data-')
      if (!allowed) {
        element.removeAttribute(attribute.name)
        continue
      }
      if (name === 'style' && isUnsafeCssValue(attribute.value)) {
        element.removeAttribute(attribute.name)
        continue
      }
      if ((name === 'href' || name === 'src') && isUnsafeUrlValue(name, attribute.value)) {
        element.removeAttribute(attribute.name)
      }
    }
  }

  const count = root.querySelectorAll('*').length
  if (count > MAX_INSERTED_ELEMENTS) {
    throw new PageToolError('invalid_args', `消毒后的内容包含 ${count} 个元素，超过上限 ${MAX_INSERTED_ELEMENTS}`)
  }
  return root
}

function insertElement(args: Record<string, unknown>): InsertElementResult {
  const ref = readString(args, 'ref')
  if (!ref) throw new PageToolError('invalid_args', '缺少参数 ref')
  const rawPosition = readString(args, 'position')
  if (
    rawPosition !== 'before' &&
    rawPosition !== 'after' &&
    rawPosition !== 'prepend' &&
    rawPosition !== 'append'
  ) {
    throw new PageToolError('invalid_args', 'position 只能是 before、after、prepend 或 append')
  }
  const html = readRawString(args, 'html')
  if (html === undefined) throw new PageToolError('invalid_args', '缺少参数 html')
  if (html.length > MAX_INSERT_HTML_CHARS) {
    throw new PageToolError('invalid_args', `html 不能超过 ${MAX_INSERT_HTML_CHARS} 字符`)
  }

  const anchor = resolveElement(ref)
  const anchorTag = anchor.tagName.toLowerCase()
  if (PROTECTED_INSERT_ANCHORS.has(anchorTag)) {
    throw new PageToolError('invalid_args', `不允许向 <${anchorTag}> 插入内容`)
  }

  const position = rawPosition as InsertPosition
  const fragment = sanitizeInsertedFragment(html)
  const insertedCount = fragment.querySelectorAll('*').length
  if (insertedCount === 0) {
    throw new PageToolError('invalid_args', '消毒后没有可插入的元素内容')
  }
  const text = mutationPreview(fragment.textContent ?? '')

  if (position === 'before' || position === 'after') {
    const parent = anchor.parentNode
    if (!parent) throw new PageToolError('execution_failed', `锚点 ${ref} 没有父节点`)
    const parentTag = parent instanceof Element ? parent.tagName.toLowerCase() : ''
    if (parentTag === 'html' || parentTag === 'head') {
      throw new PageToolError('invalid_args', `不允许在 <${parentTag}> 下插入同级内容`)
    }
    parent.insertBefore(fragment, position === 'before' ? anchor : anchor.nextSibling)
  } else if (position === 'prepend') {
    anchor.insertBefore(fragment, anchor.firstChild)
  } else {
    anchor.appendChild(fragment)
  }

  return {
    ref,
    tag: anchorTag,
    name: elementName(anchor),
    url: location.href,
    position,
    insertedCount,
    text,
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
  [MESSAGE_TYPES.SET_ELEMENT_TEXT]: (args) => setElementText(args),
  [MESSAGE_TYPES.SET_ELEMENT_ATTRIBUTE]: (args) => setElementAttribute(args),
  [MESSAGE_TYPES.SET_ELEMENT_STYLE]: (args) => setElementStyle(args),
  [MESSAGE_TYPES.REMOVE_ELEMENT]: (args) => removeElement(args),
  [MESSAGE_TYPES.INSERT_ELEMENT]: (args) => insertElement(args),
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
