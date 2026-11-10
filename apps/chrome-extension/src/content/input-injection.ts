// 输入注入：写入策略链 + 写后回读判定
//
// 设计原则：
//   1. 优先使用浏览器原生编辑命令（execCommand），它产生可信事件，React / Vue /
//      富文本编辑器都能沿自己的正常路径处理；
//   2. 原型 setter / 实例 setter 只作为兜底，并按观测到的回滚决定是否降级；
//   3. 每次写入后都回读 DOM：写不进去或页面把值改回去时必须报失败，不得谎报成功。
//
// 纯逻辑（planFillStrategies / evaluateFill / describeFillFailure 等）不接触 DOM，
// 可直接在 node 环境单测；DOM 部分只在运行时执行，模块顶层没有副作用。

import type { FillStrategy } from 'browser-tools'

export type EditableKind = 'input' | 'textarea' | 'contenteditable'
export type EditableElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement

export type FillVerdict = 'committed' | 'formatted' | 'reverted' | 'partial' | 'empty'

export interface FillAttempt {
  strategy: FillStrategy
  actual: string
  /** 内部诊断：command_rejected / beforeinput_cancelled / reverted_after_blur */
  note?: string
}

export interface FillValidity {
  valid: boolean
  message?: string
}

export interface FillOutcome {
  committed: boolean
  verdict: FillVerdict
  strategy?: FillStrategy
  /** 最后一次回读到的值（用于解释失败原因，清理后可能已不同于 DOM 现值） */
  actual: string
  attempts: FillAttempt[]
  validity?: FillValidity
}

export interface PlanFillInput {
  kind: EditableKind
  inputType?: string
  hasOwnValueAccessor: boolean
  commandAvailable: boolean
}

/** 由浏览器强校验格式、会过滤 insertText 的输入类型 */
const FORMATTED_INPUT_TYPES = new Set([
  'number',
  'date',
  'time',
  'month',
  'week',
  'datetime-local',
  'range',
  'color',
])

/**
 * 策略顺序由可信度决定，而不是由框架探测决定：
 * 原生编辑命令 → 原型 setter → 实例 setter（仅当元素自有 value accessor）。
 * contenteditable 没有 value，只能走编辑命令。
 */
export function planFillStrategies(input: PlanFillInput): FillStrategy[] {
  if (input.kind === 'contenteditable') return ['insert-text-command']

  const setters: FillStrategy[] = ['native-value-setter']
  if (input.hasOwnValueAccessor) setters.push('instance-value-setter')

  if (!input.commandAvailable) return setters
  if (input.inputType && FORMATTED_INPUT_TYPES.has(input.inputType)) return setters
  return ['insert-text-command', ...setters]
}

/** 折叠空白：去掉零宽与全角空格差异，把连续空白压成一个空格 */
export function normalizeForCompare(text: string): string {
  return text
    .replace(/[\u00a0\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripSeparators(text: string): string {
  return text.replace(/[\s,，._\-/]/g, '')
}

/** 掩码 / 千分位：去掉分隔符后相同即视为同一内容 */
export function looseMatch(expected: string, actual: string): boolean {
  const left = normalizeForCompare(expected)
  const right = normalizeForCompare(actual)
  if (!left || !right) return false
  if (left === right) return true
  const strippedLeft = stripSeparators(left)
  const strippedRight = stripSeparators(right)
  return strippedRight !== '' && strippedLeft === strippedRight
}

/** 按码点计长度：emoji 记 1 个字符，与 value.length 的 UTF-16 计数不同 */
export function codePointLength(text: string): number {
  return Array.from(text).length
}

export function evaluateFill(expected: string, actual: string, before: string): FillVerdict {
  const wanted = normalizeForCompare(expected)
  const got = normalizeForCompare(actual)
  const original = normalizeForCompare(before)

  if (wanted === got) return 'committed'
  if (wanted && looseMatch(wanted, got)) return 'formatted'
  if (got === original) return 'reverted'
  if (!got) return 'empty'
  if (
    wanted &&
    (wanted.startsWith(got) || got.startsWith(wanted) || wanted.includes(got) || got.includes(wanted))
  ) {
    return 'partial'
  }
  return 'reverted'
}

export function classifyEditable(element: Element): EditableKind | 'select' | 'unsupported' {
  if (element instanceof HTMLInputElement) return 'input'
  if (element instanceof HTMLTextAreaElement) return 'textarea'
  if (element instanceof HTMLSelectElement) return 'select'
  if (element instanceof HTMLElement && element.isContentEditable) return 'contenteditable'
  return 'unsupported'
}

export function readEditableText(element: EditableElement): string {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value
  }
  return (element as HTMLElement).innerText ?? element.textContent ?? ''
}

/** 读取 HTML5 约束校验状态；非表单控件没有约束，返回 undefined */
export function readValidity(element: Element): FillValidity | undefined {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    const valid = element.validity.valid
    return { valid, message: valid ? undefined : element.validationMessage || '页面校验未通过' }
  }
  return undefined
}

/** 元素实例（或其最近原型）上是否存在自己的 value accessor，例如掩码库 */
export function hasOwnValueAccessor(element: HTMLInputElement | HTMLTextAreaElement): boolean {
  const prototype = Object.getPrototypeOf(element) as object
  const nativePrototype =
    prototype === HTMLInputElement.prototype || prototype === HTMLTextAreaElement.prototype
  return (
    Object.getOwnPropertyDescriptor(element, 'value') !== undefined ||
    (!nativePrototype && Object.getOwnPropertyDescriptor(prototype, 'value') !== undefined)
  )
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype =
    element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  if (setter) setter.call(element, value)
  else element.value = value
}

function setInstanceValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): boolean {
  const own = Object.getOwnPropertyDescriptor(element, 'value')?.set
  const inherited = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(element) as object,
    'value',
  )?.set
  const setter = own ?? inherited
  if (!setter) return false
  setter.call(element, value)
  return true
}

function deepActiveElement(): Element | null {
  let active: Element | null = document.activeElement
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement
  }
  return active
}

/** 聚焦到真正承载编辑的元素：Shadow DOM 下 activeElement 会停在宿主上 */
export function focusDeep(element: EditableElement): void {
  element.focus({ preventScroll: true })
  if (deepActiveElement() === element) return
  const root = element.getRootNode()
  if (root instanceof ShadowRoot) element.focus({ preventScroll: true })
}

function selectionOf(element: Element): Selection | null {
  const root = element.getRootNode()
  if (!(root instanceof ShadowRoot)) return document.getSelection()
  const scoped = (root as ShadowRoot & { getSelection?: () => Selection | null }).getSelection
  return scoped ? scoped.call(root) : null
}

function selectAllEditable(element: EditableElement): void {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    try {
      element.select()
    } catch {
      // number / date 等类型不支持选区 API，由调用方的类型分流兜底
    }
    return
  }
  const selection = selectionOf(element)
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(element)
  selection.removeAllRanges()
  selection.addRange(range)
}

export function dispatchChangeEvent(element: Element): void {
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

export function dispatchFormEvents(element: Element, data?: string): void {
  element.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      composed: true,
      inputType: 'insertReplacementText',
      data,
    }),
  )
  dispatchChangeEvent(element)
}

function dispatchBeforeInput(element: Element, inputType: string, data: string): boolean {
  return element.dispatchEvent(
    new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType,
      data,
    }),
  )
}

function blurIfFocused(element: Element): void {
  if (deepActiveElement() === element && element instanceof HTMLElement) element.blur()
}

function runInsertTextCommand(element: EditableElement, text: string): FillAttempt {
  focusDeep(element)
  selectAllEditable(element)
  let accepted = false
  try {
    accepted =
      text === ''
        ? document.execCommand('delete')
        : document.execCommand('insertText', false, text)
  } catch {
    accepted = false
  }
  return {
    strategy: 'insert-text-command',
    actual: readEditableText(element),
    note: accepted ? undefined : 'command_rejected',
  }
}

function runNativeValueSetter(
  element: HTMLInputElement | HTMLTextAreaElement,
  text: string,
): FillAttempt {
  // 页面取消 beforeinput 通常意味着主动拒绝这次写入；此时不落值，交给组件 setter 兜底
  if (!dispatchBeforeInput(element, 'insertReplacementText', text)) {
    return {
      strategy: 'native-value-setter',
      actual: readEditableText(element),
      note: 'beforeinput_cancelled',
    }
  }
  setNativeValue(element, text)
  try {
    const end = element.value.length
    element.setSelectionRange(end, end)
  } catch {
    // 部分 input type 不支持 setSelectionRange
  }
  element.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      composed: true,
      inputType: 'insertReplacementText',
      data: text,
    }),
  )
  dispatchChangeEvent(element)
  return {
    strategy: 'native-value-setter',
    actual: readEditableText(element),
  }
}

function runInstanceValueSetter(
  element: HTMLInputElement | HTMLTextAreaElement,
  text: string,
): FillAttempt {
  // 实例 setter 就是组件自己的同步入口，不经过 beforeinput，只补 input / change 驱动校验
  let applied = false
  try {
    applied = setInstanceValue(element, text)
  } catch {
    applied = false
  }
  element.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      composed: true,
      inputType: 'insertReplacementText',
      data: text,
    }),
  )
  dispatchChangeEvent(element)
  return {
    strategy: 'instance-value-setter',
    actual: readEditableText(element),
    note: applied ? undefined : 'unsupported_element',
  }
}

function runStrategy(strategy: FillStrategy, element: EditableElement, text: string): FillAttempt {
  if (strategy === 'insert-text-command') return runInsertTextCommand(element, text)
  if (strategy === 'select-value') {
    return { strategy, actual: readEditableText(element), note: 'unsupported_element' }
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return strategy === 'native-value-setter'
      ? runNativeValueSetter(element, text)
      : runInstanceValueSetter(element, text)
  }
  return { strategy, actual: readEditableText(element), note: 'unsupported_element' }
}

/** 静默复原：input / textarea 直接赋值，避免编辑命令再触发可信 input 事件 */
function restoreValue(element: EditableElement, before: string): void {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    setNativeValue(element, before)
    return
  }
  focusDeep(element)
  selectAllEditable(element)
  try {
    if (before === '') document.execCommand('delete')
    else document.execCommand('insertText', false, before)
  } catch {
    // 无法复原时保持现状，由后续回读判定
  }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    // 后台标签页会暂停 rAF，必须有定时器兜底，否则回读会一直挂住
    window.setTimeout(finish, 32)
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(finish)
  })
}

/**
 * 等待值稳定再判定：掩码、防抖格式化、异步校验都会在写入后的下一帧回写，
 * 立即回读会把正常工作误判成「被回滚」。
 * 后台标签页里 rAF 与定时器都被节流，直接读一次，避免拖住工具调用。
 */
async function readSettled(element: EditableElement): Promise<string> {
  if (document.visibilityState === 'hidden') return readEditableText(element)

  const deadline = Date.now() + 400
  let current = readEditableText(element)
  let stableSince = Date.now()
  while (Date.now() < deadline) {
    await nextFrame()
    const next = readEditableText(element)
    if (next !== current) {
      current = next
      stableSince = Date.now()
      continue
    }
    if (Date.now() - stableSince >= 48) return current
  }
  return current
}

export async function commitText(element: EditableElement, text: string): Promise<FillOutcome> {
  const before = readEditableText(element)
  const kind = classifyEditable(element)
  if (kind === 'select' || kind === 'unsupported') {
    // 调用方（fillInput）已按 kind 分流，这里只做兜底
    return { committed: false, verdict: 'reverted', actual: before, attempts: [] }
  }

  const strategies = planFillStrategies({
    kind,
    inputType: element instanceof HTMLInputElement ? element.type : undefined,
    hasOwnValueAccessor:
      element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
        ? hasOwnValueAccessor(element)
        : false,
    commandAvailable: typeof document.execCommand === 'function',
  })

  const attempts: FillAttempt[] = []
  let sawRevert = false
  let lastActual = before

  for (const strategy of strategies) {
    // 实例 setter 会覆盖框架的 _valueTracker，只在确实观测到回滚后才启用
    if (strategy === 'instance-value-setter' && !sawRevert) continue

    const attempt = runStrategy(strategy, element, text)
    attempts.push(attempt)
    const actual = await readSettled(element)
    attempt.actual = actual
    lastActual = actual

    const verdict = evaluateFill(text, actual, before)
    if (verdict === 'committed' || verdict === 'formatted') {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        blurIfFocused(element)
        const afterBlur = readEditableText(element)
        const settled = evaluateFill(text, afterBlur, before)
        if (settled === 'committed' || settled === 'formatted') {
          return {
            committed: true,
            verdict: settled,
            strategy,
            actual: afterBlur,
            attempts,
            validity: readValidity(element),
          }
        }
        attempt.note = 'reverted_after_blur'
        lastActual = afterBlur
        sawRevert = true
        continue
      }
      return {
        committed: true,
        verdict,
        strategy,
        actual,
        attempts,
        validity: readValidity(element),
      }
    }

    // 页面取消 beforeinput 表示主动拒绝，不构成「回滚」，不能据此启用实例 setter
    if (verdict === 'reverted' && attempt.note !== 'beforeinput_cancelled') sawRevert = true
    restoreValue(element, before)
    await readSettled(element)
  }

  return {
    committed: false,
    verdict: evaluateFill(text, lastActual, before),
    actual: lastActual,
    attempts,
    validity: readValidity(element),
  }
}

/** 失败原因对模型可行动：说清楚「为什么失败」和「下一步怎么办」，不写泛化错误 */
export function describeFillFailure(
  outcome: FillOutcome,
  expected: string,
  label: string,
): string {
  const expectedLength = codePointLength(expected)
  const actualLength = codePointLength(outcome.actual)
  const shown = outcome.actual.length > 40 ? `${outcome.actual.slice(0, 40)}…` : outcome.actual
  const blockedByBeforeInput = outcome.attempts.some(
    (attempt) => attempt.note === 'beforeinput_cancelled',
  )
  const blockedByCommand = outcome.attempts.some((attempt) => attempt.note === 'command_rejected')

  if (outcome.verdict === 'reverted') {
    if (blockedByBeforeInput) {
      return `页面在 beforeinput 阶段取消了这次输入，${label} 可能拒绝自动化写入；请让用户手动填写，或先用 click_element 聚焦后重试。`
    }
    if (blockedByCommand) {
      return `浏览器没能对 ${label} 执行编辑命令（可能未获得焦点或被页面拦截），且写入被页面回滚；请先用 click_element 聚焦后重试，或让用户手动填写。`
    }
    return `页面在写入后把值改回了原样（当前 ${actualLength} 个字符），${label} 可能由自定义组件控制；请先用 click_element 聚焦后重试，或让用户手动填写。`
  }

  if (outcome.verdict === 'empty') {
    return `${label} 写入后仍为空（期望 ${expectedLength} 个字符），本次输入被页面丢弃；请先用 click_element 聚焦后重试，或让用户手动填写。`
  }

  return `写入后只读到 ${actualLength}/${expectedLength} 个字符（内容：「${shown}」），页面可能做了格式化或截断；已恢复原值，可调整内容或分段写入。`
}
