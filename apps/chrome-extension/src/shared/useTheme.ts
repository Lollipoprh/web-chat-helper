// 主题的 React 绑定：读取偏好、订阅 storage 与系统主题变化、把结果写到 <html>。
//
// 与 useI18n 一样用模块级单一 store + useSyncExternalStore：
// 侧边栏一次渲染几十个组件，若各自注册监听器会累积出大量重复回调。
//
// 注意：首次渲染时偏好还是默认值 auto，读到存储后会再更新一次。
// 这段时间内 CSS 的 prefers-color-scheme 已经保证主题正确，不会闪错颜色。

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  UI_THEME_KEY,
  applyTheme,
  detectTheme,
  isThemePref,
  loadThemePref,
  resolveTheme,
  saveThemePref,
  type ResolvedTheme,
  type ThemePref,
} from './theme'

export interface Theme {
  /** 用户的偏好，auto 表示跟随系统 */
  pref: ThemePref
  /** 当前实际生效的主题 */
  resolved: ResolvedTheme
  setPref: (pref: ThemePref) => Promise<void>
}

interface ThemeState {
  pref: ThemePref
  resolved: ResolvedTheme
}

let state: ThemeState = { pref: 'auto', resolved: detectTheme() }
const listeners = new Set<() => void>()
let initialized = false

function emit(): void {
  for (const listener of listeners) listener()
}

function applyPref(pref: ThemePref): void {
  applyTheme(pref)
  const resolved = resolveTheme(pref)
  if (pref === state.pref && resolved === state.resolved) return
  state = { pref, resolved }
  emit()
}

function initialize(): void {
  if (initialized) return
  initialized = true

  applyTheme(state.pref)
  void loadThemePref().then(applyPref)

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(UI_THEME_KEY in changes)) return
    const raw = changes[UI_THEME_KEY]?.newValue
    applyPref(isThemePref(raw) ? raw : 'auto')
  })

  // auto 时系统主题变化要刷新 resolved，让设置页的「跟随系统（深色）」跟着变
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (state.pref === 'auto') applyPref('auto')
    })
  }
}

function subscribe(listener: () => void): () => void {
  initialize()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): ThemeState {
  return state
}

export function useTheme(): Theme {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)

  const changePref = useCallback(async (next: ThemePref) => {
    // 不在这里 setState：写入 storage 后由 onChanged 统一更新，跨页面天然一致
    await saveThemePref(next)
  }, [])

  return { pref: snapshot.pref, resolved: snapshot.resolved, setPref: changePref }
}

/**
 * 挂载时初始化主题 store 的轻量 hook。
 * 只需要主题生效、不关心偏好值的页面（例如侧边栏）用它，避免无谓的重渲染。
 * 系统主题变化由 CSS 的 light-dark() 直接处理，这里不需要再订阅。
 */
export function useApplyTheme(): void {
  useEffect(() => subscribe(() => {}), [])
}
