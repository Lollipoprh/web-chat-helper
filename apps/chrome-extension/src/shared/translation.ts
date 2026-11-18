// 页面翻译任务：右键菜单入口、浏览器语言识别与预置提示词
//
// 右键菜单由 Service Worker 创建并把请求写入 chrome.storage.session；
// Side Panel 启动或已打开时消费请求，新建会话后用下面的预置任务文本驱动 Agent。
// 目标语言固定取当前浏览器界面语言，用户无需输入。

export const TRANSLATE_PAGE_MENU_ID = 'webchat-helper:translate-page'

/** Service Worker 写入、Side Panel 消费的待处理请求键 */
export const PENDING_TRANSLATE_REQUEST_KEY = 'pendingTranslatePageRequest'

export interface TranslateLanguage {
  /** BCP-47 标签，例如 zh-CN */
  tag: string
  /** 可读语言名，例如 Simplified Chinese */
  name: string
}

export interface TranslatePageRequest {
  id: string
  tabId?: number
  /** 触发菜单的窗口；Side Panel 只处理自己窗口的请求 */
  windowId?: number
  language: TranslateLanguage
  createdAt: number
}

/** `Intl.DisplayNames` 不可用或未收录时的兜底语言名 */
const LANGUAGE_NAMES: Record<string, string> = {
  'zh-cn': 'Simplified Chinese',
  zh: 'Simplified Chinese',
  'zh-sg': 'Simplified Chinese',
  'zh-tw': 'Traditional Chinese',
  'zh-hk': 'Traditional Chinese',
  'zh-mo': 'Traditional Chinese',
  en: 'English',
  'en-us': 'English',
  'en-gb': 'English',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  pt: 'Portuguese',
  'pt-br': 'Portuguese',
  it: 'Italian',
  ru: 'Russian',
  uk: 'Ukrainian',
  pl: 'Polish',
  nl: 'Dutch',
  tr: 'Turkish',
  ar: 'Arabic',
  hi: 'Hindi',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ms: 'Malay',
  he: 'Hebrew',
  sv: 'Swedish',
  da: 'Danish',
  fi: 'Finnish',
  no: 'Norwegian',
  cs: 'Czech',
  el: 'Greek',
  hu: 'Hungarian',
  ro: 'Romanian',
}

function readBrowserLanguageTag(): string {
  try {
    const fromChrome = chrome.i18n.getUILanguage()
    if (fromChrome) return fromChrome
  } catch {
    // 非扩展环境（例如单元测试）继续走 navigator
  }
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language
  return 'en'
}

function displayNameFor(tag: string): string {
  const key = tag.toLowerCase()
  const mapped = LANGUAGE_NAMES[key] ?? LANGUAGE_NAMES[key.split('-')[0]]
  if (mapped) return mapped
  try {
    const display = new Intl.DisplayNames([tag], { type: 'language' }).of(tag)
    if (display) return display
  } catch {
    // Intl 不可用时退回语言标签本身
  }
  return tag
}

/** 当前浏览器界面语言；翻译目标语言以此为准 */
export function resolveBrowserLanguage(): TranslateLanguage {
  const tag = readBrowserLanguageTag()
  return { tag, name: displayNameFor(tag) }
}

export function isTranslatePageRequest(value: unknown): value is TranslatePageRequest {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id.length === 0) return false
  if (typeof record.createdAt !== 'number') return false
  if (record.tabId !== undefined && typeof record.tabId !== 'number') return false
  if (record.windowId !== undefined && typeof record.windowId !== 'number') return false
  const language = record.language
  if (typeof language !== 'object' || language === null) return false
  const { tag, name } = language as Record<string, unknown>
  return typeof tag === 'string' && typeof name === 'string'
}

/**
 * 预置的页面翻译任务文本。
 * 用户通过右键菜单触发时直接以这段文本作为首条用户消息，
 * 因此提示词必须自带执行步骤、跳过规则和「只在失败时汇报」的输出要求。
 */
export function buildTranslatePageTask(language: TranslateLanguage): string {
  return [
    `Translate the current page into ${language.name} (${language.tag}).`,
    '',
    'Use the extension tools to edit the page in place. Do not analyse the page and do not describe a plan.',
    '1. Call get_page_snapshot to read the visible text, then find_elements with the original text to locate each block.',
    '2. Rewrite only leaf elements whose content is plain text, using set_element_text. Never rewrite a container that holds links, buttons, inputs or icons — translate its text-only leaves instead.',
    '3. Leave code blocks, URLs, e-mail addresses, file names, form values, numbers and text that is already in the target language unchanged.',
    '4. Keep the original meaning, tone and punctuation style. Do not add notes or explanations inside the page.',
    '5. Work through the content in order. Every edit needs approval; if the page reverts an edit, retry once and then treat that block as failed.',
    '6. Keep the chat reply as short as possible. When the whole task succeeds, answer with a single short word such as "完成" and nothing else — no summary, no skipped-block list, no caveats. Only when a block or the task fails, reply with the concrete failure details (which block, what error) and nothing more.',
  ].join('\n')
}
