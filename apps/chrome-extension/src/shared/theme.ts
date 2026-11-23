// 主题偏好的读写与解析。
//
// 只有两种真实主题（light / dark），用户偏好多一个 auto（跟随系统）。
// 解析结果通过 <html data-theme> 交给 CSS：auto 时移除该属性，
// 让 :root 的 color-scheme: light dark + light-dark() 自己跟随系统；
// 显式选择时由 theme.css 里的 [data-theme] 规则强制覆盖。

import type { MessageKey } from './i18n'

export type ResolvedTheme = 'light' | 'dark'

/** 用户偏好；auto 表示跟随系统 */
export type ThemePref = 'auto' | ResolvedTheme

/** 主题偏好保存在这里；未设置或值非法时按 auto 处理 */
export const UI_THEME_KEY = 'uiTheme'

export const THEME_PREF_VALUES: readonly ThemePref[] = ['auto', 'light', 'dark']

export function isThemePref(value: unknown): value is ThemePref {
  return value === 'auto' || value === 'light' || value === 'dark'
}

/** 当前系统主题；扩展页面在无 matchMedia 的环境（测试）里按浅色处理 */
export function detectTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(pref: ThemePref): ResolvedTheme {
  return pref === 'auto' ? detectTheme() : pref
}

/** 把偏好写到 <html>；这是主题生效的唯一出口 */
export function applyTheme(pref: ThemePref): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (pref === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)
}

/** 读取用户主题偏好；读不到时按 auto 处理，不让主题阻断页面渲染 */
export async function loadThemePref(): Promise<ThemePref> {
  try {
    const stored = await chrome.storage.local.get(UI_THEME_KEY)
    const value = stored[UI_THEME_KEY]
    return isThemePref(value) ? value : 'auto'
  } catch {
    return 'auto'
  }
}

export async function saveThemePref(pref: ThemePref): Promise<void> {
  await chrome.storage.local.set({ [UI_THEME_KEY]: pref })
}

/** 「跟随系统（深色）」这类展示需要的具体主题名 */
export function themeNameKey(theme: ResolvedTheme): MessageKey {
  return theme === 'dark' ? 'options.themeDark' : 'options.themeLight'
}
