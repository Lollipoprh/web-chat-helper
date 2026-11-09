// 界面语言的 React 绑定：读取偏好、订阅 storage 变更、提供 t()。
//
// 侧边栏与设置页是两个独立页面，各自调用一次本 hook 即可；
// 两边通过 chrome.storage.local 上的 uiLanguage 保持同步，切换后无需刷新页面。
//
// 状态放在模块级的单一 store 里，而不是每个组件各持一份：
// 消息气泡、工具卡片这类组件会按条渲染，若各自注册 storage 监听，
// 长对话会累积出几十个重复监听器。这里只有一个监听器 + useSyncExternalStore。

import { useCallback, useSyncExternalStore } from 'react'
import {
  UI_LANGUAGE_KEY,
  detectLang,
  loadLangPref,
  resolveLang,
  saveLangPref,
  translate,
  type Lang,
  type LangPref,
  type MessageKey,
} from './i18n'

export interface I18n {
  /** 当前生效的语言 */
  lang: Lang
  /** 用户的偏好，auto 表示跟随 Chrome */
  pref: LangPref
  setPref: (pref: LangPref) => Promise<void>
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

interface LangState {
  pref: LangPref
  lang: Lang
}

// 首帧先用浏览器语言兜底，避免闪一屏默认语言
let state: LangState = { pref: 'auto', lang: detectLang() }
const listeners = new Set<() => void>()
let initialized = false

function emit(): void {
  for (const listener of listeners) listener()
}

function applyPref(pref: LangPref): void {
  const lang = resolveLang(pref)
  if (pref === state.pref && lang === state.lang) return
  state = { pref, lang }
  syncDocumentLang(lang)
  emit()
}

function syncDocumentLang(lang: Lang): void {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
}

/** 首次有组件订阅时启动：读一次偏好，并挂上唯一一个 storage 监听器 */
function initialize(): void {
  if (initialized) return
  initialized = true
  syncDocumentLang(state.lang)

  void loadLangPref().then(applyPref)

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(UI_LANGUAGE_KEY in changes)) return
    const raw = changes[UI_LANGUAGE_KEY]?.newValue
    applyPref(raw === 'zh' || raw === 'en' ? raw : 'auto')
  })
}

function subscribe(listener: () => void): () => void {
  initialize()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): LangState {
  return state
}

export function useI18n(): I18n {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)

  const changePref = useCallback(async (next: LangPref) => {
    // 不在这里 setState：写入 storage 后由 onChanged 统一更新，跨页面天然一致
    await saveLangPref(next)
  }, [])

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) =>
      translate(snapshot.lang, key, vars),
    [snapshot.lang],
  )

  return { lang: snapshot.lang, pref: snapshot.pref, setPref: changePref, t }
}

/** 语言名用于「跟随 Chrome（简体中文）」这种展示，始终用该语言自己的写法 */
export function langDisplayName(lang: Lang): string {
  return lang === 'zh' ? '简体中文' : 'English'
}
